import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { createImageViewer } from "../src/core/image-viewer.js";
import { bindJavDbWantService, getJavDbWantWatchState, markJavDbWantWatch } from "../src/core/javdb-api.js";
import { createFc2DetailShell, createFc2DetailContext } from "../src/ui/detail/fc2-detail-workspace.js";
import { JavDbWantService } from "../src/services/javdb-want-service.js";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import javdbManifest, { createJavDbAdapter } from "../src/integrations/javdb/manifest.js";
import { createIntegrationRequestFacade } from "../src/app/integration-registry.js";
import { HttpService } from "../src/services/http-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { CacheService } from "../src/services/cache-service.js";
import { assessMagnetQuality } from "../src/core/magnet-quality.js";
import { Fc2WorkspaceService as Fc2Plugin } from "../src/features/detail/fc2-workspace-service.js";
import { Fc2WorkspaceService } from "../src/features/detail/fc2-workspace-service.js";

const cleanup = [];
afterEach(() => {
    for (const release of cleanup.splice(0).reverse()) release();
    vi.unstubAllGlobals();
});

function loadWorkspace() {
    const dom = new JSDOM('<main id="host"></main>', { url: "https://javdb.com/users/collection_codes" });
    const $ = jqueryFactory(dom.window);
    vi.stubGlobal("$", $);
    cleanup.push(() => dom.window.close());
    return { $, dom };
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
    const request = vi.fn(async () => ({ data: response }));
    const invalidate = vi.fn(async () => {});
    const service = new JavDbWantService({
        credential: { get: async () => encryptedToken ? "token:" + encryptedToken : "", remove() {} },
        sign: () => "fixture-signature", http: { request }, invalidate,
    });
    cleanup.push(bindJavDbWantService(service), () => service.dispose());
    return { markWant: markJavDbWantWatch, getWantState: getJavDbWantWatchState, request, invalidate };
}

