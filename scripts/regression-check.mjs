import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
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
const ciWorkflow = await read(".github/workflows/ci.yml");
const buildScript = await read("scripts/build.mjs");
const storage = await read("src/core/storage.js");
const eventBus = await read("src/core/event-bus.js");
const stateModel = await read("src/core/state-model.js");
const migration = await read("src/core/migration.js");
const stateService = await read("src/core/state-service.js");
const registry = await read("src/plugins/registry.js");
const detailWorkspace = await read("src/plugins/status/detail-workspace.js");
const unifiedOffline = await read("src/plugins/offline/unified-offline.js");
const hitShow = await read("src/plugins/external-search/hit-show.js");
const listPageButton = await read("src/plugins/status/list-page-button.js");
const fc2 = await read("src/plugins/external-search/fc2.js");
const fc2By123Av = await read("src/plugins/external-search/fc2-by-123av.js");
const uiPrimitives = await read("src/core/ui-primitives.js");
const history = await read("src/plugins/status/history.js");
const statusImport = await read("src/plugins/status/want-and-watched-videos.js");
const review = await read("src/plugins/external-search/review.js");
const related = await read("src/plugins/external-search/related.js");
const one23Offline = await read("src/plugins/one-two-three/offline.js");
const one115Offline = await read("src/plugins/one-one-five/plugins.js");
const statsSource = await read("src/plugins/stats/stats.js");
const mobileSource = await read("src/plugins/status/mobile-bottom-bar.js");
const settingFormsSource = await read("src/plugins/backup/setting-forms.js");
const settingTemplatesSource = await read("src/plugins/backup/setting-templates.js");
const magnetHubSource = await read("src/plugins/external-search/magnet-hub.js");
const newVideoTaskSource = await read("src/plugins/new-video/task.js");
const compatibilitySource = await read("src/plugins/status/compat-enhancements.js");
const themeSource = await read("src/core/theme.js");

const version = packageJson.version;
assert(hash(rootOutput) === hash(distOutput), "dist/JHS.user.js and root JHS.user.js are not byte-identical");
assert(Buffer.byteLength(rootOutput, "utf8") < 2_000_000, "generated userscript exceeds Sleazy Fork 2 MB limit");

assert(extractMetadata(rootOutput, "name") === "JHS", "userscript @name changed");
assert(extractMetadata(rootOutput, "author") === "JHS Contributors", "userscript @author changed");
assert(
  extractMetadata(rootOutput, "description")?.startsWith("JAV Helper Suite："),
  "userscript @description changed"
);
assert(
  extractMetadata(rootOutput, "namespace") === "https://sleazyfork.org/zh-CN/scripts/578503-jhs-ya",
  "userscript @namespace changed"
);
assert(
  extractMetadata(rootOutput, "homepageURL") === "https://github.com/Teamper/JHS",
  "userscript @homepageURL changed"
);
assert(
  extractMetadata(rootOutput, "supportURL") === "https://github.com/Teamper/JHS/issues",
  "userscript @supportURL changed"
);
assert(
  extractMetadata(rootOutput, "downloadURL") === "https://github.com/Teamper/JHS/releases/latest/download/JHS.user.js",
  "userscript @downloadURL changed"
);
assert(
  extractMetadata(rootOutput, "updateURL") === "https://raw.githubusercontent.com/Teamper/JHS/main/JHS.user.js",
  "userscript @updateURL changed"
);

const legacyBrands = [
  ["JHS", "YA"].join("-"),
  ["鉴", "黄", "师"].join(""),
  ["Yao", "ser"].join("")
];
for (const legacyBrand of legacyBrands) {
  assert(!rootOutput.includes(legacyBrand), `generated userscript contains legacy brand: ${legacyBrand}`);
}

