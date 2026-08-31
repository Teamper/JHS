// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListIncrementalService } from "../src/features/list/list-incremental-service.js";

describe("ListIncrementalService", () => {
    it("owns the post-mutation card pipeline and publishes the completed handoff", async () => {
        document.body.innerHTML = '<div class="item"><img class="cover"></div>';
        const item = document.querySelector(".item"), cover = item.querySelector(".cover"), scope = new LifecycleScope("feature:list"), calls = [];
        const service = new ListIncrementalService({
            scope,
            selectors: { coverImgSelector: ".cover" },
            images: { replaceHdImg: vi.fn((covers) => calls.push([ "images", covers ])) },
            captureRevision: vi.fn(() => "1:0"),
            isCurrentRevision: vi.fn(() => true),
            filterItems: vi.fn(async () => { calls.push("filter"); return true; }),
            reconcileItems: vi.fn(() => { calls.push("reconcile"); return true; }),
            prepareLayout: vi.fn(() => calls.push("layout")),
            sortItems: vi.fn(async () => calls.push("sort")),
            addCardActions: vi.fn(async () => calls.push("actions")),
            indexItems: vi.fn(() => calls.push("index")),
            eventBus: { emit: vi.fn(async () => calls.push("event")) },
            autoPage: vi.fn(async () => calls.push("auto")),
        });

        await service.processAddedItems([ item ], "1:0");

        expect(service.images.replaceHdImg).toHaveBeenCalledWith([ cover ]);
        expect(service.filterItems).toHaveBeenCalledWith([ item ], "1:0");
        expect(item.dataset.jhsProcessed).toBe("true");
        expect(calls).toEqual([ [ "images", [ cover ] ], "layout", "filter", "reconcile", "sort", "actions", "index", "event", "auto" ]);
        scope.dispose();
    });

    it("retries connected unprocessed cards after a stale revision", async () => {
        document.body.innerHTML = '<div class="item"></div>';
        const item = document.querySelector(".item"), scope = new LifecycleScope("feature:list"), filterItems = vi.fn()
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true), captureRevision = vi.fn(() => "2:0");
        const service = new ListIncrementalService({
            scope,
            selectors: {},
            captureRevision,
            isCurrentRevision: vi.fn((revision) => revision === "2:0"),
            filterItems,
            reconcileItems: vi.fn(() => true),
        });

        await service.processAddedItems([ item ], "1:0");

        expect(filterItems).toHaveBeenNthCalledWith(1, [ item ], "1:0");
        expect(filterItems).toHaveBeenNthCalledWith(2, [ item ], "2:0");
        expect(captureRevision).toHaveBeenCalledOnce();
        expect(item.dataset.jhsProcessed).toBe("true");
        scope.dispose();
    });
});
