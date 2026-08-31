// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListSummaryService } from "../src/features/list/list-summary-service.js";

afterEach(() => vi.useRealTimers());

describe("ListSummaryService", () => {
    it("collects current-page counts with the hard-hidden union", () => {
        document.body.innerHTML = `
            <div class="movie-list">
                <div class="item" data-jhs-flags='{}' data-jhs-visibility='{}'></div>
                <div class="item" data-jhs-flags='{"blocked":true}' data-jhs-visibility='{"keyword":true,"actorBlacklist":true}'></div>
                <div class="item" data-jhs-flags='{"favorite":true}' data-jhs-visibility='{"actressBlacklist":true}'></div>
                <div class="item" data-jhs-flags='{"downloaded":true,"watched":true}' data-jhs-visibility='{}'></div>
            </div>`;
        const scope = new LifecycleScope("feature:list"), service = new ListSummaryService({ scope, document, window, selectors: { itemSelector: ".movie-list .item" }, site: "javdb" });

        expect(service.collectCurrentPageSummary()).toEqual({
            total: 4, pending: 1, blockedItems: 2, favorite: 1, downloaded: 1, watched: 1,
            debug: { manualBlocked: 1, keywordBlocked: 1, actorBlocked: 1, actressBlocked: 1 },
        });
        scope.dispose();
    });

    it("skips JavBus actor cards and owns one deferred recount", () => {
        document.body.innerHTML = '<div class="movie-list"><div class="item"><div class="avatar-box"></div></div><div class="item" data-jhs-flags="{}" data-jhs-visibility="{}"></div></div>';
        vi.useFakeTimers();
        const scope = new LifecycleScope("feature:list"), onSummary = vi.fn(), service = new ListSummaryService({ scope, document, window, selectors: { itemSelector: ".movie-list .item" }, site: "javbus", onSummary });

        service.scheduleRecount();
        service.scheduleRecount();
        vi.runAllTimers();

        expect(onSummary).toHaveBeenCalledOnce();
        expect(onSummary).toHaveBeenCalledWith(expect.objectContaining({ total: 1, pending: 1 }));
        scope.dispose();
        expect(service.disposed).toBe(true);
    });
});
