import { describe, expect, it, vi } from "vitest";
import { B } from "../src/core/constants.js";
import { buildListFilterContext, ListFilterContextProvider } from "../src/features/list/list-filter-context.js";

function sources(now) {
    const stamp = (offset) => new Date(now - offset).toISOString();
    return {
        titleKeywords: ["blocked title"],
        settings: { tagPosition: "leftTop" },
        carMap: new Map([["ABC-123", { stateFlags: { favorite: true } }]]),
        blacklistMap: new Map([["actor", { role: B }], ["actress", { role: "actress" }]]),
        blacklistCars: [
            { starId: "actor", carNum: " abc-001 ", names: "Actor Name" },
            { starId: "actress", carNum: "ABC-002", names: "Actress Name" },
            { starId: "missing", carNum: "ABC-003", names: "Unknown Name" },
        ],
        activity: { entries: [
            { commitState: "committed", createdAt: stamp(1_000), changes: [{ carNum: "ABC-123", fields: ["stateFlags.favorite"] }] },
            { commitState: "committed", createdAt: stamp(8 * 864e5), changes: [{ carNum: "OLD-123", fields: ["stateFlags.favorite"] }] },
            { commitState: "committed", createdAt: stamp(1_000), changes: [{ carNum: "REV-123", undoState: "reverted", fields: ["stateFlags.watched"] }] },
            { commitState: "pending", createdAt: stamp(1_000), changes: [{ carNum: "PENDING-123", fields: ["stateFlags.watched"] }] },
        ] },
    };
}

describe("ListFilterContextProvider", () => {
    it("builds one evaluation context with 6.5.1 role, recent, and record semantics", () => {
        const now = Date.parse("2026-09-27T00:00:00Z"), missingRole = vi.fn();
        const context = buildListFilterContext(sources(now), { now, onMissingBlacklistRole: missingRole });

        expect(context.titleKeywords).toEqual(["blocked title"]);
        expect(context.settings).toEqual({ tagPosition: "leftTop" });
        expect(context.carMap.get("ABC-123").stateFlags.favorite).toBe(true);
        expect(context.actorCarNumToNameMap.get("ABC-001")).toBe("Actor Name");
        expect(context.actressCarNumToNameMap.get("ABC-002")).toBe("Actress Name");
        expect(context.recentCarNums).toEqual(new Set(["ABC-123"]));
        expect(missingRole).toHaveBeenCalledOnce();
    });

    it("coalesces reads and rebuilds after explicit invalidation", async () => {
        const now = Date.parse("2026-09-27T00:00:00Z"), readSources = vi.fn(async () => sources(now));
        const provider = new ListFilterContextProvider({ readSources, now: () => now });

        const [first, concurrent] = await Promise.all([provider.get(), provider.get()]);
        expect(first).toBe(concurrent);
        expect(readSources).toHaveBeenCalledOnce();

        provider.invalidate();
        expect(await provider.get()).not.toBe(first);
        expect(readSources).toHaveBeenCalledTimes(2);
        provider.dispose();
    });

    it("does not let a stale in-flight read overwrite a newer generation", async () => {
        const pendingReads = [];
        const now = Date.parse("2026-09-27T00:00:00Z");
        const provider = new ListFilterContextProvider({ readSources: () => new Promise((resolve) => pendingReads.push(resolve)), now: () => now });
        const stale = provider.get();
        await Promise.resolve();
        provider.invalidate();
        const current = provider.get();
        await Promise.resolve();
        pendingReads[1](sources(Date.parse("2026-09-27T00:00:00Z")));
        const currentContext = await current;
        pendingReads[0](sources(Date.parse("2026-09-27T00:00:00Z") - 10 * 864e5));
        await stale;

        expect(await provider.get()).toBe(currentContext);
        expect(provider.value.recentCarNums).toEqual(new Set(["ABC-123"]));
        provider.dispose();
    });
});
