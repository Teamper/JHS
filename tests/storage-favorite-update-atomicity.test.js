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
});
