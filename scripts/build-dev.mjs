import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildUserscript, distPath, repoRoot, rootPath } from "./build.mjs";

async function sha256(path) {
  try {
    return createHash("sha256").update(await readFile(path)).digest("hex");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

const before = new Map([[rootPath, await sha256(rootPath)], [distPath, await sha256(distPath)]]);
const commit = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: repoRoot, encoding: "utf8" }).trim() ? ".dirty" : "";
const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 12);
const version = `7.0.0-dev.${timestamp}`;
const devPath = join(repoRoot, "dist", "dev", "JHS-7.0.dev.user.js");

const transformMetadata = (metadata) => metadata
  .replace(/^\/\/ @name\s+.+$/m, "// @name         JHS Dev 7.0")
  .replace(/^\/\/ @namespace\s+.+$/m, "// @namespace    https://github.com/Teamper/JHS/dev/7.0")
  .replace(/^\/\/ @version\s+.+$/m, `// @version      ${version}`)
  .replace(/^\/\/ @description\s+.+$/m, `// @description  JHS 7.0 migration build ${commit}${dirty}`)
  .replace(/^\/\/ @(downloadURL|updateURL).*(?:\r?\n|$)/gm, "");

const transformBundle = (bundle) => `document.documentElement?.setAttribute("data-jhs-dev-build", ${JSON.stringify(`${version}|${commit}${dirty}`)});\n${bundle}`;
const result = await buildUserscript({ outputPaths: [devPath], transformMetadata, transformBundle });
for (const [path, hash] of before) {
  if (await sha256(path) !== hash) throw new Error(`Dev build modified formal artifact: ${path}`);
}
console.log(`Built dist/dev/JHS-7.0.dev.user.js (${result.outputBytes} bytes, ${commit}${dirty})`);
