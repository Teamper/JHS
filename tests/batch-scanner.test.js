// @vitest-environment jsdom
import jquery from "jquery";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => { globalThis.$ = jquery; });
import { scanAllPages } from "../src/features/list/batch-scanner.js";
import { createListEvaluationContext, evaluateListItem } from "../src/features/list/list-evaluator.js";

function pageDom(body) {
    const dom = new DOMParser().parseFromString(`<html><body>${body}</body></html>`, "text/html");
    return jquery(dom);
}

function makeContext(cars) {
    const carMap = new Map(Object.entries(cars).map(([carNum, stateFlags]) => [carNum, { stateFlags }]));
    return createListEvaluationContext({ carMap, titleKeywords: [ "禁" ] });
}

describe("cross-page batch scanner", () => {
    it("collects only records matching the current filter across all pages", async () => {
        const page1 = pageDom('<div class="item" data-id="A-001"></div><div class="item" data-id="A-002"></div><a class="next" href="/p2"></a>');
        const page2Html = '<div class="item" data-id="A-003"></div><div class="item" data-id="A-004"></div><a class="next" href="/p3"></a>';
        const page3Html = '<div class="item" data-id="A-005"></div>';
        const fetchHtml = vi.fn(async (url) => url === "/p2" ? page2Html : page3Html);
        const context = makeContext({ "A-002": { favorite: true }, "A-004": { favorite: true } });
        const records = await scanAllPages({
            startDom: page1,
            itemSelector: ".item",
            nextPageSelector: ".next",
            fetchHtml,
            parseItem: (item) => ({ carNum: item.attr("data-id"), title: "" }),
            evaluate: (item) => evaluateListItem({ carNum: item.carNum, title: item.title }, context, { filter: "favorite" }),
            pageDelayMs: 0,
        });
        expect(fetchHtml).toHaveBeenCalledTimes(2);
        expect(records.map((item) => item.carNum)).toEqual([ "A-002", "A-004" ]);
    });

    it("treats all as the true full set including hard-hidden records", async () => {
        const page1 = pageDom('<div class="item" data-id="B-001"></div><div class="item" data-id="B-002"></div>');
        const context = makeContext({ "B-001": { blocked: true } });
        const records = await scanAllPages({
            startDom: page1, itemSelector: ".item", nextPageSelector: ".next",
            fetchHtml: vi.fn(), parseItem: (item) => ({ carNum: item.attr("data-id"), title: "禁播合集" }),
            evaluate: (item) => evaluateListItem({ carNum: item.carNum, title: item.title }, context, { filter: "all" }),
            pageDelayMs: 0,
        });
        expect(records.map((item) => item.carNum)).toEqual([ "B-001", "B-002" ]);
    });

    it("deduplicates repeated car numbers across pages", async () => {
        const page1 = pageDom('<div class="item" data-id="C-001"></div><a class="next" href="/p2"></a>');
        const context = makeContext({ "C-001": {} });
        const records = await scanAllPages({
            startDom: page1, itemSelector: ".item", nextPageSelector: ".next",
            fetchHtml: async () => '<div class="item" data-id="C-001"></div>', parseItem: (item) => ({ carNum: item.attr("data-id"), title: "" }),
            evaluate: (item) => evaluateListItem({ carNum: item.carNum, title: item.title }, context, { filter: "waitCheck" }),
            pageDelayMs: 0,
        });
        expect(records).toHaveLength(1);
    });

    it("stops on cancellation and reports progress", async () => {
        const page1 = pageDom('<div class="item" data-id="D-001"></div><a class="next" href="/p2"></a>');
        let cancelled = false;
        const context = makeContext({ "D-001": {}, "D-002": {} });
        const progress = vi.fn();
        const records = await scanAllPages({
            startDom: page1, itemSelector: ".item", nextPageSelector: ".next",
            fetchHtml: async () => '<div class="item" data-id="D-002"></div>', parseItem: (item) => ({ carNum: item.attr("data-id"), title: "" }),
            evaluate: (item) => evaluateListItem({ carNum: item.carNum, title: item.title }, context, { filter: "waitCheck" }),
            isCancelled: () => cancelled,
            onProgress: progress,
            pageDelayMs: 0,
        });
        expect(records).toHaveLength(2);
        cancelled = true;
        const cancelledRecords = await scanAllPages({
            startDom: page1, itemSelector: ".item", nextPageSelector: ".next",
            fetchHtml: vi.fn(), parseItem: (item) => ({ carNum: item.attr("data-id"), title: "" }),
            evaluate: () => ({ matchesCurrentFilter: true }),
            isCancelled: () => cancelled,
            pageDelayMs: 0,
        });
        expect(cancelledRecords).toHaveLength(0);
        expect(progress).toHaveBeenCalled();
    });
});
