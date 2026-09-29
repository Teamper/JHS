// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoverButtonController } from "../src/features/list/cover-button-controller.js";
import { JavDbPreviewController as PreviewVideoPlugin } from "../src/features/detail/javdb-preview-controller.js";
import { JavBusPreviewController } from "../src/features/detail/javbus-preview-controller.js";
import { ExternalBridgeTranslationController } from "../src/features/translation/translation-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { MagnetFilterController } from "../src/features/detail/magnet-filter-controller.js";

const $ = jquery;
const win = /** @type {any} */ (globalThis.window);
const doc = win.document;

/** Minimal SettingsService double that records listeners and emits settings.changed on set(). */
function makeSettings(initial) {
    const listeners = [];
    let snapshot = { ...initial };
    const emit = (names) => {
        for (const item of listeners) item.handler({ detail: { names } });
    };
    return {
        snapshot: () => snapshot,
        set: async (key, value) => { snapshot = { ...snapshot, [key]: value }; emit([key]); return snapshot; },
        addEventListener: (name, handler) => listeners.push({ name, handler }),
        removeEventListener: vi.fn((name, handler) => {
            const index = listeners.findIndex((item) => item.name === name && item.handler === handler);
            if (index >= 0) listeners.splice(index, 1);
        }),
        listeners,
    };
}

beforeEach(() => {
    doc.body.innerHTML = "";
    vi.stubGlobal("$", $);
    vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() });
    vi.stubGlobal("show", { error: vi.fn(), info: vi.fn(), ok: vi.fn() });
    vi.stubGlobal("utils", { loopDetector: vi.fn(), htmlTo$dom: vi.fn((html) => $(new win.DOMParser().parseFromString(html, "text/html"))) });
    win.isDetailPage = false;
    win.isListPage = false;
});
afterEach(() => vi.unstubAllGlobals());

