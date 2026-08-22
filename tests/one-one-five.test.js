import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function load115(http = {}) {
    const context = vm.createContext({ URLSearchParams, encodeURIComponent, gmHttp: http, normalizeCarNum: value => typeof value === "string" && value.trim() ? value.trim() : null, ProviderError: class extends Error { constructor(provider, code, message, options) { super(message); Object.assign(this, { provider, code, ...options }); } } });
    const source = readFileSync(join(import.meta.dirname, "../src/plugins/one-one-five/client.js"), "utf8");
    vm.runInContext(`${source};globalThis.api={OneOneFiveClient,normalize115Keyword,build115PlayUrl,preview115Rename}`, context);
    return context.api;
}

describe("115 domain", () => {
    it("normalizes FC2 and filters search results to videos", async () => {
        const get = vi.fn().mockResolvedValue({ data: [{ n: "FC2-123.mp4", fid: "1", pc: "p" }, { n: "readme.txt", fid: "2" }] });
        const api = load115({ get }), client = new api.OneOneFiveClient({ get });
        expect(api.normalize115Keyword("FC2-123456")).toBe("123456");
        await expect(client.search("123456")).resolves.toHaveLength(1);
    });
    it("builds playback URLs and preserves rename suffixes", () => {
        const api = load115();
        expect(api.build115PlayUrl({ videoId: "abc" })).toContain("pickcode=abc");
        expect(api.preview115Rename("old-4K-U.mkv", "abc-1")).toBe("ABC-1-4K-U.mkv");
    });
    it("keeps disabled plugins request-free", () => {
        const source = readFileSync(join(import.meta.dirname, "../src/plugins/one-one-five/plugins.js"), "utf8");
        expect(source).toContain('getSetting("enable115Match", !1)');
        expect(source).toContain("return this.setupListMatching()");
        expect(source).toContain('jhsEventBus.on("list-items-added"');
        expect(source).not.toContain("new MutationObserver");
        expect(source).not.toContain("gmHttp");
    });
    it("classifies addOffline errors", () => {
        const api = load115();
        const client = new api.OneOneFiveClient();
        expect(client.classifyAddOfflineError("用户未登录")).toBe("LOGIN_REQUIRED");
        expect(client.classifyAddOfflineError("invalid token")).toBe("LOGIN_REQUIRED");
        expect(client.classifyAddOfflineError("invalid url")).toBe("ADD_TASK_FAILED");
        expect(client.classifyAddOfflineError("任务已存在")).toBe("TASK_EXISTS");
        expect(client.classifyAddOfflineError("任务创建失败")).toBe("ADD_TASK_FAILED");
    });
    it("throws TASK_EXISTS when addOffline reports duplicate", async () => {
        const gmRequest = vi.fn().mockResolvedValue({ state: !1, error_msg: "该任务已存在" });
        const get = vi.fn().mockResolvedValue({ sign: "s", time: "t", uid: 1 });
        const api = load115({ get, gmRequest });
        const client = new api.OneOneFiveClient({ get, gmRequest });
        await expect(client.addOffline("magnet:?xt=urn:btih:abc")).rejects.toMatchObject({ code: "TASK_EXISTS" });
    });
    it("throws LOGIN_REQUIRED when addOffline reports not logged in", async () => {
        const gmRequest = vi.fn().mockResolvedValue({ state: !1, error_msg: "请先登录" });
        const get = vi.fn().mockResolvedValue({ sign: "s", time: "t", uid: 1 });
        const api = load115({ get, gmRequest });
        const client = new api.OneOneFiveClient({ get, gmRequest });
        await expect(client.addOffline("magnet:?xt=urn:btih:abc")).rejects.toMatchObject({ code: "LOGIN_REQUIRED" });
    });
});
