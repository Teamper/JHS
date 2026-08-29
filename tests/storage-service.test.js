import { describe, expect, it, vi } from "vitest";
import { IndexedDbStorageAdapter } from "../src/platform/userscript/indexeddb-storage-adapter.js";
import { StorageService } from "../src/services/storage-service.js";

describe("storage service", () => {
    it("keeps IndexedDB data and legacy local keys in separate namespaces", async () => {
        const indexed = new Map(), local = new Map(), values = new Map();
        const forage = {
            getItem: vi.fn(async key => indexed.get(key)),
            setItem: vi.fn(async (key, value) => indexed.set(key, value)),
            removeItem: vi.fn(async key => indexed.delete(key)),
            keys: vi.fn(async () => [...indexed.keys()]),
        };
        const localStore = {
            getItem: vi.fn(key => local.get(key) ?? null),
            setItem: vi.fn((key, value) => local.set(key, value)),
            removeItem: vi.fn(key => local.delete(key)),
        };
        const getValue = vi.fn((key, fallback) => values.has(key) ? values.get(key) : fallback), setValue = vi.fn((key, value) => values.set(key, value));
        const storage = new StorageService(new IndexedDbStorageAdapter(forage, localStore, getValue, setValue));
        await storage.set("setting", { theme: "dark" });
        storage.setLocal("jhs_tag_expand", "true");
        await expect(storage.get("setting")).resolves.toEqual({ theme: "dark" });
        await expect(storage.keys()).resolves.toEqual(["setting"]);
        expect(storage.getLocal("jhs_tag_expand")).toBe("true");
        expect(indexed.has("jhs_tag_expand")).toBe(false);
        storage.removeLocal("jhs_tag_expand");
        expect(storage.getLocal("jhs_tag_expand")).toBeNull();
        expect(storage.getValue("token", "missing")).toBe("missing");
        storage.setValue("token", "secret");
        expect(storage.getValue("token", "missing")).toBe("secret");
        expect(indexed.has("token")).toBe(false);
        expect(local.has("token")).toBe(false);
    });
});
