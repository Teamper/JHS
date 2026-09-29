import { readFile, readdir, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
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

function extractContributionOrder(registrySource, site) {
  return registrySource.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/manifest\("[^"]+",\s*"[^"]+",\s*(\w+|null),\s*\[([^\]]+)\],\s*\{([^}]+)\}(?:,\s*\[[^\]]*\])?(?:,\s*\{[^}]*\})?\)/);
    if (!match || match[1] === "null" || !match[2].includes(`"${site}"`)) return [];
    const order = match[3].match(new RegExp(`(?:^|,\\s*)\\s*(?:"${site}"|${site})\\s*:\\s*(\\d+)`));
    assert(order, `Missing ${site} order for ${match[1]}`);
    return [{ plugin: match[1], order: Number(order[1]) }];
  }).filter((item) => item.order > 0).sort((left, right) => left.order - right.order).map((item) => item.plugin);
}

function assertIncludes(source, token, label) {
  assert(source.includes(token), `${label} missing token: ${token}`);
}

async function assertMissing(relativePath, label) {
  try {
    await stat(join(repoRoot, relativePath));
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`${label} must be deleted: ${relativePath}`);
}

const sourceMain = await read("src/main.js");
const rootOutput = await read("JHS.user.js");
const devOutput = await read("dist/dev/JHS-7.0.dev.user.js");
const packageJson = JSON.parse(await read("package.json"));
const ciWorkflow = await read(".github/workflows/ci.yml");
const buildScript = await read("scripts/build.mjs");
const storage = await read("src/core/storage.js");
const eventBus = await read("src/core/event-bus.js");
const stateModel = await read("src/core/state-model.js");
const migration = await read("src/core/migration.js");
const stateService = await read("src/core/state-service.js");
const storageMutation = await read("src/core/storage-mutation-coordinator.js");
const bootstrap = await read("src/app/bootstrap.js");
const otherSite = await read("src/features/external-sites/other-sites-controller.js");
const otherSitesFeature = await read("src/features/external-sites/manifest.js");
const registry = await read("src/features/compatibility/contribution-catalog.js");
const javTrailersController = await read("src/features/external-bridge/javtrailers-controller.js");
const subtitleCatController = await read("src/features/external-bridge/subtitlecat-controller.js");
const detailWorkspace = await read("src/features/detail/detail-workspace-controller.js");
const detailControllerSource = await read("src/features/detail/detail-controller.js");
const fc2DetailWorkspace = await read("src/ui/detail/fc2-detail-workspace.js");
const javDbHostAdapter = await read("src/platform/hosts/javdb-host-adapter.js");
const unifiedOffline = await read("src/features/external-bridge/unified-offline-controller.js");
const hitShow = await read("src/features/discovery/hit-show-controller.js");
const listPageButton = await read("src/features/list/list-actions-controller.js");
const listFiltersSource = await read("src/features/list/list-filters.js");
const fc2 = await read("src/features/detail/fc2-workspace-service.js");
const fc2WorkspaceManifest = await read("src/features/detail/fc2-workspace-manifest.js");
const fc2By123Av = await read("src/features/external-bridge/fc2-catalog-controller.js");
const externalBridge = await read("src/features/external-bridge/manifest.js");
const fc2CatalogManifest = await read("src/features/external-bridge/fc2-catalog-manifest.js");
const uiPrimitives = await read("src/core/ui-primitives.js");
const history = await read("src/features/library/history-dialog-controller.js");
const statusImport = await read("src/features/library/want-watch-import-controller.js");
const review = await read("src/ui/detail/review-panel.js");
const related = await read("src/ui/detail/related-panel.js");
const one23Credential = await read("src/services/pan123-credential-service.js");
const one115Controller = await read("src/features/external-bridge/one-one-five-match-controller.js");
const statsSource = await read("src/features/system/stats-controller.js");
const listFeature = await read("src/features/list/manifest.js");
const mobileSource = await read("src/features/system/responsive-shell-controller.js");
const settingFormsSource = await read("src/plugins/backup/setting-forms.js");
const settingTemplatesSource = await read("src/plugins/backup/setting-templates.js");
const settingBackupSource = await read("src/plugins/backup/setting-backup.js");
const magnetHubSource = await read("src/features/external-bridge/magnet-hub-controller.js");
const newVideoTaskSource = await read("src/features/discovery/task-execution-service.js");
const compatibilityController = await read("src/features/compatibility/compatibility-controller.js");
const compatibilityManifest = await read("src/features/compatibility/manifest.js");
const systemCatalog = await read("src/features/system/catalog.js");
const themeSource = await read("src/core/theme.js");

const version = packageJson.version;
if (version === "6.5.1") {
  const releaseBaseline = execFileSync("git", ["show", "8e2e9b8baefe99b13125f559e83ac98dd08cd02d:JHS.user.js"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert(rootOutput === releaseBaseline, "6.5.1 formal artifact must remain byte-identical to the pinned release baseline");
}
assert(Buffer.byteLength(devOutput, "utf8") < 2_000_000, "migration userscript exceeds Sleazy Fork 2 MB limit");

assert(extractMetadata(rootOutput, "name") === "JHS", "userscript @name changed");
assert(extractMetadata(rootOutput, "version") === version, "preserved release artifact version changed");
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
  assert(!devOutput.includes(legacyBrand), `migration userscript contains legacy brand: ${legacyBrand}`);
}

assert(extractMetadata(devOutput, "name") === "JHS Dev 7.0", "migration @name must be isolated");
assert(extractMetadata(devOutput, "namespace") === "https://github.com/Teamper/JHS/dev/7.0", "migration @namespace must be isolated");
assert(/^7\.0\.0-dev\.\d+$/.test(extractMetadata(devOutput, "version") ?? ""), "migration @version must identify a development build");
assertIncludes(devOutput, `document.documentElement?.setAttribute("data-jhs-dev-build", "${extractMetadata(devOutput, "version")}|`, "migration runtime build marker");
assert(!rootOutput.includes("data-jhs-dev-build"), "official userscript must not contain the migration build marker");
assert(!extractMetadata(devOutput, "downloadURL") && !extractMetadata(devOutput, "updateURL"), "migration build must not advertise release update URLs");
assert(packageJson.scripts.build === "node scripts/build-dev.mjs", "default build must produce the isolated migration artifact");
assert(packageJson.scripts["build:release"] === "node scripts/build.mjs", "official release build must remain explicit");

assertIncludes(ciWorkflow, "npm run check", "CI workflow");
assertIncludes(ciWorkflow, "git diff --exit-code -- JHS.user.js", "CI tracked artifact check");
assertIncludes(ciWorkflow, "workflow_dispatch:", "manual CI trigger");
assertIncludes(ciWorkflow, "node-version: 20", "minimum Node compatibility check");
assertIncludes(ciWorkflow, "node-version: 22", "full Node check");
assertIncludes(ciWorkflow, "needs: [node20, check, browser-smoke]", "release check dependency");
assertIncludes(ciWorkflow, "contents: write", "release write permission");
assertIncludes(ciWorkflow, "--base-ref", "version-change release detection");
assertIncludes(ciWorkflow, "github.ref == 'refs/heads/main'", "release restricted to main pushes");
assertIncludes(packageJson.scripts["check:release"] ?? "", "check:browser", "browser release gate");
assertIncludes(packageJson.scripts["check:release"] ?? "", "check:visual", "visual release gate");
assertIncludes(ciWorkflow, "queue: max", "release concurrency queue");
assertIncludes(ciWorkflow, "cancel-in-progress: false", "release concurrency preservation");
assertIncludes(ciWorkflow, "git tag -a", "annotated release tag");
assertIncludes(ciWorkflow, "gh release create", "immutable release creation");
assert(!ciWorkflow.includes("--clobber"), "release workflow must not overwrite an existing asset");
assert(!ciWorkflow.includes("gh release upload"), "release workflow must not update an existing release");
assert(!ciWorkflow.includes("JHS-dev.user.js"), "release workflow must not build dev artifacts");
assertIncludes(buildScript, "bundle: true", "performance bundled build");
assertIncludes(buildScript, "keepNames: false", "performance bundled build");
assertIncludes(buildScript, "minifySyntax: true", "performance bundled build");
assertIncludes(buildScript, "minifyWhitespace: true", "performance bundled build");
assertIncludes(buildScript, "minifyIdentifiers: true", "performance bundled build");
assertIncludes(buildScript, 'contents.replace(/\\/\\*\\*[\\s\\S]*?\\*\\//g, "")', "production bundle strips source-only JSDoc");

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
  ["import format compatibility", storage, "runDataMigrations(this, this.mutationCoordinator, true)"],
  ["export format compatibility", storage, "async exportData()"],
  ["export format compatibility", storage, "exportPortableData"],
  ["stable plugin identity", registry, "const legacyPluginId = options.legacyPluginId ?? plugin?.legacyPluginId;"],
  ["build source chain", buildScript, 'const srcPath = join(repoRoot, "src", "main.js")'],
  ["build source chain", buildScript, "entryPoints: [srcPath]"],
  ["build source chain", buildScript, "bundle: true"],
  ["build output chain", buildScript, 'const distPath = join(distDir, "JHS.user.js")'],
  ["build output chain", buildScript, 'const rootPath = join(repoRoot, "JHS.user.js")'],
  ["build output chain", buildScript, "for (const outputPath of outputPaths)"],
  ["build output chain", buildScript, 'writeFile(outputPath, output, "utf8")']
];

