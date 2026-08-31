import { describe, expect, it, vi } from "vitest";
import { ListPagePluginAdapter } from "../src/compat/list-page-adapter.js";

describe("ListPagePluginAdapter", () => {
    it("keeps the legacy name without recreating the removed implementation", () => {
        const adapter = new ListPagePluginAdapter();
        const delegate = adapter.ensureDelegate({ scope: () => Promise.resolve({}) });

        expect(adapter.getName()).toBe("ListPagePlugin");
        expect(adapter.initCss()).toBe("");
        expect(delegate).toBe(adapter);
        adapter.activeQuickFilter = "favorite";
        expect(adapter.activeQuickFilter).toBe("favorite");
        expect(adapter.delegate).toBeNull();
    });

    it("proxies the activated list Feature API without creating a legacy delegate", () => {
        const adapter = new ListPagePluginAdapter(), setQuickFilter = vi.fn(), api = Object.freeze({
            setQuickFilter,
            getActiveQuickFilter: () => "favorite",
            captureListRevision: () => "2:1",
        });

        adapter.setFeatureApi(api);

        expect(adapter.delegate).toBeNull();
        expect(adapter.activeQuickFilter).toBe("favorite");
        expect(adapter.captureListRevision()).toBe("2:1");
        adapter.setQuickFilter("all");
        expect(setQuickFilter).toHaveBeenCalledWith("all");
    });
});
