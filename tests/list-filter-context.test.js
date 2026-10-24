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
    it("refreshes state without reading or rebuilding cached rules", async () => {
        const now = Date.parse("2026-10-24T00:00:00Z"), calls = [];
        let downloaded = false;
        const provider = new ListFilterContextProvider({ now: () => now, readSources: async options => {
            calls.push(options?.stateOnly === true ? "state" : "all");
            const dynamic = { carMap: new Map([["ABC-123", { stateFlags: { downloaded } }]]), activity: { entries: [] } };
            return options?.stateOnly ? dynamic : { ...sources(now), ...dynamic };
        } });
        const first = await provider.get();
        downloaded = true;
        provider.invalidateState();
        const changed = await provider.get();
        expect(changed.carMap.get("ABC-123").stateFlags.downloaded).toBe(true);
        expect(changed.actorCarNumToNameMap).toBe(first.actorCarNumToNameMap);
        expect(calls).toEqual(["all", "state"]);
        provider.invalidate(); await provider.get();
        expect(calls).toEqual(["all", "state", "all"]);
    });

    it("uses a verified committed snapshot locally and falls back when its proof is invalid", async () => {
        const now = Date.parse("2026-10-24T00:00:00Z"), reads = [];
        const provider = new ListFilterContextProvider({ now: () => now, readSources: async options => { reads.push(options?.stateOnly ? "state" : "all"); return sources(now); } });
        await provider.get();
        let valid = true;
        const snapshot = { records: new Map([["ABC-123", { carNum: "ABC-123", stateFlags: { downloaded: true } }]]), recentCarNums: new Set(["ABC-123"]) };
        provider.invalidateState(() => valid ? snapshot : null);
        expect((await provider.get()).carMap.get("ABC-123").stateFlags.downloaded).toBe(true);
        expect(reads).toEqual(["all"]);
        provider.invalidateState(() => valid ? snapshot : null);
        valid = false;
        expect((await provider.get()).carMap.get("ABC-123").stateFlags.favorite).toBe(true);
        expect(reads).toEqual(["all", "state"]);
    });

    it("rereads state when an earlier off-list invalidation was never consumed", async () => {
        const now = Date.parse("2026-10-24T00:00:00Z"), data = new Map([["AA-1", { stateFlags: { downloaded: false } }], ["BB-1", { stateFlags: { downloaded: false } }]]), reads = [];
        const provider = new ListFilterContextProvider({ now: () => now, readSources: async options => {
            reads.push(options?.stateOnly ? "state" : "all"); return { ...sources(now), carMap: new Map(data) };
        } });
        await provider.get();
        data.set("AA-1", { stateFlags: { downloaded: true } });
        provider.invalidateState(() => ({ records: new Map([["AA-1", data.get("AA-1")]]), recentCarNums: new Set(["AA-1"]) }));
        // No rendered AA card requests this invalidated snapshot yet.
        data.set("BB-1", { stateFlags: { downloaded: true } });
        provider.invalidateState(() => ({ records: new Map([["BB-1", data.get("BB-1")]]), recentCarNums: new Set(["BB-1"]) }));
        const current = await provider.get();
        expect(current.carMap.get("AA-1").stateFlags.downloaded).toBe(true);
        expect(current.carMap.get("BB-1").stateFlags.downloaded).toBe(true);
        expect(reads).toEqual(["all", "state"]);
    });

    it("expires recent marks before applying a later local delta", async () => {
        let now = Date.parse("2026-10-24T00:00:00Z");
        const activity = { entries: [{ commitState: "committed", createdAt: new Date(now - 7 * 864e5 + 100).toISOString(), changes: [{ carNum: "AA-1", fields: ["stateFlags.favorite"] }] }] };
        const reads = [], provider = new ListFilterContextProvider({ now: () => now, readSources: async options => { reads.push(options?.stateOnly ? "state" : "all"); return { carMap: new Map(), activity }; } });
        expect((await provider.get()).recentCarNums.has("AA-1")).toBe(true);
        now += 1000;
        activity.entries.push({ commitState: "committed", createdAt: new Date(now).toISOString(), changes: [{ carNum: "BB-1", fields: ["stateFlags.favorite"] }] });
        provider.invalidateState(() => ({ records: new Map([["BB-1", { stateFlags: { favorite: true } }]]), recentCarNums: new Set(["BB-1"]) }));
        const current = await provider.get();
        expect(current.recentCarNums.has("AA-1")).toBe(false);
        expect(current.recentCarNums.has("BB-1")).toBe(true);
        expect(reads).toEqual(["all", "state"]);
    });
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
