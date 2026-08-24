import { describe, expect, it, vi } from "vitest";
import { IndexedDbStorageAdapter } from "../src/platform/userscript/indexeddb-storage-adapter.js";
import { StorageService } from "../src/services/storage-service.js";

describe("storage service", () => {
    it("keeps IndexedDB data and legacy local keys in separate namespaces", async () => {
        const indexed = new Map(), local = new Map();
        const forage = {
            getItem: vi.fn(async key => indexed.get(key)),
            setItem: vi.fn(async (key, value) => indexed.set(key, value)),
            removeItem: vi.fn(async key => indexed.delete(key)),
        };
        const localStore = {
            getItem: vi.fn(key => local.get(key) ?? null),
            setItem: vi.fn((key, value) => local.set(key, value)),
            removeItem: vi.fn(key => local.delete(key)),
        };
        const storage = new StorageService(new IndexedDbStorageAdapter(forage, localStore));
        await storage.set("setting", { theme: "dark" });
        storage.setLocal("jhs_tag_expand", "true");
        await expect(storage.get("setting")).resolves.toEqual({ theme: "dark" });
        expect(storage.getLocal("jhs_tag_expand")).toBe("true");
        expect(indexed.has("jhs_tag_expand")).toBe(false);
        storage.removeLocal("jhs_tag_expand");
        expect(storage.getLocal("jhs_tag_expand")).toBeNull();
    });
});
