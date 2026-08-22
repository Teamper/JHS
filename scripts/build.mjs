import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = join(repoRoot, "src", "main.js");
const packagePath = join(repoRoot, "package.json");
const corePaths = [
  "site-context.js",
  "cache-policy.js",
  "feature-helpers.js",
  "constants.js",
  "theme.js",
  "ui-primitives.js",
  "css-injection.js",
  "storage-index.js",
  "state-model.js",
  "storage.js",
  "migration.js",
  "javdb-api.js",
  "utils.js",
  "http.js",
  "event-bus.js",
  "state-service.js",
  "detail-state-controller.js",
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
  "backup/webdav-client.js",
  "backup/setting-styles.js",
  "backup/resource-settings.js",
  "backup/setting-templates.js",
  "backup/setting-panels.js",
  "backup/setting-forms.js",
  "backup/setting-backup.js",
  "backup/setting.js",
  "image-viewer/bus-preview-video.js",
  "avatar/search-by-image.js",
  "status/bus-nav-bar.js",
  "external-search/related.js",
  "status/want-and-watched-videos.js",
  "image-viewer/cover-button.js",
  "external-search/fc2-by-123av.js",
  "external-search/magnet-source-registry.js",
  "external-search/magnet-hub.js",
  "image-viewer/screenshot-provider-registry.js",
  "image-viewer/screenshot.js",
  "favorite/favorite-actresses.js",
  "image-viewer/bus-img.js",
  "translate/translate.js",
  "new-video/task.js",
  "new-video/new-video.js",
  "one-two-three/offline.js",
  "one-one-five/client.js",
  "one-one-five/plugins.js",
  "offline/unified-offline.js",
  "stats/stats.js",
  "status/mobile-bottom-bar.js",
  "status/detail-workspace.js",
  "status/compat-enhancements.js",
  "registry.js"
].map((file) => join(repoRoot, "src", "plugins", file));
const parserPaths = [
  "third-party-parsers.js"
].map((file) => join(repoRoot, "src", "parsers", file));
const distDir = join(repoRoot, "dist");
const distPath = join(distDir, "JHS.user.js");
const rootPath = join(repoRoot, "JHS.user.js");

const source = await readFile(srcPath, "utf8");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const coreSources = await Promise.all(corePaths.map((file) => readFile(file, "utf8")));
const parserSources = await Promise.all(parserPaths.map((file) => readFile(file, "utf8")));
const pluginSources = await Promise.all(pluginPaths.map((file) => readFile(file, "utf8")));
const metadataMatch = source.match(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==\r?\n?/m);

if (!metadataMatch) {
  throw new Error("Missing userscript metadata block in src/main.js");
}

const metadata = metadataMatch[0].trimEnd();
const mainEntry = source.slice(metadataMatch[0].length).trimStart();
const entry = [
  ...coreSources.map((item) => item.trimEnd()),
  ...parserSources.map((item) => item.trimEnd()),
  ...pluginSources.map((item) => item.trimEnd()),
  mainEntry.trimEnd()
].join("\n\n") + "\n";
const userscriptVersion = metadata.match(/^\/\/ @version\s+(.+)$/m)?.[1];

if (packageJson.version !== userscriptVersion) {
  throw new Error(`Version mismatch: package.json ${packageJson.version}, userscript ${userscriptVersion}`);
}

const buildResult = await esbuild.build({
  stdin: {
    contents: entry,
    loader: "js",
    sourcefile: "src/main.js",
    resolveDir: repoRoot
  },
  bundle: true,
  format: "iife",
  target: "es2020",
  charset: "utf8",
  legalComments: "none",
  keepNames: true,
  minifySyntax: false,
  minifyWhitespace: false,
  minifyIdentifiers: false,
  write: false,
  logLevel: "silent"
});

const readableBundle = buildResult.outputFiles[0].text.trimStart().split(/\r?\n/).map((line) => line.trimEnd()).join("\n");
const output = `${metadata}\n\n${readableBundle}`;
const outputBytes = Buffer.byteLength(output, "utf8");

await mkdir(distDir, { recursive: true });
await writeFile(distPath, output, "utf8");
await writeFile(rootPath, output, "utf8");

console.log(`Built dist/JHS.user.js and JHS.user.js (${outputBytes} bytes)`);
