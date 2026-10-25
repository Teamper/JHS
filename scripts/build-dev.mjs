import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildUserscript, distPath, repoRoot, rootPath } from "./build.mjs";
import { createDevTransforms } from "./dev-metadata.mjs";

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
const deliver = process.argv.includes("--deliver");
const deliveryPath = join(repoRoot, "JHS-7.0.dev.user.js");

const { transformMetadata, transformBundle } = createDevTransforms(version, commit + dirty);
// Validation can opt in before the default changes; the common/release builder remains unpacked.
const packStaticResources = process.env.JHS_PACK_STATIC_RESOURCES === "1";
const result = await buildUserscript({ outputPaths: deliver ? [devPath, deliveryPath] : [devPath], transformMetadata, transformBundle, packStaticResources });
await writeFile(join(repoRoot, "dist", "dev", "JHS-7.0.dev.size.json"), JSON.stringify(result.analysis, null, 2) + "\n", "utf8");
for (const [path, hash] of before) {
  if (await sha256(path) !== hash) throw new Error(`Dev build modified formal artifact: ${path}`);
}
console.log(`Built dist/dev/JHS-7.0.dev.user.js (${result.outputBytes} bytes, ${commit}${dirty})`);
if (deliver) console.log("Updated JHS-7.0.dev.user.js for development delivery");
