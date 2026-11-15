import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageManager } from "../src/core/storage.js";

describe("favorite actress update failure", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("does not mutate the cached actress before the replacement is durable", async () => {
        const cached = [{ starId: "alice", name: "Alice", remark: "Original" }];
        const storage = Object.create(StorageManager.prototype);
        storage.favorite_actresses_key = "favorite_actresses";
        storage.getFavoriteActressList = vi.fn(async () => cached);
        storage._setItemAndInvalidate = vi.fn(async () => { throw new Error("IndexedDB unavailable"); });
        storage.withActressLock = operation => operation();
        vi.stubGlobal("utils", { getNowStr: () => "2026-09-29 00:00:00" });

        await expect(storage.updateFavoriteActress({ starId: "alice", name: "Alice Updated", remark: "Changed" })).rejects.toThrow("IndexedDB unavailable");
        expect(cached).toEqual([{ starId: "alice", name: "Alice", remark: "Original" }]);
    });

    it("rebinds a missing starId to a new starId or merges records atomically", async () => {
        let current = [
            { starId: "old-id", name: "Alice Old", allName: ["Alias A"], remark: "Old note", actressType: "censored", newVideoList: [{ carNum: "ABC-001", title: "One" }], lastCheckTime: "2026-11-10" },
            { starId: "target-id", name: "Alice Target", allName: ["Alias B"], remark: "Keep note", actressType: "censored", newVideoList: [{ carNum: "ABC-002", title: "Two" }], lastCheckTime: "2026-11-11" },
        ];
        const storage = Object.create(StorageManager.prototype);
        storage.favorite_actresses_key = "favorite_actresses";
        storage.getFavoriteActressList = vi.fn(async () => current.map(item => ({ ...item, allName: [...(item.allName || [])], newVideoList: [...(item.newVideoList || [])] })));
        storage._setItemAndInvalidate = vi.fn(async (_key, next) => { current = next; return true; });
        storage.withActressLock = operation => operation();
        vi.stubGlobal("utils", { getNowStr: () => "2026-11-15 12:00:00" });

        const renamed = await storage.rebindFavoriteActress({ fromStarId: "old-id", toStarId: "fresh-id", name: "Alice Fresh", allName: ["Alias C"] });
        expect(renamed).toMatchObject({ ok: true, merged: false, actress: { starId: "fresh-id", name: "Alice Fresh", remark: "Old note", lastCheckTime: null } });
        expect(current.find(item => item.starId === "fresh-id")?.allName).toEqual(expect.arrayContaining(["Alice Old", "Alias A", "Alias C"]));

        const merged = await storage.rebindFavoriteActress({ fromStarId: "fresh-id", toStarId: "target-id" });
        expect(merged).toMatchObject({ ok: true, merged: true, actress: { starId: "target-id", name: "Alice Target", lastCheckTime: null } });
        expect(current).toHaveLength(1);
        expect(current[0].newVideoList.map(v => v.carNum)).toEqual(expect.arrayContaining(["ABC-001", "ABC-002"]));
        expect(current[0].remark).toContain("Keep note");
        expect(current[0].remark).toContain("Old note");
    });
});