describe("PreviewVideoPlugin live lifecycle", () => {
    it("registers exactly one settings listener even when the master switch starts OFF", async () => {
        win.isDetailPage = true;
        const settings = makeSettings({ enablePreviewVideo: "no", enableLoadPreviewVideo: "yes" });
        const cleanups = [];
        const scope = { addCleanup: (fn) => cleanups.push(fn) };
        let legacyPluginsReady;
        const events = { on: vi.fn((name, handler) => { expect(name).toBe("jhs-features-ready"); legacyPluginsReady = handler; return () => { legacyPluginsReady = undefined; }; }) };
        const plugin = new PreviewVideoPlugin();
        plugin.getRuntimeService = (name) => name === "settings" ? settings : name === "events" ? events : name === "scope" ? async () => scope : name === "storage" ? {} : name === "movie" ? {} : null;
        plugin.getPageInfo = () => ({ carNum: "ABC-123" });
        const unmountSpy = vi.spyOn(plugin, "unmountPreview").mockImplementation(() => { plugin._previewMounted = false; });
        const mountSpy = vi.spyOn(plugin, "mountPreview").mockImplementation(() => { plugin._previewMounted = true; });

        await plugin.handle();
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(events.on).toHaveBeenCalledOnce();
        expect(unmountSpy).not.toHaveBeenCalled();
        legacyPluginsReady();
        expect(unmountSpy).toHaveBeenCalledTimes(1);

        for (let i = 0; i < 3; i++) {
            await settings.set("enablePreviewVideo", "yes");
            await settings.set("enablePreviewVideo", "no");
        }
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(unmountSpy.mock.calls.length).toBe(4); // 初始 1 + 3 次 OFF
        expect(mountSpy).toHaveBeenCalledTimes(3);
        cleanups.forEach((cleanup) => cleanup());
        expect(legacyPluginsReady).toBeUndefined();
    });

    it("DMM sub-switch OFF destroys the JHS player and restores the native preview", () => {
        win.isDetailPage = true;
        $("body").append('<video id="preview-video"></video><video id="jhs-preview-video"></video><div id="video-bottom-toolbar"></div>');
        const native = /** @type {any} */ (doc.getElementById("preview-video"));
        const dmm = /** @type {any} */ (doc.getElementById("jhs-preview-video"));
        native.classList.add("jhs-native-preview-hidden");
        Object.defineProperty(dmm, "pause", { value: vi.fn() });
        Object.defineProperty(dmm, "load", { value: vi.fn() });
        const settings = makeSettings({ enablePreviewVideo: "yes", enableLoadPreviewVideo: "no" });
        const cleanups = [];
        const scope = { addCleanup: (fn) => cleanups.push(fn) };
        const plugin = new PreviewVideoPlugin();
        plugin.getRuntimeService = (name) => name === "settings" ? settings : name === "scope" ? async () => scope : name === "storage" ? {} : name === "movie" ? {} : null;
        plugin.lifecycleScope = scope;
        plugin.reconfigure();
        expect($("#jhs-preview-video").length).toBe(0);
        expect($("#video-bottom-toolbar").length).toBe(1);
        expect($("#video-bottom-toolbar .jhs-video-quality-btn").length).toBe(0);
        expect($("#preview-video").hasClass("jhs-native-preview-hidden")).toBe(false);
    });

    it("stale initDmm never recreates the artificial trigger after Preview OFF", async () => {
        win.isDetailPage = true;
        const settings = makeSettings({ enablePreviewVideo: "yes", enableLoadPreviewVideo: "yes" });
        const cleanups = [];
        const scope = { addCleanup: (fn) => cleanups.push(fn), disposed: false };
        const plugin = new PreviewVideoPlugin();
        plugin.getRuntimeService = (name) => name === "settings" ? settings : name === "scope" ? async () => scope : name === "storage" ? {} : name === "movie" ? {} : null;
        plugin.lifecycleScope = scope;
        $("body").append('<div class="preview-images"></div>');
        let resolveDmm = null;
        plugin.getDmmPreview = () => new Promise((resolve) => { resolveDmm = resolve; });
        const pending = plugin.initDmm(scope);
        // 请求在途时用户关闭 Preview：generation 自增并卸载。
        settings.snapshot().enablePreviewVideo = "no";
        plugin.reconfigure();
        resolveDmm?.({ sources: { mhb_w: "https://example.test/a.mp4" }, error: null });
        await pending;
        expect($(".preview-video-container[data-jhs-dmm-trigger]").length).toBe(0);
        expect($(".preview-video-container").length).toBe(0);
    });

    it("initDmm marks the artificial trigger so DMM OFF can remove only it", async () => {
        win.isDetailPage = true;
        const settings = makeSettings({ enablePreviewVideo: "yes", enableLoadPreviewVideo: "yes" });
        const cleanups = [];
        const scope = { addCleanup: (fn) => cleanups.push(fn), disposed: false };
        const plugin = new PreviewVideoPlugin();
        plugin.getRuntimeService = (name) => name === "settings" ? settings : name === "scope" ? async () => scope : name === "storage" ? {} : name === "movie" ? {} : null;
        plugin.lifecycleScope = scope;
        $("body").append('<div class="preview-images"></div>');
        plugin.getDmmPreview = async () => ({ sources: { mhb_w: "https://example.test/a.mp4" }, error: null });
        await plugin.initDmm(scope);
        expect($(".preview-video-container[data-jhs-dmm-trigger]").length).toBe(1);
        settings.snapshot().enableLoadPreviewVideo = "no";
        plugin.reconfigure();
        expect($(".preview-video-container[data-jhs-dmm-trigger]").length).toBe(0);
    });
});