for (const [label, source, token] of stableReleaseChecks) {
  assertIncludes(source, token, label);
}
assert(!registry.includes("plugin?.name"), "legacy Plugin IDs must not depend on minified constructor names");

assertIncludes(storageMutation, '"jhs_storage_mutation_v1"', "shared storage mutation lock");
assertIncludes(stateService, "this.mutationCoordinator.runExclusive", "state mutation coordination");
assertIncludes(storage, "this.mutationCoordinator.runExclusive", "legacy storage mutation coordination");
assertIncludes(migration, "coordinator.runExclusive", "data migration coordination");

for (const token of ["eventId", "originId", "timestamp", "this.seen", "options.broadcast", '"legacy-refresh"']) {
  assertIncludes(eventBus, token, "precise event bus");
}
assertIncludes(eventBus, "event.originId === this.originId", "self-event suppression");
assertIncludes(eventBus, "this._dispatch(event)", "received events stay local");
assert(!eventBus.includes("this.channel.postMessage(event);\n        await this._dispatch(event)"), "received events must not be rebroadcast");

// List page function signature assertions
const listPageSource = await read("src/features/list/list-compatibility-service.js");
const listFeatureSource = await read("src/features/list/manifest.js");
const listControllerSource = await read("src/features/list/list-controller.js");
assertIncludes(listPageSource, "applyVisibility(items = null)", "list page function signature");
assertIncludes(listPageSource, "async filterMovieList(", "list page function signature");
assertIncludes(listPageSource, "getQuickFilterCatalog()", "List Feature quick-filter catalog compatibility capability");
assertIncludes(listPageSource, "async doFilter(revision =", "list page function signature");
assert(!listPageSource.includes("getListFilterCapability"), "list filter context must not be resolved from the legacy plugin");
assert(!listControllerSource.includes("getListFilterCapability"), "ListController must consume declared filter inputs directly");
assertIncludes(listFeatureSource, "SERVICE.legacyStorage, SERVICE.legacyUtils, SERVICE.clog, SERVICE.titleKeywords", "List Feature declares its filter data dependencies");
assertIncludes(listFeatureSource, "deps[SERVICE.state].getActivityLog()", "List Feature reads activity history through StateService");
assertIncludes(listFeatureSource, "deps[SERVICE.legacyStorage].getBlacklistMap()", "List Feature reads the established blacklist map through its declared storage boundary");
assertIncludes(listControllerSource, "new ListFilterContextProvider({", "ListController owns the cached list evaluation context");
assertIncludes(javDbHostAdapter, 'querySelector("#magnets-content")', "protected JavDB resource boundary");
assert(!detailWorkspace.includes('controller.find("#magnets-content")'), "detail workspace must use the JavDB HostAdapter resource boundary");
assert(!/routeSections|moveToSection|movePanelToSection/.test(detailWorkspace), "detail workspace must not remount host sections");
assertIncludes(detailWorkspace, 'this.eventBus.emit("magnet-items-updated"', "magnet lifecycle event");
assertIncludes(detailWorkspace, "{ broadcast: !1 }", "DOM lifecycle events must stay local");
assert(!/\.jhs-detail-host-workspace\s*\{[^}]*display\s*:\s*flex/.test(detailWorkspace), "host workspace must not force flex layout");
assert(!/data-jhs-host-region[^}]*order\s*:/.test(detailWorkspace), "semantic host markers must not control layout order");
for (const token of ['$("#magnets-content").detach()', '$("#magnet-table").detach()']) assert(!detailWorkspace.includes(token), "host resource DOM must not be detached");
assertIncludes(fc2DetailWorkspace, '[ "summary", "影片概览" ], [ "gallery", "预览与剧照" ], [ "resources", "资源" ], [ "reviews", "评论" ], [ "related", "相关清单" ]', "FC2 fixed section order");
assert(!unifiedOffline.includes("$('a[href^=\"magnet:\"],a[href^=\"ed2k:\"]')"), "unified offline must not scan the whole page");
assert(!unifiedOffline.includes("link.after("), "unified offline must inject through adapter action targets");
assert(!hitShow.includes('target="_blank"'), "hit-show cards must use shared detail navigation");
assert(!listPageButton.includes("window.open("), "pending detail navigation must use ListPagePlugin");
for (const [label, source] of [["FC2", fc2], ["FC2/123AV", fc2By123Av]]) {
  assert(!source.includes("layer.closeAll("), `${label} state actions must not close unrelated layers`);
  assert(!source.includes("stateService.patch("), `${label} state actions must use toggle semantics`);
}
assertIncludes(fc2, "this.getDetailStateController().bind", "declared-state FC2 detail controller");
assert(!fc2.includes("import { detailStateController }"), "FC2 must not import a module-level detail state controller");
assertIncludes(fc2, '"123av" === context.source ? void this.load123AvDetail(context)', "FC2 controller must own 123AV detail orchestration");
assert(!fc2By123Av.includes('getDependency("Fc2Plugin")'), "123AV data source must not depend on the FC2 UI plugin");
assertIncludes(registry, 'manifest("detail.fc2-lookup", "fc2-catalog", null, ["javdb"]', "native JavDB FC2 catalog contribution retains its identity");
assertIncludes(fc2CatalogManifest, 'contributes: ["detail.fc2-lookup"]', "123AV catalog and FC2 lookup are owned by a JavDB-specific Feature");
assert(!/requires:\s*\[[^\]]*PORT\.host/.test(externalBridge) && externalBridge.includes("optionalRequires: [PORT.host]") && !externalBridge.includes("SERVICE.movie"), "shared External Bridge may use the host only through an explicit optional boundary");
assertIncludes(registry, 'executionOwner: "feature", lifecycleOwner: "feature", legacyPluginId: "UnifiedOfflinePlugin"', "offline executor is Feature-owned and retains the old contribution ID");
await assertMissing("src/plugins/offline/unified-offline.js", "UnifiedOfflinePlugin legacy executor");
assert(!registry.includes('./external-search/fc2-by-123av.js'), "123AV behavior must not instantiate a legacy plugin executor");
assertIncludes(await read("src/core/legacy-plugin-contributions.js"), 'Fc2By123AvPlugin: "detail.fc2-lookup"', "legacy 123AV disable ID remains mapped");
assert(!uiPrimitives.includes('.trigger("change")'), "JhsSelect must dispatch one native change without jQuery double fire");
for (const [label, source] of [["123", one23Credential], ["115", one115Controller]]) {
  assert(!source.includes("injectJavDbButtons"), `${label} provider must not inject JavDB UI`);
  assert(!source.includes("injectJavBusButtons"), `${label} provider must not inject JavBus UI`);
}
assert(!history.slice(history.indexOf("async editRecord")).includes("projectLegacyStatus"), "history editor must not project a legacy single status");
assert(!history.slice(history.indexOf("async editRecord")).includes("legacyActionToFlag"), "history editor must patch four flags directly");
assertIncludes(storage.slice(storage.indexOf("async getSetting("), storage.indexOf("async saveSetting(")), "Object.prototype.hasOwnProperty.call(", "settings must preserve explicit falsey values");
const settingPluginSource = await read("src/plugins/backup/setting.js");
assertIncludes(settingPluginSource, "renderCloudSettings(root, cloud)", "cloud settings must render through the shared catalog");
assertIncludes(settingPluginSource, "bindSettingRows(host, descriptors, { settings })", "cloud settings must persist through the shared binding");
for (const retiredVisibilityToken of [ "shouldHideInDefaultView", "settingHidden", "data-jhs-setting-hide" ])
  assert(!listPageSource.includes(retiredVisibilityToken), `retired all-view visibility rule returned: ${retiredVisibilityToken}`);