assertIncludes(ciWorkflow, "npm run check", "CI workflow");
assertIncludes(ciWorkflow, "git diff --exit-code -- JHS.user.js", "CI tracked artifact check");
assertIncludes(ciWorkflow, "workflow_dispatch:", "release recovery trigger");
assertIncludes(ciWorkflow, "node-version: 20", "minimum Node compatibility check");
assertIncludes(ciWorkflow, "node-version: 22", "full Node check");
assertIncludes(ciWorkflow, "needs: [node20, check]", "release check dependency");
assertIncludes(ciWorkflow, "contents: write", "release write permission");
assertIncludes(ciWorkflow, "--base-ref", "version-change release detection");
assertIncludes(ciWorkflow, "--force-release", "release recovery contract");
assertIncludes(ciWorkflow, "queue: max", "release concurrency queue");
assertIncludes(ciWorkflow, "cancel-in-progress: false", "release concurrency preservation");
assertIncludes(ciWorkflow, "git tag -a", "annotated release tag");
assertIncludes(ciWorkflow, "gh release create", "immutable release creation");
assert(!ciWorkflow.includes("--clobber"), "release workflow must not overwrite an existing asset");
assert(!ciWorkflow.includes("gh release upload"), "release workflow must not update an existing release");
assert(!ciWorkflow.includes("JHS-dev.user.js"), "release workflow must not build dev artifacts");
assertIncludes(buildScript, "bundle: true", "readable bundled build");
assertIncludes(buildScript, "keepNames: true", "readable bundled build");
assertIncludes(buildScript, "minifySyntax: false", "readable bundled build");
assertIncludes(buildScript, "minifyWhitespace: false", "readable bundled build");
assertIncludes(buildScript, "minifyIdentifiers: false", "readable bundled build");

