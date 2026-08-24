import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { classify115OfflineError, createOne115Adapter, normalize115SearchResults } from "../../src/integrations/one115/manifest.js";

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/integrations/one115/search.json"), "utf8"));

it("normalizes 115 file search contracts", async () => {
    expect(normalize115SearchResults(fixture)).toEqual([{
        folderId: "", fileId: "1", videoId: "pick-1", name: "FC2-123.mp4", size: 1073741824, createTime: "2026-08-24", isVideo: true,
    }]);
    const request = vi.fn(async options => ({ data: fixture, finalUrl: options.url })), adapter = createOne115Adapter({ request });
    await expect(adapter.searchFiles("123", { scope: "scope", ttlMs: 60000 })).resolves.toHaveLength(1);
    expect(request.mock.calls[0][0]).toMatchObject({ providerId: "one115", cacheScope: "session", sessionScopeId: "one115-browser-session", urlPolicy: { trustClass: "builtin-public", hosts: ["115.com"] } });
    expect(request.mock.calls[0][0].url).toContain("search_value=123");
    expect(adapter.getPlayUrl({ videoId: "pick-1" })).toBe("https://115.com/?ct=play&pickcode=pick-1");
});

it("normalizes 115 account, offline and rename operations", async () => {
    const request = vi.fn()
        .mockResolvedValueOnce({ data: { state: true, data: ["folder"] } })
        .mockResolvedValueOnce({ data: { sign: "s", time: "t", uid: 1 } })
        .mockResolvedValueOnce({ data: JSON.stringify({ state: true, task_id: "task" }) })
        .mockResolvedValueOnce({ data: { state: true } });
    const adapter = createOne115Adapter({ request });
    await expect(adapter.checkAccount()).resolves.toEqual({ authenticated: true });
    await expect(adapter.submit("magnet:?xt=urn:btih:abc")).resolves.toEqual({ success: true, taskId: "task" });
    await expect(adapter.renameFile("1", "ABC-1.mkv")).resolves.toEqual({ success: true });
    expect(request.mock.calls[2][0]).toMatchObject({ method: "POST", cacheScope: "none", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    expect(request.mock.calls[3][0].body).toContain("file_name=ABC-1.mkv");
});

it("classifies normalized 115 offline failures", () => {
    expect(classify115OfflineError("请先登录")).toBe("AUTH_REQUIRED");
    expect(classify115OfflineError("任务已存在")).toBe("TASK_EXISTS");
    expect(classify115OfflineError("任务创建失败")).toBe("OPERATION_FAILED");
});