describe("JavBusPreviewController lifecycle", () => {
    it("creates remote media controls without interpreting URL text as markup", async () => {
        doc.body.innerHTML = '<div id="target"></div>';
        const settings = makeSettings({ videoQuality: "mhb_w", videoMuted: true });
        const controller = new JavBusPreviewController({ document: doc, window: win, hostAdapter: { site: "javbus" }, route: "detail", settings, events: { on: () => () => {} }, storage: {}, movie: {}, ui: { jquery: $ }, diagnostics: { recordError: vi.fn() }, scope: new LifecycleScope("javbus-preview:xss") });
        const payload = 'https://example.test/video.mp4\" onerror=\"alert(1)\"><img class=\"injected\">';
        await controller.createVideoPlayerAndControls({ mhb_w: payload }, $("#target"));
        expect(doc.querySelector(".injected")).toBeNull();
        expect(doc.querySelector("[onerror]")).toBeNull();
        expect($("#preview-video source").attr("src")).toBe(payload);
        expect($(".jhs-video-quality-btn").data("video-src")).toBe(payload);
    });

    it("registers one listener and dispatches mount/unmount on toggles", async () => {
        doc.body.innerHTML = '<div id="sample-waterfall"><div class="sample-box"><div class="photo-frame"><img src="https://example.test/cover.jpg"></div></div></div>';
        const settings = makeSettings({ enablePreviewVideo: "no", enableLoadPreviewVideo: "yes" });
        const scope = new LifecycleScope("javbus-preview:lifecycle");
        let legacyPluginsReady;
        const events = { on: vi.fn((name, handler) => { expect(name).toBe("jhs-features-ready"); legacyPluginsReady = handler; return () => { legacyPluginsReady = undefined; }; }) };
        const controller = new JavBusPreviewController({ document: doc, window: win, hostAdapter: { site: "javbus", readMovieRef: () => ({ carNum: "ABC-123" }), locateNativeGallery: () => doc.querySelector("#sample-waterfall") }, route: "detail", settings, events, storage: {}, movie: {}, ui: { jquery: $ }, diagnostics: { recordError: vi.fn() }, scope });
        const unmountSpy = vi.spyOn(controller, "unmountPreview"), mountSpy = vi.spyOn(controller, "mountPreview");

        expect(controller.start()).toBe(true);
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(events.on).toHaveBeenCalledOnce();
        expect(unmountSpy).not.toHaveBeenCalled();
        expect(mountSpy).not.toHaveBeenCalled();
        legacyPluginsReady();
        expect(unmountSpy).toHaveBeenCalledTimes(1);

        await settings.set("enablePreviewVideo", "yes");
        await settings.set("enableLoadPreviewVideo", "no");
        await settings.set("enablePreviewVideo", "no");
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(mountSpy).toHaveBeenCalledTimes(1);
        expect(unmountSpy.mock.calls.length).toBe(3);
        scope.dispose();
        expect(legacyPluginsReady).toBeUndefined();
        expect(settings.removeEventListener).toHaveBeenCalledOnce();
        expect(doc.querySelector(".preview-video-container")).toBeNull();
    });

    it("cancels a pending DMM response when Preview turns OFF", async () => {
        doc.body.innerHTML = '<div id="sample-waterfall"><div class="sample-box"><div class="photo-frame"><img src="https://example.test/cover.jpg"></div></div></div>';
        const settings = makeSettings({ enablePreviewVideo: "yes", enableLoadPreviewVideo: "yes", videoQuality: "mhb_w" });
        const scope = new LifecycleScope("javbus-preview-pending-request");
        let ready;
        let resolvePreview;
        let requestScope;
        const events = { on: (_name, handler) => { ready = handler; return () => { ready = undefined; }; } };
        const storage = { getLocal: () => null, setLocal: vi.fn() };
        const movie = { preview: vi.fn((_provider, _identity, options) => {
            requestScope = options.scope;
            return new Promise((resolve) => { resolvePreview = resolve; });
        }) };
        const controller = new JavBusPreviewController({
            document: doc, window: win,
            hostAdapter: { site: "javbus", readMovieRef: () => ({ carNum: "ABC-123" }), locateNativeGallery: () => doc.querySelector("#sample-waterfall") },
            route: "detail", settings, events, storage, movie, ui: { jquery: $ },
            diagnostics: { recordError: vi.fn() }, scope,
        });

        controller.start();
        ready();
        const pending = controller.handleVideo();
        await vi.waitFor(() => expect(movie.preview).toHaveBeenCalledOnce());
        expect(requestScope.signal.aborted).toBe(false);

        await settings.set("enablePreviewVideo", "no");
        expect(requestScope.signal.aborted).toBe(true);
        resolvePreview({ sources: { mhb_w: "https://example.test/late.mp4" }, pageUrl: "https://example.test/dmm", matchType: "single" });
        await pending;

        expect(doc.querySelector("#preview-video")).toBeNull();
        expect(doc.querySelector("#bus-preview-modal.is-open")).toBeNull();
        expect(doc.querySelector(".preview-video-container")).toBeNull();
        scope.dispose();
    });
});