for (const retiredSetting of [ "showAllItem", "showFavoriteItem", "showHasDownItem", "showHasWatchItem" ])
  assert(!listPageSource.includes(retiredSetting) && !settingFormsSource.includes(retiredSetting) && !settingTemplatesSource.includes(retiredSetting), `retired list visibility setting returned: ${retiredSetting}`);
assertIncludes(listPageSource, "getIndexedItems(payload.carNums || [])", "precise list DOM index lookup");
assertIncludes(listPageSource, "scheduleRecount()", "frame-coalesced status recount");
assertIncludes(listFiltersSource, "normalizeQuickFilterKey", "quick filter compatibility boundary");
assertIncludes(listPageSource, "collectCurrentPageSummary", "single current-page summary collector");
assertIncludes(listPageSource, "hardHidden || R.push(t)", "hard-hidden cards must stay out of the default translation queue");
assert((listFiltersSource.match(/"filter"/g) || []).length === 1, "legacy quick-filter key must only appear in normalizeQuickFilterKey");
for (const forbidden of [ 'data-jhs-filter="filter"', 'setQuickFilter("filter")', 'filter === "filter"', '"filter" === filter' ])
  assert(!listFiltersSource.includes(forbidden) && !listPageSource.includes(forbidden) && !mobileSource.includes(forbidden) && !statsSource.includes(forbidden), `legacy quick-filter business key returned: ${forbidden}`);
assert(!statsSource.includes("#jhs-quick-filter"), "Stats must use ListPagePlugin.setQuickFilter instead of filter DOM");
for (const filter of [ "all", "favorite", "hasDown", "hasWatch", "blockedItems", "waitCheck" ])
  assert(!statsSource.includes(`data-filter="${filter}"`), `full-library Stats metric must not navigate to current-page filter ${filter}`);
