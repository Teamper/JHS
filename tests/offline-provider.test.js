import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { OfflineProviderRegistry } from "../src/features/external-bridge/offline-provider-registry.js";
import { UnifiedOfflineController } from "../src/features/external-bridge/unified-offline-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

function loadRegistry() { return OfflineProviderRegistry; }

function loadOfflinePlugin(submit, history = vi.fn(async () => {})) {
    const dom = new JSDOM('<button class="jhs-offline-btn">离线</button>', { url: "https://javdb.example/v/abc-1" }), $ = jqueryFactory(dom.window);
    const layer = {
        close: vi.fn(),
        open: vi.fn(options => { options.content.appendTo("body"); return 7; }),
    };
    const stateService = { appendOfflineHistory: history, patch: vi.fn(), getState: vi.fn(async () => ({ stateFlags: { downloaded: true } })) }, closePage = vi.fn().mockResolvedValue(true);
    const notifications = { ok: vi.fn(), error: vi.fn(), info: vi.fn() }, confirm = vi.fn();
    const settings = { snapshot: () => ({ needClosePage: "yes", offlineProviderMode: "ask" }) };
    const context = { show: notifications, utils: { q: confirm } };
    const scope = new LifecycleScope("test:offline");
    const plugin = new UnifiedOfflineController({
        window: dom.window, document: dom.window.document, route: "detail", site: "javdb",
        hostAdapter: { site: "javdb", locateListItems: () => [], readMovieRef: () => ({ carNum: "ABC-1" }) },
        offline: { submitWithIntegration: vi.fn(), getIntegrationHomeUrl: () => "https://pan.example/" },
        dialog: { open: layer.open, close: layer.close }, state: stateService, settings,
        styles: { register: vi.fn(() => () => {}) }, events: { on: vi.fn(() => () => {}) },
        pan123Credential: { getStoredToken: async () => "token" }, ui: { jquery: $, confirm, closePage, getDialogArea: vi.fn(() => []), getOwningLayerIndex: vi.fn(() => 9) },
        notifications, diagnostics: { recordError: vi.fn() }, scope,
    });
    const provider = { id: "115", name: "115", isEnabled: async () => true, submit };
    plugin.registry = { getCandidates: vi.fn(async () => [ { provider, availability: { authState: "ready" } } ]), updateAvailability: vi.fn() };
    return { $, button: $("button"), closePage, context, history, layer, plugin, scope, stateService };
}

describe("offline provider registry", () => {
    it("explains disabled, unsupported and unauthenticated candidates without exposing credentials", async () => {
        const Registry=loadRegistry(),registry=new Registry();
        registry.register({id:"123",name:"123 云盘",capabilities:["magnet"],isEnabled:async()=>true,getAvailability:async()=>({available:false,authState:"token-missing",reason:"尚未同步 123 授权"}),submit(){}});
        registry.register({id:"115",name:"115",capabilities:["magnet","ed2k"],isEnabled:async()=>false,getAvailability:vi.fn(),submit(){}});
        expect(await registry.getCandidates("magnet:?xt=test")).toEqual([]);
        expect(registry.getUnavailableReason()).toBe("123 云盘：尚未同步 123 授权；115：未启用");
        await registry.getCandidates("ed2k://file");
        expect(registry.getUnavailableReason()).toBe("123 云盘：不支持 ED2K；115：未启用");
        registry.providers.delete("123");
        await registry.getCandidates("magnet:?xt=test");
        expect(registry.getUnavailableReason()).toBe("123 云盘：授权桥接插件未加载或已禁用；115：未启用");
    });

    it("refreshes rejected availability on a manual submission before giving up", async () => {
        const submit=vi.fn(async()=>{}),{plugin,button}=loadOfflinePlugin(submit);
        plugin.registry.getCandidates.mockImplementation(async(_resource,{force})=>force?[{provider:{id:"123",name:"123 云盘",isEnabled:async()=>true,submit},availability:{authState:"ready"}}]:[]);
        await plugin.submitResource({},"magnet:?xt=test",button,{carNum:"ABC-123"});
        expect(submit).toHaveBeenCalledOnce();
        expect(plugin.registry.getCandidates).toHaveBeenLastCalledWith("magnet:?xt=test",{force:true});
    });
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

    it("treats a persisted string false as disabled instead of enabling the provider", async () => {
        const { plugin } = loadOfflinePlugin(vi.fn());
        plugin.registry = new OfflineProviderRegistry();
        plugin.settings = { snapshot: () => ({ enable115Offline: "false", enable123Offline: "false" }) };
        plugin.registerProviders();
        expect(await plugin.registry.providers.get("115").isEnabled()).toBe(false);
        expect(await plugin.registry.providers.get("123").isEnabled()).toBe(false);
    });
});

