import { describe, expect, it } from "vitest";
import { createListEvaluationContext, evaluateListItem, findMatchedTitleKeyword } from "../src/features/list/list-evaluator.js";

function makeContext(options = {}) {
    const carMap = new Map(Object.entries(options.cars || {}).map(([carNum, stateFlags]) => [carNum, { stateFlags }]));
    return createListEvaluationContext({
        titleKeywords: options.titleKeywords || [],
        carMap,
        actorCarNumToNameMap: new Map(Object.entries(options.actorBlacklist || {})),
        actressCarNumToNameMap: new Map(Object.entries(options.actressBlacklist || {})),
        recentCarNums: new Set(options.recent || []),
    });
}

describe("ListEvaluator (唯一列表判定器)", () => {
    it("treats all as the true full set including every hard-hidden reason", () => {
        const context = makeContext({
            titleKeywords: [ "禁播" ],
            cars: { "ABC-001": {} },
            actorBlacklist: { "ABC-002": "男优甲" },
            actressBlacklist: { "ABC-003": "女优甲" },
        });
        expect(evaluateListItem({ carNum: "ABC-001", title: "禁播合集" }, context, { filter: "all" }).matchesCurrentFilter).toBe(true);
        expect(evaluateListItem({ carNum: "ABC-002" }, context, { filter: "all" }).matchesCurrentFilter).toBe(true);
        expect(evaluateListItem({ carNum: "ABC-003" }, context, { filter: "all" }).matchesCurrentFilter).toBe(true);
    });

    it("waitCheck requires no state and no hard-hidden reason", () => {
        const context = makeContext({ cars: { "A-1": {}, "B-1": { favorite: true }, "C-1": { blocked: true } }, titleKeywords: [ "禁" ] });
        expect(evaluateListItem({ carNum: "A-1", title: "普通" }, context, { filter: "waitCheck" }).matchesCurrentFilter).toBe(true);
        expect(evaluateListItem({ carNum: "B-1", title: "普通" }, context, { filter: "waitCheck" }).matchesCurrentFilter).toBe(false);
        expect(evaluateListItem({ carNum: "C-1", title: "普通" }, context, { filter: "waitCheck" }).matchesCurrentFilter).toBe(false);
        expect(evaluateListItem({ carNum: "A-1", title: "禁播" }, context, { filter: "waitCheck" }).matchesCurrentFilter).toBe(false);
    });

    it("status filters exclude hard-hidden but keep the status flag", () => {
        const context = makeContext({ cars: { "A-1": { favorite: true }, "B-1": { favorite: true, blocked: true } } });
        expect(evaluateListItem({ carNum: "A-1" }, context, { filter: "favorite" }).matchesCurrentFilter).toBe(true);
        expect(evaluateListItem({ carNum: "B-1" }, context, { filter: "favorite" }).matchesCurrentFilter).toBe(false);
        expect(evaluateListItem({ carNum: "B-1" }, context, { filter: "blockedItems" }).matchesCurrentFilter).toBe(true);
    });

    it("returns flags, visibilityReasons, recent and hardHidden for reuse", () => {
        const context = makeContext({ cars: { "A-1": { watched: true } }, recent: [ "A-1" ] });
        const result = evaluateListItem({ carNum: "A-1", title: "x" }, context, { filter: "recent7d" });
        expect(result.flags.watched).toBe(true);
        expect(result.hardHidden).toBe(false);
        expect(result.recent).toBe(true);
        expect(result.matchesCurrentFilter).toBe(true);
        expect(result.visibilityReasons).toEqual({ keyword: false, actorBlacklist: false, actressBlacklist: false });
    });

    it("undownloaded includes pending, favorite and watched items while excluding downloads and every blocking rule", () => {
        const context = makeContext({
            cars: {
                "TEST-1": {}, "TEST-2": { favorite: true }, "TEST-3": { watched: true },
                "TEST-4": { favorite: true, watched: true },
                "TEST-5": { downloaded: true }, "TEST-6": { favorite: true, downloaded: true },
                "TEST-7": { watched: true, downloaded: true },
                "TEST-8": { favorite: true, watched: true, downloaded: true },
                "TEST-9": { blocked: true }, "TEST-10": { favorite: true, blocked: true },
            },
            titleKeywords: [ "禁播" ],
            actorBlacklist: { "TEST-11": "男优甲" },
            actressBlacklist: { "TEST-12": "女优甲" },
        });
        const records = [
            ...Array.from(context.carMap.keys()).map(carNum => ({ carNum })),
            { carNum: "TEST-13", title: "禁播合集" },
            { carNum: "TEST-11" }, { carNum: "TEST-12" },
        ];
        const before = structuredClone(context.carMap);
        expect(records.filter(record => evaluateListItem(record, context, { filter: "undownloaded" }).matchesCurrentFilter)
            .map(record => record.carNum)).toEqual([ "TEST-1", "TEST-2", "TEST-3", "TEST-4" ]);
        expect(context.carMap).toEqual(before);
    });

    it("finds the matched keyword for badge tips", () => {
        expect(findMatchedTitleKeyword([ "禁播", "4K" ], "4K 合集", "ABC-123")).toBe("4K");
        expect(findMatchedTitleKeyword([ "ABC" ], "普通标题", "ABC-001")).toBe("ABC");
        expect(findMatchedTitleKeyword([], "标题", "ABC-001")).toBeNull();
    });
});
