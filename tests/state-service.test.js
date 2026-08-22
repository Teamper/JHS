import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadStateService() {
    const constants = readFileSync(join(repoRoot, "src/core/constants.js"), "utf8"), normalizeStart = constants.indexOf("function normalizeCarNum"), normalizeEnd = constants.indexOf("function assertPageInfoContract", normalizeStart);
    const model = readFileSync(join(repoRoot, "src/core/state-model.js"), "utf8"), service = readFileSync(join(repoRoot, "src/core/state-service.js"), "utf8"), serviceEnd = service.indexOf("const stateService");
    const context = vm.createContext({ d: "filter", h: "favorite", g: "hasDown", p: "hasWatch", Date, Object, Array, Map, Set, JSON, Math, window: { location: { href: "https://javdb.example/v/1" } }, crypto: { randomUUID: vi.fn().mockImplementation((() => `id-${Math.random()}`)) }, utils: { getNowStr: () => "2026-08-22 12:00:00" } });
    vm.runInContext(`${constants.slice(normalizeStart, normalizeEnd)}\n${model}\n${service.slice(0, serviceEnd)}; globalThis.StateServiceClass = StateService;`, context);
    return context.StateServiceClass;
}

function createHarness(initial = {}) {
    const data = new Map(Object.entries(initial)), storage = {
        car_list_key: "car_list", favorite_actresses_key: "favorite_actresses",
        forage: {
            getItem: vi.fn(async key => data.get(key)),
            setItem: vi.fn(async (key, value) => data.set(key, value)),
            removeItem: vi.fn(async key => data.delete(key))
        },
        _setItemAndInvalidate: vi.fn(async (key, value) => data.set(key, value)),
        _invalidateCache: vi.fn(),
        getCar: vi.fn(async carNum => (data.get("car_list") || []).find(item => item.carNum === carNum))
    }, eventBus = { emit: vi.fn(async () => {}) }, StateService = loadStateService();
    return { service: new StateService(storage, eventBus), storage, eventBus, data };
}

describe("StateService durable transactions", () => {
    it("commits car state, activity, new-video removal and decision cleanup once", async () => {
        const { service, data, eventBus } = createHarness({
            car_list: [],
            favorite_actresses: [{ starId: "a", newVideoList: [{ carNum: "abc-123", title: "A" }] }],
            new_video_decisions: { "ABC-123": { action: "snoozed" } }
        });
        const first = await service.patch("abc_123", { favorite: true }, { record: { names: "Actor" } });
        expect(first.changed).toEqual(["ABC-123"]);
        expect(data.get("car_list")[0]).toMatchObject({ carNum: "ABC-123", status: "favorite", stateFlags: { favorite: true } });
        expect(data.get("favorite_actresses")[0].newVideoList).toEqual([]);
        expect(data.get("new_video_decisions")).toEqual({});
        expect(data.get("activity_log").entries).toHaveLength(1);
        expect(data.has("mutation_journal")).toBe(false);
        await service.patch("ABC-123", { favorite: true });
        expect(data.get("activity_log").entries).toHaveLength(1);
        expect(eventBus.emit).toHaveBeenCalledWith("car-state-changed", expect.anything());
    });

    it("persists explicit history metadata edits even when flags do not change", async () => {
        const { service, data } = createHarness({ car_list: [{ carNum: "ABC-1", names: "Old", remark: "old", stateFlags: { favorite: true }, status: "favorite" }] });
        await service.patch("ABC-1", { favorite: true }, { type: "history-edit", replaceMetadata: true, record: { names: "New", remark: "" } });
        expect(data.get("car_list")[0]).toMatchObject({ names: "New", remark: "", stateFlags: { favorite: true } });
        expect(data.get("activity_log").entries[0].changes[0].fields).toEqual([ "names", "remark" ]);
    });

    it.each([
        [ "prepared", false, false, false, false ],
        [ "car-list written", true, false, false, false ],
        [ "pending activity written", true, true, false, false ],
        [ "actress effects written", true, true, true, false ],
        [ "decision effects written", true, true, true, true ]
    ])("rolls back an interruption after %s", async (label, carWritten, activityWritten, actressesWritten, decisionsWritten) => {
        const before = { carList: [{ carNum: "ABC-1" }], actresses: [{ starId: "a", newVideoList: ["ABC-1"] }], decisions: { "ABC-1": { action: "ignored" } }, activity: { entries: [] } };
        const after = { carList: [{ carNum: "ABC-1", changed: true }], actresses: [{ starId: "a", newVideoList: [] }], decisions: {}, activity: { entries: [{ id: "tx", commitState: "pending", createdAt: "2026-08-22" }] } };
        const { service, data } = createHarness({ car_list: carWritten ? after.carList : before.carList, favorite_actresses: actressesWritten ? after.actresses : before.actresses, new_video_decisions: decisionsWritten ? after.decisions : before.decisions, activity_log: activityWritten ? after.activity : before.activity, mutation_journal: { id: "tx", before, after } });
        await service.recoverPendingTransaction();
        expect(data.get("car_list")).toEqual(before.carList);
        expect(data.get("favorite_actresses")).toEqual(before.actresses);
        expect(data.get("new_video_decisions")).toEqual(before.decisions);
        expect(data.get("activity_log").entries).toEqual([]);
        expect(data.has("mutation_journal")).toBe(false);
    });

    it("rolls a committed journal forward and retains a conflicting journal", async () => {
        const before = { carList: [], actresses: [], decisions: {}, activity: { entries: [] } }, after = { carList: [{ carNum: "ABC-1" }], actresses: [], decisions: {}, activity: { entries: [] } };
        const committed = createHarness({ car_list: before.carList, favorite_actresses: [], new_video_decisions: {}, activity_log: { entries: [{ id: "tx", commitState: "committed", createdAt: "2026-08-22" }] }, mutation_journal: { id: "tx", before, after } });
        await committed.service.recoverPendingTransaction();
        expect(committed.data.get("car_list")).toEqual(after.carList);

        const conflict = createHarness({ car_list: [{ carNum: "OTHER" }], favorite_actresses: [], new_video_decisions: {}, activity_log: { entries: [] }, mutation_journal: { id: "tx", before, after } });
        await expect(conflict.service.recoverPendingTransaction()).rejects.toThrow("数据已发生冲突");
        expect(conflict.data.has("mutation_journal")).toBe(true);
    });

    it("records partial undo and restores only unchanged state/new-video effects", async () => {
        const { service, data } = createHarness({ car_list: [], favorite_actresses: [{ starId: "a", newVideoList: ["ABC-1", "ABC-2"] }], new_video_decisions: {} });
        const transaction = await service.patch(["ABC-1", "ABC-2"], { downloaded: true });
        data.get("car_list").find(item => item.carNum === "ABC-2").stateFlags.downloaded = false;
        const result = await service.undoTransaction(transaction.transactionId);
        expect(result.reverted).toEqual(["ABC-1"]);
        expect(result.conflicts).toEqual(["ABC-2"]);
        expect(data.get("favorite_actresses")[0].newVideoList).toContain("ABC-1");
        const changes = data.get("activity_log").entries[0].changes;
        expect(changes.map(change => change.undoState)).toEqual(["reverted", "conflict"]);
    });
});
