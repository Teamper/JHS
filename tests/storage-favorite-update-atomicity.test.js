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

    it("batch-updates actressProfiles atomically under a single lock, skips unchanged profiles, and inherits actressProfile on rebind merge", async () => {
        const existingProfile = {
            url: "https://ja.wikipedia.org/wiki/A",
            birthday: "1995年1月1日",
            age: "31岁",
            height: "160cm",
            weight: "45 kg",
            threeSizeText: "85 - 58 - 86",
            braSize: "D",
            matchedName: "Alice",
        };
        let current = [
            { starId: "a1", name: "Alice (無碼)", updateDate: "2026-10-01 00:00:00", actressProfile: existingProfile, actressProfileVerifiedUrl: existingProfile.url },
            { starId: "a2", name: "Bobette", updateDate: "2026-10-01 00:00:00" },
        ];
        let lockCount = 0;
        const storage = Object.create(StorageManager.prototype);
        storage.favorite_actresses_key = "favorite_actresses";
        storage.getFavoriteActressList = vi.fn(async () => current.map(item => ({ ...item })));
        storage._setItemAndInvalidate = vi.fn(async (_key, next) => { current = next; return true; });
        storage.withActressLock = async (operation) => { lockCount += 1; return operation(); };
        vi.stubGlobal("utils", { getNowStr: () => "2026-11-18 12:00:00" });

        // Zero-write skip when normalized profile is identical (even with fetchedAt)
        const noChange = await storage.batchUpdateFavoriteActressProfiles([
            { starId: "a1", actressProfile: { ...existingProfile, fetchedAt: 99999 } },
        ]);
        expect(noChange).toBe(0);
        expect(storage._setItemAndInvalidate).not.toHaveBeenCalled();
        expect(current[0].updateDate).toBe("2026-10-01 00:00:00");

        // Material change updates only changed actresses in a single write
        const updatedCount = await storage.batchUpdateFavoriteActressProfiles([
            { starId: "a1", actressProfile: { ...existingProfile, fetchedAt: 99999 } },
            { starId: "a2", actressProfile: { url: "https://ja.wikipedia.org/wiki/B", height: "165cm", braSize: "E", matchedName: "Bobette", fetchedAt: 12345 } },
            { starId: "a3", actressProfile: { url: "javascript:alert(1)" } },
        ]);
        expect(updatedCount).toBe(1);
        expect(storage._setItemAndInvalidate).toHaveBeenCalledTimes(1);
        expect(lockCount).toBe(2);
        expect(current[0].updateDate).toBe("2026-10-01 00:00:00");
        expect(current[1].actressProfile).toEqual({
            url: "https://ja.wikipedia.org/wiki/B",
            birthday: "",
            age: "",
            height: "165cm",
            weight: "",
            threeSizeText: "",
            braSize: "E",
            matchedName: "Bobette",
        });
        expect(current[1].actressProfileVerifiedUrl).toBe(current[1].actressProfile.url);
        expect(Object.hasOwn(current[1].actressProfile, "fetchedAt")).toBe(false);
        expect(current[1].updateDate).toBe("2026-11-18 12:00:00");

        // Rebind merge inherits actressProfile from source when target lacks one
        current.push({ starId: "target-empty", name: "Target (有碼)", updateDate: "2026-10-01 00:00:00" });
        const merged = await storage.rebindFavoriteActress({ fromStarId: "a2", toStarId: "target-empty", name: "Target (有码)" });
        expect(merged.ok).toBe(true);
        expect(merged.actress.name).toBe("Target");
        expect(merged.actress.actressProfile).toEqual(current.find(i => i.starId === "target-empty").actressProfile);
        expect(merged.actress.actressProfile.url).toBe("https://ja.wikipedia.org/wiki/B");

        // Rebind strips unsafe/malformed source.actressProfile and normalizes legacy fields on both merge and rename
        current.push(
            { starId: "unsafe-src", name: "UnsafeSrc", actressProfile: { url: "javascript:alert(1)", fetchedAt: 999, extra: "bad" }, updateDate: "2026-10-01 00:00:00" },
            { starId: "unsafe-tgt", name: "UnsafeTgt", actressProfile: { url: "ftp://invalid.test/x" }, updateDate: "2026-10-01 00:00:00" },
            { starId: "legacy-src", name: "LegacySrc", actressProfile: { url: "https://ja.wikipedia.org/wiki/Legacy", height: "162cm", fetchedAt: 555, junk: 1 }, updateDate: "2026-10-01 00:00:00" },
            { starId: "malformed-tgt", name: "MalformedTgt", actressProfile: { url: "javascript:bad" }, updateDate: "2026-10-01 00:00:00" },
        );
        const mergedUnsafe = await storage.rebindFavoriteActress({ fromStarId: "unsafe-src", toStarId: "unsafe-tgt", name: "UnsafeTgt" });
        expect(mergedUnsafe.ok).toBe(true);
        expect(Object.hasOwn(mergedUnsafe.actress, "actressProfile")).toBe(false);

        const mergedFallback = await storage.rebindFavoriteActress({ fromStarId: "legacy-src", toStarId: "malformed-tgt", name: "MalformedTgt" });
        expect(mergedFallback.ok).toBe(true);
        expect(mergedFallback.actress.actressProfile).toEqual({
            url: "https://ja.wikipedia.org/wiki/Legacy",
            birthday: "", age: "", height: "162cm", weight: "", threeSizeText: "", braSize: "", matchedName: "",
        });

        current.push({ starId: "rename-unsafe", name: "RenameUnsafe", actressProfile: { url: "javascript:alert(2)" }, updateDate: "2026-10-01 00:00:00" });
        const renamedUnsafe = await storage.rebindFavoriteActress({ fromStarId: "rename-unsafe", toStarId: "rename-unsafe-new", name: "RenameUnsafe" });
        expect(renamedUnsafe.ok).toBe(true);
        expect(Object.hasOwn(renamedUnsafe.actress, "actressProfile")).toBe(false);

        current.push({ starId: "rename-legacy", name: "RenameLegacy", actressProfile: { url: "https://ja.wikipedia.org/wiki/R", braSize: "F", fetchedAt: 777 }, updateDate: "2026-10-01 00:00:00" });
        const renamedLegacy = await storage.rebindFavoriteActress({ fromStarId: "rename-legacy", toStarId: "rename-legacy-new", name: "RenameLegacy" });
        expect(renamedLegacy.ok).toBe(true);
        expect(renamedLegacy.actress.actressProfile).toEqual({
            url: "https://ja.wikipedia.org/wiki/R",
            birthday: "", age: "", height: "", weight: "", threeSizeText: "", braSize: "F", matchedName: "",
        });
    });
});