describe("unified offline button state", () => {
    it("uses the saved provider mode when multiple providers support the resource", async () => {
        const { plugin, layer } = loadOfflinePlugin(vi.fn());
        const candidates = [
            { provider: { id: "123", name: "123 云盘" }, availability: { authState: "ready" } },
            { provider: { id: "115", name: "115" }, availability: { authState: "ready" } },
        ];
        const preferred = candidates[1];
        plugin.settings = { snapshot: () => ({ offlineProviderMode: "115" }) };

        await expect(plugin.chooseCandidate({}, candidates)).resolves.toBe(preferred);
        expect(layer.open).not.toHaveBeenCalled();
    });

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
    it("closes an open provider chooser and resolves it when its owning Feature stops", async () => {
        const { plugin, layer, scope } = loadOfflinePlugin(vi.fn());
        const candidates = [
            { provider: { id: "123", name: "123" }, availability: { authState: "ready" } },
            { provider: { id: "115", name: "115" }, availability: { authState: "unknown" } },
        ];
        const pending = plugin.chooseCandidate({}, candidates);
        await vi.waitFor(() => expect(layer.open).toHaveBeenCalledOnce());
        scope.dispose();
        await expect(pending).resolves.toBeNull();
        expect(layer.close).toHaveBeenCalledWith(7);
    });
    it("releases ownership when availability fails and allows an immediate retry", async () => {
        const submit = vi.fn(async () => {}), { plugin,button } = loadOfflinePlugin(submit);
        plugin.registry.getCandidates.mockRejectedValueOnce(new Error("availability failed"));
        await plugin.submitResource({}, "magnet:?xt=retry", button, {carNum:"ABC-1"});
        expect(button.hasClass("loading")).toBe(false);
        await plugin.submitResource({}, "magnet:?xt=retry", button, {carNum:"ABC-1"});
        expect(submit).toHaveBeenCalledOnce();
    });
    it("locks the initiating button before availability awaits and rejects a provider disabled during selection", async () => {
        const submit = vi.fn(async () => {}), { plugin, button } = loadOfflinePlugin(submit);
        const candidates = await plugin.registry.getCandidates();
        plugin.registry.getCandidates.mockClear();
        let releaseCandidates;
        plugin.registry.getCandidates.mockImplementation(() => new Promise((resolve) => { releaseCandidates = resolve; }));

        const first = plugin.submitResource({}, "magnet:?xt=single-flight", button, { carNum: "ABC-1" });
        expect(button.hasClass("loading")).toBe(true);
        await plugin.submitResource({}, "magnet:?xt=single-flight", button.clone(), { carNum: "ABC-1" });
        await plugin.submitResource({}, "magnet:?xt=single-flight", button, { carNum: "ABC-1" });
        releaseCandidates(candidates);
        await first;
        expect(plugin.registry.getCandidates).toHaveBeenCalledOnce();
        expect(submit).toHaveBeenCalledOnce();

        const disabledSubmit = vi.fn(async () => {}), disabled = loadOfflinePlugin(disabledSubmit);
        const [candidate] = await disabled.plugin.registry.getCandidates();
        candidate.provider.isEnabled = vi.fn(async () => false);
        disabled.plugin.chooseCandidate = vi.fn(async () => candidate);
        await disabled.plugin.submitResource({}, "magnet:?xt=disabled", disabled.button, { carNum: "ABC-1" });
        expect(candidate.provider.isEnabled).toHaveBeenCalledOnce();
        expect(disabledSubmit).not.toHaveBeenCalled();
        expect(disabled.context.show.error).toHaveBeenCalledWith("所选离线服务已关闭，未提交任务");
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
        expect(context.show.ok).not.toHaveBeenCalled();
        await plugin.submitResource({}, "magnet:?xt=success", button.clone(), { carNum: "ABC-1" });
        expect(submit).toHaveBeenCalledOnce();
    });
    it("keeps the submitted UI state when reporting a local history failure also throws", async () => {
        const submit = vi.fn(async () => {}), history = vi.fn(async () => { throw new Error("disk"); });
        const { plugin, button, context } = loadOfflinePlugin(submit, history);
        context.show.error.mockImplementation(() => { throw new Error("toast unavailable"); });

        await plugin.submitResource({}, "magnet:?xt=notice-failed", button, { carNum: "ABC-1" });

        expect(submit).toHaveBeenCalledOnce();
        expect(history).toHaveBeenCalledOnce();
        expect(button.text()).toBe("已提交");
        expect(context.show.ok).not.toHaveBeenCalled();
        await plugin.submitResource({}, "magnet:?xt=notice-failed", button.clone().removeClass("loading"), { carNum: "ABC-1" });
        expect(submit).toHaveBeenCalledOnce();
    });
    it("reports the provider failure even when recording that failure also fails", async () => {
        const {plugin,button,context}=loadOfflinePlugin(vi.fn(async()=>{throw new Error("cloud failure");}),vi.fn(async()=>{throw new Error("disk failure");}));
        await expect(plugin.submitResource({}, "magnet:?xt=failed", button, {carNum:"ABC-1"})).resolves.toBeUndefined();
        expect(context.show.error).toHaveBeenCalledWith(expect.stringContaining("cloud failure")); expect(button.hasClass("loading")).toBe(false);
    });
    it("shows the configured 115 login entry only for authentication failures", async () => {
        const authFailure = Object.assign(new Error("115 未登录"), { code: "AUTH_REQUIRED" });
        const enabled = loadOfflinePlugin(vi.fn(async () => { throw authFailure; }));
        enabled.plugin.settings = { snapshot: () => ({ enable115LoginRedirect: true }) };
        enabled.plugin.offline.getIntegrationHomeUrl = () => "https://115.com";
        await enabled.plugin.submitResource({}, "magnet:?xt=needs-login", enabled.button, { carNum: "ABC-1" });
        const login = enabled.$(".jhs-115-login-link");
        expect(login).toHaveLength(1);
        expect(login.attr("href")).toBe("https://115.com");
        expect(login.attr("target")).toBe("_blank");
        expect(login.attr("rel")).toContain("noopener");
        expect(enabled.context.show.error).toHaveBeenCalledWith(expect.stringContaining("https://115.com"));
        enabled.plugin.dispose();
        expect(enabled.$(".jhs-115-login-link")).toHaveLength(0);

        const disabled = loadOfflinePlugin(vi.fn(async () => { throw authFailure; }));
        disabled.plugin.settings = { snapshot: () => ({ enable115LoginRedirect: false }) };
        await disabled.plugin.submitResource({}, "magnet:?xt=disabled-login", disabled.button, { carNum: "ABC-1" });
        expect(disabled.$(".jhs-115-login-link")).toHaveLength(0);
        expect(disabled.context.show.error).not.toHaveBeenCalledWith(expect.stringContaining("https://115.com"));

        const otherFailure = loadOfflinePlugin(vi.fn(async () => { throw new Error("network down"); }));
        otherFailure.plugin.settings = { snapshot: () => ({ enable115LoginRedirect: true }) };
        otherFailure.plugin.offline.getIntegrationHomeUrl = () => "https://115.com";
        await otherFailure.plugin.submitResource({}, "magnet:?xt=network-error", otherFailure.button, { carNum: "ABC-1" });
        expect(otherFailure.$(".jhs-115-login-link")).toHaveLength(0);
    });
    it("removes 115 login guidance immediately when the setting is disabled", async () => {
        const { $, button, plugin } = loadOfflinePlugin(vi.fn());
        const settings = new plugin.window.EventTarget();
        let loginEnabled = true;
        settings.snapshot = () => ({ enable115LoginRedirect: loginEnabled, enable115Offline: true, enable123Offline: false, offlineProviderMode: "115" });
        plugin.settings = settings;
        plugin.offline.getIntegrationHomeUrl = () => "https://115.com";
        plugin.offline.submitWithIntegration = vi.fn(async () => { throw Object.assign(new Error("115 未登录"), { code: "AUTH_REQUIRED" }); });
        plugin.registry = new OfflineProviderRegistry();
        plugin.start();
        await plugin.submitResource({}, "magnet:?xt=live-toggle", button, { carNum: "ABC-1" });
        expect($(".jhs-115-login-link")).toHaveLength(1);
        loginEnabled = false;
        settings.dispatchEvent(new plugin.window.CustomEvent("settings.changed", { detail: { names: ["enable115LoginRedirect"] } }));
        expect($(".jhs-115-login-link")).toHaveLength(0);
        expect(plugin.scope.snapshot().listeners).toBe(1);
        plugin.dispose();
        expect(plugin.scope.snapshot().listeners).toBe(0);
    });
    it("does not attach delayed 115 login guidance to a removed button", async () => {
        let rejectSubmit;
        const { $, button, plugin } = loadOfflinePlugin(() => new Promise((_resolve, reject) => { rejectSubmit = reject; }));
        plugin.settings = { snapshot: () => ({ enable115LoginRedirect: true }) };
        plugin.offline.getIntegrationHomeUrl = () => "https://115.com";
        const pending = plugin.submitResource({}, "magnet:?xt=closed-before-error", button, { carNum: "ABC-1" });
        await vi.waitFor(() => expect(rejectSubmit).toBeTypeOf("function"));
        button.remove();
        rejectSubmit(Object.assign(new Error("115 未登录"), { code: "AUTH_REQUIRED" }));
        await pending;
        expect($(".jhs-115-login-link")).toHaveLength(0);
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

    it("keeps the detail open when the downloaded state disappears on readback", async () => {
        const { closePage, context, plugin, stateService } = loadOfflinePlugin(vi.fn(async () => {}));
        stateService.getState.mockResolvedValueOnce(null);
        await expect(plugin.markDownloadedAndClose({ carNum: "ABC-1" }, { layerIndex: 9 })).resolves.toBe(false);
        expect(stateService.patch).toHaveBeenCalledOnce();
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

    it("does not submit a remote task when the action has no movie identity", async () => {
        const submit = vi.fn(), { button, context, plugin, stateService } = loadOfflinePlugin(submit);
        plugin.hostAdapter.readMovieRef = () => null;
        await plugin.submitResource({}, "magnet:?xt=urn:btih:missing-movie", button);
        expect(submit).not.toHaveBeenCalled();
        expect(stateService.appendOfflineHistory).not.toHaveBeenCalled();
        expect(context.show.error).toHaveBeenCalledWith("无法确定影片身份，未执行离线操作");
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
            await vi.waitFor(() => expect(submit).toHaveBeenCalled());
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
        await vi.waitFor(() => expect(history).toHaveBeenCalled());
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
