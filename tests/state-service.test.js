import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadStateService() {
    const constants = readTestFile(join(repoRoot, "src/core/constants.js"), "utf8"), normalizeStart = constants.indexOf("function normalizeCarNum"), normalizeEnd = constants.indexOf("function assertPageInfoContract", normalizeStart);
    const model = readTestFile(join(repoRoot, "src/core/state-model.js"), "utf8"), service = readTestFile(join(repoRoot, "src/core/state-service.js"), "utf8"), serviceEnd = service.indexOf("function attachStateServiceCompatibility");
    const context = vm.createContext({ d: "filter", h: "favorite", g: "hasDown", p: "hasWatch", Date, Object, Array, Map, Set, JSON, Math, TextEncoder, Uint8Array, window: { location: { href: "https://javdb.example/v/1" } }, crypto: { subtle: webcrypto.subtle, randomUUID: vi.fn().mockImplementation((() => `id-${Math.random()}`)) }, utils: { getNowStr: () => "2026-08-22 12:00:00" }, clog: { warn: vi.fn(), error: vi.fn(), log: vi.fn() }, show: { info: vi.fn(), error: vi.fn(), ok: vi.fn() } });
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
            favorite_actresses: [{ starId: "a", lastPublishTime: "2026-08-20", newVideoList: [{ carNum: "abc-123", title: "A" }] }],
            new_video_decisions: { "ABC-123": { action: "snoozed" } }
        });
        const first = await service.patch("abc_123", { favorite: true }, { record: { names: "Actor" } });
        expect(first.changed).toEqual(["ABC-123"]);
        expect(data.get("car_list")[0]).toMatchObject({ carNum: "ABC-123", status: "favorite", stateFlags: { favorite: true } });
        expect(data.get("favorite_actresses")[0].newVideoList).toEqual([]);
        expect(data.get("favorite_actresses")[0].lastPublishTime).toBe("2026-08-20");
        expect(data.get("new_video_decisions")).toEqual({});
        expect(data.get("activity_log").entries).toHaveLength(1);
        expect(data.has("mutation_journal")).toBe(false);
        await service.patch("ABC-123", { favorite: true });
        expect(data.get("activity_log").entries).toHaveLength(1);
        expect(eventBus.emit).toHaveBeenCalledWith("car-state-changed", expect.anything());
    });

    it("rolls back every touched domain when actresses fail after pending activity", async () => {
        const before = {
            car_list: [{ carNum: "ABC-1", stateFlags: {}, status: "" }],
            favorite_actresses: [{ starId: "a", newVideoList: ["ABC-1"] }],
            new_video_decisions: { "ABC-1": { action: "ignored" } },
            activity_log: { entries: [] },
        };
        const { service, data, storage } = createHarness(before);
        let writes = 0;
        storage._setItemAndInvalidate = vi.fn(async (key, value) => {
            writes += 1;
            if (writes === 2) throw new Error("actress write failed");
            data.set(key, value);
        });
        await expect(service.patch("ABC-1", { favorite: true })).rejects.toThrow("actress write failed");
        expect(data.get("car_list")).toEqual(before.car_list);
        expect(data.get("favorite_actresses")).toEqual(before.favorite_actresses);
        expect(data.get("new_video_decisions")).toEqual(before.new_video_decisions);
        expect(data.get("activity_log").entries).toEqual(before.activity_log.entries);
        expect(data.has("mutation_journal")).toBe(false);
    });

    it("persists explicit history metadata edits even when flags do not change", async () => {
        const { service, data } = createHarness({ car_list: [{ carNum: "ABC-1", names: "Old", remark: "old", stateFlags: { favorite: true }, status: "favorite" }] });
        await service.patch("ABC-1", { favorite: true }, { type: "history-edit", replaceMetadata: true, record: { names: "New", remark: "" } });
        expect(data.get("car_list")[0]).toMatchObject({ names: "New", remark: "", stateFlags: { favorite: true } });
        expect(data.get("activity_log").entries[0].changes[0].fields).toEqual([ "names", "remark" ]);
    });

    it("persists only a valid explicit FC2 source without migrating old records", async () => {
        const { service, data } = createHarness({ car_list: [], favorite_actresses: [], new_video_decisions: {} });
        await service.patch("FC2-123", { favorite: true }, { record: { url: "https://mirror.example/video/123", fc2Source: "123av" } });
        expect(data.get("car_list")[0]).toMatchObject({ carNum: "FC2-123", fc2Source: "123av" });
        await service.patch("FC2-456", { favorite: true }, { record: { fc2Source: "unknown" } });
        expect(data.get("car_list")[1]).not.toHaveProperty("fc2Source");
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

    it("rolls a committed journal forward and archives a conflicting journal", async () => {
        const before = { carList: [], actresses: [], decisions: {}, activity: { entries: [] } }, after = { carList: [{ carNum: "ABC-1" }], actresses: [], decisions: {}, activity: { entries: [] } };
        const committed = createHarness({ car_list: before.carList, favorite_actresses: [], new_video_decisions: {}, activity_log: { entries: [{ id: "tx", commitState: "committed", createdAt: "2026-08-22" }] }, mutation_journal: { id: "tx", before, after } });
        await committed.service.recoverPendingTransaction();
        expect(committed.data.get("car_list")).toEqual(after.carList);

        const conflict = createHarness({ car_list: [{ carNum: "OTHER" }], favorite_actresses: [], new_video_decisions: {}, activity_log: { entries: [] }, mutation_journal: { id: "tx", before, after } });
        // 冲突时保守策略：保留当前（更新的）数据，丢弃陈旧事务日志，不抛错以免阻塞整个脚本启动
        await expect(conflict.service.recoverPendingTransaction()).resolves.toBe(true);
        expect(conflict.data.get("car_list")).toEqual([{ carNum: "OTHER" }]);
        expect(conflict.data.has("mutation_journal")).toBe(false);
        expect(conflict.data.get("mutation_journal_conflicts")).toHaveLength(1);
        expect(conflict.data.get("mutation_journal_conflicts")[0].currentStateHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("dismisses new videos without creating car-list pollution and can undo", async () => {
        const { service, data } = createHarness({ car_list: [], favorite_actresses: [{ starId: "a", newVideoList: ["ABC-1"] }], new_video_decisions: {} });
        const result = await service.removeFromNewVideoList("ABC-1");
        expect(data.get("car_list")).toEqual([]);
        expect(data.get("new_video_decisions")["ABC-1"]).toMatchObject({ action: "dismissed", until: null });
        expect(data.get("favorite_actresses")[0].newVideoList).toEqual([]);
        await service.undoTransaction(result.transactionId);
        expect(data.get("car_list")).toEqual([]);
        expect(data.get("new_video_decisions")).toEqual({});
        expect(data.get("favorite_actresses")[0].newVideoList).toEqual(["ABC-1"]);
    });

    it("retains the active journal when conflict evidence cannot be archived", async () => {
        const before = { carList: [], actresses: [], decisions: {}, activity: { entries: [] } }, after = { carList: [{ carNum: "ABC-1" }], actresses: [], decisions: {}, activity: { entries: [] } };
        const conflict = createHarness({ car_list: [{ carNum: "OTHER" }], favorite_actresses: [], new_video_decisions: {}, activity_log: { entries: [] }, mutation_journal: { id: "tx", before, after } });
        conflict.storage.forage.setItem.mockImplementation(async (key, value) => {
            if (key === "mutation_journal_conflicts") throw new Error("archive unavailable");
            conflict.data.set(key, value);
        });
        await expect(conflict.service.recoverPendingTransaction()).rejects.toThrow("archive unavailable");
        expect(conflict.data.has("mutation_journal")).toBe(true);
    });

    it("caps conflict archives at twenty entries", async () => {
        const before = { carList: [], actresses: [], decisions: {}, activity: { entries: [] } }, after = { carList: [{ carNum: "ABC-1" }], actresses: [], decisions: {}, activity: { entries: [] } };
        const archives = Array.from({ length: 20 }, ((_, index) => ({ id: index })));
        const conflict = createHarness({ car_list: [{ carNum: "OTHER" }], favorite_actresses: [], new_video_decisions: {}, activity_log: { entries: [] }, mutation_journal_conflicts: archives, mutation_journal: { id: "tx", before, after } });
        await conflict.service.recoverPendingTransaction();
        expect(conflict.data.get("mutation_journal_conflicts")).toHaveLength(20);
        expect(conflict.data.get("mutation_journal_conflicts")[0].id).toBe(1);
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

    it("journals only domains actually changed by a conflicted undo", async () => {
        const { service, data } = createHarness({ car_list: [{ carNum: "ABC-1", stateFlags: { downloaded: false }, status: "" }], favorite_actresses: [], new_video_decisions: {} });
        const transaction = await service.patch("ABC-1", { downloaded: true });
        data.get("car_list")[0].stateFlags.downloaded = false;
        const journals = [];
        service.storage.forage.setItem = vi.fn(async (key, value) => {
            if (key === "mutation_journal") journals.push(value);
            data.set(key, value);
        });
        await service.undoTransaction(transaction.transactionId);
        expect(journals[0].touchedDomains).toEqual(["activity"]);
    });
});
