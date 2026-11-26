import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildUserscript, distPath, repoRoot, rootPath } from "./build.mjs";
import { createDevTransforms } from "./dev-metadata.mjs";
import { readFileHash } from "./delivery-artifact.mjs";

const before = new Map([[rootPath, await readFileHash(rootPath)], [distPath, await readFileHash(distPath)]]);
const commit = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: repoRoot, encoding: "utf8" }).trim() ? ".dirty" : "";
const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 12);
const version = `7.0.0-dev.${timestamp}`;
const devPath = join(repoRoot, "dist", "dev", "JHS-7.0.dev.user.js");
const deliver = process.argv.includes("--deliver");
const deliveryPath = join(repoRoot, "JHS-7.0.dev.user.js");

const { transformMetadata, transformBundle } = createDevTransforms(version, commit + dirty);
const packStaticResources = process.env.JHS_PACK_STATIC_RESOURCES !== "0";
const result = await buildUserscript({ outputPaths: deliver ? [devPath, deliveryPath] : [devPath], transformMetadata, transformBundle, packStaticResources });
const report = { ...result.analysis, version, buildId: commit + dirty, artifactPath: devPath, deliveryUpdated: deliver, deliveryPath, deliverySha256: await readFileHash(deliveryPath) };
await writeFile(join(repoRoot, "dist", "dev", "JHS-7.0.dev.size.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
for (const [path, hash] of before) {
  if (await readFileHash(path) !== hash) throw new Error(`Dev build modified formal artifact: ${path}`);
}
console.log(`Built dist/dev/JHS-7.0.dev.user.js (${result.outputBytes} bytes, ${commit}${dirty})`);
console.log(`Static resources: ${packStaticResources ? "packed" : "unpacked"}; SHA256 ${result.analysis.sha256}`);
if (deliver) console.log("Updated JHS-7.0.dev.user.js for development delivery");