const stableReleaseChecks = [
  ["storage database identity", storage, 'name: "JAV-JHS"'],
  ["storage database identity", storage, 'storeName: "appData"'],
  ["storage key identity", storage, 'i(this, "car_list_key", "car_list")'],
  ["storage key identity", storage, 'i(this, "favorite_actresses_key", "favorite_actresses")'],
  ["storage key identity", storage, 'i(this, "blacklist_key", "blacklist")'],
  ["storage key identity", storage, 'i(this, "blacklist_car_list_key", "blacklist_car_list")'],
  ["third-party cache identity", storage, 'i(this, "third_party_cache_key", "third_party_ttl_cache")'],
  ["import format compatibility", storage, "async importData(e)"],
  ["import format compatibility", migration, "validatePortableData"],
  ["import format compatibility", storage, "runDataMigrations(this)"],
  ["export format compatibility", storage, "async exportData()"],
  ["export format compatibility", storage, "exportPortableData"],
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

for (const token of ["eventId", "originId", "timestamp", "this.seen", "options.broadcast", '"legacy-refresh"']) {
  assertIncludes(eventBus, token, "precise event bus");
}
assertIncludes(eventBus, "event.originId === this.originId", "self-event suppression");
assertIncludes(eventBus, "this._dispatch(event)", "received events stay local");
assert(!eventBus.includes("this.channel.postMessage(event);\n        await this._dispatch(event)"), "received events must not be rebroadcast");

// List page function signature assertions
const listPageSource = await read("src/plugins/status/list-page.js");
assertIncludes(listPageSource, "applyVisibility()", "list page function signature");
assertIncludes(listPageSource, "async filterMovieList(", "list page function signature");
assertIncludes(listPageSource, "async doFilter()", "list page function signature");
assertIncludes(detailWorkspace, 'controller.find("#magnets-content")', "protected JavDB resource boundary");
assert(!/routeSections|moveToSection|movePanelToSection/.test(detailWorkspace), "detail workspace must not remount host sections");
assertIncludes(detailWorkspace, 'jhsEventBus.emit("magnet-items-updated"', "magnet lifecycle event");
assertIncludes(detailWorkspace, "{ broadcast: !1 }", "DOM lifecycle events must stay local");
assert(!/\.jhs-detail-host-workspace\s*\{[^}]*display\s*:\s*flex/.test(detailWorkspace), "host workspace must not force flex layout");
assert(!/data-jhs-host-region[^}]*order\s*:/.test(detailWorkspace), "semantic host markers must not control layout order");
for (const token of ['$("#magnets-content").detach()', '$("#magnet-table").detach()']) assert(!detailWorkspace.includes(token), "host resource DOM must not be detached");
assertIncludes(detailWorkspace, "container.append(summary, gallery, resources, reviews, related)", "FC2 reviews-before-related order");
assert(!unifiedOffline.includes("$('a[href^=\"magnet:\"],a[href^=\"ed2k:\"]')"), "unified offline must not scan the whole page");
assert(!unifiedOffline.includes("link.after("), "unified offline must inject through adapter action targets");
assert(!hitShow.includes('target="_blank"'), "hit-show cards must use shared detail navigation");
assert(!listPageButton.includes("window.open("), "pending detail navigation must use ListPagePlugin");
for (const [label, source] of [["FC2", fc2], ["FC2/123AV", fc2By123Av]]) {
  assert(!source.includes("layer.closeAll("), `${label} state actions must not close unrelated layers`);
  assert(!source.includes("stateService.patch("), `${label} state actions must use toggle semantics`);
  assertIncludes(source, "detailStateController.bind", `${label} detail state controller`);
}
assert(!uiPrimitives.includes('.trigger("change")'), "JhsSelect must dispatch one native change without jQuery double fire");
for (const [label, source] of [["123", one23Offline], ["115", one115Offline]]) {
  assert(!source.includes("injectJavDbButtons"), `${label} provider must not inject JavDB UI`);
  assert(!source.includes("injectJavBusButtons"), `${label} provider must not inject JavBus UI`);
}
assert(!history.slice(history.indexOf("async editRecord")).includes("projectLegacyStatus"), "history editor must not project a legacy single status");
assert(!history.slice(history.indexOf("async editRecord")).includes("legacyActionToFlag"), "history editor must patch four flags directly");
assertIncludes(storage.slice(storage.indexOf("async getSetting("), storage.indexOf("async saveSetting(")), "Object.prototype.hasOwnProperty.call(", "settings must preserve explicit falsey values");
assertIncludes(await read("src/plugins/backup/setting.js"), '.off("change.jhsResource", "input, select")', "cloud settings must persist selects through delegated binding");
assertIncludes(listPageSource, "shouldHideInDefaultView", "multi-state default visibility contract");
assertIncludes(listPageSource, "getIndexedItems(payload.carNums || [])", "precise list DOM index lookup");
assertIncludes(listPageSource, "scheduleRecount()", "frame-coalesced status recount");
assertIncludes(listPageSource, "normalizeQuickFilterKey", "quick filter compatibility boundary");
assertIncludes(listPageSource, "collectCurrentPageSummary", "single current-page summary collector");
assertIncludes(listPageSource, "hardHidden || R.push(t)", "hard-hidden cards must stay out of the default translation queue");
assert((listPageSource.match(/"filter"/g) || []).length === 1, "legacy quick-filter key must only appear in normalizeQuickFilterKey");
for (const forbidden of [ 'data-jhs-filter="filter"', 'setQuickFilter("filter")', 'filter === "filter"', '"filter" === filter' ])
  assert(!listPageSource.includes(forbidden) && !mobileSource.includes(forbidden) && !statsSource.includes(forbidden), `legacy quick-filter business key returned: ${forbidden}`);
assert(!statsSource.includes("#jhs-quick-filter"), "Stats must use ListPagePlugin.setQuickFilter instead of filter DOM");
for (const filter of [ "all", "favorite", "hasDown", "hasWatch", "blockedItems", "waitCheck" ])
  assert(!statsSource.includes(`data-filter="${filter}"`), `full-library Stats metric must not navigate to current-page filter ${filter}`);
