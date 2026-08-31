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

function extractContributionOrder(registrySource, site) {
  return registrySource.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/manifest\("[^"]+",\s*"[^"]+",\s*(\w+),\s*\[([^\]]+)\],\s*\{([^}]+)\}(?:,\s*\[[^\]]*\])?(?:,\s*\{[^}]*\})?\)/);
    if (!match || !match[2].includes(`"${site}"`)) return [];
    const order = match[3].match(new RegExp(`(?:^|,\\s*)\\s*(?:"${site}"|${site})\\s*:\\s*(\\d+)`));
    assert(order, `Missing ${site} order for ${match[1]}`);
    return [{ plugin: match[1], order: Number(order[1]) }];
  }).filter((item) => item.order > 0).sort((left, right) => left.order - right.order).map((item) => item.plugin);
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
const stateDomains = await read("src/core/state-domains.js");
const mutationCoordinator = await read("src/core/storage-mutation-coordinator.js");
const bootstrap = await read("src/app/bootstrap.js");
const registry = await read("src/plugins/registry.js");
const detailWorkspace = await read("src/plugins/status/detail-workspace.js");
const fc2DetailWorkspace = await read("src/ui/detail/fc2-detail-workspace.js");
const javDbHostAdapter = await read("src/platform/hosts/javdb-host-adapter.js");
const unifiedOfflineControllerSource = await read("src/features/external-bridge/unified-offline-controller.js");
const hitShow = await read("src/features/discovery/hit-show-controller.js");
const top250 = await read("src/features/discovery/top250-controller.js");
const listPageButton = await read("src/plugins/status/list-page-button.js");
const historySource = await read("src/features/library/history-controller.js");
const blacklistControllerSource = await read("src/features/library/blacklist-controller.js");
const blacklistRepositorySource = await read("src/features/library/blacklist-repository.js");
const libraryManifestSource = await read("src/features/library/manifest.js");
const libraryControllerSource = await read("src/features/library/library-controller.js");
const externalBridgeManifestSource = await read("src/features/external-bridge/manifest.js");
const externalBridgeControllerSource = await read("src/features/external-bridge/external-bridge-controller.js");
const externalBridgeTranslationSource = await read("src/features/external-bridge/translation-controller.js");
const one23AuthControllerSource = await read("src/features/external-bridge/one-two-three-controller.js");
const one115ControllerSource = await read("src/features/external-bridge/one-one-five-controller.js");
const javTrailersControllerSource = await read("src/features/external-bridge/javtrailers-controller.js");
const subtitleControllerSource = await read("src/features/external-bridge/subtitle-cat-controller.js");
const discoveryManifestSource = await read("src/features/discovery/manifest.js");
const discoveryControllerSource = await read("src/features/discovery/discovery-controller.js");
const compatibilityManifestSource = await read("src/features/compatibility/manifest.js");
const compatibilityControllerSource = await read("src/features/compatibility/compatibility-controller.js");
const statsManifestSource = await read("src/features/stats/manifest.js");
const statsControllerSource = await read("src/features/stats/stats-controller.js");
const statsSource = statsControllerSource;
const listBatchServiceSource = await read("src/features/list/list-batch-service.js");
const listFilterServiceSource = await read("src/features/list/list-filter-service.js");
const listIncrementalServiceSource = await read("src/features/list/list-incremental-service.js");
const listFiltersSource = await read("src/features/list/list-filters.js");
const fc2 = await read("src/plugins/external-search/fc2.js");
const fc2By123Av = await read("src/plugins/external-search/fc2-by-123av.js");
const uiPrimitives = await read("src/core/ui-primitives.js");
const history = await read("src/features/library/history-controller.js");
const review = await read("src/plugins/external-search/review.js");
const related = await read("src/plugins/external-search/related.js");
const mobileSource = await read("src/plugins/status/mobile-bottom-bar.js");
const settingSource = await read("src/plugins/backup/setting.js");
const settingFormsSource = await read("src/plugins/backup/setting-forms.js");
const settingTemplatesSource = await read("src/plugins/backup/setting-templates.js");
const magnetHubSource = await read("src/plugins/external-search/magnet-hub.js");
const newVideoTaskSource = await read("src/plugins/new-video/task.js");
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
assertIncludes(ciWorkflow, "workflow_dispatch:", "manual CI trigger");
assertIncludes(ciWorkflow, "node-version: 20", "minimum Node compatibility check");
assertIncludes(ciWorkflow, "node-version: 22", "full Node check");
assertIncludes(ciWorkflow, "needs: [node20, check, browser-smoke]", "release check dependency");
assertIncludes(ciWorkflow, "contents: write", "release write permission");
assertIncludes(ciWorkflow, "--base-ref", "version-change release detection");
assertIncludes(ciWorkflow, "github.ref == 'refs/heads/main'", "release restricted to main pushes");
assertIncludes(packageJson.scripts["check:release"] ?? "", "check:release-smoke", "manual Tampermonkey release smoke gate");
assertIncludes(ciWorkflow, "queue: max", "release concurrency queue");
assertIncludes(ciWorkflow, "cancel-in-progress: false", "release concurrency preservation");
assertIncludes(ciWorkflow, "git tag -a", "annotated release tag");
assertIncludes(ciWorkflow, "gh release create", "immutable release creation");
assert(!ciWorkflow.includes("--clobber"), "release workflow must not overwrite an existing asset");
assert(!ciWorkflow.includes("gh release upload"), "release workflow must not update an existing release");
assert(!ciWorkflow.includes("JHS-dev.user.js"), "release workflow must not build dev artifacts");
assertIncludes(buildScript, "bundle: true", "performance bundled build");
assertIncludes(buildScript, "keepNames: true", "performance bundled build");
assertIncludes(buildScript, "minifySyntax: false", "performance bundled build");
assertIncludes(buildScript, "minifyWhitespace: true", "performance bundled build");
assertIncludes(buildScript, "minifyIdentifiers: false", "performance bundled build");
assertIncludes(buildScript, 'contents.replace(/\\/\\*\\*[\\s\\S]*?\\*\\//g, "")', "production bundle strips source-only JSDoc");

assertIncludes(mutationCoordinator, 'STORAGE_MUTATION_LOCK = "jhs_storage_mutation_v1"', "storage mutation lock identity");
assertIncludes(stateDomains, "favoriteActresses", "canonical state domain registry");
assertIncludes(stateDomains, "offlineHistory", "canonical state domain registry");
assertIncludes(stateService, "this.mutationCoordinator?.runExclusive", "state mutation coordinator injection");
assert(!stateService.includes("jhs_state_mutation"), "state service must not own a second mutation lock");
assert(!migration.includes("jhs_data_migration"), "migration must not own a second mutation lock");
assertIncludes(storage, "_withStorageMutation", "storage mutation coordinator boundary");
assertIncludes(storage, "runDataMigrationsWithoutLock", "import and migration must share one lock scope");
const recoveryIndex = bootstrap.indexOf("await stateService.recoverPendingTransactionWithoutLock();");
const migrationIndex = bootstrap.indexOf("await runDataMigrationsWithoutLock(storageManager);");
const featureStartIndex = bootstrap.indexOf("await context.registries.features.start();");
const preparationLockIndex = bootstrap.indexOf("await storageMutationCoordinator.runExclusive(async () => {");
assert(preparationLockIndex > -1 && recoveryIndex > preparationLockIndex && migrationIndex > recoveryIndex && featureStartIndex > migrationIndex, "persistent recovery and migration must precede feature activation under one mutation lock");

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
  ["import format compatibility", storage, "runDataMigrationsWithoutLock(this)"],
  ["export format compatibility", storage, "async exportData()"],
  ["export format compatibility", storage, "exportPortableData"],
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