describe("CoverButtonController lifecycle", () => {
    it("mounts one settings listener and removes it with its Feature scope", async () => {
        const settings = makeSettings({ enablePreviewVideo: "yes" });
        const scope = new LifecycleScope("cover-button-test");
        const plugin = new CoverButtonController({
            document: doc, window: win,
            list: { getSelector: () => ({ itemSelector: ".item" }), findCarNumAndHref: () => ({ carNum: "ABC-123" }), parseActressName: async () => [] },
            settings, state: { patch: vi.fn() }, screenshot: { resolve: vi.fn() }, storage: {},
            movie: { externalSiteOrigin: (key) => `https://${key}.example.test`, providerOrigin: () => "https://av123.example.test" }, scope,
            ui: { jquery: $, confirm: vi.fn(), loading: () => ({ close() {} }), openImageViewer: vi.fn() },
            clipboard: { copyText: vi.fn() }, notifications: { error: vi.fn(), ok: vi.fn() }, diagnostics: { recordError: vi.fn() },
            navigation: { open: vi.fn() }, screenshotAvailable: true, isJavBus: false,
        });

        await plugin.start();
        await plugin.start();
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(doc.querySelectorAll(".jhs-cover-tools")).toHaveLength(0);
        scope.dispose();
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(0);
    });
});

describe("native translation feature live lifecycle", () => {
    it("reverts on OFF and re-applies on ON with a single listener", async () => {
        win.isDetailPage = true;
        $("body").append('<h1 class="jhs-fc2-title"><strong class="current-title">ABC-123 タイトル</strong></h1>');
        const settings = makeSettings({ translateTitle: "yes" });
        const scope = new LifecycleScope("translation-live-test");
        const translation = { translate: vi.fn(async () => "译名") };
        const controller = new ExternalBridgeTranslationController({
            document: doc, window: win, route: "detail", hostAdapter: { readMovieRef: () => ({ carNum: "ABC-123" }) },
            listPage: null, settings, translation, styles: { register: () => () => {} }, diagnostics: { recordError() {} }, scope,
        });

        controller.start();
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        await vi.waitFor(() => expect($(".translated-title").length).toBe(1));
        expect($(".translated-title").text()).toBe("译名");

        await settings.set("translateTitle", "no");
        expect($(".translated-title").length).toBe(0);

        await settings.set("translateTitle", "yes");
        await vi.waitFor(() => expect($(".translated-title").length).toBe(1));
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(translation.translate).toHaveBeenLastCalledWith("ABC-123 タイトル", expect.objectContaining({ cacheAlias: "ABC-123", scope }));
        scope.dispose();
        expect($(".translated-title").length).toBe(0);
    });

    it("does not render a request that returns after the setting turns OFF", async () => {
        win.isDetailPage = true;
        $("body").append('<h1><strong class="current-title">ABC-123 タイトル</strong></h1>');
        const settings = makeSettings({ translateTitle: "yes" });
        let finishTranslation;
        const translation = { translate: vi.fn(() => new Promise((resolve) => { finishTranslation = resolve; })) };
        const scope = new LifecycleScope("translation-late-response-test");
        const controller = new ExternalBridgeTranslationController({
            document: doc, window: win, route: "detail", hostAdapter: { readMovieRef: () => ({ carNum: "ABC-123" }) },
            listPage: null, settings, translation, styles: { register: () => () => {} }, diagnostics: { recordError() {} }, scope,
        });

        controller.start();
        await vi.waitFor(() => expect(translation.translate).toHaveBeenCalledOnce());
        await settings.set("translateTitle", "no");
        expect($(".translated-title").length).toBe(0);
        finishTranslation("迟到译文");
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect($(".translated-title").length).toBe(0);
        scope.dispose();
    });
});

