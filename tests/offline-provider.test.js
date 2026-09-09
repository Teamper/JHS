import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

function loadRegistry() {
    const source = readTestFile(join(import.meta.dirname, "../src/plugins/offline/unified-offline.js"), "utf8"), end = source.indexOf("class UnifiedOfflinePlugin"), context = vm.createContext({ Map, Array, Date, TypeError });
    vm.runInContext(`${source.slice(0, end)}; globalThis.Registry = OfflineProviderRegistry;`, context);
    return context.Registry;
}

function loadOfflinePlugin(submit, history = vi.fn(async () => {})) {
    const dom = new JSDOM('<button class="jhs-offline-btn">离线</button>', { url: "https://javdb.example/v/abc-1" }), $ = jqueryFactory(dom.window);
    const layer = {
        close: vi.fn(),
        open: vi.fn(options => { options.content.appendTo("body"); return 7; }),
    };
    const stateService = { appendOfflineHistory: history, patch: vi.fn() }, closePage = vi.fn().mockResolvedValue(true), getOwningLayerIndex = vi.fn(() => 9);
    class BasePlugin { getRuntimeService(name) { return name === "dialog" ? { open: layer.open, close: layer.close } : name === "state" ? stateService : name === "settings" ? { snapshot: () => ({ needClosePage: "yes" }) } : null; } }
    const context = vm.createContext({
        window: dom.window, document: dom.window.document, $, BasePlugin, Map, Array, Date, TypeError,
        r: true, l: false, setTimeout, clearTimeout,
        show: { ok: vi.fn(), error: vi.fn() }, clog: { error: vi.fn() }, utils: { q: vi.fn(), closePage, getOwningLayerIndex, getDialogArea: vi.fn(() => []) }, storageManager: { getSetting: vi.fn(async () => "ask") }, layer,
        getDetailResourceAdapter: vi.fn(), jhsEventBus: { on: vi.fn() }, readListItem: vi.fn()
    });
    const source = readTestFile(join(import.meta.dirname, "../src/plugins/offline/unified-offline.js"), "utf8");
    vm.runInContext(`${source};globalThis.TestOfflinePlugin=UnifiedOfflinePlugin;`, context);
    const plugin = new context.TestOfflinePlugin(), provider = { id: "115", name: "115", submit };
    plugin.registry = { getCandidates: vi.fn(async () => [ { provider, availability: { authState: "ready" } } ]), updateAvailability: vi.fn() };
    return { $, button: $("button"), closePage, context, history, layer, plugin, stateService };
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
    it("releases the button when busy-state initialization throws", async () => {
        const submit=vi.fn(), {plugin,button}=loadOfflinePlugin(submit);
        vi.spyOn(button,"attr").mockImplementationOnce(()=>{throw new Error("button failed");});
        await plugin.submitResource({},"magnet:?xt=init",button,{carNum:"ABC-1"});
        expect(button.hasClass("loading")).toBe(false); expect(submit).not.toHaveBeenCalled();
    });
    it("settles a provider chooser closed through its end callback", async () => {
        const {plugin,layer}=loadOfflinePlugin(vi.fn());
        const candidates=[{provider:{id:"123",name:"123"},availability:{authState:"ready"}},{provider:{id:"115",name:"115"},availability:{authState:"ready"}}];
        const pending=plugin.chooseCandidate({},candidates);
        await vi.waitFor(()=>expect(layer.open).toHaveBeenCalledOnce());
        layer.open.mock.calls[0][0].end(); await expect(pending).resolves.toBeNull();
    });
    it("releases ownership when availability fails and allows an immediate retry", async () => {
        const submit = vi.fn(async () => {}), { plugin,button } = loadOfflinePlugin(submit);
        plugin.registry.getCandidates.mockRejectedValueOnce(new Error("availability failed"));
        await plugin.submitResource({}, "magnet:?xt=retry", button, {carNum:"ABC-1"});
        expect(button.hasClass("loading")).toBe(false);
        await plugin.submitResource({}, "magnet:?xt=retry", button, {carNum:"ABC-1"});
        expect(submit).toHaveBeenCalledOnce();
    });
    it("does not submit after the owning scope or button disappears during availability", async () => {
        for (const mode of ["scope", "button"]) {
            const submit = vi.fn(), {plugin,button} = loadOfflinePlugin(submit);
            let release; const candidates = await plugin.registry.getCandidates();
            plugin.lifecycleScope = {disposed:false};
            plugin.registry.getCandidates = () => new Promise(resolve=>{release=resolve;});
            const pending = plugin.submitResource({}, "magnet:?xt=closed", button, {carNum:"ABC-1"});
            if (mode === "scope") plugin.lifecycleScope.disposed = true; else button.remove();
            release(candidates); await pending;
            expect(submit).not.toHaveBeenCalled(); expect(button.hasClass("loading")).toBe(false);
        }
    });
    it("releases a cancelled provider choice without submitting", async () => {
        const submit = vi.fn(), {plugin,button} = loadOfflinePlugin(submit);
        plugin.chooseCandidate = async()=>null;
        await plugin.submitResource({}, "magnet:?xt=cancel", button, {carNum:"ABC-1"});
        expect(submit).not.toHaveBeenCalled(); expect(button.hasClass("loading")).toBe(false);
    });
    it("keeps cloud success when local history fails and never records a false failure", async () => {
        const submit = vi.fn(async()=>{}), history = vi.fn(async()=>{throw new Error("disk");});
        const {plugin,button,context}=loadOfflinePlugin(submit,history);
        await plugin.submitResource({}, "magnet:?xt=success", button, {carNum:"ABC-1"});
        expect(submit).toHaveBeenCalledOnce(); expect(history).toHaveBeenCalledOnce();
        expect(history.mock.calls[0][0].status).toBe("submitted"); expect(button.text()).toBe("已提交");
        expect(context.show.error).toHaveBeenCalledWith(expect.stringContaining("任务已创建"));
    });
    it("reports the provider failure even when recording that failure also fails", async () => {
        const {plugin,button,context}=loadOfflinePlugin(vi.fn(async()=>{throw new Error("cloud failure");}),vi.fn(async()=>{throw new Error("disk failure");}));
        await expect(plugin.submitResource({}, "magnet:?xt=failed", button, {carNum:"ABC-1"})).resolves.toBeUndefined();
        expect(context.show.error).toHaveBeenCalledWith(expect.stringContaining("cloud failure")); expect(button.hasClass("loading")).toBe(false);
    });
    it("closes the owning detail surface after confirming the downloaded state", async () => {
        const { button, closePage, context, plugin, stateService } = loadOfflinePlugin(vi.fn(async () => {}));
        context.utils.q.mockImplementation((_event, _message, confirm) => confirm());
        await plugin.submitResource({ currentTarget: button[0] }, "magnet:?xt=downloaded", button, { carNum: "ABC-1" });
        await vi.waitFor(() => expect(closePage).toHaveBeenCalledOnce());
        expect(stateService.patch).toHaveBeenCalledWith("ABC-1", { downloaded: true }, expect.objectContaining({ type: "offline-mark-downloaded" }));
        expect(closePage).toHaveBeenCalledWith({ root: button[0], layerIndex: 9 });
        expect(stateService.patch.mock.invocationCallOrder[0]).toBeLessThan(closePage.mock.invocationCallOrder[0]);
    });

    it("keeps the detail open and reports a targeted error when marking downloaded fails", async () => {
        const { closePage, context, plugin, stateService } = loadOfflinePlugin(vi.fn(async () => {}));
        stateService.patch.mockRejectedValueOnce(new Error("write failed"));
        await expect(plugin.markDownloadedAndClose({ carNum: "ABC-1" }, { layerIndex: 9 })).resolves.toBe(false);
        expect(closePage).not.toHaveBeenCalled();
        expect(context.show.error).toHaveBeenCalledWith("离线已提交，但标记已下载失败");
    });

    it("keeps the downloaded state and reports a close-only error when no owner closes", async () => {
        const { closePage, context, plugin, stateService } = loadOfflinePlugin(vi.fn(async () => {}));
        closePage.mockResolvedValueOnce(false);
        await expect(plugin.markDownloadedAndClose({ carNum: "ABC-1" }, { layerIndex: 9 })).resolves.toBe(false);
        expect(stateService.patch).toHaveBeenCalledOnce();
        expect(context.show.error).toHaveBeenCalledWith("已标记下载，但无法自动关闭");
    });

    it("does nothing when no car number can be identified", async () => {
        const { closePage, plugin, stateService } = loadOfflinePlugin(vi.fn(async () => {}));
        await expect(plugin.markDownloadedAndClose({}, { layerIndex: 9 })).resolves.toBe(false);
        expect(stateService.patch).not.toHaveBeenCalled();
        expect(closePage).not.toHaveBeenCalled();
    });

    it("uses the declared dialog service when the user must select a provider", async () => {
        const { $, layer, plugin } = loadOfflinePlugin(vi.fn());
        const candidates = [
            { provider: { id: "123", name: "123 云盘" }, availability: { authState: "ready" } },
            { provider: { id: "115", name: "115" }, availability: { authState: "unknown" } },
        ];
        const selected = plugin.chooseCandidate({}, candidates);
        await vi.waitFor(() => expect(layer.open).toHaveBeenCalledOnce());
        $(".jhs-toolbar button").eq(1).trigger("click");
        await expect(selected).resolves.toBe(candidates[1]);
        expect(layer.close).toHaveBeenCalledWith(7);
    });

    it("keeps focusable success feedback busy and then restores the original idle state", async () => {
        vi.useFakeTimers();
        try {
            let resolveSubmit;
            const submit = vi.fn(() => new Promise(resolve => { resolveSubmit = resolve; }));
            const { button, history, plugin } = loadOfflinePlugin(submit);
            const pending = plugin.submitResource({}, "magnet:?xt=ok", button, { carNum: "ABC-1" });
            while (!submit.mock.calls.length) await Promise.resolve();
            expect(button.text()).toBe("提交中");
            expect(button.prop("disabled")).toBe(false);
            expect(button.attr("aria-busy")).toBe("true");
            expect(button.attr("aria-disabled")).toBe("true");

            resolveSubmit();
            await pending;
            expect(button.text()).toBe("已提交");
            expect(button.prop("disabled")).toBe(false);
            expect(button.attr("aria-disabled")).toBe("true");
            expect(history).toHaveBeenCalledOnce();
            expect(history.mock.calls[0][0].status).toBe("submitted");

            await vi.advanceTimersByTimeAsync(1800);
            expect(button.text()).toBe("离线");
            expect(button.prop("disabled")).toBe(false);
            expect(button.hasClass("loading")).toBe(false);
            expect(button.attr("aria-busy")).toBeUndefined();
            expect(button.attr("aria-disabled")).toBeUndefined();
        } finally { vi.useRealTimers(); }
    });

    it("releases the operation after recording a failed submission", async () => {
        let resolveHistory;
        const history = vi.fn(() => new Promise(resolve => { resolveHistory = resolve; }));
        const { button, plugin } = loadOfflinePlugin(vi.fn(async () => { throw new Error("failed"); }), history);
        const pending = plugin.submitResource({}, "magnet:?xt=failed", button, { carNum: "ABC-1" });
        while (!history.mock.calls.length) await Promise.resolve();
        expect(button.text()).toBe("提交中");
        expect(button.prop("disabled")).toBe(false);
        expect(button.hasClass("loading")).toBe(true);
        expect(button.attr("aria-busy")).toBe("true");
        resolveHistory();
        await pending;
        expect(button.text()).toBe("离线");
        expect(button.hasClass("loading")).toBe(false);
        expect(history).toHaveBeenCalledOnce();
        expect(history.mock.calls[0][0].status).toBe("failed");
    });
});
