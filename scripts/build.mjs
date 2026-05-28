import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = join(repoRoot, "src", "main.js");
const packagePath = join(repoRoot, "package.json");
const corePaths = [
  "constants.js",
  "storage-index.js",
  "storage.js",
  "javdb-api.js",
  "utils.js",
  "http.js",
  "event-bus.js",
  "logger.js",
  "plugin-manager.js"
].map((file) => join(repoRoot, "src", "core", file));
const pluginPaths = [
  "status/detail-page.js",
  "image-viewer/preview-video.js",
  "external-search/javtrailers.js",
  "subtitle/subtitle-cat.js",
  "external-search/fc2.js",
  "status/highlight-magnet.js",
  "status/fold-category.js",
  "avatar/actress-info.js",
  "external-search/hit-show.js",
  "external-search/top250.js",
  "status/nav-bar.js",
  "external-search/other-site.js",
  "status/bus-detail-page.js",
  "status/detail-page-button.js",
  "status/history.js",
  "external-search/review.js",
  "blacklist/filter-title-keyword.js",
  "blacklist/blacklist.js",
  "status/list-page-button.js",
  "status/list-page.js",
  "status/auto-page.js",
  "backup/setting.js",
  "image-viewer/bus-preview-video.js",
  "avatar/search-by-image.js",
  "status/bus-nav-bar.js",
  "external-search/related.js",
  "status/want-and-watched-videos.js",
  "image-viewer/cover-button.js",
  "external-search/fc2-by-123av.js",
  "external-search/magnet-hub.js",
  "image-viewer/screenshot.js",
  "favorite/favorite-actresses.js",
  "image-viewer/bus-img.js",
  "translate/translate.js",
  "new-video/task.js",
  "new-video/new-video.js",
  "backup/local.js",
  "one-two-three/offline.js",
  "stats/stats.js",
  "registry.js"
].map((file) => join(repoRoot, "src", "plugins", file));
const distDir = join(repoRoot, "dist");
const distPath = join(distDir, "JHS.user.js");
const rootPath = join(repoRoot, "JHS.user.js");

const source = await readFile(srcPath, "utf8");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const coreSources = await Promise.all(corePaths.map((file) => readFile(file, "utf8")));
const pluginSources = await Promise.all(pluginPaths.map((file) => readFile(file, "utf8")));
const metadataMatch = source.match(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==\r?\n?/m);

if (!metadataMatch) {
  throw new Error("Missing userscript metadata block in src/main.js");
}

const metadata = metadataMatch[0].trimEnd();
const mainEntry = source.slice(metadataMatch[0].length).trimStart();
const entry = [
  ...coreSources.map((item) => item.trimEnd()),
  ...pluginSources.map((item) => item.trimEnd()),
  mainEntry.trimEnd()
].join("\n\n") + "\n";
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

const output = `${metadata}\n\n${entry}`;

await mkdir(distDir, { recursive: true });
await writeFile(distPath, output, "utf8");
await writeFile(rootPath, output, "utf8");

console.log("Built dist/JHS.user.js and JHS.user.js from src/core, src/plugins, and src/main.js");
