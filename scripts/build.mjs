import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = join(repoRoot, "src", "main.js");
const packagePath = join(repoRoot, "package.json");
const distDir = join(repoRoot, "dist");
const distPath = join(distDir, "JHS.user.js");
const rootPath = join(repoRoot, "JHS.user.js");

const source = await readFile(srcPath, "utf8");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const metadataMatch = source.match(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==\r?\n?/m);

if (!metadataMatch) {
  throw new Error("Missing userscript metadata block in src/main.js");
}

const metadata = metadataMatch[0].trimEnd();
const entry = source.slice(metadataMatch[0].length);
const userscriptVersion = metadata.match(/^\/\/ @version\s+(.+)$/m)?.[1];

if (packageJson.version !== userscriptVersion) {
  throw new Error(`Version mismatch: package.json ${packageJson.version}, userscript ${userscriptVersion}`);
}

await esbuild.build({
  stdin: {
    contents: entry,
    loader: "js",
    resolveDir: repoRoot,
    sourcefile: "src/main.js"
  },
  bundle: true,
  write: false,
  format: "iife",
  target: "es2020",
  charset: "utf8",
  legalComments: "none",
  banner: {
    js: metadata
  },
  logLevel: "silent"
});

const output = source.trimEnd() + "\n";

await mkdir(distDir, { recursive: true });
await writeFile(distPath, output, "utf8");
await writeFile(rootPath, output, "utf8");

console.log("Built dist/JHS.user.js and JHS.user.js from src/main.js");
