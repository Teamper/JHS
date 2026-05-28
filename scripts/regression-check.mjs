import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "..");

async function read(relativePath) {
  return readFile(join(repoRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractVersion(source) {
  return source.match(/^\/\/ @version\s+(.+)$/m)?.[1]?.trim();
}

function extractMetadata(source, key) {
  return source.match(new RegExp(`^// @${key}\\s+(.+)$`, "m"))?.[1]?.trim();
}

function extractRegistryArray(registrySource, name) {
  const match = registrySource.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  assert(match, `Missing registry array: ${name}`);
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertIncludes(source, token, label) {
  assert(source.includes(token), `${label} missing token: ${token}`);
}

function hash(source) {
  return createHash("sha256").update(source).digest("hex");
}

const sourceMain = await read("src/main.js");
const rootOutput = await read("JHS.user.js");
const distOutput = await read("dist/JHS.user.js");
const packageJson = JSON.parse(await read("package.json"));
const readme = await read("README.md");
const workflow = await read(".github/workflows/release.yml");
const buildScript = await read("scripts/build.mjs");
const storage = await read("src/core/storage.js");
const eventBus = await read("src/core/event-bus.js");
const registry = await read("src/plugins/registry.js");

const version = extractVersion(sourceMain);
assert(version, "Cannot read userscript version from src/main.js");
assert(packageJson.version === version, "package.json version does not match userscript version");
assert(extractVersion(rootOutput) === version, "root JHS.user.js version does not match src/main.js");
assert(extractVersion(distOutput) === version, "dist/JHS.user.js version does not match src/main.js");
assert(readme.includes(`当前发布版为 \`${version}\``), "README current version does not match userscript version");
assert(hash(rootOutput) === hash(distOutput), "dist/JHS.user.js and root JHS.user.js are not byte-identical");

assert(extractMetadata(rootOutput, "name") === "JHS-YA", "userscript @name changed");
assert(
  extractMetadata(rootOutput, "namespace") === "https://sleazyfork.org/zh-CN/scripts/578503-jhs-ya",
  "userscript @namespace changed"
);
assert(
  extractMetadata(rootOutput, "downloadURL") === "https://github.com/Yaoser-x/JHS/releases/latest/download/JHS.user.js",
  "userscript @downloadURL changed"
);
assert(
  extractMetadata(rootOutput, "updateURL") === "https://raw.githubusercontent.com/Yaoser-x/JHS/main/JHS.user.js",
  "userscript @updateURL changed"
);

assertIncludes(workflow, "npm run check", "release workflow");
assertIncludes(workflow, "当前发布版为 \\`$version\\`", "release workflow README gate");
assertIncludes(workflow, "- main", "release workflow main branch");
assertIncludes(workflow, "- dev", "release workflow dev branch");
assertIncludes(workflow, "JHS-dev.user.js", "release workflow dev artifact");
assertIncludes(workflow, "actions/upload-artifact@v4", "release workflow dev artifact upload");
assertIncludes(workflow, "gh release create", "release workflow main release");
assertIncludes(workflow, "gh release upload", "release workflow main release update");
assertIncludes(workflow, "JHS.user.js --clobber", "release workflow release artifact overwrite");

const stableReleaseChecks = [
  ["storage database identity", storage, 'name: "JAV-JHS"'],
  ["storage database identity", storage, 'storeName: "appData"'],
  ["storage key identity", storage, 'i(this, "car_list_key", "car_list")'],
  ["storage key identity", storage, 'i(this, "favorite_actresses_key", "favorite_actresses")'],
  ["storage key identity", storage, 'i(this, "blacklist_key", "blacklist")'],
  ["storage key identity", storage, 'i(this, "blacklist_car_list_key", "blacklist_car_list")'],
  ["third-party cache identity", storage, 'i(this, "third_party_cache_key", "third_party_ttl_cache")'],
  ["import format compatibility", storage, "async importData(e)"],
  ["import format compatibility", storage, "for (const n in e)"],
  ["import format compatibility", storage, "this._setItemAndInvalidate(n, a)"],
  ["export format compatibility", storage, "async exportData()"],
  ["export format compatibility", storage, "this.forage.iterate"],
  ["build source chain", buildScript, 'const srcPath = join(repoRoot, "src", "main.js")'],
  ["build source chain", buildScript, "const corePaths = ["],
  ["build source chain", buildScript, 'join(repoRoot, "src", "core", file)'],
  ["build source chain", buildScript, "const pluginPaths = ["],
  ["build source chain", buildScript, 'join(repoRoot, "src", "plugins", file)'],
  ["build output chain", buildScript, 'const distPath = join(distDir, "JHS.user.js")'],
  ["build output chain", buildScript, 'const rootPath = join(repoRoot, "JHS.user.js")'],
  ["build output chain", buildScript, 'writeFile(distPath, output, "utf8")'],
  ["build output chain", buildScript, 'writeFile(rootPath, output, "utf8")']
];

for (const [label, source, token] of stableReleaseChecks) {
  assertIncludes(source, token, label);
}

assertIncludes(eventBus, 'new BroadcastChannel("channel-refresh")', "event bus");
assertIncludes(eventBus, 'type: "refresh"', "event bus");
assertIncludes(eventBus, 'type: "cleanCache_filter_actor_actress_car_list"', "event bus");
assertIncludes(eventBus, 'type: "clean_cacheSettingObj"', "event bus");
assert(!rootOutput.includes("new BroadcastChannel(channel-refresh)"), "generated output contains unquoted channel-refresh");
assert(!rootOutput.includes("type: refresh"), "generated output contains unquoted refresh message type");

const expectedPlugins = [
  ["status/detail-page.js", "Q", "DetailPagePlugin"],
  ["image-viewer/preview-video.js", "ae", "PreviewVideoPlugin"],
  ["external-search/javtrailers.js", "oe", "JavTrailersPlugin"],
  ["subtitle/subtitle-cat.js", "re", "SubTitleCatPlugin"],
  ["external-search/fc2.js", "le", "Fc2Plugin"],
  ["status/highlight-magnet.js", "ce", "HighlightMagnetPlugin"],
  ["status/fold-category.js", "de", "FoldCategoryPlugin"],
  ["avatar/actress-info.js", "he", "ActressInfoPlugin"],
  ["external-search/hit-show.js", "pe", "HitShowPlugin"],
  ["external-search/top250.js", "ue", "TOP250Plugin"],
  ["status/nav-bar.js", "fe", "NavBarPlugin"],
  ["external-search/other-site.js", "be", "OtherSitePlugin"],
  ["status/bus-detail-page.js", "we", "BusDetailPagePlugin"],
  ["status/detail-page-button.js", "ye", "DetailPageButtonPlugin"],
  ["status/history.js", "xe", "HistoryPlugin"],
  ["external-search/review.js", "$e", "ReviewPlugin"],
  ["blacklist/filter-title-keyword.js", "ke", "FilterTitleKeywordPlugin"],
  ["blacklist/blacklist.js", "Se", "BlacklistPlugin"],
  ["status/list-page-button.js", "Ce", "ListPageButtonPlugin"],
  ["status/list-page.js", "Ie", "ListPagePlugin"],
  ["status/auto-page.js", "Be", "AutoPagePlugin"],
  ["backup/setting.js", "Ae", "SettingPlugin"],
  ["image-viewer/bus-preview-video.js", "je", "BusPreviewVideoPlugin"],
  ["avatar/search-by-image.js", "Ee", "SearchByImagePlugin"],
  ["status/bus-nav-bar.js", "Fe", "BusNavBarPlugin"],
  ["external-search/related.js", "He", "RelatedPlugin"],
  ["status/want-and-watched-videos.js", "ze", "WantAndWatchedVideosPlugin"],
  ["image-viewer/cover-button.js", "Ue", "CoverButtonPlugin"],
  ["external-search/fc2-by-123av.js", "Oe", "Fc2By123AvPlugin"],
  ["external-search/magnet-hub.js", "Re", "MagnetHubPlugin"],
  ["image-viewer/screenshot.js", "Ve", "ScreenShotPlugin"],
  ["favorite/favorite-actresses.js", "Xe", "FavoriteActressesPlugin"],
  ["image-viewer/bus-img.js", "Qe", "BusImgPlugin"],
  ["translate/translate.js", "Ze", "TranslatePlugin"],
  ["new-video/task.js", "et", "TaskPlugin"],
  ["new-video/new-video.js", "pt", "NewVideoPlugin"],
  ["backup/local.js", "mt", "LocalPlugin"],
  ["one-two-three/offline.js", "OneTwoThreeOfflinePlugin", "OneTwoThreeOfflinePlugin"],
  ["stats/stats.js", "StatsPlugin", "StatsPlugin"]
];

const mainClassMatches = sourceMain.match(/^class\s+[\w$]+\s+extends\s+X\s*\{/gm) || [];
assert(mainClassMatches.length === 0, "src/main.js still contains plugin classes");

for (const [file, className, pluginName] of expectedPlugins) {
  const source = await read(`src/plugins/${file}`);
  await stat(join(repoRoot, "src", "plugins", file));
  assertIncludes(source, `class ${className} extends X`, file);
  assertIncludes(source, `return "${pluginName}"`, file);
}

const javdbPlugins = extractRegistryArray(registry, "DEFAULT_JAVDB_PLUGINS");
const javbusPlugins = extractRegistryArray(registry, "DEFAULT_JAVBUS_PLUGINS");
assert(
  javdbPlugins.join(",") === "Ie,Be,le,de,Ce,xe,Ae,fe,pe,ue,Ee,Ue,Oe,Q,$e,He,ye,ce,ae,ke,he,be,Ze,ze,Re,Ve,Se,Xe,pt,et,mt,StatsPlugin",
  "JavDB plugin registration order changed"
);
assert(
  javbusPlugins.join(",") === "Ie,Ce,Ae,xe,Be,Ee,Fe,Ue,Qe,we,ye,$e,ke,ce,je,Re,Ve,be,Ze,Se,et,StatsPlugin",
  "JavBus plugin registration order changed"
);
assertIncludes(registry, 'hostname.includes("123pan.com")', "shared registry");
assertIncludes(registry, "plugins: [ OneTwoThreeOfflinePlugin ]", "shared registry");
assertIncludes(registry, 'hostname.includes("javtrailers")', "shared registry");
assertIncludes(registry, 'hostname.includes("subtitlecat")', "shared registry");

const sourceByFile = new Map();
for (const [file] of expectedPlugins) {
  sourceByFile.set(file, await read(`src/plugins/${file}`));
}
sourceByFile.set("core/storage.js", storage);
sourceByFile.set("core/logger.js", await read("src/core/logger.js"));
sourceByFile.set("core/javdb-api.js", await read("src/core/javdb-api.js"));
sourceByFile.set("core/http.js", await read("src/core/http.js"));
sourceByFile.set("core/event-bus.js", await read("src/core/event-bus.js"));
sourceByFile.set("core/plugin-manager.js", await read("src/core/plugin-manager.js"));

const regressionMatrix = [
  ["JavDB 列表页", [["status/list-page.js", "filterMovieList"], ["status/list-page-button.js", "ListPageButtonPlugin"], ["image-viewer/cover-button.js", "CoverButtonPlugin"], ["core/storage.js", "getStatusMap"]]],
  ["JavDB 详情页", [["status/detail-page.js", "DetailPagePlugin"], ["status/detail-page-button.js", "showStatus"], ["image-viewer/preview-video.js", "PreviewVideoPlugin"]]],
  ["JavDB 演员页", [["favorite/favorite-actresses.js", "FavoriteActressesPlugin"], ["avatar/actress-info.js", "ActressInfoPlugin"], ["core/plugin-manager.js", "getActressPageInfo"]]],
  ["JavBus 列表页", [["status/list-page.js", "fixBusTitleBox"], ["image-viewer/bus-img.js", "BusImgPlugin"], ["status/list-page-button.js", "ListPageButtonPlugin"]]],
  ["JavBus 详情页", [["status/bus-detail-page.js", "BusDetailPagePlugin"], ["image-viewer/bus-preview-video.js", "BusPreviewVideoPlugin"], ["status/bus-nav-bar.js", "BusNavBarPlugin"]]],
  ["123pan 授权同步", [["one-two-three/offline.js", "startTokenSync"], ["one-two-three/offline.js", "visibilitychange"], ["one-two-three/offline.js", "syncFallbackMs = 3e5"]]],
  ["123 离线提交", [["one-two-three/offline.js", "submitMagnet"], ["one-two-three/offline.js", "resolveMagnet"], ["one-two-three/offline.js", "markCurrentVideoAsHasDown"]]],
  ["新作品检测", [["new-video/task.js", "TaskPlugin"], ["new-video/new-video.js", "NewVideoPlugin"], ["core/storage.js", "newVideoList"]]],
  ["黑名单检测", [["blacklist/blacklist.js", "BlacklistPlugin"], ["blacklist/filter-title-keyword.js", "FilterTitleKeywordPlugin"], ["core/storage.js", "batchSaveBlacklistCarList"]]],
  ["统计面板", [["stats/stats.js", "StatsPlugin"], ["stats/stats.js", "getPendingNewVideoCount"], ["core/storage.js", "getStatusMap"]]],
  ["数据导入导出", [["backup/setting.js", "importData"], ["backup/setting.js", "exportData"], ["core/storage.js", "exportData"]]],
  ["WebDAV 备份", [["backup/setting.js", "class De"], ["backup/setting.js", "backupDataByWebDav"], ["backup/setting.js", "PROPFIND"]]],
  ["快捷键", [["status/list-page.js", "bindListPageHotKey"], ["external-search/javtrailers.js", "registerHotkey"], ["backup/setting.js", "hotkey-panel"]]],
  ["图片查看器", [["core/logger.js", "showImageViewer"], ["core/logger.js", "new Viewer"], ["image-viewer/screenshot.js", "ScreenShotPlugin"]]],
  ["第三方请求失败场景", [["core/storage.js", "cachedRequest"], ["core/http.js", "onerror"], ["external-search/other-site.js", "detectOtherSites"]]],
  ["多标签页同步", [["core/event-bus.js", "BroadcastChannel"], ["status/list-page.js", "channel-refresh"], ["status/list-page.js", "clean_cacheSettingObj"]]]
];

for (const [scope, checks] of regressionMatrix) {
  for (const [file, token] of checks) {
    const source = sourceByFile.get(file);
    assert(source, `${scope} references unknown file ${file}`);
    assertIncludes(source, token, scope);
  }
}

console.log(
  `Regression checks passed for ${version}: ${expectedPlugins.length} plugins, ${regressionMatrix.length} scopes, ${stableReleaseChecks.length} stable release checks`
);
