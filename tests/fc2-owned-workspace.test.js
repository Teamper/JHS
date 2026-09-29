import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import javdbManifest, { createJavDbAdapter } from "../src/integrations/javdb/manifest.js";
import { createIntegrationRequestFacade } from "../src/app/integration-registry.js";
import { HttpService } from "../src/services/http-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { CacheService } from "../src/services/cache-service.js";
import { assessMagnetQuality } from "../src/core/magnet-quality.js";
import { Fc2Plugin } from "../src/plugins/external-search/fc2.js";
import { Fc2WorkspaceService } from "../src/features/detail/fc2-workspace-service.js";

const repoRoot = join(import.meta.dirname, "..");
const fc2Source = readTestFile(join(repoRoot, "src/features/detail/fc2-workspace-service.js"), "utf8");
const fc2WorkspaceManifestSource = readTestFile(join(repoRoot, "src/features/detail/fc2-workspace-manifest.js"), "utf8");
const fc2PageControllerSource = readTestFile(join(repoRoot, "src/features/detail/fc2-owned-page-controller.js"), "utf8");
const fc2StylesSource = readTestFile(join(repoRoot, "src/ui/detail/fc2-workspace-styles.js"), "utf8");
const detailManifestSource = readTestFile(join(repoRoot, "src/features/detail/manifest.js"), "utf8");
const listManifestSource = readTestFile(join(repoRoot, "src/features/list/manifest.js"), "utf8");
const fc2ViewSource = readTestFile(join(repoRoot, "src/ui/detail/fc2-workspace-view.js"), "utf8");
const fc2NavigationSource = readTestFile(join(repoRoot, "src/features/list/fc2-navigation-controller.js"), "utf8");
const fc2By123AvSource = readTestFile(join(repoRoot, "src/features/external-bridge/fc2-catalog-controller.js"), "utf8");
const screenshotControllerSource = readTestFile(join(repoRoot, "src/features/detail/screenshot-controller.js"), "utf8");
const screenshotPanelSource = readTestFile(join(repoRoot, "src/ui/detail/screenshot-panel.js"), "utf8");
const listPageSource = readTestFile(join(repoRoot, "src/features/list/list-compatibility-service.js"), "utf8");
const historySource = readTestFile(join(repoRoot, "src/features/library/history-dialog-controller.js"), "utf8");
const stateServiceSource = readTestFile(join(repoRoot, "src/core/state-service.js"), "utf8");
const titleFilterControllerSource = readTestFile(join(repoRoot, "src/features/library/title-keyword-controller.js"), "utf8");
const highlightMagnetSource = readTestFile(join(repoRoot, "src/features/detail/magnet-filter-controller.js"), "utf8");
const primitivesSource = readTestFile(join(repoRoot, "src/core/ui-primitives.js"), "utf8");
const loggerSource = readTestFile(join(repoRoot, "src/core/logger.js"), "utf8");
const top250Source = readTestFile(join(repoRoot, "src/features/discovery/top250-controller.js"), "utf8");

function loadWorkspace() {
    const dom = new JSDOM('<main id="host"></main>', { url: "https://javdb.com/users/collection_codes" }), $ = jqueryFactory(dom.window);
    const context = vm.createContext({ window: dom.window, document: dom.window.document, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, $, BasePlugin: class {}, r: true, l: false,
        normalizeCarNum: value => String(value || "").trim().toUpperCase() || null, jhsEventBus: { emit: vi.fn() }, utils: {}, JhsSelect: {} });
    const source = readTestFile(join(repoRoot, "src/ui/detail/fc2-detail-workspace.js"), "utf8");
    vm.runInContext(`${source};globalThis.createShell=createFc2DetailShell;globalThis.createContext=createFc2DetailContext`, context);
    return { $, context };
}

