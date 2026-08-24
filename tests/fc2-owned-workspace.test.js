import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { createJavDbAdapter } from "../src/integrations/javdb/manifest.js";
import { HttpService } from "../src/services/http-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { CacheService } from "../src/services/cache-service.js";

const repoRoot = join(import.meta.dirname, "..");
const fc2Source = readTestFile(join(repoRoot, "src/plugins/external-search/fc2.js"), "utf8");
const fc2By123AvSource = readTestFile(join(repoRoot, "src/plugins/external-search/fc2-by-123av.js"), "utf8");
const screenshotSource = readTestFile(join(repoRoot, "src/plugins/image-viewer/screenshot.js"), "utf8");
const listPageSource = readTestFile(join(repoRoot, "src/plugins/status/list-page.js"), "utf8");
const historySource = readTestFile(join(repoRoot, "src/plugins/status/history.js"), "utf8");
const stateServiceSource = readTestFile(join(repoRoot, "src/core/state-service.js"), "utf8");
const titleFilterSource = readTestFile(join(repoRoot, "src/plugins/blacklist/filter-title-keyword.js"), "utf8");
const highlightMagnetSource = readTestFile(join(repoRoot, "src/plugins/status/highlight-magnet.js"), "utf8");
const primitivesSource = readTestFile(join(repoRoot, "src/core/ui-primitives.js"), "utf8");
const magnetHubSource = readTestFile(join(repoRoot, "src/plugins/external-search/magnet-hub.js"), "utf8");
const loggerSource = readTestFile(join(repoRoot, "src/core/logger.js"), "utf8");
const top250Source = readTestFile(join(repoRoot, "src/plugins/external-search/top250.js"), "utf8");

function loadWorkspace() {
    const dom = new JSDOM('<main id="host"></main>', { url: "https://javdb.com/users/collection_codes" }), $ = jqueryFactory(dom.window);
    const context = vm.createContext({ window: dom.window, document: dom.window.document, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, $, BasePlugin: class {}, r: true, l: false,
        normalizeCarNum: value => String(value || "").trim().toUpperCase() || null, jhsEventBus: { emit: vi.fn() }, utils: {}, JhsSelect: {} });
    const source = readTestFile(join(repoRoot, "src/plugins/status/detail-workspace.js"), "utf8");
    vm.runInContext(`${source};globalThis.createShell=createFc2DetailShell;globalThis.createContext=createFc2DetailContext`, context);
    return { $, context };
}

function loadResolver(responseFactory) {
    const requests = [], get = vi.fn(responseFactory), port = { request: async options => {
        requests.push(options);
        return { status: 200, data: await get(options), finalUrl: options.url };
    } };
    const http = new HttpService(port, new ExternalUrlPolicy(), { cache: new CacheService() });
    const adapter = createJavDbAdapter(http, () => "signature");
    return { resolveId: carNum => adapter.resolveMovie({ carNum }).then(value => value?.movieId || null), get, requests };
}

function loadWantApi({ encryptedToken = "encrypted", response = { success: 1 } } = {}) {
    const local = new Map(encryptedToken ? [ [ "jhs_appAuthorization", encryptedToken ] ] : []), gmRequest = vi.fn(async () => response), deleteCachedRequest = vi.fn(async () => {}), context = vm.createContext({
        storageManager: { deleteCachedRequest }, gmHttp: { gmRequest }, localStorage: { getItem: key => local.get(key) || null, setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key) }, decryptData: vi.fn(async value => `token:${value}`), md5: String,
        normalizeCarNum: String, utils: { formatDate: String }, show: { error: vi.fn() }
    });
    const source = readTestFile(join(repoRoot, "src/core/javdb-api.js"), "utf8");
    vm.runInContext(`${source};globalThis.markWant=markJavDbWantWatch`, context);
    return { markWant: context.markWant, gmRequest, deleteCachedRequest };
}

