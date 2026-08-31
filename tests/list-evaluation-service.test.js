import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListEvaluationService } from "../src/features/list/list-evaluation-service.js";

function createDependencies() {
    const storage = {
        getTitleFilterKeyword: vi.fn(async () => ["BLOCK"]),
        getBlacklistMap: vi.fn(async () => new Map([["actor-1", { role: "actor" }], ["actress-1", { role: "actress" }]])),
        getBlacklistCarList: vi.fn(async () => [
            { starId: "actor-1", carNum: "ABC-123", names: "Actor" },
            { starId: "actress-1", carNum: "DEF-456", names: "Actress" },
        ]),
        getSetting: vi.fn(async () => ({ tagPosition: "rightTop" })),
        getCarMap: vi.fn(async () => new Map([["ABC-123", { stateFlags: { favorite: true } }]])),
    };
    const stateService = {
        getActivityLog: vi.fn(async () => ({ entries: [{ commitState: "committed", createdAt: new Date().toISOString(), changes: [{ carNum: "ABC-123", fields: ["stateFlags.favorite"] }] }] })),
    };
    return { storage, stateService };
}

describe("ListEvaluationService", () => {
    it("caches one storage snapshot and builds the canonical evaluator context", async () => {
        const scope = new LifecycleScope("feature:list"), { storage, stateService } = createDependencies(), service = new ListEvaluationService({ scope, storage, stateService });

        const first = await service.getContext(), second = await service.getContext(), evaluation = await service.createEvaluationContext();

        expect(second).toBe(first);
        expect(storage.getCarMap).toHaveBeenCalledOnce();
        expect(stateService.getActivityLog).toHaveBeenCalledOnce();
        expect(first.actorCarNumToNameMap.get("ABC-123")).toBe("Actor");
        expect(first.actressCarNumToNameMap.get("DEF-456")).toBe("Actress");
        expect(first.recentCarNums.has("ABC-123")).toBe(true);
        expect(evaluation.carMap).toBe(first.carMap);
        scope.dispose();
    });

    it("invalidates the cached snapshot and releases with the feature scope", async () => {
        const scope = new LifecycleScope("feature:list"), { storage, stateService } = createDependencies(), service = new ListEvaluationService({ scope, storage, stateService });

        await service.getContext();
        service.invalidate();
        await service.getContext();
        scope.dispose();

        expect(storage.getCarMap).toHaveBeenCalledTimes(2);
        expect(service.disposed).toBe(true);
        expect(service.context).toBeNull();
    });
});
