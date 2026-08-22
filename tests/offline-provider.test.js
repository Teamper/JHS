import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

function loadRegistry() {
    const source = readFileSync(join(import.meta.dirname, "../src/plugins/offline/unified-offline.js"), "utf8"), end = source.indexOf("class UnifiedOfflinePlugin"), context = vm.createContext({ Map, Array, Date, TypeError });
    vm.runInContext(`${source.slice(0, end)}; globalThis.Registry = OfflineProviderRegistry;`, context);
    return context.Registry;
}

function loadOfflinePlugin(submit, history = vi.fn(async () => {})) {
    const dom = new JSDOM('<button class="jhs-offline-btn">离线</button>'), $ = jqueryFactory(dom.window);
    class BasePlugin {}
    const context = vm.createContext({
        window: dom.window, document: dom.window.document, $, BasePlugin, Map, Array, Date, TypeError,
        r: true, l: false, setTimeout, clearTimeout,
        stateService: { appendOfflineHistory: history, patch: vi.fn() },
        show: { ok: vi.fn(), error: vi.fn() }, utils: { q: vi.fn() }, storageManager: {}, layer: {},
        OneOneFiveClient: class {}, getDetailResourceAdapter: vi.fn(), jhsEventBus: { on: vi.fn() }
    });
    const source = readFileSync(join(import.meta.dirname, "../src/plugins/offline/unified-offline.js"), "utf8");
    vm.runInContext(`${source};globalThis.TestOfflinePlugin=UnifiedOfflinePlugin;`, context);
    const plugin = new context.TestOfflinePlugin(), provider = { id: "115", name: "115", submit };
    plugin.registry = { getCandidates: vi.fn(async () => [ { provider, availability: { authState: "ready" } } ]), updateAvailability: vi.fn() };
    return { $, button: $("button"), context, history, plugin };
}

describe("offline provider registry", () => {
    it("filters resources by enabled capability and availability", async () => {
        const Registry = loadRegistry(), registry = new Registry(), ready = vi.fn().mockResolvedValue({ available: true, authState: "ready" });
        registry.register({ id: "123", name: "123", capabilities: ["magnet"], isEnabled: async () => true, getAvailability: ready, submit() {} });
        registry.register({ id: "115", name: "115", capabilities: ["magnet", "ed2k"], isEnabled: async () => true, getAvailability: async () => ({ available: true, authState: "unknown" }), submit() {} });
        expect((await registry.getCandidates("ed2k://file")).map(item => item.provider.id)).toEqual(["115"]);
        expect((await registry.getCandidates("magnet:?xt=urn:btih:abc")).map(item => item.provider.id)).toEqual(["123", "115"]);
        await registry.getCandidates("magnet:?xt=urn:btih:def");
        expect(ready).toHaveBeenCalledTimes(1);
    });

    it("excludes login-required providers before ranking", async () => {
        const Registry = loadRegistry(), registry = new Registry();
        registry.register({ id: "115", name: "115", capabilities: ["ed2k"], isEnabled: async () => true, getAvailability: async () => ({ available: false, authState: "login-required" }), submit() {} });
        expect(await registry.getCandidates("ed2k://file")).toEqual([]);
    });

    it("uses short negative caching and lets manual retry force an immediate refresh", async () => {
        const Registry = loadRegistry(), registry = new Registry(), availability = vi.fn()
            .mockResolvedValueOnce({ available: false, authState: "login-required" })
            .mockResolvedValue({ available: true, authState: "ready" });
        registry.register({ id: "115", name: "115", capabilities: ["magnet"], isEnabled: async () => true, getAvailability: availability, submit() {} });
        expect(await registry.getCandidates("magnet:?xt=one")).toEqual([]);
        expect(await registry.getCandidates("magnet:?xt=one")).toEqual([]);
        expect(availability).toHaveBeenCalledOnce();
        expect((await registry.getCandidates("magnet:?xt=one", { force: true }))[0].provider.id).toBe("115");
        expect(availability).toHaveBeenCalledTimes(2);
        expect(registry.positiveTtl).toBe(300000);
        expect(registry.negativeTtl).toBe(20000);
    });
});

describe("unified offline button state", () => {
    it("keeps success feedback disabled and then restores the original idle state", async () => {
        vi.useFakeTimers();
        try {
            let resolveSubmit;
            const submit = vi.fn(() => new Promise(resolve => { resolveSubmit = resolve; }));
            const { button, history, plugin } = loadOfflinePlugin(submit);
            const pending = plugin.submitResource({}, "magnet:?xt=ok", button, { carNum: "ABC-1" });
            while (!submit.mock.calls.length) await Promise.resolve();
            expect(button.text()).toBe("提交中");
            expect(button.prop("disabled")).toBe(true);
            expect(button.attr("aria-busy")).toBe("true");

            resolveSubmit();
            await pending;
            expect(button.text()).toBe("已提交");
            expect(button.prop("disabled")).toBe(true);
            expect(history).toHaveBeenCalledOnce();
            expect(history.mock.calls[0][0].status).toBe("submitted");

            await vi.advanceTimersByTimeAsync(1800);
            expect(button.text()).toBe("离线");
            expect(button.prop("disabled")).toBe(false);
            expect(button.hasClass("loading")).toBe(false);
            expect(button.attr("aria-busy")).toBeUndefined();
        } finally { vi.useRealTimers(); }
    });

    it("restores the original state immediately after a failed submission", async () => {
        let resolveHistory;
        const history = vi.fn(() => new Promise(resolve => { resolveHistory = resolve; }));
        const { button, plugin } = loadOfflinePlugin(vi.fn(async () => { throw new Error("failed"); }), history);
        const pending = plugin.submitResource({}, "magnet:?xt=failed", button, { carNum: "ABC-1" });
        while (!history.mock.calls.length) await Promise.resolve();
        expect(button.text()).toBe("离线");
        expect(button.prop("disabled")).toBe(false);
        expect(button.hasClass("loading")).toBe(false);
        expect(button.attr("aria-busy")).toBeUndefined();
        resolveHistory();
        await pending;
        expect(history).toHaveBeenCalledOnce();
        expect(history.mock.calls[0][0].status).toBe("failed");
    });
});
