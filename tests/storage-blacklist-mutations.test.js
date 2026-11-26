// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { StateService } from "../src/core/state-service.js";
import { storageFromForage } from "./helpers/atomic-storage.js";

function createCoordinator() {
    let tail = Promise.resolve(), entries = 0, active = 0;
    return {
        get entries() { return entries; },
        get active() { return active; },
        runExclusive(operation) {
            const run = tail.then(async () => {
                entries++, active++;
                try { return await operation(); }
                finally { active--; }
            });
            tail = run.then(() => undefined, () => undefined);
            return run;
        },
    };
}

function createStorage({ failAfterPersist = false, emit = vi.fn(async () => {}), logger = { warn: vi.fn() } } = {}) {
    const data = new Map([
        ["blacklist", [{ starId: "actor-1", name: "Actor" }, { starId: "actor-2", name: "Other" }]],
        ["blacklist_car_list", [{ starId: "actor-1", carNum: "ABC-1" }, { starId: "actor-2", carNum: "DEF-2" }]],
    ]);
    const writes = [], coordinator = createCoordinator();
    let failed = false;
    const forage = {
        getItem: vi.fn(async key => data.get(key) ?? null),
        setItem: vi.fn(async (key, value) => {
            writes.push({ key, lockDepth: coordinator.active });
            data.set(key, structuredClone(value));
            if (!failed && key === "blacklist" && failAfterPersist) {
                failed = true;
                throw new Error("injected blacklist write failure");
            }
        }),
        removeItem: vi.fn(async key => data.delete(key)),
    };
    const storage = storageFromForage(forage);
    const state = new StateService(storage, { emit }, coordinator, { logger, origin: () => "https://javdb.com" });
    return { state, data, coordinator, writes, emit };
}

describe("blacklist actor mutation coordination", () => {
    it("removes the actor and all blocked cards in one shared write window", async () => {
        const harness = createStorage();

        await expect(harness.state.removeBlacklistActor("actor-1")).resolves.toEqual({ removedActor: true, removedCarRecords: 1 });

        expect(harness.coordinator.entries).toBe(1);
        expect(harness.writes).toEqual([
            { key: "blacklist_car_list", lockDepth: 1 },
            { key: "blacklist", lockDepth: 1 },
        ]);
        expect(harness.data.get("blacklist")).toEqual([{ starId: "actor-2", name: "Other" }]);
        expect(harness.data.get("blacklist_car_list")).toEqual([{ starId: "actor-2", carNum: "DEF-2" }]);
        expect(harness.emit).toHaveBeenCalledExactlyOnceWith("blacklist-rules-changed", {}, { broadcastFirst: true });
    });

    it("restores the blocked-card list when removing the actor record fails after writing", async () => {
        const harness = createStorage({ failAfterPersist: true });
        const before = Object.fromEntries(harness.data);

        await expect(harness.state.removeBlacklistActor("actor-1")).rejects.toThrow("injected blacklist write failure");

        expect(Object.fromEntries(harness.data)).toEqual(before);
        expect(harness.coordinator.entries).toBe(1);
        expect(harness.writes.every(write => write.lockDepth === 1)).toBe(true);
    });

    it("keeps a completed actor deletion successful when notification and warning both fail", async () => {
        const emit = vi.fn(async () => { throw new Error("event channel closed"); });
        const logger = { warn: vi.fn(() => { throw new Error("logger failed"); }) };
        const harness = createStorage({ emit, logger });

        await expect(harness.state.removeBlacklistActor("actor-1")).resolves.toEqual({ removedActor: true, removedCarRecords: 1 });
        expect(harness.data.get("blacklist")).toEqual([{ starId: "actor-2", name: "Other" }]);
        expect(harness.data.get("blacklist_car_list")).toEqual([{ starId: "actor-2", carNum: "DEF-2" }]);
    });

    it("keeps a completed batch screen successful when its UI and diagnostics fail", async () => {
        const logger = { html: vi.fn(() => { throw new Error("UI failed"); }), warn: vi.fn(() => { throw new Error("logger failed"); }) };
        const harness = createStorage({ logger });

        await expect(harness.state.batchSaveBlacklistCarList([{ starId: "actor-3", carNum: "GHI-3", url: "https://javdb.com/v/ghi-3", names: "Synthetic", actionType: "filter" }])).resolves.toEqual({ changed: ["GHI-3"] });
        expect(harness.data.get("blacklist_car_list").find((item) => item.carNum === "GHI-3")).toMatchObject({ starId: "actor-3", url: "https://javdb.com/v/ghi-3", names: "Synthetic", status: "filter" });
    });
});
