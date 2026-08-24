// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { OneTwoThreeOfflinePlugin } from "../src/plugins/one-two-three/offline.js";

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
    const plugin = new OneTwoThreeOfflinePlugin();
    plugin.runtimeServices = Object.freeze({ storage, scope: () => scope });
    return { plugin, scope, storage, values };
}

describe("123Pan platform boundary", () => {
    it("preserves token keys while separating site-local discovery from GM storage", () => {
        const { plugin, storage, values } = createHarness([["authorToken", "site-token"]]);
        plugin.syncTokenOnce();
        expect(values.get("jhs_123pan_author_token")).toBe("site-token");
        expect(values.get("jhs_123pan_author_token_meta")).toMatchObject({ source: "authorToken" });
        expect(storage.setValue).toHaveBeenCalledTimes(2);
        expect(plugin.getStoredToken()).toBe("site-token");
    });

    it("removes all global listeners and polling when the Feature scope is disposed", async () => {
        vi.useFakeTimers();
        const { plugin, scope } = createHarness();
        await plugin.handle();
        expect(scope.snapshot().listeners).toBe(3);
        expect(plugin.syncTimer).not.toBeNull();
        scope.dispose();
        expect(scope.snapshot()).toMatchObject({ listeners: 0, disposed: true });
        expect(plugin.syncTimer).toBeNull();
    });
});
