import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MagnetHubController } from "../src/features/external-bridge/magnet-hub-controller.js";

const windows = [];
afterEach(() => { windows.splice(0).forEach(window => window.close()); vi.useRealTimers(); vi.unstubAllGlobals(); });
const magnet = (title = "FC2-1234567 sample", hash = "1".repeat(40)) => ({ title, magnet: `magnet:?xt=urn:btih:${hash}`, source: "sukebei", seeders: 3 });
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function setup(searches, { remembered, filters = [] } = {}) {
    const dom = new JSDOM('<main id="movie"></main>', { url: "https://javdb.com/" });
    windows.push(dom.window);
    vi.stubGlobal("document", dom.window.document);
    const $ = jqueryFactory(dom.window), setLocal = vi.fn(), clipboard = { copyText: vi.fn(async () => true) };
    const sources = Object.entries(searches).map(([id]) => ({ id, name: id === "sukebei" ? "Sukebei" : id.toUpperCase(), enabled: true, baseUrl: `https://${id}.example` }));
    const controller = new MagnetHubController({
        storage: { getLocal: () => remembered, setLocal }, http: {}, scope: { disposed: false }, site: "other", jquery: $, clipboard,
        resourceSettings: { getBuiltInSources: async () => [], getMagnetSources: async () => [], getMagnetTagRules: async () => [], getMagnetFilterRules: async () => filters },
        magnet: { getBuiltInSources: () => sources, searchSource: (id, keyword) => searches[id](keyword), getSourceTargetUrl: (id, keyword) => `https://${id}.example/?q=${keyword}` },
        diagnostics: { recordError: vi.fn() }, document: dom.window.document, window: dom.window,
    });
    const root = $("#movie");
    const open = async (options = {}) => {
        const hub = await controller.createMagnetHub({ movieContext: { carNum: "FC2-1234567" }, root }, options);
        root.append(hub);
        return hub;
    };
    return { $, root, controller, open, setLocal, clipboard };
}
const settled = hub => vi.waitFor(() => expect(hub.find(".magnet-results").data("jhsMagnetPanel").pending).toBe(false));