assertIncludes(statsSource, 'data-action="${metric.action}"', "Stats action button contract");
assertIncludes(statsSource, 'action: "filter"', "Stats current-page blocked action");
assert(!statsSource.includes("resolveCompatibilityBean"), "Stats must not resolve legacy Feature instances directly");
assertIncludes(statsSource, 'this.setQuickFilter("blockedItems")', "Stats current-page filter uses its injected List capability");
assertIncludes(listFeature, '"list.current-page-summary":', "List Feature must expose its current-page summary command");
assertIncludes(listFeature, '"list.set-quick-filter":', "List Feature must expose its quick-filter command");
assertIncludes(listFeature, 'listCompatibilityService?.setQuickFilter?.(filter)', "List quick-filter command must delegate to the Feature-owned service");
assertIncludes(statsSource, 'title: "统计"', "Stats dialog title");
assert(!mobileSource.includes("activeQuickFilter ="), "mobile filter actions must use ListPagePlugin.setQuickFilter");
assert(!mobileSource.includes('$("#waitCheckBtn").click()'), "mobile identification must call ListPageButtonPlugin.openWaitCheck directly");
assertIncludes(mobileSource, 'await this.getCapability("ListPageButtonPlugin")?.openWaitCheck?.()', "mobile identification API");
assert(!/\.jhs-commandbar__filters\s*\{[^}]*overflow-x\s*:\s*auto/.test(mobileSource), "command-bar filters must not clip popovers with horizontal overflow");
assert(!/@media \(max-width:\s*1023px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*overflow-x\s*:\s*auto/.test(mobileSource), "tablet command bar must wrap instead of scrolling horizontally");
assert(/@media \(max-width:\s*1023px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*flex-wrap\s*:\s*wrap[^}]*overflow\s*:\s*visible/.test(mobileSource), "tablet command bar must wrap with visible overflow");
assert(/@media \(max-width:\s*767px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*display\s*:\s*none/.test(mobileSource), "mobile command bar must stay hidden");
assert(!listPageButton.includes(":visible") && !listPageButton.includes("span.tag:contains"), "start identification must use card data across the full list");
assert(!listPageSource.includes("currentPageBlockedItemCount"), "unused blocked-item counter must stay removed");
assert((newVideoTaskSource.match(/锁任务出现错误:/g) || []).length === 1, "background lock failures must be logged once");
assertIncludes(unifiedOffline, '.attr({ "aria-busy": "true", "aria-disabled": "true" }).text("提交中")', "focusable offline submitting button state");
assertIncludes(unifiedOffline, '.removeAttr("aria-busy aria-disabled").text(original)', "offline idle button restoration");
assert(!unifiedOffline.includes('.prop("disabled", !0)'), "offline submission must preserve button focus");
  assertIncludes(unifiedOffline, "this.window.setTimeout(restoreButton, this.BUTTON_COOLDOWN_MS)", "offline success cooldown and immediate failure restoration");
for (const removedSetting of [ "showFilterItem", "showFilterActorItem", "showFilterKeywordItem" ])
  assert(!listPageSource.includes(removedSetting) && !settingFormsSource.includes(removedSetting) && !settingTemplatesSource.includes(removedSetting), `retired visibility setting returned: ${removedSetting}`);
assert(!listPageSource.includes("data-jhs-auto-hide"), "retired auto-hide card attribute returned");
assertIncludes(compatibilityController, 'if (this.site === "javdb")', "JavDB ad cleanup scope");
assert((compatibilityController.match(/\.sda-content/g) || []).length === 1, "JavDB ad cleanup must use only one confirmed container selector");
assert(/\.sda-content\s*\{\s*display\s*:\s*none\s*!important;?\s*\}/.test(compatibilityController), "JavDB ad container must be hidden with CSS");
assert(!/MutationObserver|setInterval/.test(compatibilityController), "JavDB ad cleanup must not poll");
assertIncludes(compatibilityManifest, '"compatibility.enhancements"', "compatibility Feature contribution");
assert(!themeSource.includes(".sda-content"), "JavDB host cleanup must not leak into theme CSS");
for (const removedBestResourceToken of [ "bestResourceBtn", "submitBestResource", "findBestResource", "selectBestCapableResource" ])
  assert(!unifiedOffline.includes(removedBestResourceToken) && !magnetHubSource.includes(removedBestResourceToken), `best-resource path returned: ${removedBestResourceToken}`);
for (const removedPlugin of [ "OneOneFiveOfflinePlugin", "OneOneFiveRenamePlugin" ])
  assert(!registry.includes(removedPlugin) && !one115Controller.includes(removedPlugin), `retired 115 plugin returned: ${removedPlugin}`);
assert(!registry.includes("./one-one-five/plugins.js"), "115 matching must not instantiate the retired legacy executor");
assertIncludes(unifiedOffline, "forceAvailabilityRefresh", "offline retries must bypass availability cache");
assertIncludes(unifiedOffline, "preferredProviderId", "offline retries must prefer their original provider");
assert(!statusImport.includes("$.ajax("), "multi-page import must use the declared HTTP service");
assertIncludes(statusImport, "requestHostPage(this.http, nextUrl, this.scope)", "multi-page import must fetch pages through its cancellable HTTP capability");
assert(!history.includes('$(".layui-layer-content")'), "history events must be scoped to their own layer");
assertIncludes(history, "this.historyRepository.toggle(a, flag", "single history actions must toggle state through HistoryRepository");
assert(!review.includes('id="reviews'), "review panels must not expose fixed instance ids");
assert(!related.includes('id="related'), "related panels must not expose fixed instance ids");
assertIncludes(statusImport, 'route.includes("/watched_videos") ? "watched"', "JavDB watched import mapping");
assertIncludes(statusImport, "this.state.patch(carNum, { [flag]: true }", "JavDB import must write through StateService without legacy status projection");
assert(!statusImport.includes('"downloaded": true'), "JavDB watched import must not map to downloaded");

const expectedPlugins = [];

const settingsServiceSource = await read("src/plugins/backup/setting.js");
const listPageAdapterSource = await read("src/compat/list-page-adapter.js");
assertIncludes(settingsServiceSource, "export class SettingPlugin", "Settings Feature-owned compatibility service");
assert(!settingsServiceSource.includes("extends BasePlugin"), "settings service must not extend BasePlugin");
assert(!settingsServiceSource.includes("globalThis.$"), "settings service must receive its UI dependencies from Settings Feature");
assert(!settingBackupSource.includes("globalThis."), "settings backup helpers must use injected browser and UI capabilities");
assertIncludes(settingBackupSource, "BackupUiDependencies", "settings backup helpers declare their injected service boundary");
assertIncludes(settingBackupSource, "openFileListDialog(e, t, n, folderName, showDiffPreviewFn, dialog, dependencies)", "WebDAV dialog uses the injected table and UI capabilities");
assertIncludes(settingsServiceSource, 'this.getRuntimeService("host")?.getListSelectors?.()', "settings selector compatibility must use the injected Host port");
assertIncludes(registry, 'manifest("settings.core", "settings-entry", null', "settings Contribution is Feature-owned");
assertIncludes(registry, 'new SettingsCompatibilityBean(', "SettingPlugin remains available through a compatibility bean");
assertIncludes(systemCatalog, "compatibilityBean.createFeatureService", "Settings Feature creates the settings service with declared dependencies");
assertIncludes(listPageAdapterSource, "export class ListPagePluginAdapter {", "ListPage compatibility shell is a plain forwarding adapter");
assert(!listPageAdapterSource.includes("extends BasePlugin"), "ListPage compatibility shell must not inherit the legacy plugin base");
assertIncludes(registry, 'manifest("list.core", "list", null', "List core Contribution has no legacy executor");
assertIncludes(registry, 'executionOwner: "feature", lifecycleOwner: "feature", legacyPluginId: "ListPagePlugin"', "List core preserves its legacy disable ID under Feature ownership");
assertIncludes(registry, 'registerCompatibilityBean("ListPagePlugin", new ListPagePluginAdapter())', "ListPagePlugin remains a lookup alias without entering executor registration");
assertIncludes(listPageAdapterSource, 'List Feature compatibility service is not active', "List compatibility lookup cannot create an executor outside Feature startup");
assertMissing("src/plugins/status/list-page.js", "ListPagePlugin legacy executor");

assertMissing("src/plugins/new-video/task.js", "retired TaskPlugin scheduler executor");
const newVideoWorkspaceSource = await read("src/plugins/new-video/new-video.js");
assertIncludes(newVideoWorkspaceSource, "export class NewVideoWorkspaceService", "NewVideoWorkspaceService is feature-created and independent of BasePlugin");
assert(!newVideoWorkspaceSource.includes("extends BasePlugin"), "new-video workspace must not extend BasePlugin");
assertIncludes(registry, 'executionOwner: "feature", legacyPluginId: "NewVideoPlugin"', "NewVideo contribution uses Feature execution ownership while preserving its disable ID");
assertIncludes(registry, 'new NewVideoCompatibilityBean(', "NewVideoPlugin compatibility bean preserves the legacy surface");
assertIncludes(await read("src/features/discovery/new-video-manifests.js"), "compatibilityBean.createFeatureService", "Discovery Feature creates the NewVideo workspace service");
assertIncludes(await read("src/compat/new-video-compatibility-bean.js"), 'this.executeCommand("new-video.open", ...args)', "NewVideoPlugin remains a forwarding compatibility bean");
assertIncludes(newVideoTaskSource, "export class TaskExecutionService", "Scheduler Feature owns background task execution");
assertIncludes(await read("src/compat/task-compatibility-bean.js"), 'getName() { return "TaskPlugin"; }', "TaskPlugin is retained as a compatibility facade");
assertMissing("src/plugins/status/history.js", "HistoryPlugin business executor");
assertIncludes(await read("src/compat/history-compatibility-bean.js"), 'this.executeCommand("library.history.open")', "HistoryPlugin remains a forwarding-only compatibility bean");

const mainClassMatches = sourceMain.match(/^class\s+[\w$]+\s+extends\s+BasePlugin\s*\{/gm) || [];
assert(mainClassMatches.length === 0, "src/main.js still contains plugin classes");
assertMissing("src/plugins/status/mobile-bottom-bar.js", "MobileBottomBarPlugin legacy executor");
assertIncludes(registry, 'manifest("responsive-shell.bottom-bar", "responsive-shell", null, ["javdb", "javbus"]', "responsive shell remains a Feature-owned Contribution");
assertIncludes(systemCatalog, 'id: "responsive-shell", kind: "system", disableable: false', "responsive shell remains non-disableable");
assertIncludes(mobileSource, "export class ResponsiveShellController", "responsive shell Feature controller");
assertIncludes(mobileSource, "this._animationTimers.add(timer)", "responsive shell tracks stagger timers for teardown");

for (const [file, className, pluginName] of expectedPlugins) {
  const sourcePath = file.startsWith("compat/") ? join("src", file) : join("src", "plugins", file);
  const source = await read(sourcePath);
  await stat(join(repoRoot, sourcePath));
  assertIncludes(source, `class ${className} extends BasePlugin`, file);
  assertIncludes(source, `return "${pluginName}"`, file);
}

const javdbPlugins = extractContributionOrder(registry, "javdb");
const javbusPlugins = extractContributionOrder(registry, "javbus");
assert(
  javdbPlugins.length === 0,
  "JavDB must not register a legacy ListPagePlugin executor"
);
assertIncludes(registry, 'manifest("detail.fc2-owned", "fc2-workspace", null, ["javdb"]', "FC2 workspace is registered as a Feature-owned contribution");
assert(!registry.includes("./external-search/fc2.js"), "FC2 workspace must not be registered as a legacy plugin executor");
assertIncludes(fc2WorkspaceManifest, 'providesCommands: [commandId]', "FC2 workspace service has an activation-safe Feature command");
assertIncludes(fc2WorkspaceManifest, 'runtime.registerCompatibilityBean?.("Fc2Plugin", service)', "FC2 preserves its legacy lookup alias without a legacy executor");
assert(!fc2.includes("extends BasePlugin"), "FC2 workspace service must not inherit the legacy runtime");
assert(!registry.includes('./status/want-and-watched-videos.js'), "want/watch import must not instantiate the retired legacy executor");
assertIncludes(registry, 'executionOwner: "feature", legacyPluginId: "WantAndWatchedVideosPlugin"', "want/watch import retains the legacy disable ID under Feature ownership");
assertIncludes(registry, 'manifest("discovery.top250", "ranking", null, ["javdb"]', "feature-owned TOP250 contribution");
assertIncludes(registry, 'manifest("discovery.hit-show", "discovery", null, ["javdb"]', "feature-owned playback ranking context contribution");
assertIncludes(registry, 'manifest("list.actions", "list", null, ["javdb", "javbus"], { javdb: 5, javbus: 2 }, [], { executionOwner: "feature", legacyPluginId: "ListPageButtonPlugin" })', "native List Feature-owned actions contribution retaining the legacy disable ID");
assert(!registry.includes('./status/list-page-button.js'), "List actions must not instantiate the retired legacy executor");
assertMissing("src/plugins/status/list-page-button.js", "ListPageButtonPlugin legacy executor");
assert(!registry.includes('./status/detail-page-button.js'), "Detail page actions must not instantiate a legacy executor");
assertIncludes(registry, 'manifest("detail.page-state-actions", "detail", null, ["javdb", "javbus"], { javdb: 18, javbus: 12 }, [], { executionOwner: "feature", legacyPluginId: "DetailPageButtonPlugin" })', "Detail Feature-owned page actions retaining the legacy disable ID");
assertMissing("src/plugins/status/detail-page-button.js", "DetailPageButtonPlugin legacy executor");
assertIncludes(registry, 'setCompatibilityBeanResolver?.((name) => compatibilityBeans.lookupCompatibilityBean(name))', "Features resolve compatibility beans through the explicit lookup boundary");
assertIncludes(await read("src/features/list/manifest.js"), 'registerCompatibilityBean?.("ListPageButtonPlugin", listActionsController)', "List Feature retains the mobile-bar compatibility capability");
assertIncludes(registry, 'manifest("list.auto-page", "list", null, ["javdb", "javbus"], { javdb: 2, javbus: 5 }, [], { executionOwner: "feature", legacyPluginId: "AutoPagePlugin" })', "List Feature-owned native auto-page contribution");
assertIncludes(registry, 'manifest("stats.dashboard", "stats", null, ["javdb", "javbus"], { javdb: 32, javbus: 23 }, [], { executionOwner: "feature", legacyPluginId: "StatsPlugin" })', "Stats Feature-owned dashboard contribution");
assertIncludes(systemCatalog, 'id: "stats", kind: "system", disableable: false', "Stats retains its 6.5.1 non-disableable behavior");
assert(!registry.includes("./stats/stats.js"), "Stats dashboard must not instantiate the retired legacy plugin");
assert(!registry.includes('./status/auto-page.js'), "AutoPage must not instantiate the retired legacy plugin");
assertIncludes(registry, 'manifest("library.keyword-filter", "library", null, ["javdb", "javbus"], { javdb: 21, javbus: 14 }, [SERVICE.settings, SERVICE.titleKeywords, SERVICE.domUi, SERVICE.events], { executionOwner: "feature", legacyPluginId: "FilterTitleKeywordPlugin", routes: ["list", "detail", "owned-detail"], surfaces: ["list-page", "detail-page"] })', "Library Feature-owned title keyword contribution");
assertIncludes(registry, 'manifest("compatibility.enhancements", "compatibility", null, ["javdb", "javbus"], { javdb: 36, javbus: 27 }', "Feature-owned compatibility enhancement contribution");
assert(!registry.includes('./blacklist/filter-title-keyword.js'), "title keyword filter must not instantiate the retired legacy plugin");
const titleKeywordController = await read("src/features/library/title-keyword-controller.js");
assertIncludes(titleKeywordController, 'this.window.getSelection()?.toString()', "delegated title-selection filtering");
assertIncludes(titleKeywordController, "escapeHtml(selectedText)", "external title escaping before confirmation");
assertIncludes(registry, 'manifest("detail.fc2-navigation", "list", null, ["javdb"], { javdb: 4 }, [], { executionOwner: "feature", legacyPluginId: "Fc2NavigationPlugin", routes: ["list"], surfaces: ["list-card"] })', "List Feature-owned native FC2 navigation contribution");
assert(!registry.includes('./status/fc2-navigation.js'), "FC2 navigation must not instantiate the retired legacy plugin");
assertIncludes(registry, 'manifest("detail.screenshot", "detail", null, ["javdb", "javbus"], { javdb: 27, javbus: 18 }, [], { executionOwner: "feature", legacyPluginId: "ScreenShotPlugin", routes: ["list", "detail"], surfaces: ["list-page", "detail-page"] })', "Detail Feature-owned native screenshot contribution");
assert(!registry.includes('./image-viewer/screenshot.js'), "screenshot UI must not instantiate the retired legacy executor");
assertIncludes(registry, 'manifest("detail.native-magnets", "detail", null, ["javdb", "javbus"], { javdb: 19, javbus: 15 }, [], { executionOwner: "feature", legacyPluginId: "HighlightMagnetPlugin" })', "native Detail Feature-owned magnet filter with legacy disable key");
assert(!registry.includes('./status/highlight-magnet.js'), "magnet filtering must not instantiate the retired legacy executor");
assertIncludes(registry, 'manifest("detail.external-magnets", "external-bridge", null, ["javdb", "javbus"]', "native External Bridge magnet controller retains its disable key");
assert(!registry.includes('./external-search/magnet-hub.js'), "magnet hub must not instantiate a legacy plugin executor");
const magnetHubController = await read("src/features/external-bridge/magnet-hub-controller.js");
assertIncludes(magnetHubController, "export class MagnetHubController", "magnet hub is Feature-owned");
assertIncludes(magnetHubController, "this.http.request(", "magnet hub uses injected HTTP service");
assertIncludes(registry, 'manifest("detail.javbus-preview", "detail", null, ["javbus"], { javbus: 16 }, [], { executionOwner: "feature", legacyPluginId: "BusPreviewVideoPlugin" })', "native Detail Feature-owned JavBus preview contribution with legacy disable key");
assert(!registry.includes('./image-viewer/bus-preview-video.js'), "JavBus preview must not instantiate the retired legacy executor");
assertIncludes(registry, 'manifest("detail.javdb-preview", "detail", null, ["javdb"], { javdb: 20 }, [], { executionOwner: "feature", legacyPluginId: "PreviewVideoPlugin" })', "native Detail Feature-owned JavDB preview contribution with legacy disable key");
assert(!registry.includes('./image-viewer/preview-video.js'), "JavDB preview must not instantiate its retired legacy executor");
assertIncludes(registry, 'manifest("detail.reviews", "detail", null, ["javdb", "javbus"], { javdb: 16, javbus: 13 }, [PORT.host, SERVICE.review, SERVICE.movie, SERVICE.settings, SERVICE.storage, SERVICE.domUi, SERVICE.clipboard, SERVICE.notifications, SERVICE.diagnostics], { executionOwner: "feature", legacyPluginId: "ReviewPlugin" })', "Detail Feature-owned reviews contribution");
assertIncludes(registry, 'manifest("detail.related", "detail", null, ["javdb"], { javdb: 17 }, [PORT.host, SERVICE.related, SERVICE.settings, SERVICE.domUi, SERVICE.notifications, SERVICE.diagnostics], { executionOwner: "feature", legacyPluginId: "RelatedPlugin" })', "Detail Feature-owned related-content contribution");
assert(!registry.includes("./external-search/review.js") && !registry.includes("./external-search/related.js"), "detail panels must not instantiate their retired legacy executors");
assertIncludes(registry, 'manifest("detail.external-sites", "external-sites", null, ["javdb", "javbus"], { javdb: 23, javbus: 19 }, [], { executionOwner: "feature", legacyPluginId: "OtherSitePlugin", routes: ["detail", "owned-detail"], surfaces: ["detail-page"] })', "native external-sites Feature contribution retaining the legacy disable ID");
assert(!registry.includes("./external-search/other-site.js"), "external sites must not instantiate the retired legacy executor");
assertIncludes(otherSitesFeature, 'sites: ["javdb", "javbus"], routes: ["detail", "owned-detail"], startup: "eager"', "external-sites Feature runs only on detail routes");
assertIncludes(otherSitesFeature, 'const consumers = ["SettingPlugin"]', "external-sites injects its capability into retained consumers");
assertIncludes(otherSitesFeature, 'runtime.executeCommand("detail.fc2.workspace")', "external-sites waits for the Feature-owned FC2 workspace service");
assertIncludes(otherSitesFeature, 'consumer.attachFeatureExternalSitesAdapter?.(controller)', "external-sites consumer injection uses an explicit adapter boundary");
assertIncludes(otherSitesFeature, 'registerCompatibilityBean?.("OtherSitePlugin", controller)', "external-sites retains its consumer compatibility capability");
assertIncludes(fc2, "attachFeatureExternalSitesAdapter", "FC2 consumes the Feature-owned external-sites adapter");
assertIncludes(await read("src/plugins/backup/setting.js"), "attachFeatureExternalSitesAdapter", "settings consumes the Feature-owned external-sites adapter");
assert(!registry.includes("LEGACY_PLUGIN_DEPENDENCY_MAP"), "compatibility beans do not use implicit legacy dependency declarations");
assertIncludes(registry, 'manifest("detail.javbus-images", "list", null, ["javbus"], { javbus: 9 }, [], { executionOwner: "feature", legacyPluginId: "BusImgPlugin", routes: ["list"], surfaces: ["list-page"] })', "List Feature-owned JavBus image layout contribution");
assertIncludes(registry, 'manifest("identity.javbus-navigation", "identity", null, ["javbus"], { javbus: 7 }, [], { executionOwner: "feature", legacyPluginId: "BusNavBarPlugin" })', "Identity Feature-owned JavBus navigation contribution");
assertIncludes(registry, 'manifest("detail.javbus-native", "identity", null, ["javbus"], { javbus: 10 }, [SERVICE.clipboard], { executionOwner: "feature", legacyPluginId: "BusDetailPagePlugin" })', "Identity Feature-owned JavBus native page contribution");
assert(!registry.includes('./status/bus-detail-page.js'), "JavBus native page behavior must not instantiate the retired legacy plugin");
assertIncludes(registry, 'manifest("identity.javdb-navigation", "identity", null, ["javdb"], { javdb: 8 }, [PORT.style, SERVICE.movie, SERVICE.navigation, SERVICE.notifications], { executionOwner: "feature", legacyPluginId: "NavBarPlugin" })', "Identity Feature-owned JavDB navigation contribution");
assertIncludes(registry, 'manifest("identity.image-search", "identity", null, ["javdb", "javbus"], { javdb: 11, javbus: 6 }, [], { executionOwner: "feature", legacyPluginId: "SearchByImagePlugin" })', "Identity Feature-owned image-search contribution");
assertIncludes(registry, 'manifest("detail.workspace", "detail", null, ["javdb", "javbus"], { javdb: 15, javbus: 11 }, [], { executionOwner: "feature", legacyPluginId: "DetailWorkspacePlugin" })', "Detail Feature-owned workspace contribution");
assertIncludes(registry, 'manifest("detail.javdb-native", "detail", null, ["javdb"], { javdb: 14 }, [], { executionOwner: "feature", legacyPluginId: "DetailPagePlugin" })', "Detail Feature-owned JavDB native contribution");
assert(!registry.includes('./status/bus-nav-bar.js'), "JavBus navigation must not instantiate the retired legacy plugin");
assert(!registry.includes('./status/nav-bar.js'), "JavDB navigation must not instantiate the retired legacy plugin");
assert(!registry.includes('./avatar/search-by-image.js'), "Image search must not instantiate the retired legacy plugin");
assert(!registry.includes('./compat/detail-workspace-adapter.js'), "Detail workspace must not instantiate the retired legacy plugin adapter");
assert(!registry.includes('./status/detail-page.js'), "JavDB detail links must not instantiate the retired legacy plugin");
assert(!registry.includes('./image-viewer/bus-img.js'), "JavBus image layout must not instantiate the retired legacy plugin");
assertIncludes(registry, 'manifest("external-bridge.translation", "translation", null, ["javdb", "javbus"]', "Feature-owned title translation contribution");
assert(!registry.includes('./translate/translate.js'), "title translation must not instantiate the retired legacy plugin");
const translationController = await read("src/features/translation/translation-controller.js");
assertIncludes(translationController, 'names?.includes("translateTitle")', "title translation live setting listener");
assertIncludes(translationController, "this.translation.translate(sourceText", "native title translation service");
assertIncludes(translationController, "generation === this.generation", "stale title translation response gate");
const pluginRuntimeReadyAt = bootstrap.indexOf('await jhsEventBus.emit("jhs-features-ready", {}, { broadcast: false });');
assert(pluginRuntimeReadyAt > bootstrap.indexOf("await context.registries.features.start();"), "feature-ready signal must follow Feature activation");
assertIncludes(otherSite, 'events?.on?.("jhs-features-ready"', "external sites insertion order readiness");
assertIncludes(otherSite, 'if (!legacyPluginsReady || settings.snapshot().enableLoadOtherSite === "no")', "external sites readiness and live setting gate");
assert(
  javbusPlugins.length === 0,
  "JavBus must not register a legacy ListPagePlugin executor"
);
assertIncludes(registry, 'manifest("external-bridge.123pan", "external-bridge", null, ["javdb", "javbus", "123pan"]', "native 123Pan credential contribution");
assertIncludes(registry, 'legacyPluginId: "OneTwoThreeOfflinePlugin"', "preserve the 6.5.1 123Pan disable ID");
assert(!registry.includes("./one-two-three/offline.js"), "123Pan token sync must not instantiate a legacy executor");
assertIncludes(registry, 'manifest("external-bridge.javtrailers", "external-bridge", null, ["javtrailers"]', "Feature-owned JavTrailers contribution");
assertIncludes(registry, 'manifest("external-bridge.subtitle", "external-bridge", null, ["subtitlecat"]', "Feature-owned SubtitleCat contribution");
assertIncludes(javTrailersController, 'href.includes("handle=1")', "JavTrailers preview route gate");
assertIncludes(javTrailersController, 'currentVideo.currentTime = 5', "JavTrailers preview timeline offset");
assertIncludes(subtitleCatController, 'new URLSearchParams(this.window.location.search).get("search")', "SubtitleCat search query filter");
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
sourceByFile.set("features/external-bridge/one-one-five-match-controller.js", one115Controller);
sourceByFile.set("features/external-bridge/fc2-catalog-controller.js", fc2By123Av);
sourceByFile.set("features/external-bridge/unified-offline-controller.js", unifiedOffline);
sourceByFile.set("features/external-bridge/offline-provider-registry.js", await read("src/features/external-bridge/offline-provider-registry.js"));
sourceByFile.set("features/discovery/task-execution-service.js", newVideoTaskSource);
sourceByFile.set("plugins/new-video/new-video.js", newVideoWorkspaceSource);
sourceByFile.set("features/list/list-compatibility-service.js", listPageSource);
for (const [file] of expectedPlugins) {
  sourceByFile.set(file, await read(file.startsWith("compat/") ? `src/${file}` : `src/plugins/${file}`));
}
sourceByFile.set("services/pan123-credential-service.js", one23Credential);
sourceByFile.set("core/storage.js", storage);
sourceByFile.set("core/logger.js", await read("src/core/logger.js"));
sourceByFile.set("core/javdb-api.js", await read("src/core/javdb-api.js"));
sourceByFile.set("core/http.js", await read("src/core/http.js"));
sourceByFile.set("core/event-bus.js", await read("src/core/event-bus.js"));
sourceByFile.set("core/state-model.js", stateModel);
sourceByFile.set("core/migration.js", migration);
sourceByFile.set("core/state-service.js", stateService);
sourceByFile.set("features/system/stats-controller.js", statsSource);
sourceByFile.set("features/system/responsive-shell-controller.js", mobileSource);
sourceByFile.set("core/utils.js", await read("src/core/utils.js"));
sourceByFile.set("ui/detail/review-panel.js", review);
sourceByFile.set("ui/detail/related-panel.js", related);
sourceByFile.set("features/list/javbus-image-layout-controller.js", await read("src/features/list/javbus-image-layout-controller.js"));
sourceByFile.set("features/list/list-host-markup-controller.js", await read("src/features/list/list-host-markup-controller.js"));
sourceByFile.set("features/list/list-cover-image-controller.js", await read("src/features/list/list-cover-image-controller.js"));
sourceByFile.set("features/list/list-actions-controller.js", listPageButton);
sourceByFile.set("features/list/cover-button-controller.js", await read("src/features/list/cover-button-controller.js"));
sourceByFile.set("features/library/favorite-actresses-controller.js", await read("src/features/library/favorite-actresses-controller.js"));
sourceByFile.set("features/library/blacklist-scan-controller.js", await read("src/features/library/blacklist-scan-controller.js"));
sourceByFile.set("integrations/host-list/blacklist-parser.js", await read("src/integrations/host-list/blacklist-parser.js"));
sourceByFile.set("features/library/title-keyword-controller.js", await read("src/features/library/title-keyword-controller.js"));
sourceByFile.set("features/identity/actress-info-controller.js", await read("src/features/identity/actress-info-controller.js"));
sourceByFile.set("features/identity/manifest.js", await read("src/features/identity/manifest.js"));
sourceByFile.set("features/identity/bus-navigation-controller.js", await read("src/features/identity/bus-navigation-controller.js"));
sourceByFile.set("features/identity/javbus-native-controller.js", await read("src/features/identity/javbus-native-controller.js"));
sourceByFile.set("services/clipboard-service.js", await read("src/services/clipboard-service.js"));
sourceByFile.set("features/detail/detail-controller.js", detailControllerSource);
sourceByFile.set("features/detail/detail-page-actions-controller.js", await read("src/features/detail/detail-page-actions-controller.js"));
sourceByFile.set("features/external-sites/other-sites-controller.js", otherSite);
sourceByFile.set("features/detail/javbus-preview-controller.js", await read("src/features/detail/javbus-preview-controller.js"));
sourceByFile.set("features/detail/javdb-preview-controller.js", await read("src/features/detail/javdb-preview-controller.js"));
sourceByFile.set("features/detail/magnet-filter-controller.js", await read("src/features/detail/magnet-filter-controller.js"));
sourceByFile.set("features/detail/screenshot-controller.js", await read("src/features/detail/screenshot-controller.js"));
sourceByFile.set("services/webdav-service.js", await read("src/services/webdav-service.js"));
sourceByFile.set("backup/setting.js", await read("src/plugins/backup/setting.js"));
sourceByFile.set("backup/setting-backup.js", await read("src/plugins/backup/setting-backup.js"));
sourceByFile.set("backup/setting-styles.js", await read("src/plugins/backup/setting-styles.js"));
sourceByFile.set("backup/setting-templates.js", await read("src/plugins/backup/setting-templates.js"));
sourceByFile.set("backup/setting-panels.js", await read("src/plugins/backup/setting-panels.js"));
sourceByFile.set("backup/setting-forms.js", await read("src/plugins/backup/setting-forms.js"));

const regressionMatrix = [
  ["JavDB 列表页", [["features/list/list-compatibility-service.js", "filterMovieList"], ["features/list/list-actions-controller.js", "ListActionsController"], ["features/list/list-cover-image-controller.js", "ListCoverImageController"], ["features/list/cover-button-controller.js", "CoverButtonController"], ["core/storage.js", "getStatusMap"]]],
  ["JavDB 详情页", [["features/detail/detail-controller.js", "locateDetailExternalLinks"], ["features/detail/detail-page-actions-controller.js", "showStatus"], ["features/detail/magnet-filter-controller.js", "class MagnetFilterController"], ["features/detail/javdb-preview-controller.js", "class JavDbPreviewController"]]],
  ["JavDB 演员页", [["features/library/favorite-actresses-controller.js", "FavoriteActressesController"], ["integrations/host-list/blacklist-parser.js", "getBlacklistSubjectInfo"], ["features/identity/actress-info-controller.js", "ActressInfoController"]]],
  ["JavBus 列表页", [["features/list/list-host-markup-controller.js", "ListHostMarkupController"], ["features/list/list-cover-image-controller.js", "replaceOne(image)"], ["features/list/javbus-image-layout-controller.js", "JavBusImageLayoutController"], ["features/list/list-actions-controller.js", "ListActionsController"]]],
  ["JavBus 详情页", [["features/identity/javbus-native-controller.js", "openGenreLinksInNewTabs"], ["services/clipboard-service.js", "copyText"], ["features/detail/javbus-preview-controller.js", "class JavBusPreviewController"]]],
  ["JavBus 导航栏", [["features/identity/bus-navigation-controller.js", "BusNavigationController"], ["features/identity/manifest.js", "identity.javbus-navigation"]]],
  ["123pan 授权同步", [["services/pan123-credential-service.js", "startTokenSync(scope)"], ["services/pan123-credential-service.js", "visibilitychange"], ["services/pan123-credential-service.js", "syncFallbackMs = 3e5"]]],
  ["统一离线提交", [["features/external-bridge/unified-offline-controller.js", "getAvailability"], ["features/external-bridge/unified-offline-controller.js", "capabilities"], ["features/external-bridge/unified-offline-controller.js", "appendOfflineHistory"]]],
  ["新作品检测", [["features/discovery/task-execution-service.js", "TaskExecutionService"], ["plugins/new-video/new-video.js", "NewVideoPlugin"], ["core/storage.js", "newVideoList"]]],
  ["黑名单检测", [["features/library/blacklist-scan-controller.js", "BlacklistScanController"], ["integrations/host-list/blacklist-parser.js", "parseBlacklistFilterPage"], ["core/storage.js", "batchSaveBlacklistCarList"]]],
  ["统计面板", [["features/system/stats-controller.js", "class StatsController"], ["features/system/stats-controller.js", "coverageStart"], ["features/system/stats-controller.js", "6.4.0"]]],
  ["数据导入导出", [["backup/setting-backup.js", "importSettingData"], ["backup/setting-backup.js", "exportSettingData"], ["core/storage.js", "exportData"]]],
  ["WebDAV 备份", [["services/webdav-service.js", "class WebDavClient"], ["backup/setting-backup.js", "backupDataByWebDav"], ["services/webdav-service.js", "PROPFIND"]]],
  ["图片查看器", [["core/logger.js", "showImageViewer"], ["core/logger.js", "new Viewer"], ["features/detail/screenshot-controller.js", "class ScreenshotController"]]],
  ["第三方请求失败场景", [["core/storage.js", "cachedRequest"], ["core/http.js", "onerror"], ["features/external-sites/other-sites-controller.js", "detectOtherSites"]]],
  ["多标签页同步", [["core/event-bus.js", "eventId"], ["core/event-bus.js", "originId"], ["features/list/list-compatibility-service.js", "list-items-added"]]],
  ["快速筛选", [["features/list/list-compatibility-service.js", "createQuickFilter"], ["features/list/list-compatibility-service.js", "setQuickFilter"], ["features/list/list-compatibility-service.js", "blockedItems"]]],
  ["标记状态与隐藏", [["features/list/list-compatibility-service.js", "data-jhs-flags"], ["features/list/list-compatibility-service.js", "visibilityReasons"], ["core/state-model.js", "syncLegacyStatus"]]],
  ["版本迁移", [["core/migration.js", "DATA_MIGRATIONS"], ["core/migration.js", "migration-snapshot"], ["core/migration.js", "collision"]]],
  ["可恢复状态事务", [["core/state-service.js", "mutation_journal"], ["core/state-service.js", 'commitState: "pending"'], ["core/state-service.js", "recoverPendingTransaction"]]],
  ["离线能力路由", [["features/external-bridge/offline-provider-registry.js", "capabilities.includes(type)"], ["features/external-bridge/offline-provider-registry.js", '"ready", "unknown"'], ["features/external-bridge/unified-offline-controller.js", "getCandidates(resource"]]],
  ["115 增量匹配", [["features/external-bridge/one-one-five-match-controller.js", "IntersectionObserver"], ["features/external-bridge/one-one-five-match-controller.js", 'rootMargin: "200px"'], ["features/external-bridge/one-one-five-match-controller.js", "list-items-added"]]],
  ["设置页", [["backup/setting.js", "SettingPlugin"], ["backup/setting-backup.js", "importSettingData"]]],
  ["演员信息解析", [["integrations/host-list/blacklist-parser.js", "getBlacklistSubjectInfo"], ["features/list/list-compatibility-service.js", "parseActressName"]]],
  ["移动端适配", [["features/system/responsive-shell-controller.js", "ResponsiveShellController"], ["features/system/responsive-shell-controller.js", "this._animationTimers.add(timer)"], ["core/utils.js", "isMobileMode"]]]
];

assert(!one115Controller.includes("new MutationObserver"), "115 must reuse the ListPage MutationObserver");
for (const [file, source] of [
  ["features/list/list-compatibility-service.js", listPageSource],
  ["features/detail/detail-page-actions-controller.js", sourceByFile.get("features/detail/detail-page-actions-controller.js")],
  ["plugins/new-video/new-video.js", sourceByFile.get("plugins/new-video/new-video.js")],
  ["features/system/stats-controller.js", sourceByFile.get("features/system/stats-controller.js")]
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

const fc2Source = fc2;
const fc2By123AvSource = sourceByFile.get("features/external-bridge/fc2-catalog-controller.js");
const workspaceSource = detailWorkspace;
const reviewSource = sourceByFile.get("ui/detail/review-panel.js");
assertIncludes(fc2Source, "mountFc2Detail", "FC2 owned workspace");
assertIncludes(fc2Source, "magnetHubPromise ||=", "FC2 lazy magnet single-flight");
assertIncludes(fc2DetailWorkspace, "createFc2DetailContext", "FC2 owned workspace");
assertIncludes(fc2By123AvSource, "async loadDetail(context, url)", "123AV FC2 adapter");
assert(!fc2Source.includes("organizeJhsOwnedDetailWorkspace"), "FC2 must render directly into owned slots");
assert(!fc2By123AvSource.includes("organizeJhsOwnedDetailWorkspace"), "123AV FC2 must reuse the owned shell");
assert(!reviewSource.includes("R(movieId, 2, pageSize).catch"), "review page 2 must only load on demand");
assert(!sourceMain.includes("isFc2Page"), "FC2 title filtering must bind to the mounted detail root");

const devBuilder = await read("scripts/build-dev.mjs");
assertIncludes(devBuilder, '"JHS-7.0.dev.user.js"', "isolated migration build output");
assertIncludes(devBuilder, "JHS Dev 7.0", "isolated migration build name");
assertIncludes(devBuilder, "https://github.com/Teamper/JHS/dev/7.0", "isolated migration namespace");
assertIncludes(devBuilder, "7.0.0-dev.${timestamp}", "isolated migration version identifier");

console.log(
  `Regression checks passed for ${version}: ${expectedPlugins.length} plugins, ${regressionMatrix.length} scopes, ${stableReleaseChecks.length} stable release checks`
);
