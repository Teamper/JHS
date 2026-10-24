import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";
import { SYNC_DOMAINS } from "../src/core/webdav-sync-model.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("idle synchronization work", () => {
    it("falls back to native CPU yields without MessageChannel, including hidden pages", async () => {
        const a = await syncReplica(memoryDav(), { data: { car_list: Array.from({ length: 100 }, (_, index) => ({ carNum: `YIELD-${index}`, stateFlags: { favorite: true } })) } }); await a.service.check();
        let now = 0;
        vi.spyOn(performance, "now").mockImplementation(() => now += 5);
        const yieldWork = vi.fn(async () => {});
        vi.stubGlobal("MessageChannel", undefined);
        vi.stubGlobal("scheduler", { yield: yieldWork }); vi.stubGlobal("document", { hidden: true });
        await a.service.check(); expect(yieldWork).toHaveBeenCalled();
        yieldWork.mockClear();
        vi.stubGlobal("document", { hidden: false });
        await a.service.check(); expect(yieldWork).toHaveBeenCalled();
    });

    it("refuses a remote commit when the connection changes during a CPU yield", async () => {
        const remote = memoryDav(), a = await syncReplica(remote); await a.service.check();
        const b = await syncReplica(remote); await b.service.check();
        await b.state.patch(["CANCEL-1"], { favorite: true }); await b.service.check();
        let now = 0;
        vi.spyOn(performance, "now").mockImplementation(() => now += 5);
        vi.stubGlobal("MessageChannel", undefined);
        vi.stubGlobal("scheduler", { yield: async () => { a.shared.revision = "changed-during-yield"; } });
        await a.service.check();
        expect(a.values.get("car_list").some(car => car.carNum === "CANCEL-1")).toBe(false);
    });
    it("repairs local writes once per idle poll, skips redundant materialization and emits no business refresh", async () => {
        const a = await syncReplica(memoryDav(), { data: { car_list: Array.from({ length: 1000 }, (_, index) => ({ carNum: `TEST-${index}`, stateFlags: { favorite: true } })) } });
        await a.service.check(); a.store.deps.events.emit.mockClear(); a.forage.getItem.mockClear();
        const reconcile = vi.spyOn(a.store, "computeReconciliation");
        await a.service.check();
        expect(reconcile).toHaveBeenCalledOnce();
        for (const domain of SYNC_DOMAINS) expect(a.forage.getItem.mock.calls.filter(([key]) => key === domain)).toHaveLength(1);
        expect(a.store.deps.events.emit).not.toHaveBeenCalled();
        // A writer bypassing capture is still repaired by the full reconciliation.
        a.values.get("car_list").push({ carNum: "MISSED-1", stateFlags: { watched: true } });
        await a.service.check();
        expect((await a.store.read()).model.records["car_list/MISSED-1"]).toBeTruthy();
        expect(a.values.get("car_list").some(car => car.carNum === "MISSED-1")).toBe(true);
    });

    it("publishes only changed domains and changed movie identities after a remote update", async () => {
        const remote = memoryDav(), a = await syncReplica(remote);
        await a.service.check(); const b = await syncReplica(remote); await b.service.check();
        await a.state.patch(["CHANGED-1"], { favorite: true }); await a.service.check(); b.store.deps.events.emit.mockClear();
        await b.service.check();
        const calls = b.store.deps.events.emit.mock.calls;
        expect(calls.some(([type]) => type === "blacklist-rules-changed" || type === "settings-changed" || type === "filter-rules-changed")).toBe(false);
        const payload = calls.find(([type]) => type === "car-state-changed")[1];
        expect(payload.carNums).toEqual(["CHANGED-1"]); expect(payload.scope).toBe("items");
        expect(payload.changedDomains).toContain("car_list"); expect(payload.notificationId).toBeTruthy();
    });
});
