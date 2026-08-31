import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListIndexController } from "../src/features/list/list-index-controller.js";

describe("ListIndexController", () => {
    it("indexes, removes, and resolves connected cards by normalized number", () => {
        const scope = new LifecycleScope("feature:list"), first = { isConnected: true, querySelectorAll: () => [] }, second = { isConnected: true, querySelectorAll: () => [] }, root = { querySelectorAll: () => [first, second] }, readItem = vi.fn((item) => ({ carNum: item === first ? "abc-123" : "ABC-124" })), controller = new ListIndexController({ scope, selectors: { itemSelector: ".item" }, document: root, readItem });

        controller.rebuildItemIndex();

        expect(controller.getIndexedItems(["ABC-123"])).toEqual([first]);
        controller.removeIndexedItems([{ nodeType: 1, querySelectorAll: () => [second] }]);
        expect(controller.getIndexedItems(["ABC-124"])).toEqual([]);
        scope.dispose();
    });

    it("drops disconnected cards during lookup", () => {
        const scope = new LifecycleScope("feature:list"), item = { isConnected: false, querySelectorAll: () => [] }, controller = new ListIndexController({ scope, selectors: { itemSelector: ".item" }, document: { querySelectorAll: () => [item] }, readItem: () => ({ carNum: "ABC-123" }) });

        controller.rebuildItemIndex();

        expect(controller.getIndexedItems(["ABC-123"])).toEqual([]);
        scope.dispose();
    });
});
