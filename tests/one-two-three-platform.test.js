// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { Pan123CredentialService } from "../src/services/pan123-credential-service.js";

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

function createHarness(localEntries = []) {
    const dom = new JSDOM("<main></main>", { url: "https://yun.123pan.com/" }), local = new Map(localEntries), values = new Map(), scope = new LifecycleScope("feature:external-bridge");
    const storage = {
        getLocal: vi.fn(key => local.get(key) ?? null),
        getValue: vi.fn((key, fallback) => values.has(key) ? values.get(key) : fallback),
        setValue: vi.fn((key, value) => values.set(key, value)),
    };
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("show", { info: vi.fn() });
    vi.stubGlobal("clog", { debug: vi.fn() });
    const notifications = { info: vi.fn(), debug: vi.fn() };
    const service = new Pan123CredentialService(storage, notifications, { window: dom.window, document: dom.window.document, crypto: globalThis.crypto });
    return { service, scope, storage, values, notifications };
}

describe("123Pan platform boundary", () => {
    it("encrypts the shared token while separating site-local discovery from GM storage", async () => {
        const { service, values } = createHarness([["authorToken", "site-token"]]);
        await service.syncTokenOnce();
        expect(values.get(service.tokenKey)).toMatch(/^AES:/);
        expect(values.get(service.tokenKey)).not.toContain("site-token");
        expect(values.get(service.tokenMetaKey)).toMatchObject({ source: "authorToken" });
        await expect(service.getStoredToken()).resolves.toBe("site-token");
    });

    it("removes all global listeners and polling when the Feature scope is disposed", async () => {
        vi.useFakeTimers();
        const { service, scope } = createHarness();
        expect(service.startTokenSync(scope)).toBe(true);
        expect(scope.snapshot().listeners).toBe(3);
        expect(service.syncTimer).not.toBeNull();
        const generationBeforeDispose = service.syncGeneration;
        scope.dispose();
        expect(scope.snapshot()).toMatchObject({ listeners: 0, disposed: true });
        expect(service.syncTimer).toBeNull();
        expect(service.syncGeneration).toBe(generationBeforeDispose + 1);
    });

    it("invalidates an in-flight token sync when the owning Feature stops", async () => {
        const { service, storage, values } = createHarness([ ["authorToken", "site-token"] ]);
        let resolveStoredToken;
        service.getStoredToken = () => new Promise((resolve) => { resolveStoredToken = resolve; });
        const pending = service.syncTokenOnce();
        await vi.waitFor(() => expect(resolveStoredToken).toBeTypeOf("function"));
        service.stop();
        resolveStoredToken("");
        await pending;
        expect(storage.setValue).not.toHaveBeenCalledWith(service.tokenKey, expect.stringMatching(/^AES:/));
        expect(values.has(service.tokenKey)).toBe(false);
    });

    it("does not read or sync credentials outside the 123Pan account host", () => {
        const { service, scope } = createHarness();
        service.window = new JSDOM("", { url: "https://www.123pan.com/" }).window;
        expect(service.startTokenSync(scope)).toBe(false);
        expect(service.syncTimer).toBeNull();
        expect(scope.snapshot().listeners).toBe(0);
    });
});
