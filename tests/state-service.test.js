import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadStateService(diagnosticConsole = console, uiDiagnostics = {}) {
    const constants = readTestFile(join(repoRoot, "src/core/constants.js"), "utf8"), normalizeStart = constants.indexOf("function normalizeCarNum"), normalizeEnd = constants.indexOf("function assertPageInfoContract", normalizeStart);
    const model = readTestFile(join(repoRoot, "src/core/state-model.js"), "utf8"), domains = readTestFile(join(repoRoot, "src/core/state-domains.js"), "utf8"), service = readTestFile(join(repoRoot, "src/core/state-service.js"), "utf8"), serviceEnd = service.indexOf("function attachStateServiceCompatibility");
    const context = vm.createContext({ d: "filter", h: "favorite", g: "hasDown", p: "hasWatch", Date, Object, Array, Map, Set, JSON, Math, TextEncoder, Uint8Array, console: diagnosticConsole, window: { location: { href: "https://javdb.example/v/1" } }, crypto: { subtle: webcrypto.subtle, randomUUID: vi.fn().mockImplementation((() => `id-${Math.random()}`)) }, utils: { getNowStr: () => "2026-08-22 12:00:00" }, clog: uiDiagnostics.clog ?? { warn: vi.fn(), error: vi.fn(), log: vi.fn() }, show: uiDiagnostics.show ?? { info: vi.fn(), error: vi.fn(), ok: vi.fn() } });
    vm.runInContext(`${constants.slice(normalizeStart, normalizeEnd)}\n${model}\n${domains}\n${service.slice(0, serviceEnd)}; globalThis.StateServiceClass = StateService;`, context);
    return context.StateServiceClass;
}

function createHarness(initial = {}, mutationCoordinator = null, diagnosticConsole = console, uiDiagnostics = {}) {
    const data = new Map(Object.entries(initial)), storage = {
        car_list_key: "car_list", favorite_actresses_key: "favorite_actresses",
        forage: {
            getItem: vi.fn(async key => data.get(key)),
            setItem: vi.fn(async (key, value) => data.set(key, value)),
            removeItem: vi.fn(async key => data.delete(key))
        },
        _setItemAndInvalidate: vi.fn(async (key, value) => data.set(key, value)),
        _invalidateCache: vi.fn(),
        getBlacklist: vi.fn(async () => data.get("blacklist") || []),
        batchSaveBlacklistCarList: vi.fn(async records => ({ records: records.length })),
        updateBlacklistItem: vi.fn(async update => update),
        removeBlacklistActor: vi.fn(async starId => ({ removedActor: starId === "actor-1", removedCarRecords: 2 })),
        getCar: vi.fn(async carNum => (data.get("car_list") || []).find(item => item.carNum === carNum))
    }, eventBus = { emit: vi.fn(async () => {}) }, StateService = loadStateService(diagnosticConsole, uiDiagnostics);
    return { service: new StateService(storage, eventBus, mutationCoordinator), storage, eventBus, data };
}

