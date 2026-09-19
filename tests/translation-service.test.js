import { describe, expect, it, vi } from "vitest";
import { TranslationService } from "../src/services/translation-service.js";

describe("translation service", () => {
    it("resolves the declared translation capability", async () => {
        const translate = vi.fn(async () => "译文");
        const integrations = { list: vi.fn(() => [{ id: "google-translate" }]), getAdapter: vi.fn(() => ({ translate })) };
        const service = new TranslationService(integrations);
        await expect(service.translate("原題")).resolves.toBe("译文");
        expect(translate).toHaveBeenCalledWith("原題", { sourceLanguage: "ja", targetLanguage: "zh-CN" });
    });

    it("reuses persistent results across service instances and isolates language pairs", async () => {
        const records = new Map(), storage = {
            get: vi.fn(async key => records.get(key)),
            set: vi.fn(async (key, value) => records.set(key, value)),
            remove: vi.fn(async key => records.delete(key)),
            keys: vi.fn(async () => [...records.keys()]),
        };
        const translate = vi.fn(async (_text, options) => `${options.targetLanguage}译文`);
        const integrations = { list: vi.fn(() => [{ id: "google-translate" }]), getAdapter: vi.fn(() => ({ translate })) };
        const first = new TranslationService(integrations, storage);
        await expect(first.translate("原題")).resolves.toBe("zh-CN译文");
        await first.persistNow();
        await expect(new TranslationService(integrations, storage).translate("原題")).resolves.toBe("zh-CN译文");
        await expect(new TranslationService(integrations, storage).translate("原題", { targetLanguage: "en" })).resolves.toBe("en译文");
        expect(translate).toHaveBeenCalledTimes(2);
    });

    it("refreshes expired persistent results", async () => {
        const storage = { get: vi.fn(async key => key === "translation_cache_v2" ? { entries: { "translation:v1:ja:zh-CN:原題": { value: "旧译文", expiresAt: Date.now() - 1 } } } : null), set: vi.fn(), remove: vi.fn(), keys: vi.fn(async () => []) };
        const translate = vi.fn(async () => "新译文"), integrations = { list: vi.fn(() => [{ id: "google-translate" }]), getAdapter: vi.fn(() => ({ translate })) };
        await expect(new TranslationService(integrations, storage).translate("原題")).resolves.toBe("新译文");
        expect(translate).toHaveBeenCalledOnce();
    });

    it("returns the translation without waiting for persistent cache writes", async () => {
        vi.useFakeTimers();
        let releaseWrite;
        const storage = {
            get: vi.fn(async () => null), remove: vi.fn(),
            keys: vi.fn(async () => []),
            set: vi.fn(() => new Promise(resolve => { releaseWrite = resolve; })),
        };
        const translate = vi.fn(async () => "即时译文"), integrations = { list: vi.fn(() => [{ id: "google-translate" }]), getAdapter: vi.fn(() => ({ translate })) };
        const service = new TranslationService(integrations, storage);
        try {
            await expect(service.translate("原題")).resolves.toBe("即时译文");
            await expect(service.translate("原題")).resolves.toBe("即时译文");
            expect(storage.get).toHaveBeenCalledOnce();
            expect(translate).toHaveBeenCalledOnce();
            expect(storage.set).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(300);
            expect(storage.set).toHaveBeenCalledOnce();
            releaseWrite();
        } finally { vi.useRealTimers(); }
    });

    it("reuses the legacy car-number cache without a network or IndexedDB read", async () => {
        const storage = {
            getLocal: vi.fn(() => JSON.stringify({ "ABC-123": "旧缓存译文" })),
            get: vi.fn(), set: vi.fn(), remove: vi.fn(),
        };
        const translate = vi.fn(), integrations = { list: vi.fn(() => [{ id: "google-translate" }]), getAdapter: vi.fn(() => ({ translate })) };
        await expect(new TranslationService(integrations, storage).translate("原題", { cacheAlias: "ABC-123" })).resolves.toBe("旧缓存译文");
        expect(storage.get).not.toHaveBeenCalled();
        expect(translate).not.toHaveBeenCalled();
    });

    it("hydrates once for concurrent list translations and deduplicates identical requests", async () => {
        const storage = { get: vi.fn(async () => null), set: vi.fn(), remove: vi.fn(), keys: vi.fn(async () => []) };
        let release;
        const translate = vi.fn(() => new Promise(resolve => { release = resolve; }));
        const integrations = { list: vi.fn(() => [{ id: "google-translate" }]), getAdapter: vi.fn(() => ({ translate })) };
        const service = new TranslationService(integrations, storage);
        const requests = Array.from({ length: 20 }, () => service.translate("同一标题"));
        await vi.waitFor(() => expect(translate).toHaveBeenCalledOnce());
        release("合并译文");
        await expect(Promise.all(requests)).resolves.toEqual(Array(20).fill("合并译文"));
        expect(storage.get).toHaveBeenCalledOnce();
    });

    it("migrates v1 entries and clears every translation cache namespace", async () => {
        const records = new Map([
            ["translation:v1:ja:zh-CN:旧标题", { value: "旧译文", expiresAt: Date.now() + 60_000 }],
            ["translation_cache_v2", { version: 2, entries: { "translation:v1:ja:zh-CN:新标题": { value: "新译文", expiresAt: Date.now() + 60_000, lastUsed: Date.now() } } }],
        ]), removeLocal = vi.fn(), storage = {
            get: vi.fn(async key => records.get(key)), set: vi.fn(async (key, value) => records.set(key, value)), remove: vi.fn(async key => records.delete(key)),
            keys: vi.fn(async () => [...records.keys()]), getLocal: vi.fn(() => JSON.stringify({ ABC: "旧本地缓存" })), removeLocal,
        };
        const integrations = { list: vi.fn(() => []), getAdapter: vi.fn() }, service = new TranslationService(integrations, storage);
        await expect(service.translate("旧标题")).resolves.toBe("旧译文");
        expect(records.has("translation:v1:ja:zh-CN:旧标题")).toBe(false);
        await service.clearCache();
        expect(records.has("translation_cache_v2")).toBe(false);
        expect(service.memoryCache.size).toBe(0);
        expect(removeLocal).toHaveBeenCalledWith("jhs_translate");
    });

    it("prunes expired entries before least-recently-used overflow", () => {
        const service = new TranslationService({ list: vi.fn(), getAdapter: vi.fn() });
        const now = Date.now();
        service.memoryCache.set("expired", { value: "x", expiresAt: now - 1, lastUsed: 0 });
        for (let index = 0; index < 1_001; index += 1) service.memoryCache.set(`key-${index}`, { value: String(index), expiresAt: now + 60_000, lastUsed: index });
        expect(service.prune()).toBe(true);
        expect(service.memoryCache.size).toBe(1_000);
        expect(service.memoryCache.has("expired")).toBe(false);
        expect(service.memoryCache.has("key-0")).toBe(false);
    });
});
