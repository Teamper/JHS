import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildThemeCss, JHS_Z_INDEX } from "../src/core/theme.js";
import { evaluateBundleBudget, formatBundleBudget } from "./bundle-budget.mjs";
import { readDevIdentity } from "./dev-metadata.mjs";

function checkMetadata(source, label, expected) {
  const header = source.match(/^\/\/ ==UserScript==\r?\n([\s\S]*?)^\/\/ ==\/UserScript==$/m)?.[1];
  assert(header, `${label} is missing its userscript header`);
  const fields = [...header.matchAll(/^\/\/ @(\w+)[ \t]+([^\r\n]+)$/gm)];
  for (const [key, value] of Object.entries(expected)) {
    const values = fields.filter(field => field[1] === key).map(field => field[2].trim());
    assert.deepEqual(values, value === null ? [] : [value], `${label} has unexpected @${key}`);
  }
  return fields;
}

export async function checkReleaseInvariants(root = join(import.meta.dirname, "..")) {
  const read = file => readFile(join(root, file), "utf8");
  const [release, dev, budgetSource] = await Promise.all([
    read("JHS.user.js"), read("dist/dev/JHS-7.0.dev.user.js"), read("performance-budget.json"),
  ]);
  const releaseFields = checkMetadata(release, "Release artifact", {
    name: "JHS",
    namespace: "https://sleazyfork.org/zh-CN/scripts/578503-jhs-ya",
    author: "JHS Contributors",
    homepageURL: "https://github.com/Teamper/JHS",
    supportURL: "https://github.com/Teamper/JHS/issues",
    downloadURL: "https://github.com/Teamper/JHS/releases/latest/download/JHS.user.js",
    updateURL: "https://raw.githubusercontent.com/Teamper/JHS/main/JHS.user.js",
  });
  assert(releaseFields.some(([, key, value]) => key === "description" && value.startsWith("JAV Helper Suite：")),
    "Release artifact has an unexpected @description");
  const { version: devVersion } = readDevIdentity(dev);
  checkMetadata(dev, "Dev artifact", {
    name: "JHS Dev 7.0",
    namespace: "https://github.com/Teamper/JHS/dev/7.0",
    version: devVersion,
    downloadURL: null,
    updateURL: null,
  });
  assert(dev.includes("data-jhs-dev-build") && !release.includes("data-jhs-dev-build"), "Dev runtime marker must stay isolated");
  for (const brand of ["JHS-YA", "鉴黄师", "Yaoser"]) {
    assert(!release.includes(brand) && !dev.includes(brand), `Userscript artifact contains legacy brand: ${brand}`);
  }

  const result = evaluateBundleBudget(Buffer.byteLength(dev), JSON.parse(budgetSource).bundle);
  const message = formatBundleBudget("Dev artifact", result);
  if (result.status === "exceeded") throw new Error(`${message}; review bundle growth or justify a budget change`);
  if (result.status === "warning") {
    console.warn(`${process.env.GITHUB_ACTIONS === "true" ? "::warning::" : ""}${message}; explain growth and attach npm run analyze:bundle output for module cost review`);
  } else {
    console.log(message);
  }

  const expectedZIndices = Object.fromEntries(Object.entries(JHS_Z_INDEX).map(([key, value]) => [
    `--jhs-z-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, String(value),
  ]));
  const cssZIndices = Object.fromEntries([...buildThemeCss().matchAll(/(--jhs-z-[\w-]+)\s*:\s*([^;]+);/g)]
    .map(([, name, value]) => [name, value.trim()]));
  assert.deepEqual(cssZIndices, expectedZIndices, "Theme CSS z-index tokens must match JHS_Z_INDEX");

  const rules = [
    [/\bcatch\s*(?:\([^)]*\)\s*)?\{\s*\}/, "contains an undocumented empty catch block"],
    [/\bz-index\s*:\s*[-+]?(?:\d|\.\d)|\bzIndex\s*:\s*[-+]?(?:\d|\.\d)/i, "contains a numeric z-index"],
    [/\sstyle\s*=\s*["'`]/, "contains a static inline style"],
  ];
  const consoleOwners = new Set(["src/core/logger.js", "src/app/bootstrap.js"]);
  const declared = new Set();
  const referenced = new Map();
  const failures = [];
  const entries = await readdir(join(root, "src"), { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const file = join(entry.parentPath, entry.name);
    const label = relative(root, file).replaceAll("\\", "/");
    const source = await readFile(file, "utf8");
    for (const [pattern, reason] of rules) {
      if (pattern.test(source)) failures.push(`${label} ${reason}`);
    }
    if (/\bconsole\.log\s*\(/.test(source) || (!consoleOwners.has(label) && /\bconsole\.(?:warn|error)\s*\(/.test(source))) {
      failures.push(`${label} bypasses the shared logger`);
    }
    for (const [, name] of source.matchAll(/(--jhs-[\w-]+)\s*:/g)) declared.add(name);
    for (const [, name] of source.matchAll(/\.setProperty\(\s*["'](--jhs-[\w-]+)["']/g)) declared.add(name);
    for (const [, name] of source.matchAll(/var\(\s*(--jhs-[\w-]+)\s*\)/g)) referenced.set(name, label);
    for (const [, key] of source.matchAll(/\bJHS_Z_INDEX\.([\w$]+)/g)) {
      if (!Object.hasOwn(JHS_Z_INDEX, key)) failures.push(`${label} references unknown z-index token ${key}`);
    }
    for (const [, , classes] of source.matchAll(/\bclass\s*=\s*(["'])([^\r\n]*?)\1/g)) {
      const names = classes.split(/\s+/);
      if (names.includes("jhs-btn") && names.some(name => /^(?:button|is-(?:info|small|primary|success|danger|warning))$/.test(name))) {
        failures.push(`${label} mixes JHS and Bulma button classes`);
      }
    }
  }
  for (const [name, label] of referenced) {
    if (!declared.has(name)) failures.push(`${label} references undeclared CSS token ${name}`);
  }
  if (failures.length) throw new Error(failures.join("\n"));
  console.log("Release invariants passed: artifact identities, CSS tokens and source safety rules");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await checkReleaseInvariants();
