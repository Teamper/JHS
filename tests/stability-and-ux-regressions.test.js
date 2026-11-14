// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { GmHttp } from "../src/core/http.js";
import { HttpService } from "../src/services/http-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { UserscriptHttpAdapter } from "../src/platform/userscript/userscript-http-adapter.js";
import { StateService } from "../src/core/state-service.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { WebDavSyncStore, SYNC_STATE_KEY } from "../src/core/webdav-sync-store.js";
import { SYNC_PENDING_KEY } from "../src/core/sync-pending-ledger.js";
import { OwnedPopover } from "../src/core/owned-popover.js";
import { CacheService } from "../src/services/cache-service.js";
import { TranslationService } from "../src/services/translation-service.js";
import { CredentialService } from "../src/services/credential-service.js";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
});

describe("stability, lifecycle, UX, and performance regressions", () => {
    it("recovers GmHttp half-open probe cleanly on non-5xx responses and ignoreNotFound 404", async () => {
        vi.stubGlobal("clog", { error: vi.fn(), warn: vi.fn() });
        const http = new GmHttp({
            utils: { retry: (op) => op() },
            storageManager: { getSetting: vi.fn(async (_k, fallback) => fallback) },
        });
        const breaker = { state: "half-open", failCount: 3, openTime: Date.now() - 120_000, cooldownMs: 60_000, threshold: 3, probing: false };
        http._circuitBreakers.set("example.test", breaker);

        // 404 without ignoreNotFound should reject without leaving probing stuck = true
        vi.stubGlobal("GM_xmlhttpRequest", vi.fn((opts) => opts.onload({ status: 404, responseText: "missing", finalUrl: opts.url })));
        await expect(http.get("https://example.test/a")).rejects.toThrow("missing");
        expect(http.getCircuitBreakerStatus()["example.test"]).toMatchObject({ state: "closed", probing: false, failCount: 0 });

        // ignoreNotFound 404 on half-open should also record success and close circuit
        http._circuitBreakers.set("example.test", { ...breaker, state: "half-open", probing: false });
        await expect(http.gmRequest("GET", "https://example.test/b", {}, {}, {}, false, { ignoreNotFound: true })).resolves.toBeNull();
        expect(http.getCircuitBreakerStatus()["example.test"]).toMatchObject({ state: "closed", probing: false, failCount: 0 });
    });

    it("does not trip HttpService circuit breaker on 4xx client errors", async () => {
        const service = new HttpService({ request: async () => ({ status: 422, responseHeaders: "", finalUrl: "https://api.example.test/data" }) }, new ExternalUrlPolicy());
        const options = { providerId: "example", url: "https://api.example.test/data", cacheScope: "none", retryCount: 0, circuitThreshold: 1, urlPolicy: { trustClass: "builtin-public", hosts: ["api.example.test"] } };
        await expect(service.request(options)).rejects.toMatchObject({ code: "INVALID_RESPONSE", retryable: false });
        expect(service.getCircuitBreakerStatus()["api.example.test"]).toMatchObject({ failCount: 0, state: "closed" });
    });

    it("preserves non-OK HTML responses in UserscriptHttpAdapter native-fetch even for json responseType", async () => {
        const fetchMock = vi.fn(async () => ({
            ok: false,
            status: 403,
            url: "https://api.example.test/item",
            headers: new Headers({ "content-type": "text/html" }),
            text: async () => "<title>Just a moment...</title>",
        }));
        const adapter = new UserscriptHttpAdapter(vi.fn(), fetchMock);
        const result = await adapter.request({ url: "https://api.example.test/item", responseType: "json", transport: "native-fetch" });
        expect(result).toMatchObject({ status: 403, responseText: "<title>Just a moment...</title>" });
    });

    it("commits StateService.undoTransaction atomically with sync ledger updates", async () => {
        vi.stubGlobal("utils", { getNowStr: () => "2026-11-14T00:00:00.000Z" });
        vi.stubGlobal("window", { location: { href: "https://javdb.com/" } });
        const values = new Map([["car_list", [{ carNum: "ABC-123", stateFlags: { favorite: false } }]]]);
        const forage = {
            getItem: async (key) => structuredClone(values.get(key) ?? null),
            setItem: vi.fn(async (key, value) => { values.set(key, structuredClone(value)); }),
            removeItem: async (key) => values.delete(key),
        };
        const coordinator = new StorageMutationCoordinator({ lockManager: null });
        const sync = new WebDavSyncStore({ forage, coordinator });
        await sync.initialize();
        sync.enabled = true;
        coordinator.observer = { begin() { sync.begin(); }, async finish(ok) { await sync.finish(ok); } };
        const storage = {
            car_list_key: "car_list",
            favorite_actresses_key: "favorite_actresses",
            forage,
            syncState: sync,
            _invalidateCache: vi.fn(),
            _getCacheGeneration: () => 0,
            atomicStorage: {
                commitLockedBatch: vi.fn(async ({ puts }) => {
                    for (const [k, v] of Object.entries(structuredClone(puts))) values.set(k, v);
                    return true;
                }),
            },
        };
        const state = new StateService(storage, { emit: vi.fn() }, coordinator);
        try {
            const tx = await state.toggle("ABC-123", "favorite");
            forage.setItem.mockClear();
            storage.atomicStorage.commitLockedBatch.mockClear();
            const genBefore = values.get(SYNC_PENDING_KEY).generation;

            const undo = await state.undoTransaction(tx.transactionId);
            expect(undo.reverted).toEqual(["ABC-123"]);
            expect(storage.atomicStorage.commitLockedBatch).toHaveBeenCalledOnce();
            expect(forage.setItem.mock.calls.some(([k]) => k === "mutation_journal")).toBe(false);
            expect(values.get(SYNC_PENDING_KEY).generation).toBeGreaterThan(genBefore);
            expect(values.get("car_list")[0].stateFlags.favorite).toBe(false);
        } finally {
            sync.dispose();
        }
    });

    it("closes OwnedPopover on Escape even when manageKeyboard is false without propagating to parent dialog", () => {
        const anchor = document.createElement("button");
        const menu = document.createElement("div");
        const onClose = vi.fn();
        document.body.append(anchor, menu);
        const popover = new OwnedPopover(anchor, menu, { manageKeyboard: false, onClose });
        const parentEsc = vi.fn();
        document.addEventListener("keydown", parentEsc);

        popover.open();
        expect(popover.opened).toBe(true);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        expect(popover.opened).toBe(false);
        expect(onClose).toHaveBeenCalledOnce();
        expect(parentEsc).not.toHaveBeenCalled();

        document.removeEventListener("keydown", parentEsc);
        popover.close();
    });

    it("bounds CacheService L1 maps with LRU eviction", async () => {
        const cache = new CacheService();
        for (let idx = 0; idx < 300; idx++) {
            await cache.set("ns", `k-${idx}`, `v-${idx}`, { scope: "session", sessionScopeId: "s1", ttlMs: 60_000 });
        }
        expect(cache.storeFor("session", "s1").size).toBe(250);
        expect((await cache.get("ns", "k-0", { scope: "session", sessionScopeId: "s1" })).hit).toBe(false);
        expect((await cache.get("ns", "k-299", { scope: "session", sessionScopeId: "s1" })).hit).toBe(true);
    });

    it("does not trigger storage persistence on TranslationService cache read hits", async () => {
        const storage = { get: vi.fn(async () => null), set: vi.fn(async () => {}), remove: vi.fn(async () => {}), keys: vi.fn(async () => []) };
        const translate = vi.fn(async () => "测试译文");
        const integrations = { list: vi.fn(() => [{ id: "google-translate" }]), getAdapter: vi.fn(() => ({ translate })) };
        const service = new TranslationService(integrations, storage);

        // First call computes & persists via remember
        await service.translate("Hello");
        expect(service.memoryCache.size).toBe(1);
        service.persistTimer && clearTimeout(service.persistTimer);
        service.persistTimer = null;
        storage.set.mockClear();

        // Subsequent cache read hit should NOT schedule another IDB write
        const hit = await service.translate("Hello");
        expect(hit).toBe("测试译文");
        expect(service.persistTimer).toBeNull();
        expect(storage.set).not.toHaveBeenCalled();
        service.dispose();
    });

    it("prunes stale CredentialService ancestor revisions past retention limit while preserving active head/parents", async () => {
        vi.stubGlobal("navigator", { locks: { request: (_k, run) => run() } });
        const values = new Map();
        const storage = {
            getValue: async (k, f) => values.get(k) ?? f,
            setValue: async (k, v) => { values.set(k, v); },
            removeValue: async (k) => { values.delete(k); },
            listValues: async () => [...values.keys()],
        };
        const cred = new CredentialService(storage);
        let rev = null;
        for (let idx = 0; idx < 12; idx++) {
            const saved = await cred.setVersioned("conn", JSON.stringify({ n: idx }), rev);
            rev = saved.revision;
        }
        const remaining = [...values.keys()].filter(k => k.includes(":revision:"));
        expect(remaining.length).toBeLessThanOrEqual(8);
        expect((await cred.readVersioned("conn")).value).toBe(JSON.stringify({ n: 11 }));
    });
});
