// @vitest-environment jsdom

import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { createListEvaluationContext } from "../src/features/list/list-evaluator.js";
import { ListFilterService } from "../src/features/list/list-filter-service.js";

afterEach(() => {
    delete globalThis.$;
    delete window.isListPage;
});

describe("ListFilterService", () => {
    it("commits canonical state metadata and renders status tags for visible cards", async () => {
        window.isListPage = true;
        globalThis.$ = jqueryFactory;
        document.body.innerHTML = '<div class="movie-list"><div class="item"><div class="tags"></div><div class="video-title"><strong>ABC-123</strong> 标题</div></div></div>';
        const item = document.querySelector(".item"), scope = new LifecycleScope("feature:list"), context = createListEvaluationContext({
            settings: { tagPosition: "leftTop" },
            carMap: new Map([["ABC-123", { stateFlags: { favorite: true } }]]),
        }), recordPhase = vi.fn(), scheduleRecount = vi.fn(), translateItems = vi.fn(async () => {}), logTiming = vi.fn();
        const service = new ListFilterService({
            scope,
            document,
            window,
            selectors: { itemSelector: ".movie-list .item" },
            site: "javdb",
            getActiveFilter: () => "favorite",
            captureRevision: () => "1:0",
            isCurrentRevision: () => true,
            getEvaluationContext: () => context,
            readItem: vi.fn(() => ({ carNum: "ABC-123", title: "标题" })),
            recordPhase,
            scheduleRecount,
            translateItems,
            logTiming,
        });

        await expect(service.doFilter("1:0")).resolves.toBe(true);

        expect(JSON.parse(item.dataset.jhsFlags)).toMatchObject({ favorite: true });
        expect(JSON.parse(item.dataset.jhsVisibility)).toEqual({ keyword: false, actorBlacklist: false, actressBlacklist: false });
        expect(item.dataset.jhsTagPosition).toBe("leftTop");
        expect(item.querySelector(".jhs-status-tags")).not.toBeNull();
        expect(item.querySelector(".jhs-status-tags").textContent).toContain("已收藏");
        expect(scheduleRecount).toHaveBeenCalledOnce();
        expect(translateItems).toHaveBeenCalledWith([ item ]);
        expect(recordPhase).toHaveBeenNthCalledWith(1, "doFilter-start", 1);
        expect(recordPhase).toHaveBeenNthCalledWith(2, "doFilter-end", 1);
        expect(logTiming).toHaveBeenCalledOnce();
        scope.dispose();
    });

    it("does not commit a card after its revision becomes stale", async () => {
        window.isListPage = true;
        globalThis.$ = jqueryFactory;
        document.body.innerHTML = '<div class="movie-list"><div class="item"><div class="tags"></div></div></div>';
        let resolveContext, current = true;
        const contextPromise = new Promise((resolve) => { resolveContext = resolve; }), item = document.querySelector(".item"), scope = new LifecycleScope("feature:list"), scheduleRecount = vi.fn();
        const service = new ListFilterService({
            scope,
            document,
            window,
            selectors: { itemSelector: ".movie-list .item" },
            site: "javdb",
            getActiveFilter: () => "favorite",
            captureRevision: () => "2:0",
            isCurrentRevision: vi.fn(() => current),
            getEvaluationContext: async () => { const context = await contextPromise; current = false; return context; },
            readItem: vi.fn(() => ({ carNum: "ABC-123", title: "标题" })),
            scheduleRecount,
        });
        const request = service.doFilter("1:0");
        resolveContext(createListEvaluationContext());

        await expect(request).resolves.toBe(false);

        expect(item.dataset.jhsFlags).toBeUndefined();
        expect(scheduleRecount).not.toHaveBeenCalled();
        scope.dispose();
    });
});
