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
        const context = makeContext({ cars: { "A": {}, "B": { favorite: true }, "C": { blocked: true } }, titleKeywords: [ "禁" ] });
        expect(evaluateListItem({ carNum: "A", title: "普通" }, context, { filter: "waitCheck" }).matchesCurrentFilter).toBe(true);
        expect(evaluateListItem({ carNum: "B", title: "普通" }, context, { filter: "waitCheck" }).matchesCurrentFilter).toBe(false);
        expect(evaluateListItem({ carNum: "C", title: "普通" }, context, { filter: "waitCheck" }).matchesCurrentFilter).toBe(false);
        expect(evaluateListItem({ carNum: "A", title: "禁播" }, context, { filter: "waitCheck" }).matchesCurrentFilter).toBe(false);
    });

    it("status filters exclude hard-hidden but keep the status flag", () => {
        const context = makeContext({ cars: { "A": { favorite: true }, "B": { favorite: true, blocked: true } } });
        expect(evaluateListItem({ carNum: "A" }, context, { filter: "favorite" }).matchesCurrentFilter).toBe(true);
        expect(evaluateListItem({ carNum: "B" }, context, { filter: "favorite" }).matchesCurrentFilter).toBe(false);
        expect(evaluateListItem({ carNum: "B" }, context, { filter: "blockedItems" }).matchesCurrentFilter).toBe(true);
    });

    it("returns flags, visibilityReasons, recent and hardHidden for reuse", () => {
        const context = makeContext({ cars: { "A": { watched: true } }, recent: [ "A" ] });
        const result = evaluateListItem({ carNum: "A", title: "x" }, context, { filter: "recent7d" });
        expect(result.flags.watched).toBe(true);
        expect(result.hardHidden).toBe(false);
        expect(result.recent).toBe(true);
        expect(result.matchesCurrentFilter).toBe(true);
        expect(result.visibilityReasons).toEqual({ keyword: false, actorBlacklist: false, actressBlacklist: false });
    });

    it("undownloaded includes pending, favorite and watched items while excluding downloads and every blocking rule", () => {
        const context = makeContext({
            cars: {
                pending: {}, favorite: { favorite: true }, watched: { watched: true },
                favoriteWatched: { favorite: true, watched: true },
                downloaded: { downloaded: true }, favoriteDownloaded: { favorite: true, downloaded: true },
                watchedDownloaded: { watched: true, downloaded: true },
                favoriteWatchedDownloaded: { favorite: true, watched: true, downloaded: true },
                blocked: { blocked: true }, favoriteBlocked: { favorite: true, blocked: true },
            },
            titleKeywords: [ "禁播" ],
            actorBlacklist: { actorBlocked: "男优甲" },
            actressBlacklist: { actressBlocked: "女优甲" },
        });
        const records = [
            ...Array.from(context.carMap.keys()).map(carNum => ({ carNum })),
            { carNum: "keywordBlocked", title: "禁播合集" },
            { carNum: "actorBlocked" }, { carNum: "actressBlocked" },
        ];
        const before = structuredClone(context.carMap);
        expect(records.filter(record => evaluateListItem(record, context, { filter: "undownloaded" }).matchesCurrentFilter)
            .map(record => record.carNum)).toEqual([ "pending", "favorite", "watched", "favoriteWatched" ]);
        expect(context.carMap).toEqual(before);
    });

    it("finds the matched keyword for badge tips", () => {
        expect(findMatchedTitleKeyword([ "禁播", "4K" ], "4K 合集", "ABC-123")).toBe("4K");
        expect(findMatchedTitleKeyword([ "ABC" ], "普通标题", "ABC-001")).toBe("ABC");
        expect(findMatchedTitleKeyword([], "标题", "ABC-001")).toBeNull();
    });
});