function loadResolver(responseFactory) {
    const requests = [], get = vi.fn(responseFactory), port = { request: async options => {
        requests.push(options);
        return { status: 200, data: await get(options), finalUrl: options.url };
    } };
    const http = new HttpService(port, new ExternalUrlPolicy(), { cache: new CacheService() });
    const adapter = createJavDbAdapter(createIntegrationRequestFacade(http, javdbManifest), () => "signature");
    return { resolveId: carNum => adapter.resolveMovie({ carNum }).then(value => value?.movieId || null), get, requests };
}

function loadWantApi({ encryptedToken = "encrypted", response = { success: 1 } } = {}) {
    const local = new Map(encryptedToken ? [ [ "jhs_appAuthorization", encryptedToken ] ] : []), gmRequest = vi.fn(async () => response), deleteCachedRequest = vi.fn(async () => {}), context = vm.createContext({
        storageManager: { deleteCachedRequest }, gmHttp: { gmRequest }, localStorage: { getItem: key => local.get(key) || null, setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key) }, decryptData: vi.fn(async value => `token:${value}`), md5: String,
        normalizeCarNum: String, utils: { formatDate: String }, show: { error: vi.fn() }
    });
    const source = readTestFile(join(repoRoot, "src/core/javdb-api.js"), "utf8");
    vm.runInContext(`${source};globalThis.markWant=markJavDbWantWatch;globalThis.getWantState=getJavDbWantWatchState`, context);
    return { markWant: context.markWant, getWantState: context.getWantState, gmRequest, deleteCachedRequest };
}

function loadImageViewer() {
    const dom = new JSDOM('<div id="gallery"><img src="a.jpg"><img src="b.jpg"></div>'), $ = jqueryFactory(dom.window), instances = [];
    class ViewerMock {
        constructor(host, options) { this.host = host, this.options = options, this.viewerData = { width: 1000, height: 800 }, this.imageData = { width: 400, height: 200 }, this.zoomTo = vi.fn(), this.moveTo = vi.fn(), this.resize = vi.fn(), this.prev = vi.fn(), this.next = vi.fn(), this.destroy = vi.fn(), instances.push(this); }
        show() {}
        destroy() {}
    }
    const marker = loggerSource.indexOf("}(), function() {", loggerSource.indexOf("unsafeWindow.show")), start = loggerSource.indexOf("function() {", marker), end = loggerSource.indexOf("}(), window.ImageHoverPreview", start), viewerIife = loggerSource.slice(start, end + 1), context = vm.createContext({ window: dom.window, document: dom.window.document, $, Viewer: ViewerMock, JHS_Z_INDEX: { viewer: 100 }, AbortController: dom.window.AbortController, MutationObserver: dom.window.MutationObserver, setTimeout: vi.fn() });
    const scopeSource = readFileSync(join(repoRoot, "src/core/lifecycle-scope.js"), "utf8").replace("export class", "class");
    vm.runInContext(`${scopeSource}; const scope = new LifecycleScope("viewer-test"); globalThis.testScope=scope; (${viewerIife})();`, context);
    return { dom, instances, scope: context.testScope };
}

