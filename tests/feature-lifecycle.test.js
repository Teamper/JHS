// @vitest-environment jsdom
import jquery from "jquery";
import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");
const $ = jquery;
const win = /** @type {any} */ (globalThis.window);
const doc = win.document;

beforeEach(() => { doc.body.innerHTML = '<div class="movie-list"></div>'; });
afterEach(() => vi.unstubAllGlobals());

function loadPlugin(relativePath, overrides = {}) {
    /** @type {Array<{ name: string, handler: (event: any) => void }>} */
    const settingsEvents = [];
    const settings = {
        snapshot: () => overrides.settingsSnapshot || {},
        addEventListener: (name, handler) => settingsEvents.push({ name, handler }),
        removeEventListener: vi.fn(),
    };
    const runtime = {
        settings,
        storageManager: overrides.storageManager || { getSetting: vi.fn(async () => ({})) },
        utils: overrides.utils || { htmlTo$dom: vi.fn((html) => $(new win.DOMParser().parseFromString(html, "text/html"))) },
        clog: { log: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
        ...overrides.runtime,
    };
    const context = vm.createContext({
        window: win, document: doc, $, URL, Date, console,
        setTimeout, clearTimeout, requestAnimationFrame, cancelAnimationFrame,
        BasePlugin: class {
            getRuntimeService(name) { return runtime[name]; }
            getOptionalDependency(name) { return runtime.optional?.[name]; }
        },
        clog: runtime.clog,
        utils: runtime.utils,
        storageManager: runtime.storageManager,
        isDetailPage: overrides.isDetailPage ?? true,
        isListPage: overrides.isListPage ?? true,
        r: true, l: false, o: "https://javdb.example/search?q=ABC",
        show: { error: vi.fn(), info: vi.fn(), ok: vi.fn() },
        ...overrides.globals,
    });
    const source = readTestFile(join(repoRoot, relativePath), "utf8");
    vm.runInContext(source + "; globalThis.TestPlugin = " + overrides.className + ";", context);
    return { Plugin: context.TestPlugin, settings, settingsEvents };
}

describe("Live feature lifecycle (mount/unmount/reconfigure)", () => {
    it("AutoPage: OFF 停止（loader 移除、请求清空），ON 重新启动不刷新", async () => {
        const { Plugin, settings } = loadPlugin("src/plugins/status/auto-page.js", {
            className: "AutoPagePlugin",
            settingsSnapshot: { autoPage: "no" },
        });
        const plugin = new Plugin();
        plugin.getRuntimeService = (name) => name === "settings" ? settings : { scope: async () => ({ addCleanup: () => {}, listen: () => {}, ownTimeout: () => {}, disposed: false }), http: {} }[name];
        await plugin.reconfigure();
        expect(plugin.started).toBe(false);
        expect(plugin.loader).toBeUndefined();
        settings.snapshot = () => ({ autoPage: "yes" });
        plugin.getSelector = () => ({ boxSelector: ".movie-list", nextPageSelector: ".pagination-next" });
        plugin.shouldDisablePaging = async () => false;
        await plugin.reconfigure();
        expect(plugin.started).toBe(true);
        expect(plugin.loader).toBeInstanceOf(win.HTMLElement);
        plugin.stop();
        expect(plugin.loader).toBeUndefined();
        expect(plugin.nextUrl).toBeNull();
        expect(plugin.pageItems).toEqual([]);
    });

    it("ActressInfo: OFF→mount 不渲染，unmount 删除 JHS DOM", async () => {
        const { Plugin } = loadPlugin("src/plugins/avatar/actress-info.js", {
            className: "ActressInfoPlugin",
            settingsSnapshot: { enableLoadActressInfo: "no" },
        });
        $("body").append('<div class="actress-info">旧节点</div>');
        const plugin = new Plugin();
        plugin.getRuntimeService = (name) => name === "settings" ? { snapshot: () => ({ enableLoadActressInfo: "no" }) } : async () => ({});
        await plugin.mount();
        expect($(".actress-info").length).toBe(1);
        plugin.unmount();
        expect($(".actress-info").length).toBe(0);
    });

    it("OtherSite: 使用 SettingsService 快照（无私有缓存），OFF 只删 JHS 自有面板", async () => {
        const { Plugin, settings } = loadPlugin("src/plugins/external-search/other-site.js", {
            className: "OtherSitePlugin",
            settingsSnapshot: { enableLoadOtherSite: "no" },
        });
        $("body").append('<div data-jhs-other-site-box></div><div data-jhs-other-site-settings></div><div id="otherSiteBox"></div>');
        const plugin = new Plugin();
        plugin.getRuntimeService = (name) => name === "settings" ? settings : name === "scope" ? async () => ({ addCleanup: () => {} }) : {};
        const cache = await plugin.getSettingCache();
        expect(cache).toBe(settings.snapshot());
        await plugin.mount();
        plugin.unmount();
        expect($("[data-jhs-other-site-box]").length).toBe(0);
        expect($("[data-jhs-other-site-settings]").length).toBe(0);
        expect($("#otherSiteBox").length).toBe(1);
    });

    it("ON→OFF→ON ×3 通过 settings.changed 切换，监听器只注册一次", async () => {
        const { Plugin, settings, settingsEvents } = loadPlugin("src/plugins/external-search/other-site.js", {
            className: "OtherSitePlugin",
            settingsSnapshot: { enableLoadOtherSite: "yes" },
        });
        const plugin = new Plugin();
        const mounted = vi.fn(async () => {}), unmounted = vi.fn();
        plugin.getRuntimeService = (name) => name === "settings" ? settings : name === "scope" ? async () => ({ addCleanup: () => {} }) : {};
        plugin.loadOtherSite = mounted;
        plugin.unmount = unmounted;
        await plugin.handle();
        expect(settingsEvents.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        const handler = settingsEvents[0].handler;
        for (let i = 0; i < 3; i++) {
            settings.snapshot = () => ({ enableLoadOtherSite: "no" });
            handler({ detail: { names: [ "enableLoadOtherSite" ] } });
            settings.snapshot = () => ({ enableLoadOtherSite: "yes" });
            handler({ detail: { names: [ "enableLoadOtherSite" ] } });
        }
        expect(settingsEvents.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(unmounted).toHaveBeenCalledTimes(3);
        expect(mounted).toHaveBeenCalledTimes(4); // 初始 handle 一次 + 3 次重新挂载
    });
});
