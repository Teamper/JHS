import { describe, expect, it, vi } from "vitest";
import { OneOneFiveMatchService } from "../src/services/one-one-five-match-service.js";
import { matches115FileName, preview115Rename } from "../src/core/one-one-five-file-identity.js";

const file = (name, fileId = "1") => ({ name, fileId, folderId: "folder" });
const page = (items, hasMore = false, nextOffset = items.length) => ({ items, hasMore, nextOffset });
function setup(search) {
    const offline = { getAccountIdentity: vi.fn(async () => ({ accountId: "1" })), searchFilePage: vi.fn(search) };
    return { offline, service: new OneOneFiveMatchService(offline) };
}

describe("115 shared matching", () => {
    it("searches complete code first, then tail and validates every candidate locally", async () => {
        const { service, offline } = setup(async (_id, keyword) => page(keyword === "MIVR-345" ? [] : [file("MIVR00345-5.mp4"), file("MIVR-346.mp4", "2")]));
        const result = await service.matchMovie({ carNum: "MIVR-345" });
        expect(result.complete).toBe(true);
        expect(result.matches.map(item => item.name)).toEqual(["MIVR00345-5.mp4"]);
        expect(offline.searchFilePage.mock.calls.map(call => call[1])).toEqual(["MIVR-345", "345"]);
        expect(result.matches[0].accountId).toBe("1");
    });
    it("caps one pass at ten pages and resumes from the cursor with existing matches", async () => {
        const { service, offline } = setup(async (_id, keyword, options) => page([file("ABC123.mp4", String(options.offset))], options.offset < 1000, options.offset + 100));
        const first = await service.matchMovie({ carNum: "ABC-123" });
        expect(first.complete).toBe(false);
        expect(first.matches).toHaveLength(10);
        expect(first.continuation.offset).toBe(1000);
        expect(offline.searchFilePage).toHaveBeenCalledTimes(10);
        const next = await service.matchMovie({ carNum: "ABC-123" }, { continuation: first.continuation });
        expect(next.complete).toBe(true);
        expect(next.matches).toHaveLength(11);
        expect(next.continuation).toBeNull();
    });
    it("caches only complete account-bound results and refresh bypasses the cache", async () => {
        const { service, offline } = setup(async () => page([file("ABC-123.mp4")]));
        const result = await service.matchMovie({ carNum: "ABC-123" });
        result.matches[0].name = "changed by caller";
        expect((await service.matchMovie({ carNum: "ABC-123" })).matches[0].name).toBe("ABC-123.mp4");
        expect(offline.searchFilePage).toHaveBeenCalledTimes(1);
        await service.matchMovie({ carNum: "ABC-123" }, { force: true });
        expect(offline.searchFilePage).toHaveBeenCalledTimes(2);
        offline.getAccountIdentity.mockResolvedValue({ accountId: "2" });
        await service.matchMovie({ carNum: "ABC-123" });
        expect(offline.searchFilePage).toHaveBeenCalledTimes(3);
    });
    it("rejects a changed account before publishing or continuing results", async () => {
        const { service, offline } = setup(async () => page([file("ABC-123.mp4")]));
        offline.getAccountIdentity.mockResolvedValueOnce({ accountId: "1" }).mockResolvedValueOnce({ accountId: "2" });
        await expect(service.matchMovie({ carNum: "ABC-123" })).rejects.toThrow("账号已切换");
        expect(service.cache.size).toBe(0);
        await expect(service.matchMovie({ carNum: "ABC-123" }, { continuation: { accountId: "other", carNum: "ABC-123", stage: 0, offset: 100, matches: [] } })).rejects.toThrow("账号或影片已变化");
    });
    it("rejects nonadvancing and duplicate pages", async () => {
        const stalled = setup(async () => page([file("ABC-123.mp4")], true, 0));
        await expect(stalled.service.matchMovie({ carNum: "ABC-123" })).rejects.toThrow("分页未推进");
        const repeated = setup(async (_id, _keyword, options) => page([file("ABC-123.mp4")], true, options.offset + 100));
        await expect(repeated.service.matchMovie({ carNum: "ABC-123" })).rejects.toThrow("重复分页");
    });
    it("preserves disc suffixes while accepting compact padded aliases", () => {
        expect(matches115FileName("mdvr00317-3.mp4", "MDVR-317")).toBe(true);
        expect(matches115FileName("START-0657.mp4", "START-657")).toBe(false);
        expect(matches115FileName("MIVR00345-5 ABC-123.mp4", "MIVR-345")).toBe(false);
        expect(preview115Rename("mdvr00317-3-4K-C.mp4", "MDVR-317")).toBe("MDVR-317-3-4K-C.mp4");
    });
});