assertIncludes(statsSource, 'action: "new-video"', "Stats global NewVideo action");
assertIncludes(statsSource, 'action: "filter", filter: "blockedItems"', "Stats current-page blocked action");
assertIncludes(statsSource, 'title: "统计"', "Stats dialog title");
assert(!mobileSource.includes("activeQuickFilter ="), "mobile filter actions must use ListPagePlugin.setQuickFilter");
assert(!mobileSource.includes('$("#waitCheckBtn").click()'), "mobile identification must call ListPageButtonPlugin.openWaitCheck directly");
assertIncludes(mobileSource, 'await this.getBean("ListPageButtonPlugin")?.openWaitCheck?.()', "mobile identification API");
assert(!/\.jhs-commandbar__filters\s*\{[^}]*overflow-x\s*:\s*auto/.test(mobileSource), "command-bar filters must not clip popovers with horizontal overflow");
assert(!/@media \(max-width:\s*1023px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*overflow-x\s*:\s*auto/.test(mobileSource), "tablet command bar must wrap instead of scrolling horizontally");
assert(/@media \(max-width:\s*1023px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*flex-wrap\s*:\s*wrap[^}]*overflow\s*:\s*visible/.test(mobileSource), "tablet command bar must wrap with visible overflow");
assert(/@media \(max-width:\s*768px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*display\s*:\s*none/.test(mobileSource), "mobile command bar must stay hidden");
assert(!listPageButton.includes(":visible") && !listPageButton.includes("span.tag:contains"), "start identification must use card data across the full list");
assert(!listPageSource.includes("currentPageBlockedItemCount"), "unused blocked-item counter must stay removed");
assert((newVideoTaskSource.match(/锁任务出现错误:/g) || []).length === 1, "background lock failures must be logged once");
assertIncludes(unifiedOffline, '.attr({ "aria-busy": "true", "aria-disabled": "true" }).text("提交中")', "focusable offline submitting button state");
assertIncludes(unifiedOffline, '.removeAttr("aria-busy aria-disabled").text(original)', "offline idle button restoration");
assert(!unifiedOffline.includes('.prop("disabled", !0)'), "offline submission must preserve button focus");
assertIncludes(unifiedOffline, "submitted ? setTimeout(restoreButton, this.BUTTON_COOLDOWN_MS) : restoreButton()", "offline success cooldown and immediate failure restoration");
for (const removedSetting of [ "showFilterItem", "showFilterActorItem", "showFilterKeywordItem" ])
  assert(!listPageSource.includes(removedSetting) && !settingFormsSource.includes(removedSetting) && !settingTemplatesSource.includes(removedSetting), `retired visibility setting returned: ${removedSetting}`);
assert(!listPageSource.includes("data-jhs-auto-hide"), "retired auto-hide card attribute returned");
const javDbAdCleanup = compatibilitySource.slice(compatibilitySource.indexOf("async initCss()"), compatibilitySource.indexOf("async handle()"));
assertIncludes(javDbAdCleanup, "if (!siteContext.isJavDB) return \"\"", "JavDB ad cleanup scope");
assert((javDbAdCleanup.match(/\.sda-content/g) || []).length === 1, "JavDB ad cleanup must use only one confirmed container selector");
assert(/\.sda-content\s*\{\s*display\s*:\s*none\s*!important;?\s*\}/.test(javDbAdCleanup), "JavDB ad container must be hidden with CSS");
assert(!/MutationObserver|setInterval|href|https?:\/\//.test(javDbAdCleanup), "JavDB ad cleanup must not poll or classify URLs");
assert(!themeSource.includes(".sda-content"), "JavDB host cleanup must not leak into theme CSS");
for (const removedBestResourceToken of [ "bestResourceBtn", "submitBestResource", "findBestResource", "selectBestCapableResource" ])
  assert(!unifiedOffline.includes(removedBestResourceToken) && !magnetHubSource.includes(removedBestResourceToken), `best-resource path returned: ${removedBestResourceToken}`);
for (const removedPlugin of [ "OneOneFiveOfflinePlugin", "OneOneFiveRenamePlugin" ])
  assert(!registry.includes(removedPlugin) && !one115Offline.includes(removedPlugin), `retired 115 plugin returned: ${removedPlugin}`);
assertIncludes(unifiedOffline, "forceAvailabilityRefresh", "offline retries must bypass availability cache");
assertIncludes(unifiedOffline, "preferredProviderId", "offline retries must prefer their original provider");
assert(!statusImport.includes("$.ajax("), "multi-page import must use one awaited promise chain");
assertIncludes(statusImport, "return this.parseMovieList(nextPage, result)", "multi-page import recursion must be awaited by return");
assert(!history.includes('$(".layui-layer-content")'), "history events must be scoped to their own layer");
assertIncludes(history, "stateService.toggle(a, flag", "single history actions must toggle state");
assert(!review.includes('id="reviews'), "review panels must not expose fixed instance ids");
assert(!related.includes('id="related'), "related panels must not expose fixed instance ids");
assertIncludes(statusImport, 'this.flag = "watched"', "JavDB watched import mapping");
assert(!/watched_videos[\s\S]{0,500}this\.(?:flag|type)\s*=\s*g/.test(statusImport), "JavDB watched import must not map to downloaded");

const expectedPlugins = [
  ["status/detail-page.js", "DetailPagePlugin", "DetailPagePlugin"],
  ["status/detail-workspace.js", "DetailWorkspacePlugin", "DetailWorkspacePlugin"],
  ["image-viewer/preview-video.js", "PreviewVideoPlugin", "PreviewVideoPlugin"],
  ["external-search/javtrailers.js", "JavTrailersPlugin", "JavTrailersPlugin"],
  ["subtitle/subtitle-cat.js", "SubTitleCatPlugin", "SubTitleCatPlugin"],
  ["external-search/fc2.js", "Fc2Plugin", "Fc2Plugin"],
  ["status/highlight-magnet.js", "HighlightMagnetPlugin", "HighlightMagnetPlugin"],
  ["status/fold-category.js", "FoldCategoryPlugin", "FoldCategoryPlugin"],
  ["avatar/actress-info.js", "ActressInfoPlugin", "ActressInfoPlugin"],
  ["external-search/hit-show.js", "HitShowPlugin", "HitShowPlugin"],
  ["external-search/top250.js", "Top250Plugin", "TOP250Plugin"],
  ["status/nav-bar.js", "NavBarPlugin", "NavBarPlugin"],
  ["external-search/other-site.js", "OtherSitePlugin", "OtherSitePlugin"],
  ["status/bus-detail-page.js", "BusDetailPagePlugin", "BusDetailPagePlugin"],
  ["status/detail-page-button.js", "DetailPageButtonPlugin", "DetailPageButtonPlugin"],
  ["status/history.js", "HistoryPlugin", "HistoryPlugin"],
  ["external-search/review.js", "ReviewPlugin", "ReviewPlugin"],
  ["blacklist/filter-title-keyword.js", "FilterTitleKeywordPlugin", "FilterTitleKeywordPlugin"],
  ["blacklist/blacklist.js", "BlacklistPlugin", "BlacklistPlugin"],
  ["status/list-page-button.js", "ListPageButtonPlugin", "ListPageButtonPlugin"],
  ["status/list-page.js", "ListPagePlugin", "ListPagePlugin"],
  ["status/auto-page.js", "AutoPagePlugin", "AutoPagePlugin"],
  ["backup/setting.js", "SettingPlugin", "SettingPlugin"],
  ["image-viewer/bus-preview-video.js", "BusPreviewVideoPlugin", "BusPreviewVideoPlugin"],
  ["avatar/search-by-image.js", "SearchByImagePlugin", "SearchByImagePlugin"],
  ["status/bus-nav-bar.js", "BusNavBarPlugin", "BusNavBarPlugin"],
  ["external-search/related.js", "RelatedPlugin", "RelatedPlugin"],
  ["status/want-and-watched-videos.js", "WantAndWatchedVideosPlugin", "WantAndWatchedVideosPlugin"],
  ["image-viewer/cover-button.js", "CoverButtonPlugin", "CoverButtonPlugin"],
  ["external-search/fc2-by-123av.js", "Fc2By123AvPlugin", "Fc2By123AvPlugin"],
  ["external-search/magnet-hub.js", "MagnetHubPlugin", "MagnetHubPlugin"],
  ["image-viewer/screenshot.js", "ScreenShotPlugin", "ScreenShotPlugin"],
  ["favorite/favorite-actresses.js", "FavoriteActressesPlugin", "FavoriteActressesPlugin"],
  ["image-viewer/bus-img.js", "BusImgPlugin", "BusImgPlugin"],
  ["translate/translate.js", "TranslatePlugin", "TranslatePlugin"],
  ["new-video/task.js", "TaskPlugin", "TaskPlugin"],
  ["new-video/new-video.js", "NewVideoPlugin", "NewVideoPlugin"],
  ["one-two-three/offline.js", "OneTwoThreeOfflinePlugin", "OneTwoThreeOfflinePlugin"],
  ["one-one-five/plugins.js", "OneOneFiveMatchPlugin", "OneOneFiveMatchPlugin"],
  ["offline/unified-offline.js", "UnifiedOfflinePlugin", "UnifiedOfflinePlugin"],
  ["status/compat-enhancements.js", "CompatibilityEnhancementsPlugin", "CompatibilityEnhancementsPlugin"],
  ["stats/stats.js", "StatsPlugin", "StatsPlugin"],
  ["status/mobile-bottom-bar.js", "MobileBottomBarPlugin", "MobileBottomBarPlugin"]
];

const mainClassMatches = sourceMain.match(/^class\s+[\w$]+\s+extends\s+BasePlugin\s*\{/gm) || [];
assert(mainClassMatches.length === 0, "src/main.js still contains plugin classes");

for (const [file, className, pluginName] of expectedPlugins) {
  const source = await read(`src/plugins/${file}`);
  await stat(join(repoRoot, "src", "plugins", file));
  assertIncludes(source, `class ${className} extends BasePlugin`, file);
  assertIncludes(source, `return "${pluginName}"`, file);
}

const javdbPlugins = extractRegistryArray(registry, "DEFAULT_JAVDB_PLUGINS");
const javbusPlugins = extractRegistryArray(registry, "DEFAULT_JAVBUS_PLUGINS");
assert(
  javdbPlugins.join(",") === "ListPagePlugin,AutoPagePlugin,Fc2Plugin,FoldCategoryPlugin,ListPageButtonPlugin,HistoryPlugin,SettingPlugin,NavBarPlugin,HitShowPlugin,Top250Plugin,SearchByImagePlugin,CoverButtonPlugin,Fc2By123AvPlugin,DetailPagePlugin,DetailWorkspacePlugin,ReviewPlugin,RelatedPlugin,DetailPageButtonPlugin,HighlightMagnetPlugin,PreviewVideoPlugin,FilterTitleKeywordPlugin,ActressInfoPlugin,OtherSitePlugin,TranslatePlugin,WantAndWatchedVideosPlugin,MagnetHubPlugin,ScreenShotPlugin,BlacklistPlugin,FavoriteActressesPlugin,NewVideoPlugin,TaskPlugin,StatsPlugin,MobileBottomBarPlugin,OneOneFiveMatchPlugin,UnifiedOfflinePlugin,CompatibilityEnhancementsPlugin",
  "JavDB plugin registration order changed"
);
assert(
  javbusPlugins.join(",") === "ListPagePlugin,ListPageButtonPlugin,SettingPlugin,HistoryPlugin,AutoPagePlugin,SearchByImagePlugin,BusNavBarPlugin,CoverButtonPlugin,BusImgPlugin,BusDetailPagePlugin,DetailWorkspacePlugin,DetailPageButtonPlugin,ReviewPlugin,FilterTitleKeywordPlugin,HighlightMagnetPlugin,BusPreviewVideoPlugin,MagnetHubPlugin,ScreenShotPlugin,OtherSitePlugin,TranslatePlugin,BlacklistPlugin,TaskPlugin,StatsPlugin,MobileBottomBarPlugin,OneOneFiveMatchPlugin,UnifiedOfflinePlugin,CompatibilityEnhancementsPlugin",
  "JavBus plugin registration order changed"
);
assertIncludes(registry, "context.is123Pan", "shared registry");
assertIncludes(registry, "plugins: [ OneTwoThreeOfflinePlugin ]", "shared registry");
assertIncludes(registry, "context.isJavTrailers", "shared registry");
assertIncludes(registry, "context.isSubtitleCat", "shared registry");
const siteContext = await read("src/core/site-context.js");
for (const [metadataToken, runtimeToken] of [
  ["javdb", "JAVDB_HOST_PATTERN"],
  ["javbus", '"javbus"'],
  ["javsee", '"javsee"'],
  ["seejav", '"seejav"'],
  ["123pan.com", "is123Pan"],
  ["javtrailers.com", "isJavTrailers"],
  ["subtitlecat.com", "isSubtitleCat"]
]) {
  assertIncludes(sourceMain, metadataToken, "userscript site metadata");
  assertIncludes(siteContext, runtimeToken, "runtime site registry");
}

const sourceByFile = new Map();
for (const [file] of expectedPlugins) {
  sourceByFile.set(file, await read(`src/plugins/${file}`));
}
sourceByFile.set("core/storage.js", storage);
sourceByFile.set("core/logger.js", await read("src/core/logger.js"));
sourceByFile.set("core/javdb-api.js", await read("src/core/javdb-api.js"));
sourceByFile.set("core/http.js", await read("src/core/http.js"));
sourceByFile.set("core/event-bus.js", await read("src/core/event-bus.js"));
sourceByFile.set("core/state-model.js", stateModel);
sourceByFile.set("core/migration.js", migration);
sourceByFile.set("core/state-service.js", stateService);
sourceByFile.set("core/plugin-manager.js", await read("src/core/plugin-manager.js"));
sourceByFile.set("core/utils.js", await read("src/core/utils.js"));
sourceByFile.set("backup/webdav-client.js", await read("src/plugins/backup/webdav-client.js"));
sourceByFile.set("backup/setting-backup.js", await read("src/plugins/backup/setting-backup.js"));
sourceByFile.set("backup/setting-styles.js", await read("src/plugins/backup/setting-styles.js"));
sourceByFile.set("backup/setting-templates.js", await read("src/plugins/backup/setting-templates.js"));
sourceByFile.set("backup/setting-panels.js", await read("src/plugins/backup/setting-panels.js"));
sourceByFile.set("backup/setting-forms.js", await read("src/plugins/backup/setting-forms.js"));

const regressionMatrix = [
  ["JavDB 列表页", [["status/list-page.js", "filterMovieList"], ["status/list-page-button.js", "ListPageButtonPlugin"], ["image-viewer/cover-button.js", "CoverButtonPlugin"], ["core/storage.js", "getStatusMap"]]],
  ["JavDB 详情页", [["status/detail-page.js", "DetailPagePlugin"], ["status/detail-page-button.js", "showStatus"], ["image-viewer/preview-video.js", "PreviewVideoPlugin"]]],
  ["JavDB 演员页", [["favorite/favorite-actresses.js", "FavoriteActressesPlugin"], ["avatar/actress-info.js", "ActressInfoPlugin"], ["core/plugin-manager.js", "getActressPageInfo"]]],
  ["JavBus 列表页", [["status/list-page.js", "fixBusTitleBox"], ["image-viewer/bus-img.js", "BusImgPlugin"], ["status/list-page-button.js", "ListPageButtonPlugin"]]],
  ["JavBus 详情页", [["status/bus-detail-page.js", "BusDetailPagePlugin"], ["image-viewer/bus-preview-video.js", "BusPreviewVideoPlugin"], ["status/bus-nav-bar.js", "BusNavBarPlugin"]]],
  ["123pan 授权同步", [["one-two-three/offline.js", "startTokenSync"], ["one-two-three/offline.js", "visibilitychange"], ["one-two-three/offline.js", "syncFallbackMs = 3e5"]]],
  ["统一离线提交", [["offline/unified-offline.js", "getAvailability"], ["offline/unified-offline.js", "capabilities"], ["offline/unified-offline.js", "appendOfflineHistory"]]],
  ["新作品检测", [["new-video/task.js", "TaskPlugin"], ["new-video/new-video.js", "NewVideoPlugin"], ["core/storage.js", "newVideoList"]]],
  ["黑名单检测", [["blacklist/blacklist.js", "BlacklistPlugin"], ["blacklist/filter-title-keyword.js", "FilterTitleKeywordPlugin"], ["core/storage.js", "batchSaveBlacklistCarList"]]],
  ["统计面板", [["stats/stats.js", "StatsPlugin"], ["stats/stats.js", "coverageStart"], ["stats/stats.js", "6.4.0"]]],
  ["数据导入导出", [["backup/setting-backup.js", "importSettingData"], ["backup/setting-backup.js", "exportSettingData"], ["core/storage.js", "exportData"]]],
  ["WebDAV 备份", [["backup/webdav-client.js", "class WebDavClient"], ["backup/setting-backup.js", "backupDataByWebDav"], ["backup/webdav-client.js", "PROPFIND"]]],
  ["图片查看器", [["core/logger.js", "showImageViewer"], ["core/logger.js", "new Viewer"], ["image-viewer/screenshot.js", "ScreenShotPlugin"]]],
  ["第三方请求失败场景", [["core/storage.js", "cachedRequest"], ["core/http.js", "onerror"], ["external-search/other-site.js", "detectOtherSites"]]],
  ["多标签页同步", [["core/event-bus.js", "eventId"], ["core/event-bus.js", "originId"], ["status/list-page.js", "list-items-added"]]],
  ["快速筛选", [["status/list-page.js", "createQuickFilter"], ["status/list-page.js", "setQuickFilter"], ["status/list-page.js", "blockedItems"]]],
  ["标记状态与隐藏", [["status/list-page.js", "data-jhs-flags"], ["status/list-page.js", "visibilityReasons"], ["core/state-model.js", "syncLegacyStatus"]]],
  ["版本迁移", [["core/migration.js", "DATA_MIGRATIONS"], ["core/migration.js", "migration-snapshot"], ["core/migration.js", "collision"]]],
  ["可恢复状态事务", [["core/state-service.js", "mutation_journal"], ["core/state-service.js", 'commitState: "pending"'], ["core/state-service.js", "recoverPendingTransaction"]]],
  ["离线能力路由", [["offline/unified-offline.js", "capabilities.includes(type)"], ["offline/unified-offline.js", '"ready", "unknown"'], ["offline/unified-offline.js", "getCandidates(resource"]]],
  ["115 增量匹配", [["one-one-five/plugins.js", "IntersectionObserver"], ["one-one-five/plugins.js", 'rootMargin: "200px"'], ["one-one-five/plugins.js", "list-items-added"]]],
  ["设置页", [["backup/setting.js", "SettingPlugin"], ["backup/setting-backup.js", "importSettingData"]]],
  ["演员信息解析", [["core/plugin-manager.js", "getActressPageInfo"], ["status/list-page.js", "parseActressName"]]],
  ["移动端适配", [["status/mobile-bottom-bar.js", "MobileBottomBarPlugin"], ["core/utils.js", "isMobileMode"], ["core/plugin-manager.js", "shouldSkipOnMobile"]]]
];

assert(!sourceByFile.get("one-one-five/plugins.js").includes("new MutationObserver"), "115 must reuse the ListPage MutationObserver");
for (const [file, source] of [
  ["status/list-page.js", listPageSource],
  ["status/detail-page-button.js", sourceByFile.get("status/detail-page-button.js")],
  ["new-video/new-video.js", sourceByFile.get("new-video/new-video.js")],
  ["stats/stats.js", sourceByFile.get("stats/stats.js")]
]) {
  assert(!source.includes("window.refresh("), `${file} must use precise events instead of legacy refresh`);
  assert(!source.includes("storageManager.saveCar("), `${file} must use StateService instead of legacy writes`);
}

for (const entry of await readdir(join(repoRoot, "src", "plugins"), { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
  const file = join(entry.parentPath, entry.name), source = await readFile(file, "utf8");
  assert(!source.includes("window.refresh("), `${file} must not call legacy refresh`);
  for (const legacyCall of ["storageManager.saveCar(", "storageManager.saveCarList(", "storageManager.updateCarInfo(", "storageManager.removeCar("]) {
    assert(!source.includes(legacyCall), `${file} must not call legacy state writer ${legacyCall}`);
  }
}
assert(!listPageSource.includes("data-jhs-status"), "list page must not encode real state as a single legacy value");

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
