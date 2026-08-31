// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { OneTwoThreeAuthController } from "../src/features/external-bridge/one-two-three-controller.js";

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
    const controller = new OneTwoThreeAuthController({ document: dom.window.document, window: dom.window, storage, scope });
    return { controller, scope, storage, values };
}

describe("123Pan platform boundary", () => {
    it("encrypts the shared token while separating site-local discovery from GM storage", async () => {
        const { controller, storage, values } = createHarness([["authorToken", "site-token"]]);
        await controller.syncTokenOnce();
        expect(values.get("jhs_123pan_author_token")).toMatch(/^AES:/);
        expect(values.get("jhs_123pan_author_token")).not.toContain("site-token");
        expect(values.get("jhs_123pan_author_token_meta")).toMatchObject({ source: "authorToken" });
        await expect(controller.getStoredToken()).resolves.toBe("site-token");
    });

    it("removes all global listeners and polling when the Feature scope is disposed", async () => {
        vi.useFakeTimers();
        const { controller, scope } = createHarness();
        controller.start();
        expect(scope.snapshot().listeners).toBe(3);
        expect(controller.syncTimer).not.toBeNull();
        scope.dispose();
        expect(scope.snapshot()).toMatchObject({ listeners: 0, disposed: true });
        expect(controller.syncTimer).toBeNull();
    });
});