function loadImageViewer() {
    const dom = new JSDOM('<div id="gallery"><img src="a.jpg"><img src="b.jpg"></div>'), $ = jqueryFactory(dom.window), instances = [];
    class ViewerMock {
        constructor(host, options) { this.host = host, this.options = options, this.viewerData = { width: 1000, height: 800 }, this.imageData = { width: 400, height: 200, naturalWidth: 400, naturalHeight: 200 }, this.viewed = true, this.footer = dom.window.document.createElement("div"), this.zoomTo = vi.fn(), this.moveTo = vi.fn(), this.resize = vi.fn(), this.prev = vi.fn(), this.next = vi.fn(), this.destroy = vi.fn(), instances.push(this); }
        show() {}
        destroy() {}
    }
    for (const [key, value] of Object.entries({
        window: dom.window, document: dom.window.document, $,
        Viewer: ViewerMock, MutationObserver: dom.window.MutationObserver,
    })) vi.stubGlobal(key, value);
    const scope = new LifecycleScope("viewer-test");
    dom.window.showImageViewer = createImageViewer(scope);
    cleanup.push(() => { scope.dispose(); dom.window.close(); });
    return { dom, instances, scope };
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
        const plugin = new Fc2Plugin({ runtimeServices: { ui: { openPage } } });
        expect(() => plugin.createFc2PageUrl(null, "FC2-123", "/v/abc")).toThrow("movieId");
        await plugin.openFc2Page(null, "FC2-123", "/v/abc", { newTab: true });
        expect(openPage).toHaveBeenCalledWith("/v/abc", "FC2-123", true, { newTab: true });
        vi.unstubAllGlobals();
    });
    it("uses an HTML dialog host and destroys the mounted workspace when the dialog closes", () => {
        const { $, dom } = loadWorkspace();
        let options;
        const dialog = { open: vi.fn(value => {
            options = value;
            expect(typeof value.content).toBe("string");
            const layer = $("<div></div>").html(value.content).appendTo("#host");
            value.success(layer[0], 4);
            return 4;
        }) };
        const setupEscClose = vi.fn(), service = new Fc2WorkspaceService({ runtimeServices: { dialog, ui: { setupEscClose } } });
        const destroy = vi.fn();
        const mount = vi.spyOn(service, "mountFc2Detail").mockReturnValue({ destroy });
        const url = "https://javdb.com/v/synthetic";
        expect(service.openFc2Dialog("test-id", "FC2-100", url, { source: "123av" })).toBe(4);
        expect(mount.mock.calls[0][0][0]).toBe(dom.window.document.querySelector(".jhs-fc2-dialog-host"));
        expect(mount.mock.calls[0][1]).toMatchObject({ movieId: "test-id", carNum: "FC2-100", url, source: "123av", mode: "dialog" });
        expect(setupEscClose).toHaveBeenCalledWith(4);
        options.end();
        expect(destroy).toHaveBeenCalledOnce();
    });

    it("restores the FC2 third-party slot when its Feature adapter attaches after page startup", () => {
        const dom = new JSDOM('<main id="host"><div class="jhs-fc2-workspace"><div data-jhs-slot="resources"><section class="jhs-fc2-resource-group"><div data-jhs-role="native-magnets"></div></section><section class="jhs-fc2-resource-group"><div data-jhs-role="magnet-hub"></div></section></div></div></main>', { url: "https://javdb.com/users/collection_codes" });
        const $ = jqueryFactory(dom.window), workspace = $(dom.window.document.querySelector(".jhs-fc2-workspace")), resources = workspace.find('[data-jhs-slot="resources"]');
        const context = { root: workspace, isAlive: () => true, getSlot: () => resources, otherSiteGeneration: 0 };
        workspace.data("jhsFc2Context", context);
        const adapter = {};
        let externalSites = adapter;
        const plugin = new Fc2Plugin({ readExternalSites: () => externalSites });
        const mount = vi.spyOn(plugin, "mountFc2OtherSites").mockImplementation(() => {});
        vi.stubGlobal("$", $);
        try {
            plugin.refreshExternalSites();
            const sitesGroup = resources.find('[data-jhs-role="other-sites"]').closest(".jhs-fc2-resource-group");
            expect(sitesGroup).toHaveLength(1);
            expect(sitesGroup.next().find('[data-jhs-role="magnet-hub"]')).toHaveLength(1);
            expect(mount).toHaveBeenCalledOnce();
            expect(mount.mock.calls[0][0]).toBe(context);
            expect(mount.mock.calls[0][1][0]).toBe(sitesGroup[0]);
            expect(mount.mock.calls[0][2]).toBe(adapter);

            externalSites = null;
            plugin.refreshExternalSites();
            expect(resources.find('[data-jhs-role="other-sites"]')).toHaveLength(0);
            expect(context.otherSiteGeneration).toBe(1);
        } finally {
            vi.unstubAllGlobals();
            dom.window.close();
        }
    });

    it("opens the selected gallery image with navigation and centers it in both axes", () => {
        const { dom, instances, scope } = loadImageViewer(), gallery = dom.window.document.querySelector("#gallery"), selected = gallery.querySelectorAll("img")[1];
        dom.window.showImageViewer(selected, "", { galleryRoot: gallery, imageKind: "photo" });
        const viewer = instances[0];
        expect(viewer.host.querySelectorAll("img")).toHaveLength(2);
        expect(viewer.options.initialViewIndex).toBe(1);
        expect(viewer.options.zoomOnWheel).toBe(true);
        expect(viewer.options.slideOnTouch).toBe(true);
        expect(viewer.options.loop).toBe(false);
        viewer.options.viewed();
        expect(viewer.zoomTo).toHaveBeenCalledWith(2.5);
        expect(viewer.moveTo).toHaveBeenCalledWith(0, 150);
        scope.dispose(); dom.window.close();
    });

    it("replaces an opening viewer and ignores its late callbacks", () => {
        const {dom,instances,scope}=loadImageViewer(), images=dom.window.document.querySelectorAll("img");
        dom.window.showImageViewer(images[0]);
        dom.window.showImageViewer(images[1]);
        expect(instances[0].destroy).toHaveBeenCalledOnce();
        instances[0].options.viewed(); instances[0].options.hidden();
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
        dom.window.showImageViewer(selected, "", {imageKind:"contact-sheet"});
        const viewer = instances[0];
        expect(viewer.host.parentElement).toBe(document.body);
        expect(viewer.options.inline).not.toBe(true);
        expect(viewer.options.initialViewIndex).toBe(0);
        expect(viewer.options.slideOnTouch).toBe(false);
        expect(viewer.options.url).toBe("data-jhs-viewer-source");
        expect([...viewer.host.querySelectorAll("img")].map(image => image.getAttribute(viewer.options.url))).toEqual(["https://example.test/sheet.jpg"]);
        expect([...viewer.host.querySelectorAll("img")].every(image => image.src.startsWith("data:image/"))).toBe(true);
        expect(workspace.inert).toBe(true);
        viewer.options.viewed();
        expect(viewer.zoomTo).toHaveBeenCalledWith(2.5);
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
             instances[i].options.hidden();
            expect(scope.cleanups.size).toBe(0);
            expect(dom.window.document.querySelectorAll(".temporary-container")).toHaveLength(0);
            expect(dom.window.document.body.style.overflow).toBe("clip");
        }
        scope.dispose(); dom.window.close();
    });

    it("exposes a frozen list-navigation capability without exposing the plugin instance", async () => {
        const openPage = vi.fn();
        const plugin = new Fc2Plugin({ runtimeServices: { ui: { openPage } } });
        Object.assign(plugin, {
            resolveMovieIdForRecord: vi.fn(async () => "movie-id"),
            resolveFc2Source: vi.fn(async () => "123av"),
            openFc2Page: vi.fn(async () => true),
            openFc2Dialog: vi.fn(),
        });
        const capability = plugin.getListNavigationCapability();
        expect(Object.isFrozen(capability)).toBe(true);
        await expect(capability.resolveMovieIdForRecord("FC2-123", "/v/fc2")).resolves.toBe("movie-id");
        await expect(capability.resolveFc2Source({ url: "/v/fc2" })).resolves.toBe("123av");
        await capability.openFc2Page("movie-id", "FC2-123", "/v/fc2", { newTab: true }, { source: "123av" });
        capability.openFc2Dialog("movie-id", "FC2-123", "/v/fc2", { source: "123av" });
        expect(plugin.resolveMovieIdForRecord).toHaveBeenCalledWith("FC2-123", "/v/fc2");
        expect(plugin.openFc2Page).toHaveBeenCalledWith("movie-id", "FC2-123", "/v/fc2", { newTab: true }, { source: "123av" });
        expect(plugin.openFc2Dialog).toHaveBeenCalledWith("movie-id", "FC2-123", "/v/fc2", { source: "123av" });

        const event = { button: 1 };
        capability.openNativeFallback("/v/fc2", "FC2-123", { event, newTab: true });
        expect(openPage).toHaveBeenCalledWith("/v/fc2", "FC2-123", true, { event, newTab: true });
        vi.unstubAllGlobals();
    });

    it("assesses explicit HD and subtitle tags even when the title has no marker", () => {
        const assessed = assessMagnetQuality({ title: "FC2-123", hasHdTag: true, hasSubtitleTag: true, seeders: 0 });
        expect(assessed.highQuality).toBe(true), expect(assessed.subtitle).toBe(true), expect(assessed.score.resolution).toBe(20), expect(assessed.score.subtitle).toBe(20);
    });

    it("creates fixed slots in display order and keeps two contexts isolated", () => {
        const { $ } = loadWorkspace(), host = $("#host"), firstShell = createFc2DetailShell({ carNum: "fc2-123", source: "fc2", mode: "page" }).appendTo(host), secondShell = createFc2DetailShell({ carNum: "fc2-456", source: "123av", mode: "dialog" }).appendTo(host);
        const first = createFc2DetailContext(firstShell, { carNum: "FC2-123" }), second = createFc2DetailContext(secondShell, { carNum: "FC2-456" });
        expect(firstShell.find("[data-jhs-section]").map(((index, node) => $(node).attr("data-jhs-section"))).get()).toEqual([ "summary", "gallery", "resources", "reviews", "related" ]);
        first.getSlot("gallery").append("<span>first</span>"), second.getSlot("gallery").append("<span>second</span>");
        expect(first.getSlot("gallery").text()).toBe("first"), expect(second.getSlot("gallery").text()).toBe("second");
    });

    it("disconnects owned lifecycle resources and rejects commits after destroy", () => {
        const { $ } = loadWorkspace(), shell = createFc2DetailShell({ carNum: "FC2-123" }).appendTo($("#host")), detail = createFc2DetailContext(shell), observer = { disconnect: vi.fn() };
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
        expect(api.request).toHaveBeenCalledWith(expect.objectContaining({
            method: "GET", url: expect.stringContaining("/v2/users/review_movies?status=want_watch"),
            headers: expect.objectContaining({ authorization: "Bearer token:encrypted" }),
        }), expect.any(LifecycleScope));
    });

    it("submits want_watch to the JavDB account and invalidates cached details", async () => {
        const api = loadWantApi();
        await expect(api.markWant("movie-123")).resolves.toEqual({ success: 1 });
        expect(api.request).toHaveBeenCalledOnce();
        const [{ method, url, body, headers }] = api.request.mock.calls[0];
        expect(method).toBe("POST"), expect(url).toBe("https://jdforrepam.com/api/v1/movies/movie-123/reviews");
        expect(body).toContain('name="status"\r\n\r\nwant_watch'), expect(body).toContain('name="score"\r\n\r\n0'), expect(headers.authorization).toBe("Bearer token:encrypted");
        expect(api.invalidate).toHaveBeenCalledWith("movie-123");
    });

    it("requires login before sending the native want action", async () => {
        const api = loadWantApi({ encryptedToken: "" });
        await expect(api.markWant("movie-123")).rejects.toMatchObject({ code: "LOGIN_REQUIRED" });
        expect(api.request).not.toHaveBeenCalled();
    });
});