describe("Detail Feature magnet filter lifecycle", () => {
    it("filters host rows, restores them on OFF, and cleans listeners and score UI on stop", async () => {
        doc.body.innerHTML = '<button id="enable-magnets-filter" class="do-hide"><span id="magnets-span"></span></button><div id="magnets-content"><div class="item" id="high"><span class="name" style="font-weight:600;color:purple">ABC-123 4K HDR</span></div><div class="item" id="low"><span class="name">普通资源</span></div><div class="item" id="sub" data-subtitle="yes"><span class="name">中字资源</span></div></div>';
        const settings = makeSettings({ enableMagnetsFilter: "yes" });
        const scope = new LifecycleScope("magnet-filter-lifecycle");
        const rows = [...doc.querySelectorAll("#magnets-content .item")];
        const boundary = {
            rows: () => rows,
            getTitleTarget: (row) => row.querySelector(".name"),
            hasSubtitleTag: (row) => row.dataset.subtitle === "yes",
        };
        const eventHandlers = new Map();
        const events = { on: vi.fn((name, handler) => { eventHandlers.set(name, handler); return () => eventHandlers.delete(name); }) };
        const controller = new MagnetFilterController({ document: doc, hostAdapter: { site: "javdb", getDetailResourceBoundary: () => boundary }, settings, events, scope });

        expect(controller.start()).toBe(true);
        expect(doc.querySelector("#high").classList.contains("high-quality")).toBe(true);
        expect(doc.querySelector("#sub").classList.contains("high-quality")).toBe(true);
        expect(doc.querySelector("#low").classList.contains("jhs-magnet-filter-hidden")).toBe(true);
        expect(doc.querySelectorAll(".jhs-magnet-score")).toHaveLength(3);
        expect(doc.querySelector("#enable-magnets-filter").getAttribute("aria-pressed")).toBe("true");
        expect(doc.querySelector("#enable-magnets-filter").getAttribute("data-tip")).toContain("仅显示");

        await settings.set("enableMagnetsFilter", "no");
        expect(rows.every((row) => !row.classList.contains("jhs-magnet-filter-hidden"))).toBe(true);
        expect(doc.querySelectorAll(".jhs-magnet-score")).toHaveLength(0);
        expect(doc.querySelector("#high .name").style.color).toBe("purple");
        expect(doc.querySelector("#enable-magnets-filter").getAttribute("aria-pressed")).toBe("false");
        expect(doc.querySelector("#enable-magnets-filter").hasAttribute("data-tip")).toBe(false);

        await settings.set("enableMagnetsFilter", "yes");
        expect(doc.querySelector("#low").classList.contains("jhs-magnet-filter-hidden")).toBe(true);
        eventHandlers.get("magnet-items-updated")();
        scope.dispose();
        expect(eventHandlers.size).toBe(0);
        expect(settings.removeEventListener).toHaveBeenCalledOnce();
        expect(doc.querySelectorAll(".jhs-magnet-score")).toHaveLength(0);
        expect(rows.every((row) => !row.classList.contains("jhs-magnet-filter-hidden"))).toBe(true);
    });
});