function loadImageViewer() {
    const dom = new JSDOM('<div id="gallery"><img src="a.jpg"><img src="b.jpg"></div>'), $ = jqueryFactory(dom.window), instances = [];
    class ViewerMock {
        constructor(host, options) { this.host = host, this.options = options, this.viewerData = { width: 1000, height: 800 }, this.imageData = { width: 400, height: 200 }, this.zoomTo = vi.fn(), this.moveTo = vi.fn(), this.prev = vi.fn(), this.next = vi.fn(), instances.push(this); }
        show() {}
        destroy() {}
    }
    const marker = loggerSource.indexOf("}(), function() {", loggerSource.indexOf("unsafeWindow.show")), start = loggerSource.indexOf("function() {", marker), end = loggerSource.indexOf("}(), window.ImageHoverPreview", start), viewerIife = loggerSource.slice(start, end + 1), context = vm.createContext({ window: dom.window, document: dom.window.document, $, Viewer: ViewerMock, JHS_Z_INDEX: { viewer: 100 }, setTimeout: vi.fn() });
    vm.runInContext(`(${viewerIife})();`, context);
    return { dom, instances };
}

describe("FC2 owned detail workspace", () => {
    it("passes Layer an HTML string instead of a raw DOM node", () => {
        expect(fc2Source).toContain('content: \'<div class="jhs-fc2-dialog-host"></div>\'');
        expect(fc2Source).not.toContain("content: host[0]");
        expect(fc2Source).toContain("scrollbar: !1, shadeClose: !0");
        expect(fc2Source).toContain("utils.setupEscClose(layerIndex)");
    });

    it("keeps the dialog height chain bounded so the workspace owns scrolling", () => {
        expect(fc2Source).toMatch(/\.movie-detail-layer \.layui-layer-content \{[^}]*min-height:0;[^}]*overflow:hidden;/);
        expect(fc2Source).toMatch(/\.movie-detail-layer \.jhs-fc2-dialog-host \{[^}]*height:100%;[^}]*min-height:0;/);
        expect(fc2Source).toMatch(/\.jhs-fc2-workspace\[data-jhs-fc2-mode="dialog"\] \{[^}]*height:100%;[^}]*min-height:0;[^}]*overflow-y:auto;/);
    });

    it("lets sections keep their content height and opens gallery thumbnails in the viewer", () => {
        expect(fc2Source).toMatch(/\.jhs-fc2-workspace \{[^}]*grid-auto-rows:max-content;[^}]*align-content:start;/);
        expect(fc2Source).toMatch(/\.jhs-fc2-gallery-grid \{[^}]*minmax\(112px,144px\)/);
        expect(fc2Source).toContain('class=\\"jhs-btn jhs-fc2-gallery-item\\"');
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
        const { dom, instances } = loadImageViewer(), gallery = dom.window.document.querySelector("#gallery"), selected = gallery.querySelectorAll("img")[1];
        dom.window.showImageViewer(selected, "", { galleryRoot: gallery });
        const viewer = instances[0];
        expect(viewer.host).toBe(gallery), expect(viewer.options.initialViewIndex).toBe(1), expect(viewer.options.toolbar.prev).toBe(1), expect(viewer.options.toolbar.next).toBe(1);
        viewer.options.viewed();
        expect(viewer.moveTo).toHaveBeenCalledWith(300, 300);
    });

    it("renders screenshot-provider results as the smallest thumbnail until opened", () => {
        expect(fc2Source).toMatch(/\.jhs-fc2-screenshot-thumbnail \{[^}]*width:112px;/);
        expect(screenshotSource).toContain('class="jhs-btn jhs-fc2-gallery-item jhs-fc2-screenshot-thumbnail"');
        expect(screenshotSource).toContain("showImageViewer(image[0])");
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
        expect(fc2By123AvSource).toContain('data-jhs-fc2-source="123av"');
        expect(listPageSource).toContain("{ source: fc2Source }");
        expect(historySource).toContain("resolveFc2Source(t)");
        expect(stateServiceSource).toContain('"fc2Source"');
        expect(fc2Source).toContain('target.searchParams.set("source", source)');
    });

    it("restores source links, magnet metadata and scoped quality filtering", () => {
        expect(fc2Source).toContain("FC2PPVDB");
        expect(fc2Source).toContain("FC2 市场");
        expect(fc2Source).toContain("item.hasHdTag && tags.append");
        expect(fc2Source).toContain("item.hasSubtitleTag && tags.append");
        expect(fc2Source).toContain("item.createdAt");
        expect(fc2Source).toContain('data-jhs-action="filter-native-magnets"');
        expect(highlightMagnetSource).toContain("assessMagnet({");
    });

    it("assesses explicit HD and subtitle tags even when the title has no marker", () => {
        const context = vm.createContext({ BasePlugin: class {}, clog: { debug: vi.fn() } });
        vm.runInContext(`${magnetHubSource.slice(0, magnetHubSource.indexOf("class MagnetHubPlugin"))}\n${highlightMagnetSource};globalThis.Highlighter=HighlightMagnetPlugin`, context);
        const highlighter = Object.create(context.Highlighter.prototype), assessed = highlighter.assessMagnet({ title: "FC2-123", hasHdTag: true, hasSubtitleTag: true, seeders: 0 });
        expect(assessed.highQuality).toBe(true), expect(assessed.subtitle).toBe(true), expect(assessed.score.resolution).toBe(20), expect(assessed.score.subtitle).toBe(20);
    });

    it("shares the 123AV movie resolver and keeps summary retry local", () => {
        expect(fc2By123AvSource).toContain("fc2Plugin.mountPanels(context, movieIdPromise)");
        expect(fc2By123AvSource).toContain("fc2Plugin.configureJavDbWantButton(context, movieIdPromise)");
        expect(fc2By123AvSource).toContain("movieIdPromise.then");
        expect(fc2By123AvSource).toContain("loadSummary(context, url)");
        expect(fc2By123AvSource).not.toContain("() => void this.loadDetail(context, url)");
    });

    it("keeps JHS marks and restores a separate JavDB want action", () => {
        expect(fc2Source).toContain('data-jhs-action="javdb-want"');
        expect(fc2Source).toContain("markJavDbWantWatch(movieId)");
        expect(fc2Source).toContain('this.getBean("TOP250Plugin")');
        expect(top250Source).toContain('"function" === typeof onSuccess ? await onSuccess()');
    });

    it("supports exact layer closing, reusable MagnetHub and hardened mobile layout", () => {
        expect(titleFilterSource).toContain("utils.closePage({ root: host, layerIndex })");
        expect(fc2Source).toContain('hubButton.attr("aria-expanded", "false")');
        expect(fc2Source).toContain("magnetHubPromise ||=");
        expect(primitivesSource).toMatch(/\.magnet-tabs > div \{[^}]*width: 100%;[^}]*min-width: 0;[^}]*overflow-x: auto;/);
        expect(fc2Source).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
        expect(fc2Source).toContain("@media (max-width:339px)");
    });

    it("keeps asynchronous error variables inside their catch callbacks", () => {
        expect(fc2Source).not.toMatch(/catch\(\(error => [^{\n]*\), clog\.error/);
        expect(fc2By123AvSource).not.toMatch(/catch\(\(error => [^{\n]*\), clog\.error/);
        expect(fc2Source).toContain('catch((error => {\n            context.isAlive() && sitesGroup.remove()');
        expect(fc2By123AvSource).toContain('catch((error => {\n            context.isAlive() && fc2Plugin.setState');
    });

    it("initializes screenshot providers once per owned render and removes empty spacing", () => {
        expect(screenshotSource).toContain("getScreenshotFromInitializedProviders(carNum)");
        expect(fc2Source).toContain(".jhs-fc2-screenshot:empty");
        expect(fc2Source).toContain("if (context.isAlive() && !box) sitesGroup.remove()");
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
