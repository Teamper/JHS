import { describe, expect, it } from "vitest";
import { ListPagePluginAdapter } from "../src/compat/list-page-adapter.js";

describe("ListPagePluginAdapter", () => {
    it("keeps the legacy name while creating its delegate on Feature activation", async () => {
        const adapter = new ListPagePluginAdapter();
        adapter.pluginManager = { resolveDeclaredPlugin: () => null };
        adapter.declaredDependencies = new Set();

        const delegate = adapter.ensureDelegate({ scope: () => Promise.resolve({}) });

        expect(adapter.getName()).toBe("ListPagePlugin");
        expect(adapter.initCss()).toBe("");
        expect(delegate.getName()).toBe("ListPagePlugin");
        delegate.activeQuickFilter = "favorite";
        expect(adapter.activeQuickFilter).toBe("favorite");
        expect(typeof adapter.getFilterContext).toBe("function");
    });
});
