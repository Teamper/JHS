import { describe, expect, it } from "vitest";
import { ListPagePluginAdapter } from "../src/compat/list-page-adapter.js";

describe("ListPagePluginAdapter", () => {
    it("keeps the old lookup name as a forwarding shell without creating an executor", () => {
        const adapter = new ListPagePluginAdapter();
        const delegate = { managedByFeature: true, activeQuickFilter: "all", getCurrentPageSummary() {} };
        expect(adapter.managedByFeature).toBe(true);
        expect(adapter.delegate).toBeNull();
        expect(() => adapter.ensureDelegate()).toThrow("List Feature compatibility service is not active");
        adapter.attachFeatureDelegate(delegate);
        delegate.activeQuickFilter = "favorite";

        expect(adapter.getName()).toBe("ListPagePlugin");
        expect(adapter.initCss()).toBe("");
        expect(adapter.activeQuickFilter).toBe("favorite");
        expect(adapter.getCurrentPageSummary).toBeInstanceOf(Function);
        adapter.activeQuickFilter = "downloaded";
        expect(delegate.activeQuickFilter).toBe("downloaded");
        expect(adapter.ensureDelegate()).toBe(delegate);
        expect(adapter.detachFeatureDelegate({})).toBe(false);
        expect(adapter.detachFeatureDelegate(delegate)).toBe(true);
        expect(adapter.delegate).toBeNull();
    });

    it("rejects a second, competing feature owner", () => {
        const adapter = new ListPagePluginAdapter();
        adapter.attachFeatureDelegate({ managedByFeature: true });
        expect(() => adapter.attachFeatureDelegate({ managedByFeature: true })).toThrow("already has an active Feature delegate");
    });
});