for (const token of ["eventId", "originId", "timestamp", "this.seen", "options.broadcast", '"legacy-refresh"']) {
  assertIncludes(eventBus, token, "precise event bus");
}
assertIncludes(eventBus, "event.originId === this.originId", "self-event suppression");
assertIncludes(eventBus, "this._dispatch(event)", "received events stay local");
assert(!eventBus.includes("this.channel.postMessage(event);\n        await this._dispatch(event)"), "received events must not be rebroadcast");

// List page function signature assertions
const listPageSource = await read("src/plugins/status/list-page.js");
const identityManifestSource = await read("src/features/identity/manifest.js");
const identityControllerSource = await read("src/features/identity/identity-controller.js");
const identityNavigationSource = await read("src/features/identity/identity-navigation-controller.js");
const identityBusNavigationSource = await read("src/features/identity/identity-bus-navigation-controller.js");
const identityImageSearchSource = await read("src/features/identity/identity-image-search-controller.js");
const identityActressSource = await read("src/features/identity/identity-actress-info-controller.js");
const listManifestSource = await read("src/features/list/manifest.js");
const listControllerSource = await read("src/features/list/list-controller.js");
const listDomObserverSource = await read("src/features/list/list-dom-observer.js");
const listMediaSource = await read("src/features/list/list-media-controller.js");
const listImageSource = await read("src/features/list/list-image-controller.js");
const listEventSource = await read("src/features/list/list-event-controller.js");
const listEvaluationSource = await read("src/features/list/list-evaluation-service.js");
const listSummarySource = await read("src/features/list/list-summary-service.js");
const listDiagnosticsSource = await read("src/features/list/list-diagnostics-service.js");
const listTranslationSource = await read("src/features/list/list-translation-service.js");
const architectureSource = await read("scripts/architecture-check.mjs");
const listPageAdapterSource = await read("src/compat/list-page-adapter.js");
const listViewSource = await read("src/features/list/list-view.js");
const listActionsSource = await read("src/plugins/status/list-page-button.js");
const autoPageSource = await read("src/plugins/status/auto-page.js");
const foldCategorySource = await read("src/plugins/status/fold-category.js");
const coverButtonSource = await read("src/plugins/image-viewer/cover-button.js");
const compatibilitySource = compatibilityControllerSource;
const statusImport = libraryControllerSource;
const responsiveShellSource = await read("src/features/system/responsive-shell-controller.js");
assertIncludes(listPageSource, "applyVisibility(items = null)", "list page function signature");
assertIncludes(listPageSource, "async filterMovieList(", "list page function signature");
assertIncludes(listPageSource, "async doFilter(revision =", "list page function signature");
assertIncludes(listManifestSource, 'id: "list"', "real list feature manifest");
assertIncludes(listManifestSource, 'contributes: ["list.core", "list.auto-page", "list.fold-category", "list.actions", "list.fc2-navigation", "list.cover-state-actions", "list.javbus-images", "list.fc2-lookup"]', "list feature contribution ownership");
assertIncludes(listManifestSource, 'legacyApiAliases: ["ListPagePlugin"]', "list compatibility API alias");
assertIncludes(listManifestSource, "REGISTRY.feature", "list direct Feature API dependency");
assertIncludes(listManifestSource, 'resolveLegacyPlugin?.("BusImgPlugin")', "list JavBus image contribution boundary");
assert(!listManifestSource.includes('resolveLegacyPlugin?.("ListPagePlugin")'), "List core must not resolve ListPagePlugin");
assertIncludes(listManifestSource, "http: deps[SERVICE.http]", "list batch HTTP service injection");
assertIncludes(listManifestSource, "stateService: deps[SERVICE.state]", "list batch state service injection");
assertIncludes(listPageAdapterSource, "class ListPagePluginAdapter extends BasePlugin", "list compatibility shell");
assertIncludes(listPageAdapterSource, "const delegate = new ListPagePlugin()", "list feature delegate construction");
assertIncludes(registry, 'ListPagePluginAdapter as ListPagePlugin', "list registry compatibility shell");
assertIncludes(listControllerSource, "this.domObserver?.start()", "list DOM observer startup ownership");
assert(!listControllerSource.includes("this.legacyPlugin?.attachList"), "list controller must not hand off owned services to the legacy plugin");
assert(!listControllerSource.includes("legacyPlugin"), "list controller must not depend on the legacy plugin");
assertIncludes(listControllerSource, ".then(() => this.startListLifecycle())", "list initial lifecycle startup ownership");
assert(!listControllerSource.includes("skipOwnedListLifecycle"), "list controller must not delegate its lifecycle to the legacy plugin");
assertIncludes(listControllerSource, "async startListLifecycle()", "list initial lifecycle ownership");
assertIncludes(listControllerSource, "this.hostAdapter.prepareList?.()", "list host preparation ownership");
assertIncludes(listControllerSource, "this.filter?.doFilter?.(revision)", "list initial filtering ownership");
assertIncludes(listControllerSource, "LIST_FEATURE_CSS", "list feature style ownership");
assertIncludes(listControllerSource, "captureListRevision: () => this.state.captureListRevision()", "list revision API ownership");
assertIncludes(listPageSource, "options.skipOwnedDomObserver || this.checkDom(scope)", "legacy list DOM observer fallback");
assertIncludes(listPageSource, "options.skipOwnedInteractions || await this.bindClick()", "legacy list interaction fallback");
assertIncludes(listPageSource, "if (options.skipOwnedListLifecycle) return", "legacy list lifecycle fallback");
assertIncludes(listControllerSource, "new ListView({", "list view host boundary");
assertIncludes(listControllerSource, "new ListDomObserver({", "list DOM observer ownership");
assertIncludes(listControllerSource, "new ListMediaController({", "list media lifecycle ownership");
assertIncludes(listControllerSource, "new ListImageController({", "list image lifecycle ownership");
assertIncludes(listControllerSource, "new ListEventController({", "list event lifecycle ownership");
assertIncludes(listControllerSource, "new ListEvaluationService({", "list evaluation context ownership");
assertIncludes(listControllerSource, "new ListSummaryService({", "list summary ownership");
assertIncludes(listControllerSource, 'this.features?.getFeatureApi?.("library")', "list Library Feature API ownership");
assertIncludes(listControllerSource, "this.busImgPlugin?.logImageHeightsByRow", "list JavBus image contribution ownership");
assertIncludes(listControllerSource, "createEvaluationContext()", "list evaluation capability boundary");
assert(!listEventSource.includes("legacyPlugin"), "list events must not depend on the legacy filter plugin");
assertIncludes(listControllerSource, "new ListTranslationService({", "list translation ownership");
assertIncludes(listControllerSource, "new ListFilterService({", "list filter service ownership");
assertIncludes(listControllerSource, "this.hostAdapter.prepareListItems?.(items)", "list host incremental normalization");
assertIncludes(listControllerSource, "new ListContextMenuController({", "list context-menu ownership");
assertIncludes(listControllerSource, "new ListPaginationController({", "list pagination ownership");
assertIncludes(listControllerSource, "this.pagination?.start()", "list pagination lifecycle ownership");
assertIncludes(listControllerSource, "new ListTagExpandController({", "list actor-tag ownership");
assertIncludes(listControllerSource, "onOpenMovieDetail:", "list navigation action ownership");
assertIncludes(listControllerSource, "this.openMovieDetail(item, options)", "list navigation API ownership");
assertIncludes(listControllerSource, "showCarNumBox: (/** @type {string} */ carNum) => this.showCarNumBox(carNum)", "list card reveal API ownership");
assertIncludes(listControllerSource, "bindClick: () => this.bindClick()", "list interaction API ownership");
assertIncludes(listControllerSource, 'configureHoverPreview: route(this.images, "configureHoverPreview")', "list image API ownership");
assertIncludes(listControllerSource, 'rebuildItemIndex: route(this.index, "rebuildItemIndex")', "list index API ownership");
assertIncludes(listControllerSource, 'bindMovieDetailNavigation: route(this.view, "bindMovieDetailNavigation")', "list view API ownership");
assertIncludes(listControllerSource, "createEvaluationContext()", "list evaluation API ownership");
assertIncludes(listControllerSource, 'getCurrentPageSummary: route(this.summary, "collectCurrentPageSummary")', "list summary API ownership");
assertIncludes(listControllerSource, "new ListBatchService({", "list batch service ownership");
assertIncludes(listControllerSource, "new ListIncrementalService({", "list incremental service ownership");
assertIncludes(listPageSource, "if (this.listIncremental) return this.listIncremental.processAddedItems", "legacy list incremental compatibility handoff");
assertIncludes(listPageSource, "if (this.listFilter) return this.listFilter.doFilterItems", "legacy list filter compatibility handoff");
assertIncludes(listPageSource, "this.listHostAdapter?.prepareList", "legacy list host compatibility handoff");
assertIncludes(listPageSource, "if (this.listContextMenu)", "legacy list context-menu compatibility handoff");
assertIncludes(listEventSource, "this.filter?.doFilter?.(revision)", "list event filter ownership");
assertIncludes(listEventSource, "this.filter?.doFilter?.(revision)", "list event filter ownership");
assertIncludes(listEventSource, "this.filter?.doFilterItems?.(items, revision)", "list state event filter ownership");
assertIncludes(listFilterServiceSource, "evaluateListItem({ carNum, title }", "list filter evaluation ownership");
assertIncludes(listFilterServiceSource, "data-jhs-state-signature", "list filter state metadata ownership");
assertIncludes(listIncrementalServiceSource, 'this.eventBus?.emit?.("list-items-added"', "list incremental event ownership");
assertIncludes(listIncrementalServiceSource, 'dataset.jhsProcessed = "true"', "list incremental processed marker ownership");
assertIncludes(listControllerSource, "readItem: (item) => this.readListItem(item)", "list card reader ownership");
assertIncludes(listControllerSource, "findCarNumAndHref: (/** @type {any} */ item) => this.readListItem(item)", "list card reader capability");
assertIncludes(listControllerSource, "onFilterChange: (filter, options)", "list view filter callback boundary");
assertIncludes(listControllerSource, "const batch = /** @type {any} */ (this.batch)", "list batch capability boundary");
assertIncludes(listControllerSource, "this.scope.ownTimeout(setTimeout", "list action deferred lifecycle handoff");
assertIncludes(listControllerSource, "fc2NavigationPlugin?.handle?.({ scope: this.scope })", "FC2 list navigation feature handoff");
assertIncludes(listControllerSource, "coverPlugin?.handle?.({ scope: this.scope, listFeatureApi })", "list card actions feature handoff");
assertIncludes(listControllerSource, "fc2LookupPlugin?.handle?.({ scope: this.scope })", "123AV lookup feature handoff");
assertIncludes(listDomObserverSource, "scope.observe(root", "list DOM observer lifecycle ownership");
assertIncludes(listDomObserverSource, "scope.ownTimeout(this.processTimer)", "list DOM debounce lifecycle ownership");
assertIncludes(listMediaSource, "scope.listen(root, \"click\"", "list media listener lifecycle ownership");
assertIncludes(listImageSource, "scope.ownObserver(this.hdImageObserver)", "list image observer lifecycle ownership");
assertIncludes(listImageSource, "hdPendingCleanups", "list image pending listener ownership");
assertIncludes(listEventSource, "scope.listen(this.settings, \"settings.changed\"", "list settings listener lifecycle ownership");
assertIncludes(listEventSource, "legacy-refresh", "list refresh event ownership");
assertIncludes(listEventSource, "this.evaluation?.invalidate()", "list evaluation cache invalidation");
assertIncludes(listPageSource, "this.listMedia ? this.listMedia.start()", "legacy list media compatibility handoff");
assertIncludes(listPageSource, "if (this.listBatch) return this.listBatch.batchSaveAllVideos", "legacy list batch compatibility handoff");
assertIncludes(listPageSource, "applyListSummary(summary)", "legacy list summary compatibility handoff");
assertIncludes(listPageSource, "if (this.listImages) return this.listImages.replaceHdImg(e);", "legacy list image compatibility handoff");
assertIncludes(listPageSource, "if (this.listDomObserver) return this.listDomObserver.start();", "legacy list DOM observer compatibility handoff");
assertIncludes(listBatchServiceSource, "scanAllPages({", "list batch scanner ownership");
assertIncludes(listBatchServiceSource, "stateService.patch(chunk.map((item) => item.carNum)", "list batch state write ownership");
assertIncludes(listBatchServiceSource, "scope.ownTimeout(timer)", "list batch progress lifecycle ownership");
assertIncludes(listEvaluationSource, "stateService.getActivityLog()", "list evaluation activity snapshot ownership");
assertIncludes(listEvaluationSource, "invalidate()", "list evaluation cache lifecycle ownership");
assertIncludes(listSummarySource, "scope.ownTimeout(timer)", "list summary timer lifecycle ownership");
assertIncludes(listSummarySource, "collectCurrentPageSummary()", "list summary aggregation ownership");
assert(!listControllerSource.includes("applyListSummary"), "feature list summary must not project to legacy plugin");
assertIncludes(listControllerSource, "new ListDiagnosticsService({", "list diagnostics ownership");
assertIncludes(listControllerSource, "this.diagnostics?.recordPhase", "list diagnostics lifecycle handoff");
assertIncludes(listDiagnosticsSource, "globalThis).__jhsBrowserDiagnostics", "list browser diagnostics boundary");
assertIncludes(listDiagnosticsSource, "phases.length > 200", "list diagnostics bounded history");
assertIncludes(architectureSource, 'id: "business-legacy-runtime-reference"', "business legacy runtime architecture gate");
assertIncludes(architectureSource, 'id: "business-unsafe-window"', "business unsafeWindow architecture gate");
assertIncludes(architectureSource, 'id: "business-global-service"', "business global service architecture gate");
assertIncludes(listTranslationSource, "translationGeneration", "list translation generation ownership");
assertIncludes(listTranslationSource, "mapLimit(items, 3", "list translation concurrency ownership");
const detailControllerSource = await read("src/features/detail/detail-controller.js");
const detailManifestSource = await read("src/features/detail/manifest.js");
const detailWorkspaceSource = await read("src/plugins/status/detail-workspace.js");
const detailPageSource = await read("src/plugins/status/detail-page.js");
const busDetailPageSource = await read("src/plugins/status/bus-detail-page.js");
const detailReviewSource = await read("src/plugins/external-search/review.js");
const detailRelatedSource = await read("src/plugins/external-search/related.js");
const screenshotSource = await read("src/plugins/image-viewer/screenshot.js");
const highlightMagnetSource = await read("src/plugins/status/highlight-magnet.js");
const detailPageButtonSource = await read("src/plugins/status/detail-page-button.js");
const previewVideoSource = await read("src/plugins/image-viewer/preview-video.js");
const busPreviewVideoSource = await read("src/plugins/image-viewer/bus-preview-video.js");
const otherSiteSource = await read("src/plugins/external-search/other-site.js");
assertIncludes(detailControllerSource, "nativePlugin?.handle?.({ scope: this.scope })", "native detail feature handoff");
assertIncludes(detailControllerSource, "workspacePlugin?.handle?.({ scope: this.scope })", "detail workspace feature handoff");
assertIncludes(detailManifestSource, '"detail.workspace"', "detail workspace contribution selection");
assertIncludes(detailManifestSource, '"detail.javdb-native"', "JavDB native detail contribution selection");
assertIncludes(detailManifestSource, '"detail.javbus-native"', "JavBus native detail contribution selection");
assertIncludes(detailWorkspaceSource, "options.scope ?? await this.getRuntimeService(\"scope\")()", "detail workspace injected scope");
assertIncludes(detailPageSource, "export class DetailPagePlugin", "JavDB native detail implementation");
assertIncludes(busDetailPageSource, "export class BusDetailPagePlugin", "JavBus native detail implementation");
assertIncludes(detailControllerSource, "reviewPlugin?.handle?.({ scope: this.scope })", "detail review feature handoff");
assertIncludes(detailControllerSource, "relatedPlugin?.handle?.({ scope: this.scope })", "detail related feature handoff");
assertIncludes(detailControllerSource, "screenshotPlugin?.handle?.({ scope: this.scope })", "detail screenshot feature handoff");
assertIncludes(detailControllerSource, "magnetPlugin?.handle?.({ scope: this.scope })", "detail magnet feature handoff");
assertIncludes(detailControllerSource, "pageActionsPlugin?.handle?.({ scope: this.scope })", "detail page actions feature handoff");
assertIncludes(detailReviewSource, "options.scope ?? await this.getRuntimeService(\"scope\")()", "detail review injected scope");
assertIncludes(detailRelatedSource, "options.scope ?? await this.getRuntimeService(\"scope\")()", "detail related injected scope");
assertIncludes(screenshotSource, "options.scope ?? await this.getRuntimeService(\"scope\")()", "detail screenshot injected scope");
assertIncludes(highlightMagnetSource, "options.scope ?? await this.getRuntimeService(\"scope\")()", "detail magnet injected scope");
assertIncludes(detailPageButtonSource, "options.scope ?? await this.getRuntimeService(\"scope\")()", "detail page actions injected scope");
assertIncludes(detailControllerSource, "previewPlugin?.handle?.({ scope: this.scope })", "detail preview feature handoff");
assertIncludes(previewVideoSource, "options.scope ?? await this.getRuntimeService(\"scope\")()", "JavDB preview injected scope");
assertIncludes(busPreviewVideoSource, "options.scope ?? await this.getRuntimeService(\"scope\")()", "JavBus preview injected scope");
assertIncludes(detailControllerSource, "externalSitesPlugin?.handle?.({ scope: this.scope })", "detail external sites feature handoff");
assertIncludes(otherSiteSource, "options.scope ?? await this.getRuntimeService(\"scope\")()", "detail external sites injected scope");
assertIncludes(listViewSource, "export class ListView", "real list view");
assertIncludes(listViewSource, "shouldShowItem({ filter: normalizedFilter", "list view shared filter semantics");
assertIncludes(listViewSource, "async createQuickFilter(initialFilter)", "list view quick-filter ownership");
assertIncludes(listViewSource, "bindMovieDetailNavigation(container)", "list view navigation ownership");
assertIncludes(listPageSource, "return this.getListView().createQuickFilter", "list quick-filter compatibility adapter");
assertIncludes(listPageSource, "return this.getListView().bindMovieDetailNavigation", "list navigation compatibility adapter");
assertIncludes(hitShow, 'getFeatureApi("list")', "hit-show list feature API boundary");
assert(!hitShow.includes('getOptionalDependency("ListPagePlugin")'), "hit-show must not resolve ListPagePlugin directly");
assertIncludes(listActionsSource, 'getFeatureApi("list")', "list actions feature API boundary");
assert(!listActionsSource.includes('getOptionalDependency("ListPagePlugin")'), "list actions must not resolve ListPagePlugin directly");
assertIncludes(autoPageSource, 'getFeatureApi("list")', "auto-page feature API boundary");
assert(!autoPageSource.includes('getOptionalDependency("ListPagePlugin")'), "auto-page must not resolve ListPagePlugin directly");
assertIncludes(foldCategorySource, "options.scope", "fold category feature lifecycle handoff");
assertIncludes(responsiveShellSource, "this.plugin?.handle?.({ scope: this.scope })", "responsive shell feature lifecycle handoff");
assertIncludes(coverButtonSource, 'getFeatureApi("list")', "cover actions feature API boundary");
assert(!coverButtonSource.includes('getOptionalDependency("ListPagePlugin")'), "cover actions must not resolve ListPagePlugin directly");
assertIncludes(historySource, 'getFeatureApi("list")', "history list API boundary");
assert(!historySource.includes('getOptionalDependency("ListPagePlugin")'), "history must not resolve ListPagePlugin directly");
assertIncludes(compatibilitySource, 'getFeatureApi?.("list")', "compatibility list API boundary");
assert(!compatibilitySource.includes('getOptionalDependency("ListPagePlugin")'), "compatibility must not resolve ListPagePlugin directly");
assertIncludes(statsSource, 'getFeatureApi("list")', "stats list API boundary");
assert(!statsSource.includes('getOptionalDependency("ListPagePlugin")'), "stats must not resolve ListPagePlugin directly");
assertIncludes(mobileSource, 'getFeatureApi("list")', "mobile list API boundary");
assert(!mobileSource.includes('getOptionalDependency("ListPagePlugin")'), "mobile must not resolve ListPagePlugin directly");
assert(!mobileSource.includes('getOptionalDependency("BlacklistPlugin")'), "mobile must not resolve BlacklistPlugin directly");
assert(!settingSource.includes('getOptionalDependency("ListPagePlugin")'), "settings must not resolve ListPagePlugin directly");
assert(!settingSource.includes('getOptionalDependency("BlacklistPlugin")'), "settings must not resolve BlacklistPlugin directly");
assert(!newVideoTaskSource.includes('getOptionalDependency("BlacklistPlugin")'), "scheduler must not resolve BlacklistPlugin directly");
assert(!listPageButton.includes('getOptionalDependency("BlacklistPlugin")'), "list actions must not resolve BlacklistPlugin directly");
assert(!listPageButton.includes('getOptionalDependency("HistoryPlugin")'), "list actions must not resolve HistoryPlugin directly");
assert(!fc2.includes('getOptionalDependency("FilterTitleKeywordPlugin")'), "FC2 must not resolve FilterTitleKeywordPlugin directly");
assertIncludes(libraryManifestSource, 'id: "library"', "real library feature manifest");
assertIncludes(libraryManifestSource, 'new LibraryController({', "library feature controller ownership");
assertIncludes(libraryManifestSource, 'new BlacklistController({', "library blacklist controller ownership");
assert(!libraryManifestSource.includes('resolveLegacyPlugin?.("SettingPlugin")'), "library must not resolve SettingPlugin directly");
assertIncludes(blacklistControllerSource, 'openSettingsUi("task-panel"', "library settings UI owner boundary");
assert(!blacklistControllerSource.includes("settingPlugin"), "library blacklist must not depend on SettingPlugin");
assertIncludes(libraryControllerSource, 'this.historyController?.start({ scope: this.scope })', "library history lifecycle handoff");
assertIncludes(libraryControllerSource, 'this.blacklistController?.start?.({ scope: this.scope })', "library blacklist lifecycle handoff");
assertIncludes(libraryControllerSource, "this.state.patch", "library state import lifecycle handoff");
assertIncludes(libraryControllerSource, 'if (this.route === "detail") this.bindDetailKeywordFilter(this.document);', "library native keyword lifecycle");
assertIncludes(libraryControllerSource, 'blacklistCall("parseAndSaveFilterInfo")', "library blacklist API boundary");
assertIncludes(libraryControllerSource, 'hasBlacklist: Boolean(this.blacklistController)', "library blacklist availability");
assertIncludes(libraryControllerSource, 'historyCall("openHistory")', "library history API boundary");
assertIncludes(libraryControllerSource, 'bindDetailKeywordFilter: (/** @type {any[]} */ ...args) => this.bindDetailKeywordFilter(...args)', "library keyword API boundary");
assertIncludes(libraryControllerSource, 'filter_keyword_title', "library keyword storage boundary");
assertIncludes(libraryControllerSource, "mountFavoriteActresses()", "library favorite lifecycle handoff");
assertIncludes(libraryControllerSource, 'favorite_actresses', "library favorite storage boundary");
assertIncludes(identityManifestSource, 'id: "identity"', "real identity feature manifest");
assertIncludes(identityManifestSource, 'new IdentityController({', "identity feature controller ownership");
assertIncludes(identityControllerSource, 'this.javdbNavigationController?.start({ scope: this.scope, identityApi: api })', "identity navigation lifecycle handoff");
assertIncludes(identityManifestSource, 'new IdentityNavigationController({', "identity navigation controller ownership");
assertIncludes(identityNavigationSource, 'this.scope.addCleanup?.(() => {', "identity navigation scope cleanup");
assertIncludes(identityNavigationSource, 'this.getJQuery()("#search-keyword")', "identity navigation DOM ownership");
assertIncludes(identityManifestSource, 'new IdentityBusNavigationController({', "identity JavBus navigation controller ownership");
assertIncludes(identityControllerSource, 'this.javbusNavigationController?.start({ scope: this.scope, identityApi: api })', "identity JavBus navigation lifecycle handoff");
assertIncludes(identityBusNavigationSource, 'this.scope.addCleanup(() => button.off(".jhsIdentityNav").remove())', "identity JavBus navigation scope cleanup");
assertIncludes(identityManifestSource, 'new IdentityImageSearchController({', "identity image-search controller ownership");
assertIncludes(identityControllerSource, 'hasSearchByImage: Boolean(this.imageSearchController)', "identity image-search API boundary");
assertIncludes(identityImageSearchSource, 'this.scope.addCleanup?.(() => this.dispose())', "identity image-search scope cleanup");
assertIncludes(identityImageSearchSource, 'this.imageSearch.resolve(source, { scope: this.scope })', "identity image-search service boundary");
assert(!identityImageSearchSource.includes('getRuntimeService('), "identity image-search must not resolve legacy runtime services");
assertIncludes(identityManifestSource, 'new IdentityActressInfoController({', "identity actress controller ownership");
assertIncludes(identityControllerSource, 'await this.actressInfoController?.start()', "identity actress lifecycle handoff");
assertIncludes(identityActressSource, 'this.scope.addCleanup?.(() => this.dispose())', "identity actress scope cleanup");
assertIncludes(identityActressSource, 'this.actressInfo.lookup(name, { scope: this.scope })', "identity actress service boundary");
assert(!identityActressSource.includes('getRuntimeService('), "identity actress must not resolve legacy runtime services");
assertIncludes(externalBridgeManifestSource, 'id: "external-bridge"', "real external bridge feature manifest");
assertIncludes(externalBridgeManifestSource, 'new ExternalBridgeController({', "external bridge feature controller ownership");
assertIncludes(externalBridgeManifestSource, 'new ExternalBridgeTranslationController({', "external bridge translation controller ownership");
assertIncludes(externalBridgeManifestSource, 'new OneTwoThreeAuthController({', "external bridge 123Pan controller ownership");
assertIncludes(externalBridgeManifestSource, 'new OneOneFiveMatchController({', "external bridge 115 controller ownership");
assertIncludes(externalBridgeControllerSource, 'this.translationController?.start()', "external bridge translation lifecycle handoff");
assertIncludes(externalBridgeControllerSource, 'this.oneTwoThreeController?.start()', "external bridge 123Pan lifecycle handoff");
assertIncludes(externalBridgeControllerSource, 'this.oneOneFiveController?.start()', "external bridge 115 lifecycle handoff");
assertIncludes(externalBridgeManifestSource, 'new UnifiedOfflineController({', "external bridge offline controller ownership");
assertIncludes(externalBridgeManifestSource, 'new JavTrailersController({', "external bridge JavTrailers controller ownership");
assertIncludes(externalBridgeManifestSource, 'new SubtitleCatController({', "external bridge SubtitleCat controller ownership");
assertIncludes(externalBridgeControllerSource, 'this.javTrailersController?.start()', "external bridge JavTrailers lifecycle handoff");
assertIncludes(externalBridgeControllerSource, 'this.subtitleController?.start()', "external bridge SubtitleCat lifecycle handoff");
assert(!externalBridgeManifestSource.includes("resolveLegacyPlugin"), "external bridge must not resolve retired external-page plugins");
assertIncludes(externalBridgeTranslationSource, 'translation: this.translation', "external bridge translation service boundary");
assertIncludes(externalBridgeTranslationSource, 'this.scope.addCleanup?.(() => this.dispose())', "external bridge translation scope cleanup");
assert(!externalBridgeTranslationSource.includes('getRuntimeService('), "external bridge translation must not resolve legacy runtime services");
assertIncludes(externalBridgeControllerSource, 'this.offlineController?.start()', "external bridge offline lifecycle handoff");
assertIncludes(one23AuthControllerSource, 'this.scope.listen(this.document, "visibilitychange"', "external bridge 123Pan visibility lifecycle");
assertIncludes(one23AuthControllerSource, 'this.syncFallbackMs = 3e5', "external bridge 123Pan fallback polling");
assert(!one23AuthControllerSource.includes('getRuntimeService('), "external bridge 123Pan must not resolve legacy runtime services");
assertIncludes(externalBridgeControllerSource, 'getOfflineProvider:', "external bridge offline API boundary");
assertIncludes(discoveryManifestSource, 'id: "discovery"', "real discovery feature manifest");
assertIncludes(discoveryManifestSource, 'new DiscoveryController({', "discovery feature controller ownership");
assertIncludes(discoveryManifestSource, 'new HitShowController({', "discovery hot-ranking controller ownership");
assertIncludes(discoveryManifestSource, 'new Top250Controller({', "discovery Top250 controller ownership");
assertIncludes(discoveryControllerSource, 'this.top250Controller?.start', "discovery Top250 lifecycle handoff");
assertIncludes(compatibilityManifestSource, 'id: "compatibility"', "real compatibility feature manifest");
assertIncludes(compatibilityControllerSource, "scope", "compatibility feature controller ownership");
assertIncludes(statsManifestSource, 'id: "stats"', "real stats feature manifest");
assertIncludes(statsControllerSource, "openDialog", "stats feature controller ownership");
assertIncludes(discoveryControllerSource, 'this.newVideoPlugin?.handle?.({ scope: this.scope, taskApi })', "discovery idle new-video handoff");
assertIncludes(discoveryControllerSource, 'openNewVideoDialog:', "discovery new-video API boundary");
for (const source of [hitShow, top250, newVideoTaskSource, await read("src/plugins/new-video/new-video.js")]) {
  assert(!source.includes('getOptionalDependency("TaskPlugin")') && !source.includes('getOptionalDependency("HitShowPlugin")') && !source.includes('getOptionalDependency("TOP250Plugin")'), "Discovery consumers must use Feature APIs");
}
assertIncludes(identityNavigationSource, 'this.identityApi?.openSearchByImage?.()', "JavDB navigation identity API boundary");
assertIncludes(identityBusNavigationSource, 'identityApi.openSearchByImage?.()', "JavBus navigation identity API boundary");
assert(!identityNavigationSource.includes('getOptionalDependency("SearchByImagePlugin")'), "JavDB navigation must not resolve SearchByImagePlugin directly");
assert(!identityBusNavigationSource.includes('getOptionalDependency("SearchByImagePlugin")'), "JavBus navigation must not resolve SearchByImagePlugin directly");
assert(!historySource.includes('getOptionalDependency("UnifiedOfflinePlugin")'), "history must use the external bridge API");
assert(!unifiedOfflineControllerSource.includes("getRuntimeService("), "unified offline must not resolve legacy runtime services");
assert(!settingSource.includes('getOptionalDependency("TranslatePlugin")'), "settings must not resolve the translation plugin directly");
assert(!settingSource.includes('getOptionalDependency("ActressInfoPlugin")'), "settings must not resolve the actress information plugin directly");
assertIncludes(settingSource, 'getFeatureApi("identity")', "settings identity feature API boundary");
assertIncludes(historySource, "async start(options = {})", "history feature lifecycle entry");
assertIncludes(historySource, "scope.addCleanup", "history feature scope cleanup");
assertIncludes(statusImport, "mountStateImportAction()", "state import feature lifecycle entry");
assertIncludes(statusImport, 'id = "wantWatchBtn"', "state import feature scope cleanup");
assertIncludes(libraryControllerSource, "scope.addCleanup", "keyword filter feature scope cleanup");
assertIncludes(libraryControllerSource, 'registerListener("click", onClick)', "favorite feature scope cleanup");
assertIncludes(listPageSource, "options.scope ?? await this.getRuntimeService(\"scope\")()", "list feature scope handoff");
assertIncludes(listPageSource, "this.getListView().applyVisibility", "list view visibility ownership");
assertIncludes(listPageSource, "element.matches?.(e.itemSelector) && this.indexItems([ element ])", "list reorder index retention");
assertIncludes(javDbHostAdapter, 'querySelector("#magnets-content")', "protected JavDB resource boundary");
assert(!detailWorkspace.includes('controller.find("#magnets-content")'), "detail workspace must use the JavDB HostAdapter resource boundary");
assert(!/routeSections|moveToSection|movePanelToSection/.test(detailWorkspace), "detail workspace must not remount host sections");
assertIncludes(detailWorkspace, 'jhsEventBus.emit("magnet-items-updated"', "magnet lifecycle event");
assertIncludes(detailWorkspace, "{ broadcast: !1 }", "DOM lifecycle events must stay local");
assert(!/\.jhs-detail-host-workspace\s*\{[^}]*display\s*:\s*flex/.test(detailWorkspace), "host workspace must not force flex layout");
assert(!/data-jhs-host-region[^}]*order\s*:/.test(detailWorkspace), "semantic host markers must not control layout order");
for (const token of ['$("#magnets-content").detach()', '$("#magnet-table").detach()']) assert(!detailWorkspace.includes(token), "host resource DOM must not be detached");
assertIncludes(fc2DetailWorkspace, '[ "summary", "影片概览" ], [ "gallery", "预览与剧照" ], [ "resources", "资源" ], [ "reviews", "评论" ], [ "related", "相关清单" ]', "FC2 fixed section order");
assert(!unifiedOfflineControllerSource.includes("$('a[href^=\"magnet:\"],a[href^=\"ed2k:\"]')"), "unified offline must not scan the whole page");
assert(!unifiedOfflineControllerSource.includes("link.after("), "unified offline must inject through adapter action targets");
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
assert(!uiPrimitives.includes('.trigger("change")'), "JhsSelect must dispatch one native change without jQuery double fire");
for (const [label, source] of [["123", one23AuthControllerSource], ["115", one115ControllerSource]]) {
  assert(!source.includes("injectJavDbButtons"), `${label} provider must not inject JavDB UI`);
  assert(!source.includes("injectJavBusButtons"), `${label} provider must not inject JavBus UI`);
}
assert(!history.slice(history.indexOf("async editRecord")).includes("projectLegacyStatus"), "history editor must not project a legacy single status");
assert(!history.slice(history.indexOf("async editRecord")).includes("legacyActionToFlag"), "history editor must patch four flags directly");
assertIncludes(storage.slice(storage.indexOf("async getSetting("), storage.indexOf("async saveSetting(")), "Object.prototype.hasOwnProperty.call(", "settings must preserve explicit falsey values");
assertIncludes(await read("src/plugins/backup/setting.js"), '.off("change.jhsResource", "input, select")', "cloud settings must persist selects through delegated binding");
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
assertIncludes(statsSource, 'action: "new-video"', "Stats global NewVideo action");
assertIncludes(statsSource, 'action: "filter", filter: "blockedItems"', "Stats current-page blocked action");
assertIncludes(statsSource, 'title: "统计"', "Stats dialog title");
assert(!mobileSource.includes("activeQuickFilter ="), "mobile filter actions must use ListPagePlugin.setQuickFilter");
assert(!mobileSource.includes('$("#waitCheckBtn").click()'), "mobile identification must call ListPageButtonPlugin.openWaitCheck directly");
assertIncludes(mobileSource, 'await this.getOptionalDependency("ListPageButtonPlugin")?.openWaitCheck?.()', "mobile identification API");
assert(!/\.jhs-commandbar__filters\s*\{[^}]*overflow-x\s*:\s*auto/.test(mobileSource), "command-bar filters must not clip popovers with horizontal overflow");
assert(!/@media \(max-width:\s*1023px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*overflow-x\s*:\s*auto/.test(mobileSource), "tablet command bar must wrap instead of scrolling horizontally");
assert(/@media \(max-width:\s*1023px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*flex-wrap\s*:\s*wrap[^}]*overflow\s*:\s*visible/.test(mobileSource), "tablet command bar must wrap with visible overflow");
assert(/@media \(max-width:\s*767px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*display\s*:\s*none/.test(mobileSource), "mobile command bar must stay hidden");
assert(!listPageButton.includes(":visible") && !listPageButton.includes("span.tag:contains"), "start identification must use card data across the full list");
assert(!listPageSource.includes("currentPageBlockedItemCount"), "unused blocked-item counter must stay removed");
assert((newVideoTaskSource.match(/锁任务出现错误:/g) || []).length === 1, "background lock failures must be logged once");
assertIncludes(unifiedOfflineControllerSource, '.attr({ "aria-busy": "true", "aria-disabled": "true" }).text("提交中")', "focusable offline submitting button state");
assertIncludes(unifiedOfflineControllerSource, '.removeAttr("aria-busy aria-disabled").text(original)', "offline idle button restoration");
assert(!unifiedOfflineControllerSource.includes('.prop("disabled", !0)'), "offline submission must preserve button focus");
assertIncludes(unifiedOfflineControllerSource, "submitted ? this.window.setTimeout(restoreButton, this.BUTTON_COOLDOWN_MS) : restoreButton()", "offline success cooldown and immediate failure restoration");
for (const removedSetting of [ "showFilterItem", "showFilterActorItem", "showFilterKeywordItem" ])
  assert(!listPageSource.includes(removedSetting) && !settingFormsSource.includes(removedSetting) && !settingTemplatesSource.includes(removedSetting), `retired visibility setting returned: ${removedSetting}`);
assert(!listPageSource.includes("data-jhs-auto-hide"), "retired auto-hide card attribute returned");
const javDbAdCleanup = compatibilitySource;
assertIncludes(javDbAdCleanup, 'this.hostAdapter?.site === "javdb"', "JavDB ad cleanup scope");
assert((javDbAdCleanup.match(/\.sda-content/g) || []).length === 1, "JavDB ad cleanup must use only one confirmed container selector");
assert(/\.sda-content\s*\{\s*display\s*:\s*none\s*!important;?\s*\}/.test(javDbAdCleanup), "JavDB ad container must be hidden with CSS");
assert(!/MutationObserver|setInterval|https?:\/\//.test(javDbAdCleanup), "JavDB ad cleanup must not poll or classify URLs");
assert(!themeSource.includes(".sda-content"), "JavDB host cleanup must not leak into theme CSS");
for (const removedBestResourceToken of [ "bestResourceBtn", "submitBestResource", "findBestResource", "selectBestCapableResource" ])
  assert(!unifiedOfflineControllerSource.includes(removedBestResourceToken) && !magnetHubSource.includes(removedBestResourceToken), `best-resource path returned: ${removedBestResourceToken}`);
for (const removedPlugin of [ "OneOneFiveOfflinePlugin", "OneOneFiveRenamePlugin" ])
  assert(!registry.includes(removedPlugin) && !one115ControllerSource.includes(removedPlugin), `retired 115 plugin returned: ${removedPlugin}`);
assertIncludes(unifiedOfflineControllerSource, "forceAvailabilityRefresh", "offline retries must bypass availability cache");
assertIncludes(unifiedOfflineControllerSource, "preferredProviderId", "offline retries must prefer their original provider");
assert(!statusImport.includes("$.ajax("), "multi-page import must use one awaited promise chain");
assertIncludes(statusImport, 'return this.parseMovieList(new DOMParser().parseFromString(html, "text/html"), result)', "multi-page import recursion must be awaited by return");
assert(!history.includes('$(".layui-layer-content")'), "history events must be scoped to their own layer");
assertIncludes(history, "this.historyRepository.toggle(a, flag", "single history actions must toggle state through HistoryRepository");
assert(!review.includes('id="reviews'), "review panels must not expose fixed instance ids");
assert(!related.includes('id="related'), "related panels must not expose fixed instance ids");
assertIncludes(statusImport, 'return href.includes("/watched_videos") ? "watched" : "favorite"', "JavDB watched import mapping");
assert(!statusImport.includes("downloaded"), "JavDB watched import must not map to downloaded");

const expectedPlugins = [
  ["status/detail-page.js", "DetailPagePlugin", "DetailPagePlugin"],
  ["status/detail-workspace.js", "DetailWorkspacePlugin", "DetailWorkspacePlugin"],
  ["image-viewer/preview-video.js", "PreviewVideoPlugin", "PreviewVideoPlugin"],
  ["external-search/fc2.js", "Fc2Plugin", "Fc2Plugin"],
  ["status/highlight-magnet.js", "HighlightMagnetPlugin", "HighlightMagnetPlugin"],
  ["status/fold-category.js", "FoldCategoryPlugin", "FoldCategoryPlugin"],
  ["external-search/other-site.js", "OtherSitePlugin", "OtherSitePlugin"],
  ["status/bus-detail-page.js", "BusDetailPagePlugin", "BusDetailPagePlugin"],
  ["status/detail-page-button.js", "DetailPageButtonPlugin", "DetailPageButtonPlugin"],
  ["external-search/review.js", "ReviewPlugin", "ReviewPlugin"],
  ["status/list-page-button.js", "ListPageButtonPlugin", "ListPageButtonPlugin"],
  ["status/list-page.js", "ListPagePlugin", "ListPagePlugin"],
  ["status/fc2-navigation.js", "Fc2NavigationPlugin", "Fc2NavigationPlugin"],
  ["status/auto-page.js", "AutoPagePlugin", "AutoPagePlugin"],
  ["backup/setting.js", "SettingPlugin", "SettingPlugin"],
  ["image-viewer/bus-preview-video.js", "BusPreviewVideoPlugin", "BusPreviewVideoPlugin"],
  ["external-search/related.js", "RelatedPlugin", "RelatedPlugin"],
  ["image-viewer/cover-button.js", "CoverButtonPlugin", "CoverButtonPlugin"],
  ["external-search/fc2-by-123av.js", "Fc2By123AvPlugin", "Fc2By123AvPlugin"],
  ["external-search/magnet-hub.js", "MagnetHubPlugin", "MagnetHubPlugin"],
  ["image-viewer/screenshot.js", "ScreenShotPlugin", "ScreenShotPlugin"],
  ["image-viewer/bus-img.js", "BusImgPlugin", "BusImgPlugin"],
  ["new-video/task.js", "TaskPlugin", "TaskPlugin"],
  ["new-video/new-video.js", "NewVideoPlugin", "NewVideoPlugin"],
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

const javdbPlugins = extractContributionOrder(registry, "javdb");
const javbusPlugins = extractContributionOrder(registry, "javbus");
assert(
  javdbPlugins.join(",") === "ListPagePlugin,AutoPagePlugin,Fc2Plugin,Fc2NavigationPlugin,FoldCategoryPlugin,ListPageButtonPlugin,SettingPlugin,CoverButtonPlugin,Fc2By123AvPlugin,DetailPagePlugin,DetailWorkspacePlugin,ReviewPlugin,RelatedPlugin,DetailPageButtonPlugin,HighlightMagnetPlugin,PreviewVideoPlugin,OtherSitePlugin,MagnetHubPlugin,ScreenShotPlugin,NewVideoPlugin,TaskPlugin,MobileBottomBarPlugin",
  "JavDB plugin registration order changed"
);
assert(
  javbusPlugins.join(",") === "ListPagePlugin,ListPageButtonPlugin,SettingPlugin,AutoPagePlugin,CoverButtonPlugin,BusImgPlugin,BusDetailPagePlugin,DetailWorkspacePlugin,DetailPageButtonPlugin,ReviewPlugin,HighlightMagnetPlugin,BusPreviewVideoPlugin,MagnetHubPlugin,ScreenShotPlugin,OtherSitePlugin,TaskPlugin,MobileBottomBarPlugin",
  "JavBus plugin registration order changed"
);
assert(!registry.includes("OneTwoThreeOfflinePlugin"), "123Pan auth must not be registered as a legacy plugin");
assert(!registry.includes("UnifiedOfflinePlugin"), "unified offline must not be registered as a legacy plugin");
assert(!registry.includes("HitShowPlugin"), "HitShow must not be registered as a legacy plugin");
assert(!registry.includes("JavTrailersPlugin"), "JavTrailers must not be registered as a legacy plugin");
assert(!registry.includes("SubTitleCatPlugin"), "SubtitleCat must not be registered as a legacy plugin");
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
sourceByFile.set("features/stats/stats-controller.js", statsControllerSource);
sourceByFile.set("features/library/library-controller.js", libraryControllerSource);
sourceByFile.set("features/library/history-controller.js", historySource);
sourceByFile.set("features/library/blacklist-controller.js", blacklistControllerSource);
sourceByFile.set("features/library/blacklist-repository.js", blacklistRepositorySource);
sourceByFile.set("features/identity/identity-navigation-controller.js", identityNavigationSource);
sourceByFile.set("features/identity/identity-bus-navigation-controller.js", identityBusNavigationSource);
sourceByFile.set("features/identity/identity-image-search-controller.js", identityImageSearchSource);
sourceByFile.set("features/identity/identity-actress-info-controller.js", identityActressSource);
sourceByFile.set("features/compatibility/compatibility-controller.js", compatibilityControllerSource);
sourceByFile.set("features/external-bridge/translation-controller.js", externalBridgeTranslationSource);
sourceByFile.set("features/external-bridge/one-two-three-controller.js", one23AuthControllerSource);
sourceByFile.set("features/external-bridge/one-one-five-controller.js", one115ControllerSource);
sourceByFile.set("features/external-bridge/unified-offline-controller.js", unifiedOfflineControllerSource);
sourceByFile.set("features/external-bridge/javtrailers-controller.js", javTrailersControllerSource);
sourceByFile.set("features/external-bridge/subtitle-cat-controller.js", subtitleControllerSource);
sourceByFile.set("features/discovery/hit-show-controller.js", hitShow);
sourceByFile.set("features/discovery/top250-controller.js", top250);
sourceByFile.set("services/webdav-service.js", await read("src/services/webdav-service.js"));
sourceByFile.set("backup/setting-backup.js", await read("src/plugins/backup/setting-backup.js"));
sourceByFile.set("backup/setting-styles.js", await read("src/plugins/backup/setting-styles.js"));
sourceByFile.set("backup/setting-templates.js", await read("src/plugins/backup/setting-templates.js"));
sourceByFile.set("backup/setting-panels.js", await read("src/plugins/backup/setting-panels.js"));
sourceByFile.set("backup/setting-forms.js", await read("src/plugins/backup/setting-forms.js"));

const regressionMatrix = [
  ["JavDB 列表页", [["status/list-page.js", "filterMovieList"], ["status/list-page-button.js", "ListPageButtonPlugin"], ["image-viewer/cover-button.js", "CoverButtonPlugin"], ["core/storage.js", "getStatusMap"]]],
  ["JavDB 详情页", [["status/detail-page.js", "DetailPagePlugin"], ["status/detail-page-button.js", "showStatus"], ["image-viewer/preview-video.js", "PreviewVideoPlugin"]]],
  ["JavDB 演员页", [["features/library/library-controller.js", "mountFavoriteActresses"], ["features/identity/identity-actress-info-controller.js", "class IdentityActressInfoController"], ["core/plugin-manager.js", "getActressPageInfo"]]],
  ["JavBus 列表页", [["status/list-page.js", "fixBusTitleBox"], ["image-viewer/bus-img.js", "BusImgPlugin"], ["status/list-page-button.js", "ListPageButtonPlugin"]]],
  ["JavBus 详情页", [["status/bus-detail-page.js", "BusDetailPagePlugin"], ["image-viewer/bus-preview-video.js", "BusPreviewVideoPlugin"]]],
  ["123pan 授权同步", [["features/external-bridge/one-two-three-controller.js", "class OneTwoThreeAuthController"], ["features/external-bridge/one-two-three-controller.js", "visibilitychange"], ["features/external-bridge/one-two-three-controller.js", "syncFallbackMs = 3e5"]]],
  ["JavTrailers 预告片", [["features/external-bridge/javtrailers-controller.js", "class JavTrailersController"], ["features/external-bridge/javtrailers-controller.js", "handlePlayJavTrailers"], ["features/external-bridge/javtrailers-controller.js", "jhsJavTrailers"]]],
  ["SubtitleCat 筛选", [["features/external-bridge/subtitle-cat-controller.js", "class SubtitleCatController"], ["features/external-bridge/subtitle-cat-controller.js", "sub-table"], ["features/external-bridge/subtitle-cat-controller.js", "该番号无字幕"]]],
  ["统一离线提交", [["features/external-bridge/unified-offline-controller.js", "getAvailability"], ["features/external-bridge/unified-offline-controller.js", "capabilities"], ["features/external-bridge/unified-offline-controller.js", "appendOfflineHistory"]]],
  ["热播榜单", [["features/discovery/hit-show-controller.js", "class HitShowController"], ["features/discovery/hit-show-controller.js", "handlePlayback"], ["features/discovery/hit-show-controller.js", "loadScore"]]],
  ["Top250", [["features/discovery/top250-controller.js", "class Top250Controller"], ["features/discovery/top250-controller.js", "handleTop"], ["features/discovery/top250-controller.js", "openLoginDialog"]]],
  ["新作品检测", [["new-video/task.js", "TaskPlugin"], ["new-video/new-video.js", "NewVideoPlugin"], ["core/storage.js", "newVideoList"]]],
  ["黑名单检测", [["features/library/blacklist-controller.js", "class BlacklistController"], ["features/library/blacklist-repository.js", "class BlacklistRepository"], ["features/library/library-controller.js", "filter_keyword_title"], ["core/storage.js", "batchSaveBlacklistCarList"]]],
  ["统计面板", [["features/stats/stats-controller.js", "class StatsController"], ["features/stats/stats-controller.js", "coverageStart"], ["features/stats/stats-controller.js", "6.4.0"]]],
  ["兼容增强", [["features/compatibility/compatibility-controller.js", "class CompatibilityController"], ["features/compatibility/compatibility-controller.js", "jhs-actress-state-container"], ["features/compatibility/compatibility-controller.js", "createTreeWalker"]]],
  ["数据导入导出", [["backup/setting-backup.js", "importSettingData"], ["backup/setting-backup.js", "exportSettingData"], ["core/storage.js", "exportData"]]],
  ["WebDAV 备份", [["services/webdav-service.js", "class WebDavClient"], ["backup/setting-backup.js", "backupDataByWebDav"], ["services/webdav-service.js", "PROPFIND"]]],
  ["图片查看器", [["core/logger.js", "showImageViewer"], ["core/logger.js", "new Viewer"], ["image-viewer/screenshot.js", "ScreenShotPlugin"]]],
  ["第三方请求失败场景", [["core/storage.js", "cachedRequest"], ["core/http.js", "onerror"], ["external-search/other-site.js", "detectOtherSites"]]],
  ["多标签页同步", [["core/event-bus.js", "eventId"], ["core/event-bus.js", "originId"], ["status/list-page.js", "list-items-added"]]],
  ["快速筛选", [["status/list-page.js", "createQuickFilter"], ["status/list-page.js", "setQuickFilter"], ["status/list-page.js", "blockedItems"]]],
  ["标记状态与隐藏", [["status/list-page.js", "data-jhs-flags"], ["status/list-page.js", "visibilityReasons"], ["core/state-model.js", "syncLegacyStatus"]]],
  ["版本迁移", [["core/migration.js", "DATA_MIGRATIONS"], ["core/migration.js", "migration-snapshot"], ["core/migration.js", "collision"]]],
  ["可恢复状态事务", [["core/state-service.js", "mutation_journal"], ["core/state-service.js", 'commitState: "pending"'], ["core/state-service.js", "recoverPendingTransaction"]]],
  ["离线能力路由", [["features/external-bridge/unified-offline-controller.js", "capabilities.includes(type)"], ["features/external-bridge/unified-offline-controller.js", '"ready", "unknown"'], ["features/external-bridge/unified-offline-controller.js", "getCandidates(resource"]]],
  ["115 增量匹配", [["features/external-bridge/one-one-five-controller.js", "IntersectionObserver"], ["features/external-bridge/one-one-five-controller.js", 'rootMargin: "200px"'], ["features/external-bridge/one-one-five-controller.js", "list-items-added"]]],
  ["设置页", [["backup/setting.js", "SettingPlugin"], ["backup/setting-backup.js", "importSettingData"]]],
  ["演员信息解析", [["core/plugin-manager.js", "getActressPageInfo"], ["status/list-page.js", "parseActressName"]]],
  ["移动端适配", [["status/mobile-bottom-bar.js", "MobileBottomBarPlugin"], ["core/utils.js", "isMobileMode"], ["core/plugin-manager.js", "shouldSkipOnMobile"]]]
];

assert(!sourceByFile.get("features/external-bridge/one-one-five-controller.js").includes("new MutationObserver"), "115 must reuse the ListPage MutationObserver");
for (const [file, source] of [
  ["status/list-page.js", listPageSource],
  ["status/detail-page-button.js", sourceByFile.get("status/detail-page-button.js")],
  ["new-video/new-video.js", sourceByFile.get("new-video/new-video.js")],
  ["features/stats/stats-controller.js", statsControllerSource]
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

const fc2Source = sourceByFile.get("external-search/fc2.js");
const fc2By123AvSource = sourceByFile.get("external-search/fc2-by-123av.js");
const workspaceSource = sourceByFile.get("status/detail-workspace.js");
const reviewSource = sourceByFile.get("external-search/review.js");
assertIncludes(fc2Source, "mountFc2Detail", "FC2 owned workspace");
assertIncludes(fc2Source, "magnetHubPromise ||=", "FC2 lazy magnet single-flight");
assertIncludes(fc2DetailWorkspace, "createFc2DetailContext", "FC2 owned workspace");
assertIncludes(fc2By123AvSource, "loadDetail(context, url)", "123AV FC2 adapter");
assert(!fc2Source.includes("organizeJhsOwnedDetailWorkspace"), "FC2 must render directly into owned slots");
assert(!fc2By123AvSource.includes("organizeJhsOwnedDetailWorkspace"), "123AV FC2 must reuse the owned shell");
assert(!reviewSource.includes("R(movieId, 2, pageSize).catch"), "review page 2 must only load on demand");
assert(!sourceMain.includes("isFc2Page"), "FC2 title filtering must bind to the mounted detail root");

console.log(
  `Regression checks passed for ${version}: ${expectedPlugins.length} plugins, ${regressionMatrix.length} scopes, ${stableReleaseChecks.length} stable release checks`
);