describe("magnet source results and recovery", () => {
    it("keeps successful results, names failures and retries only failed sources", async () => {
        const success = vi.fn(async () => [magnet()]), failed = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue([magnet("duplicate"), magnet("second", "2".repeat(40))]);
        const { open } = setup({ u9a9: success, sukebei: failed });
        const hub = await open(); await settled(hub);
        expect(hub.find(".magnet-result")).toHaveLength(1);
        expect(hub.text()).toContain("查询失败：Sukebei");
        hub.find('[data-jhs-action="retry-magnets"]').trigger("click");
        await settled(hub);
        expect(success).toHaveBeenCalledOnce(); expect(failed).toHaveBeenCalledTimes(2);
        expect(hub.find(".magnet-result")).toHaveLength(2);
        expect(hub.find(".magnet-error")).toHaveLength(0);
    });
    it("distinguishes complete failure from partial failure with no results", async () => {
        const failed = async () => { throw new Error("offline"); };
        const complete = await setup({ sukebei: failed, u9a9: failed }).open(); await settled(complete);
        expect(complete.text()).toContain("磁力查询失败"); expect(complete.text()).not.toContain("未找到相关资源");
        const partial = await setup({ sukebei: failed, u9a9: async () => [] }).open(); await settled(partial);
        expect(partial.text()).toContain("部分来源查询失败");
    });
    it("shows successful empty and rule-filtered states separately", async () => {
        const empty = await setup({ sukebei: async () => [] }).open(); await settled(empty);
        expect(empty.text()).toContain("未找到相关资源"); expect(empty.find(".magnet-error")).toHaveLength(0);
        const filtered = await setup({ sukebei: async () => [magnet()] }, { filters: [{ enabled: true, pattern: "sample", action: "hide", target: "title" }] }).open();
        await settled(filtered); expect(filtered.text()).toContain("相关资源已被当前过滤规则隐藏");
    });
    it("retries a single source and retains the source preference", async () => {
        const search = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue([magnet()]);
        const { open, setLocal } = setup({ sukebei: search }, { remembered: "sukebei" });
        const hub = await open(); await settled(hub);
        expect(hub.find('[data-jhs-action="retry-magnets"]').text()).toBe("重试");
        hub.find('[data-jhs-action="retry-magnets"]').trigger("click"); await settled(hub);
        expect(hub.find(".magnet-result")).toHaveLength(1); expect(setLocal).not.toHaveBeenCalled();
    });
    it("opens all sources from the shortcut without saving a new preference or repeating a pending query", async () => {
        const wait = deferred(), search = vi.fn(() => wait.promise);
        const { open, setLocal } = setup({ sukebei: search }, { remembered: "sukebei" });
        const hub = await open({ initialEngineId: "all", requireExternal: true });
        hub.data("jhsOpenExternalMagnets")(); hub.data("jhsOpenExternalMagnets")();
        expect(hub.find('.magnet-tab[aria-selected="true"]').data("engine")).toBe("all");
        expect(search).toHaveBeenCalledOnce(); expect(setLocal).not.toHaveBeenCalled();
        wait.resolve([]); await settled(hub);
    });
    it("reports disabled external sources without requesting native-only results", async () => {
        const native = vi.fn(async () => []), { open } = setup({ "native-test": native });
        const hub = await open({ initialEngineId: "all", requireExternal: true });
        expect(hub.text()).toContain("外部磁力来源未启用"); expect(native).not.toHaveBeenCalled();
    });
    it("shows disabled-source guidance even when a native-only all panel was already opened", async () => {
        const native = vi.fn(async () => []), { open } = setup({ "native-test": native });
        const hub = await open(); await settled(hub);
        hub.data("jhsOpenExternalMagnets")();
        expect(hub.text()).toContain("外部磁力来源未启用"); expect(native).toHaveBeenCalledOnce();
    });
    it("does not duplicate a failed-source retry while it is pending", async () => {
        const wait = deferred(), search = vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementation(() => wait.promise);
        const { open } = setup({ sukebei: search });
        const hub = await open(); await settled(hub);
        const retry = hub.find('[data-jhs-action="retry-magnets"]');
        retry.trigger("click"); retry.trigger("click");
        expect(search).toHaveBeenCalledTimes(2); wait.resolve([magnet()]); await settled(hub);
        expect(hub.find(".magnet-result")).toHaveLength(1);
    });
    it("ignores responses after selection changes and after the owner closes", async () => {
        const old = deferred(), { open } = setup({ sukebei: () => old.promise, u9a9: async () => [magnet("new selection")] }, { remembered: "sukebei" });
        const hub = await open(); hub.find('[data-engine="u9a9"]').trigger("click"); await settled(hub);
        old.resolve([magnet("stale selection")]); await Promise.resolve(); await Promise.resolve();
        expect(hub.text()).toContain("new selection"); expect(hub.text()).not.toContain("stale selection");
        const late = deferred(); let active = true;
        const closing = await setup({ sukebei: () => late.promise }).open({ isActive: () => active });
        const before = closing.html(); active = false; late.resolve([magnet("closed")]);
        await vi.waitFor(() => expect(closing.html()).toBe(before));
        await new Promise(done => setTimeout(done, 10)); expect(closing.html()).toBe(before);
    });
    it("keeps independent reports for multiple panels", async () => {
        const first = deferred(), second = deferred(), search = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
        const { open } = setup({ sukebei: search });
        const a = await open(), b = await open();
        second.resolve([magnet("second panel")]); await settled(b);
        first.resolve([]); await settled(a);
        expect(a.text()).toContain("未找到相关资源"); expect(b.text()).toContain("second panel");
    });
    it("binds copy actions once across repeated result renders", async () => {
        vi.useFakeTimers();
        const { $, root, controller, clipboard } = setup({ sukebei: async () => [] });
        const panel = $("<div></div>").appendTo(root);
        for (let i = 0; i < 3; i++) await controller.displayResults(panel, [magnet()], "Sukebei");
        panel.find(".copy-btn").trigger("click"); await Promise.resolve();
        expect(clipboard.copyText).toHaveBeenCalledOnce(); vi.runAllTimers();
    });
});