describe("StateService durable transactions", () => {
    it("exposes established actress and movie-map reads through its domain boundary", async () => {
        const { service, storage } = createHarness();
        storage.getFavoriteActressList = vi.fn(async () => [{ starId: "actor-1" }]);
        storage.getCarMap = vi.fn(async () => new Map([["ABC-123", { carNum: "ABC-123" }]]));

        await expect(service.getFavoriteActressList()).resolves.toEqual([{ starId: "actor-1" }]);
        await expect(service.getCarMap()).resolves.toEqual(new Map([["ABC-123", { carNum: "ABC-123" }]]));
        expect(storage.getFavoriteActressList).toHaveBeenCalledOnce();
        expect(storage.getCarMap).toHaveBeenCalledOnce();
    });
    it("routes new-video actress-record updates through StorageManager's mutation boundary", async () => {
        const { service, storage } = createHarness();
        storage.updateFavoriteActress = vi.fn(async (update) => ({ saved: update.starId }));

        await expect(service.updateFavoriteActress({ starId: "actor-1", newVideoList: [] })).resolves.toEqual({ saved: "actor-1" });
        expect(storage.updateFavoriteActress).toHaveBeenCalledWith({ starId: "actor-1", newVideoList: [] });
    });
    it("exposes the established blacklist read through the StateService boundary", async () => {
        const { service, storage } = createHarness({ blacklist: [{ starId: "actor-1" }] });
        await expect(service.getBlacklist()).resolves.toEqual([{ starId: "actor-1" }]);
        expect(storage.getBlacklist).toHaveBeenCalledOnce();
    });
    it("routes blacklist actor deletion through the coordinated storage operation", async () => {
        const { service, storage } = createHarness();
        await expect(service.removeBlacklistActor("actor-1")).resolves.toEqual({ removedActor: true, removedCarRecords: 2 });
        expect(storage.removeBlacklistActor).toHaveBeenCalledWith("actor-1");
    });
    it("routes blacklist page commits through the StateService boundary", async () => {
        const { service, storage } = createHarness(), records = [{ carNum: "A-1" }], update = { starId: "actor-1", checkTime: "2026-09-27" };
        await expect(service.batchSaveBlacklistCarList(records)).resolves.toEqual({ records: 1 });
        await expect(service.updateBlacklistItem(update)).resolves.toEqual(update);
        expect(storage.batchSaveBlacklistCarList).toHaveBeenCalledWith(records);
        expect(storage.updateBlacklistItem).toHaveBeenCalledWith(update);
    });
    it("keeps a persisted offline success when broadcasting the history update fails", async () => {
        const {service,eventBus,data}=createHarness();
        eventBus.emit.mockRejectedValueOnce(new Error("channel closed"));
        await expect(service.appendOfflineHistory({id:"submitted-1",carNum:"ABC-1",status:"submitted"})).resolves.toMatchObject({id:"submitted-1",status:"submitted"});
        expect(data.get("offline_history")).toHaveLength(1);
    });
    it("does not turn a committed history write into failure when the fallback warning throws", async () => {
        const warning = { warn: vi.fn(() => { throw new Error("console unavailable"); }) };
        const { service, eventBus, data } = createHarness({}, null, warning);
        eventBus.emit.mockRejectedValue(new Error("channel closed"));

        await expect(service.appendOfflineHistory({ id: "submitted-1", carNum: "ABC-1", status: "submitted" })).resolves.toMatchObject({ id: "submitted-1" });
        expect(data.get("offline_history")).toHaveLength(1);
        expect(warning.warn).toHaveBeenCalledOnce();
    });
    it("keeps a committed state patch successful when the shared mutation lock is injected", async () => {
        const coordinator = { runExclusive: vi.fn(async (operation) => operation()) };
        const { service, storage, data, eventBus } = createHarness({ car_list: [] }, coordinator);
        eventBus.emit.mockRejectedValue(new Error("channel closed"));
        await expect(service.patch("ABC-1", { favorite: true })).resolves.toMatchObject({ changed: [ "ABC-1" ] });
        expect(coordinator.runExclusive).toHaveBeenCalledOnce();
        expect(data.get("car_list")[0].stateFlags.favorite).toBe(true);
        const journal = storage.forage.setItem.mock.calls.find(([ key ]) => key === "mutation_journal")?.[1];
        expect(journal).toMatchObject({ schema: 2, state: "prepared", touchedDomains: [ "carList", "actresses", "decisions", "activity" ] });
        expect(Object.keys(journal.before)).toEqual([ "carList", "actresses", "decisions", "activity" ]);
    });
    it.each(["mutation_journal", "car_list", "favorite_actresses", "new_video_decisions", "activity_log", "journal-clear"])("recovers an undo failure at %s without losing retry eligibility", async stage => {
        const { service, storage, data } = createHarness({ car_list: [{ carNum: "ABC-1", stateFlags: {}, status: "" }], favorite_actresses: [{ starId: "a", newVideoList: ["ABC-1"] }], new_video_decisions: { "ABC-1": { action: "snoozed" } } });
        const result = await service.patch("ABC-1", { favorite: true }), before = structuredClone(Object.fromEntries(data));
        let failed = false;
        const write = async (key, value) => { if (!failed && key === stage) { failed = true; throw new Error("injected undo failure"); } data.set(key, value); };
        storage.forage.setItem.mockImplementation(write); storage._setItemAndInvalidate.mockImplementation(write);
        storage.forage.removeItem.mockImplementation(async key => { if (!failed && stage === "journal-clear") { failed = true; throw new Error("injected undo failure"); } data.delete(key); });
        await expect(service.undoTransaction(result.transactionId)).rejects.toThrow("injected undo failure");
        await service.recoverPendingTransaction();
        expect(Object.fromEntries(data)).toEqual(before);
        expect((await service.undoTransaction(result.transactionId)).reverted).toEqual(["ABC-1"]);
    });
    it("restores undo eligibility when the activity write fails", async () => {
        const { service, data, storage } = createHarness({ car_list: [{ carNum: "ABC-1", stateFlags: {}, status: "" }] });
        const result = await service.patch("ABC-1", { favorite: true });
        let failed = false;
        storage._setItemAndInvalidate.mockImplementation(async (key, value) => {
            if (!failed && key === "activity_log") { failed = true; throw new Error("activity write failed"); }
            data.set(key, value);
        });
        await expect(service.undoTransaction(result.transactionId)).rejects.toThrow("activity write failed");
        await service.recoverPendingTransaction();
        expect(data.get("car_list")[0].stateFlags.favorite).toBe(true);
        expect((await service.undoTransaction(result.transactionId)).reverted).toEqual(["ABC-1"]);
        expect(data.get("car_list")[0].stateFlags.favorite).toBe(false);
    });
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

    it.each(["log", "toast"])("keeps successful conflict archival complete when the %s diagnostic fails", async (failure) => {
        const before = { carList: [], actresses: [], decisions: {}, activity: { entries: [] } };
        const after = { carList: [{ carNum: "ABC-1" }], actresses: [], decisions: {}, activity: { entries: [] } };
        const diagnostics = {
            clog: { warn: vi.fn(() => { if (failure === "log") throw new Error("log failed"); }), error: vi.fn(), log: vi.fn() },
            show: { info: vi.fn(() => { if (failure === "toast") throw new Error("toast failed"); }), error: vi.fn(), ok: vi.fn() },
        };
        const conflict = createHarness({ car_list: [{ carNum: "OTHER" }], favorite_actresses: [], new_video_decisions: {}, activity_log: { entries: [] }, mutation_journal: { id: "tx", before, after } }, null, console, diagnostics);

        await expect(conflict.service.recoverPendingTransaction()).resolves.toBe(true);
        expect(conflict.data.get("car_list")).toEqual([{ carNum: "OTHER" }]);
        expect(conflict.data.get("mutation_journal_conflicts")).toHaveLength(1);
        expect(conflict.data.has("mutation_journal")).toBe(false);
    });

    it("preserves the original archive error and active journal when its error logger fails", async () => {
        const before = { carList: [], actresses: [], decisions: {}, activity: { entries: [] } };
        const after = { carList: [{ carNum: "ABC-1" }], actresses: [], decisions: {}, activity: { entries: [] } };
        const diagnostics = { clog: { warn: vi.fn(), error: vi.fn(() => { throw new Error("logger failed"); }), log: vi.fn() } };
        const conflict = createHarness({ car_list: [{ carNum: "OTHER" }], favorite_actresses: [], new_video_decisions: {}, activity_log: { entries: [] }, mutation_journal: { id: "tx", before, after } }, null, console, diagnostics);
        conflict.storage.forage.setItem.mockImplementation(async (key, value) => {
            if (key === "mutation_journal_conflicts") throw new Error("archive unavailable");
            conflict.data.set(key, value);
        });

        await expect(conflict.service.recoverPendingTransaction()).rejects.toThrow("archive unavailable");
        expect(conflict.data.has("mutation_journal")).toBe(true);
        expect(conflict.data.get("car_list")).toEqual([{ carNum: "OTHER" }]);
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
