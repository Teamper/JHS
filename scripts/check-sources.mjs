import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = join(import.meta.dirname, "..");

async function listJavaScriptFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listJavaScriptFiles(fullPath);
    }
    return entry.isFile() && /\.(mjs|js)$/.test(entry.name) ? [fullPath] : [];
  }));
  return files.flat();
}

const sourceFiles = [
  ...(await listJavaScriptFiles(join(repoRoot, "src"))),
  ...(await listJavaScriptFiles(join(repoRoot, "scripts")))
];

let hasError = false;

for (const file of sourceFiles) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: repoRoot,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    hasError = true;
    console.error(`Syntax check failed: ${relative(repoRoot, file)}`);
  }
}

if (hasError) {
  process.exit(1);
}
