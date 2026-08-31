// @vitest-environment jsdom

import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { endBatchRun, tryBeginBatchRun } from "../src/core/batch-coordinator.js";
import { createListEvaluationContext } from "../src/features/list/list-evaluator.js";
import { ListBatchService } from "../src/features/list/list-batch-service.js";

const originalUtils = globalThis.utils;
const originalShow = globalThis.show;

function createService(scope, stateService = { patch: vi.fn(async () => {}) }) {
    return new ListBatchService({
        scope,
        document,
        window,
        location: window.location,
        selectors: { requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" },
        stateService,
        http: { request: vi.fn() },
        getEvaluationContext: () => createListEvaluationContext({ carMap: new Map([["ABC-123", { stateFlags: { favorite: true } }]]) }),
    });
}

afterEach(() => {
    document.body.innerHTML = "";
    delete globalThis.$;
    if (originalUtils === undefined) delete globalThis.utils;
    else globalThis.utils = originalUtils;
    if (originalShow === undefined) delete globalThis.show;
    else globalThis.show = originalShow;
});

describe("ListBatchService", () => {
    it("scans the owned DOM and writes matching records through StateService", async () => {
        document.body.innerHTML = '<div class="movie-list"><div class="item"><a href="/v/ABC-123"><div class="video-title"><strong>ABC-123</strong> title</div></a></div></div>';
        globalThis.$ = jqueryFactory;
        const scope = new LifecycleScope("feature:list"), stateService = { patch: vi.fn(async () => {}) }, service = createService(scope, stateService);

        await expect(service.batchSaveAllVideos({ kind: "search" }, "favorite", { filter: "favorite", confirm: false })).resolves.toMatchObject({ matched: 1, updated: 1 });

        expect(stateService.patch).toHaveBeenCalledWith(["ABC-123"], { favorite: true }, expect.objectContaining({
            type: "actor-page-batch-state",
            records: [expect.objectContaining({ carNum: "ABC-123", url: "/v/ABC-123" })],
        }));
        expect(globalThis.$("#jhs-batch-progress").length).toBe(1);
        scope.dispose();
    });

    it("returns a cancellation result without acquiring the batch slot", async () => {
        globalThis.utils = { q: vi.fn((_event, _text, _accept, reject) => reject()) };
        const scope = new LifecycleScope("feature:list"), service = createService(scope);

        await expect(service.batchSaveAllVideos({ kind: "search" }, "favorite")).resolves.toEqual({ cancelled: true });
        expect(globalThis.utils.q).toHaveBeenCalledOnce();
        scope.dispose();
    });

    it("rejects a second run through the shared single-flight coordinator", async () => {
        const activeRun = tryBeginBatchRun();
        globalThis.show = { error: vi.fn() };
        const scope = new LifecycleScope("feature:list"), service = createService(scope);

        await expect(service.batchSaveAllVideos({ kind: "search" }, "favorite", { confirm: false })).resolves.toEqual({ cancelled: true, busy: true });
        expect(globalThis.show.error).toHaveBeenCalledWith("已有批量任务正在执行");
        endBatchRun(activeRun);
        scope.dispose();
    });

    it("releases the service with its feature lifecycle", () => {
        const scope = new LifecycleScope("feature:list"), service = createService(scope);

        scope.dispose();

        expect(service.disposed).toBe(true);
    });
});
