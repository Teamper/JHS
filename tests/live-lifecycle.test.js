// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoverButtonPlugin } from "../src/plugins/image-viewer/cover-button.js";
import { PreviewVideoPlugin } from "../src/plugins/image-viewer/preview-video.js";
import { BusPreviewVideoPlugin } from "../src/plugins/image-viewer/bus-preview-video.js";
import { TranslatePlugin } from "../src/plugins/translate/translate.js";
import { HighlightMagnetPlugin } from "../src/plugins/status/highlight-magnet.js";

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
        removeEventListener: vi.fn(),
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
        const plugin = new PreviewVideoPlugin();
        plugin.getRuntimeService = (name) => name === "settings" ? settings : name === "scope" ? async () => scope : name === "storage" ? {} : name === "movie" ? {} : null;
        plugin.getPageInfo = () => ({ carNum: "ABC-123" });
        const unmountSpy = vi.spyOn(plugin, "unmountPreview").mockImplementation(() => { plugin._previewMounted = false; });
        const mountSpy = vi.spyOn(plugin, "mountPreview").mockImplementation(() => { plugin._previewMounted = true; });

        await plugin.handle();
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(unmountSpy).toHaveBeenCalledTimes(1);

        for (let i = 0; i < 3; i++) {
            await settings.set("enablePreviewVideo", "yes");
            await settings.set("enablePreviewVideo", "no");
        }
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(unmountSpy.mock.calls.length).toBe(4); // 初始 1 + 3 次 OFF
        expect(mountSpy).toHaveBeenCalledTimes(3);
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
        expect($("#video-bottom-toolbar").length).toBe(0);
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

describe("BusPreviewVideoPlugin live lifecycle", () => {
    it("registers one listener and dispatches mount/unmount on toggles", async () => {
        win.isDetailPage = true;
        const settings = makeSettings({ enablePreviewVideo: "no", enableLoadPreviewVideo: "yes" });
        const cleanups = [];
        const scope = { addCleanup: (fn) => cleanups.push(fn) };
        const plugin = new BusPreviewVideoPlugin();
        plugin.getRuntimeService = (name) => name === "settings" ? settings : name === "scope" ? async () => scope : name === "storage" ? {} : name === "movie" ? {} : null;
        plugin.getPageInfo = () => ({ carNum: "ABC-123" });
        const unmountSpy = vi.spyOn(plugin, "unmountPreview").mockImplementation(() => { plugin._busPreviewMounted = false; });
        const mountSpy = vi.spyOn(plugin, "mountPreview").mockImplementation(() => { if (plugin._busPreviewMounted) return; plugin._busPreviewMounted = true; });

        await plugin.handle();
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(unmountSpy).toHaveBeenCalledTimes(1);

        await settings.set("enablePreviewVideo", "yes");
        await settings.set("enableLoadPreviewVideo", "no");
        await settings.set("enablePreviewVideo", "no");
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(mountSpy).toHaveBeenCalled(); // 幂等挂载（DMM 子开关切换会再次进入 reconfigure，但不会重复挂载）
        // JavBus 无原生预览：DMM OFF 等于整个 JHS preview 入口不可用 → unmount（初始 OFF 1 次 + DMM OFF 1 次 + 总开关 OFF 1 次）
        expect(unmountSpy.mock.calls.length).toBe(3);
    });
});

describe("CoverButtonPlugin listener accumulation", () => {
    it("keeps exactly one settings listener across repeated handle() calls", async () => {
        win.isListPage = true;
        const settings = makeSettings({ enablePreviewVideo: "yes" });
        const cleanups = [];
        const scope = { addCleanup: (fn) => cleanups.push(fn) };
        const plugin = new CoverButtonPlugin();
        plugin.getRuntimeService = (name) => name === "settings" ? settings : name === "scope" ? async () => scope : {};
        plugin.getOptionalDependency = () => null;
        plugin.getSelector = () => ({ itemSelector: ".item", boxSelector: ".movie-list" });

        await plugin.handle();
        await plugin.handle();
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
    });
});

describe("TranslatePlugin live lifecycle", () => {
    it("reverts on OFF and re-applies on ON with a single listener", async () => {
        win.isDetailPage = true;
        $("body").append('<h1 class="jhs-fc2-title"><strong class="current-title">ABC-123 タイトル</strong></h1>');
        const settings = makeSettings({ translateTitle: "yes" });
        const cleanups = [];
        const scope = { addCleanup: (fn) => cleanups.push(fn) };
        const plugin = new TranslatePlugin();
        plugin.getRuntimeService = (name) => name === "settings" ? settings : name === "scope" ? async () => scope : name === "translation" ? { translate: async () => "译名" } : null;
        plugin.getOptionalDependency = () => null;

        await plugin.handle();
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        await vi.waitFor(() => expect($(".translated-title").length).toBe(1));
        expect($(".translated-title").text()).toBe("译名");

        await settings.set("translateTitle", "no");
        expect($(".translated-title").length).toBe(0);

        await settings.set("translateTitle", "yes");
        await vi.waitFor(() => expect($(".translated-title").length).toBe(1));
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
    });
});

describe("HighlightMagnetPlugin live lifecycle", () => {
    it("reconfigures on settings.changed and syncs the local button", async () => {
        win.isDetailPage = true;
        const settings = makeSettings({ enableMagnetsFilter: "yes" });
        const cleanups = [];
        const scope = { addCleanup: (fn) => cleanups.push(fn) };
        const plugin = new HighlightMagnetPlugin();
        plugin.getRuntimeService = (name) => name === "settings" ? settings : name === "scope" ? async () => scope : name === "host" ? { getDetailResourceBoundary: () => null } : null;
        const filterSpy = vi.spyOn(plugin, "doFilterMagnet").mockImplementation(() => undefined);
        const showAllSpy = vi.spyOn(plugin, "showAll").mockImplementation(() => undefined);

        await plugin.handle();
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(filterSpy).toHaveBeenCalledTimes(1);

        await settings.set("enableMagnetsFilter", "no");
        expect(showAllSpy).toHaveBeenCalledTimes(1);
        await settings.set("enableMagnetsFilter", "yes");
        expect(filterSpy.mock.calls.length).toBe(2);
        expect(settings.listeners.filter((item) => item.name === "settings.changed")).toHaveLength(1);
    });
});