describe("FC2 owned detail workspace", () => {
    it("ensures the lazy 123AV adapter before loading a 123AV detail workspace", async () => {
        const adapter = {
            resolveMovieId: vi.fn(async () => "movie-1"),
            loadDetail: vi.fn(async () => {}),
        };
        const ensureFc2Catalog = vi.fn(async () => adapter);
        const service = new Fc2WorkspaceService({ runtimeServices: { ensureFc2Catalog } });
        vi.spyOn(service, "configureJavDbWantButton").mockResolvedValue(undefined);
        vi.spyOn(service, "mountPanels").mockResolvedValue(undefined);
        vi.spyOn(service, "fetchAndRenderNativeMagnets").mockResolvedValue(undefined);
        vi.spyOn(service, "applyFc2Translation").mockResolvedValue(undefined);
        const context = { isAlive: () => true, carNum: "FC2-123", url: "https://www.123av.com/videos/123" };

        await service.load123AvDetail(context);
        await Promise.resolve();

        expect(ensureFc2Catalog).toHaveBeenCalledOnce();
        expect(adapter.resolveMovieId).toHaveBeenCalledWith("FC2-123");
        expect(adapter.loadDetail).toHaveBeenCalledWith(context, context.url);
        expect(service.fetchAndRenderNativeMagnets).toHaveBeenCalledWith(context, "movie-1");
    });

    it("never builds a private FC2 URL without a resolved movie id", async () => {
        const openPage = vi.fn();
        vi.stubGlobal("utils", { openPage });
        const plugin = new Fc2Plugin();
        expect(() => plugin.createFc2PageUrl(null, "FC2-123", "/v/abc")).toThrow("movieId");
        await plugin.openFc2Page(null, "FC2-123", "/v/abc", { newTab: true });
        expect(openPage).toHaveBeenCalledWith("/v/abc", "FC2-123", true, { newTab: true });
        vi.unstubAllGlobals();
    });

    it("passes Layer an HTML string instead of a raw DOM node", () => {
        expect(fc2Source).toContain('content: \'<div class="jhs-fc2-dialog-host"></div>\'');
        expect(fc2Source).not.toContain("content: host[0]");
        expect(fc2Source).toContain("scrollbar: !1, shadeClose: !0");
        expect(fc2Source).toContain("utils.setupEscClose(layerIndex)");
    });

    it("keeps the dialog height chain bounded so the workspace owns scrolling", () => {
        expect(fc2StylesSource).toMatch(/\.movie-detail-layer \.layui-layer-content \{[^}]*min-height:0;[^}]*overflow:hidden;/);
        expect(fc2StylesSource).toMatch(/\.movie-detail-layer \.jhs-fc2-dialog-host \{[^}]*height:100%;[^}]*min-height:0;/);
        expect(fc2StylesSource).toMatch(/\.jhs-fc2-workspace\[data-jhs-fc2-mode="dialog"\] \{[^}]*height:100%;[^}]*min-height:0;[^}]*overflow-y:auto;/);
    });

    it("registers FC2 workspace styles from the owning Features, not the compatibility plugin", () => {
        expect(fc2Source).not.toContain("async initCss()");
        expect(fc2WorkspaceManifestSource).toContain("FC2_WORKSPACE_STYLES");
        expect(detailManifestSource).not.toContain("FC2_WORKSPACE_STYLES");
        expect(listManifestSource).not.toContain("FC2_WORKSPACE_STYLES");
        expect(fc2StylesSource).toContain("const FC2_WORKSPACE_STYLES");
    });

    it("moves the collection-codes page lifecycle into the FC2 workspace Feature", () => {
        expect(fc2Source).not.toContain("async handle()");
        expect(fc2PageControllerSource).toContain('scope.listen(this.window, "pagehide"');
        expect(fc2PageControllerSource).toContain("this.canCommit(generation)");
        expect(fc2PageControllerSource).toContain('mode: "page"');
        expect(fc2WorkspaceManifestSource).toContain("new Fc2OwnedPageController");
    });

    it("restores the FC2 third-party slot when its Feature adapter attaches after page startup", () => {
        const dom = new JSDOM('<main id="host"><div class="jhs-fc2-workspace"><div data-jhs-slot="resources"><section class="jhs-fc2-resource-group"><div data-jhs-role="native-magnets"></div></section><section class="jhs-fc2-resource-group"><div data-jhs-role="magnet-hub"></div></section></div></div></main>', { url: "https://javdb.com/users/collection_codes" });
        const $ = jqueryFactory(dom.window), workspace = $(dom.window.document.querySelector(".jhs-fc2-workspace")), resources = workspace.find('[data-jhs-slot="resources"]');
        const context = { isAlive: () => true, getSlot: () => resources, otherSiteGeneration: 0 };
        workspace.data("jhsFc2Context", context);
        const plugin = new Fc2Plugin(), adapter = {};
        const mount = vi.spyOn(plugin, "mountFc2OtherSites").mockImplementation(() => {});
        vi.stubGlobal("$", $);
        try {
            plugin.attachFeatureExternalSitesAdapter(adapter);
            const sitesGroup = resources.find('[data-jhs-role="other-sites"]').closest(".jhs-fc2-resource-group");
            expect(sitesGroup).toHaveLength(1);
            expect(sitesGroup.next().find('[data-jhs-role="magnet-hub"]')).toHaveLength(1);
            expect(mount).toHaveBeenCalledOnce();
            expect(mount.mock.calls[0][0]).toBe(context);
            expect(mount.mock.calls[0][1][0]).toBe(sitesGroup[0]);
            expect(mount.mock.calls[0][2]).toBe(adapter);

            plugin.detachFeatureExternalSitesAdapter(adapter);
            expect(resources.find('[data-jhs-role="other-sites"]')).toHaveLength(0);
            expect(context.otherSiteGeneration).toBe(1);
        } finally {
            vi.unstubAllGlobals();
            dom.window.close();
        }
    });

    it("lets sections keep their content height and opens gallery thumbnails in the viewer", () => {
        expect(fc2StylesSource).toMatch(/\.jhs-fc2-workspace \{[^}]*grid-auto-rows:max-content;[^}]*align-content:start;/);
        expect(fc2StylesSource).toMatch(/\.jhs-fc2-gallery-grid \{[^}]*minmax\(112px,144px\)/);
        expect(fc2ViewSource).toContain('class="jhs-btn jhs-fc2-gallery-item"');
        expect(fc2Source).toContain('showImageViewer(image, "", { galleryRoot: gallery[0] })');
        expect(fc2Source).not.toContain('"data-fancybox"');
        expect(loggerSource).toContain("initialViewIndex");
        expect(loggerSource).toContain("prev: hasGallery ? 1 : 0");
        expect(loggerSource).toContain("next: hasGallery ? 1 : 0");
        expect(loggerSource).toContain('"ArrowLeft" === t.key');
        expect(loggerSource).toContain('"ArrowRight" === t.key');
        expect(loggerSource).toContain("o.moveTo(x, y)");
        expect(loggerSource).not.toContain("o.moveTo(e, 0)");
    });

    it("opens the selected gallery image with navigation and centers it in both axes", () => {
        const { dom, instances, scope } = loadImageViewer(), gallery = dom.window.document.querySelector("#gallery"), selected = gallery.querySelectorAll("img")[1];
        dom.window.showImageViewer(selected, "", { galleryRoot: gallery });
        const viewer = instances[0];
        expect(viewer.host).toBe(gallery), expect(viewer.options.initialViewIndex).toBe(1), expect(viewer.options.toolbar.prev).toBe(1), expect(viewer.options.toolbar.next).toBe(1);
        viewer.options.viewed();
        expect(viewer.moveTo).toHaveBeenCalledWith(300, 300);
        scope.dispose(); dom.window.close();
    });

    it("replaces an opening viewer and ignores its late callbacks", () => {
        const {dom,instances,scope}=loadImageViewer(), images=dom.window.document.querySelectorAll("img");
        dom.window.showImageViewer(images[0]);
        dom.window.showImageViewer(images[1]);
        expect(instances[0].destroy).toHaveBeenCalledOnce();
        instances[1].options.shown();
        instances[0].options.shown(); instances[0].options.viewed(); instances[0].options.hidden();
        expect(instances[0].zoomTo).not.toHaveBeenCalled();
        expect(instances[1].destroy).not.toHaveBeenCalled();
        expect(dom.window.document.body.style.overflow).toBe("hidden");
        scope.dispose();
        expect(instances[1].destroy).toHaveBeenCalledOnce();
        expect(dom.window.document.body.style.overflow).toBe("");
        dom.window.close();
    });

    it("contains FC2 previews in their owner and shares screenshots without eager full image loading", () => {
        const { dom, instances, scope } = loadImageViewer(), document = dom.window.document;
        document.body.innerHTML = '<div class="layui-layer"><div class="layui-layer-content"><div class="jhs-fc2-workspace"><div data-jhs-slot="gallery"><div id="gallery"><img src="https://example.test/a.jpg"><img src="https://example.test/b.jpg"></div><button><img id="sheet" src="https://example.test/sheet.jpg"></button></div></div></div></div>';
        const selected = document.querySelector("#sheet"), workspace = document.querySelector(".jhs-fc2-workspace");
        dom.window.showImageViewer(selected);
        const viewer = instances[0];
        expect(viewer.host.closest(".layui-layer-content")).not.toBeNull();
        expect(viewer.options.inline).toBe(true);
        expect(viewer.options.initialViewIndex).toBe(2);
        expect(viewer.options.url).toBe("data-jhs-viewer-source");
        expect([...viewer.host.querySelectorAll("img")].map(image => image.getAttribute(viewer.options.url))).toEqual(["https://example.test/a.jpg", "https://example.test/b.jpg", "https://example.test/sheet.jpg"]);
        expect([...viewer.host.querySelectorAll("img")].every(image => image.src.startsWith("data:image/"))).toBe(true);
        expect(workspace.inert).toBe(true);
        viewer.options.viewed();
        expect(viewer.zoomTo).not.toHaveBeenCalled();
        expect(viewer.resize).toHaveBeenCalledOnce();
        scope.dispose();
        expect(document.querySelector(".jhs-image-viewer-host")).toBeNull();
        expect(document.querySelector(".jhs-image-viewer-owner")).toBeNull();
        expect(workspace.inert).toBeFalsy();
        dom.window.close();
    });

    it("releases per-viewer subscriptions on repeated close and preserves unrelated scroll styles", () => {
        const {dom,instances,scope}=loadImageViewer();
        dom.window.document.body.style.overflow="clip";
        for(let i=0;i<5;i++) {
            dom.window.showImageViewer("https://example.test/image.png");
            instances[i].options.shown(); instances[i].options.hidden();
            expect(scope.cleanups.size).toBe(0);
            expect(dom.window.document.querySelectorAll(".temporary-container")).toHaveLength(0);
            expect(dom.window.document.body.style.overflow).toBe("clip");
        }
        scope.dispose(); dom.window.close();
    });

    it("renders screenshot-provider results as the smallest thumbnail until opened", () => {
        expect(fc2StylesSource).toMatch(/\.jhs-fc2-screenshot-thumbnail \{[^}]*width:112px;/);
        expect(screenshotPanelSource).toContain('class="jhs-btn jhs-fc2-gallery-item jhs-fc2-screenshot-thumbnail"');
        expect(screenshotPanelSource).toContain("showImageViewer(image[0])");
    });

    it("keeps state action buttons mounted while either summary renderer refreshes", () => {
        expect(fc2Source).toContain('data-jhs-role="summary-content"');
        expect(fc2Source).toContain("context.root.find('[data-jhs-role=\"summary-content\"]')");
        expect(fc2By123AvSource).toContain("context.root.find('[data-jhs-role=\"summary-content\"]')");
        expect(fc2Source).not.toContain('body.append(context.getSlot("summary").find(".jhs-fc2-toolbar"))');
        expect(fc2By123AvSource).not.toContain('context.getSlot("summary").find(".jhs-fc2-toolbar")');
    });

    it("propagates an explicit FC2 source without guessing from URL text", () => {
        expect(fc2Source).not.toContain('url.includes("123av")');
        expect(fc2By123AvSource).toContain('setAttribute("data-jhs-fc2-source", "123av")');
        expect(fc2NavigationSource).toContain("fc2Source || (await this.fc2.resolveFc2Source");
        expect(fc2NavigationSource).toContain("resolveMovieIdForRecord(carNum, aHref)");
        expect(historySource).toContain('this.resolveLegacy("Fc2Plugin")');
        expect(historySource).toContain("this.getFc2Workspace()");
        expect(stateServiceSource).toContain('"fc2Source"');
        expect(fc2Source).toContain('target.searchParams.set("source", source)');
    });

    it("keeps the native FC2 entry free of a hard list.core dependency so disabling ListPagePlugin stays safe", () => {
        expect(fc2Source).not.toContain('getBean("ListPagePlugin")');
        expect(fc2PageControllerSource).toContain('pageUrl.pathname !== "/users/collection_codes"');
        expect(fc2PageControllerSource).toContain('pageUrl.searchParams.has("movieId")');
        expect(fc2Source).toContain("openFc2Dialog(");
        expect(fc2NavigationSource).toContain("protectFc2Navigation(root)");
        expect(fc2NavigationSource).toContain("this.fc2.openNativeFallback");
        expect(fc2Source).toContain("getListNavigationCapability()");
        expect(fc2Source).toContain("openNativeFallback: (url, carNum, { event, newTab })");
        expect(fc2NavigationSource).not.toContain('this.getBean("Fc2Plugin")');
        expect(listPageSource).not.toContain("protectFc2Navigation(root)");
        expect(listPageSource).not.toContain('getBean("Fc2Plugin")');
    });

    it("exposes a frozen list-navigation capability without exposing the plugin instance", async () => {
        const plugin = {
            resolveMovieIdForRecord: vi.fn(async () => "movie-id"),
            resolveFc2Source: vi.fn(async () => "123av"),
            openFc2Page: vi.fn(async () => true),
            openFc2Dialog: vi.fn(),
        };
        const capability = Fc2Plugin.prototype.getListNavigationCapability.call(plugin);
        expect(Object.isFrozen(capability)).toBe(true);
        await expect(capability.resolveMovieIdForRecord("FC2-123", "/v/fc2")).resolves.toBe("movie-id");
        await expect(capability.resolveFc2Source({ url: "/v/fc2" })).resolves.toBe("123av");
        await capability.openFc2Page("movie-id", "FC2-123", "/v/fc2", { newTab: true }, { source: "123av" });
        capability.openFc2Dialog("movie-id", "FC2-123", "/v/fc2", { source: "123av" });
        expect(plugin.resolveMovieIdForRecord).toHaveBeenCalledWith("FC2-123", "/v/fc2");
        expect(plugin.openFc2Page).toHaveBeenCalledWith("movie-id", "FC2-123", "/v/fc2", { newTab: true }, { source: "123av" });
        expect(plugin.openFc2Dialog).toHaveBeenCalledWith("movie-id", "FC2-123", "/v/fc2", { source: "123av" });

        const openPage = vi.fn();
        vi.stubGlobal("utils", { openPage });
        const event = { button: 1 };
        capability.openNativeFallback("/v/fc2", "FC2-123", { event, newTab: true });
        expect(openPage).toHaveBeenCalledWith("/v/fc2", "FC2-123", true, { event, newTab: true });
        vi.unstubAllGlobals();
    });

    it("restores source links, magnet metadata and scoped quality filtering", () => {
        expect(fc2ViewSource).toContain("FC2PPVDB");
        expect(fc2ViewSource).toContain("FC2 市场");
        expect(fc2Source).toContain("item.hasHdTag && tags.append");
        expect(fc2Source).toContain("item.hasSubtitleTag && tags.append");
        expect(fc2Source).toContain("item.createdAt");
        expect(fc2Source).toContain('data-jhs-action="filter-native-magnets"');
        expect(fc2Source).toContain("magnetService.assess({");
    });

    it("assesses explicit HD and subtitle tags even when the title has no marker", () => {
        const assessed = assessMagnetQuality({ title: "FC2-123", hasHdTag: true, hasSubtitleTag: true, seeders: 0 });
        expect(assessed.highQuality).toBe(true), expect(assessed.subtitle).toBe(true), expect(assessed.score.resolution).toBe(20), expect(assessed.score.subtitle).toBe(20);
    });

    it("shares the 123AV movie resolver and keeps summary retry local", () => {
        expect(fc2Source).toContain("this.mountPanels(context, movieIdPromise)");
        expect(fc2Source).toContain("this.configureJavDbWantButton(context, movieIdPromise)");
        expect(fc2Source).toContain("movieIdPromise.then");
        expect(fc2By123AvSource).not.toContain("mountPanels(context");
        expect(fc2By123AvSource).not.toContain("configureJavDbWantButton(context");
        expect(fc2By123AvSource).not.toContain('getBean("Fc2Plugin")');
        expect(fc2By123AvSource).toContain("loadSummary(context, url)");
        expect(fc2By123AvSource).not.toContain("() => void this.loadDetail(context, url)");
    });

    it("keeps JHS marks and restores a separate JavDB want action", () => {
        expect(fc2Source).toContain('data-jhs-action="javdb-want"');
        expect(fc2Source).toContain("markJavDbWantWatch(movieId)");
        expect(fc2Source).toContain("openJavDbLoginDialog({");
        expect(fc2Source).not.toContain('this.getBean("TOP250Plugin")');
        expect(fc2Source).toContain('openJavDbLoginDialog({');
        expect(top250Source).not.toContain('openJavDbLoginDialog({');
        expect(top250Source).not.toContain("hasStoredEncryptedCredential");
        expect(top250Source).not.toContain("removeStoredEncryptedCredential");
        expect(top250Source).not.toContain("storeEncryptedCredential");
    });

    it("supports exact layer closing, reusable MagnetHub and hardened mobile layout", () => {
        expect(titleFilterControllerSource).toContain("this.ui.closePage({ root: this.ui.jquery(title) })");
        expect(titleFilterControllerSource).toContain('this.window.getSelection()?.toString()');
        expect(fc2Source).toContain('hubButton.attr("aria-expanded", "false")');
        expect(fc2Source).toContain("magnetHubPromise ||=");
        expect(primitivesSource).toMatch(/\.magnet-tabs > div \{[^}]*width: 100%;[^}]*min-width: 0;[^}]*overflow-x: auto;/);
        expect(fc2StylesSource).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
        expect(fc2StylesSource).toContain("@media (max-width:339px)");
    });

    it("keeps asynchronous error variables inside their catch callbacks", () => {
        expect(fc2Source).not.toMatch(/catch\(\(error => [^{\n]*\), clog\.error/);
        expect(fc2By123AvSource).not.toMatch(/catch\(\(error => [^{\n]*\), clog\.error/);
        expect(fc2Source).toMatch(/catch\(\(\/\*\* @type \{unknown\} \*\/ error\) => \{\n\s+if \(!context\.isAlive\(\) \|\| generation !== context\.otherSiteGeneration\) return;\n\s+sitesGroup\.show\(\);/);
        expect(fc2Source).toContain("renderFc2State(context.root.find('[data-jhs-role=\"other-sites\"]'), \"外部站点加载失败\")");
        expect(fc2Source).toContain('catch((/** @type {unknown} */ error) => {');
    });

    it("initializes screenshot through the single ScreenshotService-owned view and keeps stable slots", () => {
        expect(screenshotPanelSource).toContain("renderScreenshotPanel");
        expect(screenshotControllerSource).toContain("this.screenshot.isEnabled(this.settings.snapshot())");
        expect(fc2Source).toContain('screenshotService.isEnabled(settings.snapshot())');
        expect(fc2StylesSource).toContain(".jhs-fc2-screenshot:empty");
        expect(fc2Source).toContain("box ? sitesGroup.show() : sitesGroup.hide()");
        expect(fc2Source).toContain("sitesGroup.hide();");
        expect(fc2Source).not.toContain("if (!result && !screenshot.children().length) screenshot.remove()");
        expect(fc2Source).not.toContain('settings.snapshot().enableLoadScreenShot !== "no" && screenshot.remove()');
    });

    it("creates fixed slots in display order and keeps two contexts isolated", () => {
        const { $, context } = loadWorkspace(), host = $("#host"), firstShell = context.createShell({ carNum: "fc2-123", source: "fc2", mode: "page" }).appendTo(host), secondShell = context.createShell({ carNum: "fc2-456", source: "123av", mode: "dialog" }).appendTo(host);
        const first = context.createContext(firstShell, { carNum: "FC2-123" }), second = context.createContext(secondShell, { carNum: "FC2-456" });
        expect(firstShell.find("[data-jhs-section]").map(((index, node) => $(node).attr("data-jhs-section"))).get()).toEqual([ "summary", "gallery", "resources", "reviews", "related" ]);
        first.getSlot("gallery").append("<span>first</span>"), second.getSlot("gallery").append("<span>second</span>");
        expect(first.getSlot("gallery").text()).toBe("first"), expect(second.getSlot("gallery").text()).toBe("second");
    });

    it("disconnects owned lifecycle resources and rejects commits after destroy", () => {
        const { $, context } = loadWorkspace(), shell = context.createShell({ carNum: "FC2-123" }).appendTo($("#host")), detail = context.createContext(shell), observer = { disconnect: vi.fn() };
        detail.addObserver(observer), expect(detail.isAlive()).toBe(true), detail.destroy();
        expect(detail.isAlive()).toBe(false), expect(observer.disconnect).toHaveBeenCalledOnce();
    });
});

describe("JavDB exact movie resolver", () => {
    it("deduplicates concurrent requests and only accepts an exact normalized number", async () => {
        let release;
        const pending = new Promise(resolve => (release = resolve)), loaded = loadResolver(() => pending);
        const first = loaded.resolveId("FC2-123"), second = loaded.resolveId("fc2-123");
        release({ data: { movies: [ { id: "wrong", number: "FC2-1234" }, { id: "right", number: "FC2-123" } ] } });
        await expect(Promise.all([ first, second ])).resolves.toEqual([ "right", "right" ]), expect(loaded.get).toHaveBeenCalledOnce();
        expect(loaded.requests).toHaveLength(1);
        expect(loaded.requests[0]).toMatchObject({ providerId: "javdb", cacheScope: "public", ttlMs: 7 * 864e5 });
    });

    it("uses a short negative cache value but does not convert network errors into misses", async () => {
        const miss = loadResolver(async () => ({ data: { movies: [ { id: "near", number: "FC2-999" } ] } }));
        await expect(miss.resolveId("FC2-123")).resolves.toBeNull(), expect(miss.get).toHaveBeenCalledOnce();
        const failed = loadResolver(async () => { throw new Error("network"); });
        await expect(failed.resolveId("FC2-123")).rejects.toThrow("network"), expect(failed.get).toHaveBeenCalledOnce();
    });
});

describe("JavDB native want action", () => {
    it("reads an existing authenticated want-watch state before enabling the action", async () => {
        const api = loadWantApi({ response: { data: { movies: [ { id: "movie-123" } ] } } });
        await expect(api.getWantState("movie-123")).resolves.toBe(true);
        expect(api.gmRequest).toHaveBeenCalledWith("GET", expect.stringContaining("/v2/users/review_movies?status=want_watch"), null, {}, expect.objectContaining({ authorization: "Bearer token:encrypted" }));
    });

    it("submits want_watch to the JavDB account and invalidates cached details", async () => {
        const api = loadWantApi();
        await expect(api.markWant("movie-123")).resolves.toEqual({ success: 1 });
        expect(api.gmRequest).toHaveBeenCalledOnce();
        const [ method, url, body, query, headers ] = api.gmRequest.mock.calls[0];
        expect(method).toBe("POST"), expect(url).toBe("https://jdforrepam.com/api/v1/movies/movie-123/reviews"), expect(query).toEqual({});
        expect(body).toContain('name="status"\r\n\r\nwant_watch'), expect(body).toContain('name="score"\r\n\r\n0'), expect(headers.authorization).toBe("Bearer token:encrypted");
        expect(api.deleteCachedRequest).toHaveBeenCalledWith("movie-detail:movie-123");
    });

    it("requires login before sending the native want action", async () => {
        const api = loadWantApi({ encryptedToken: "" });
        await expect(api.markWant("movie-123")).rejects.toMatchObject({ code: "LOGIN_REQUIRED" });
        expect(api.gmRequest).not.toHaveBeenCalled();
    });
});
