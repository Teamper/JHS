import { describe, expect, it, vi } from "vitest";
import { StateService } from "../src/core/state-service.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { storageFromForage } from "./helpers/atomic-storage.js";

function createHarness(initial = {}, mutationCoordinator = null, diagnosticConsole = console, uiDiagnostics = {}) {
    const data = new Map(Object.entries(structuredClone(initial)));
    const forage = {
        getItem: vi.fn(async key => structuredClone(data.get(key))),
        setItem: vi.fn(async (key, value) => data.set(key, structuredClone(value))),
        removeItem: vi.fn(async key => data.delete(key)),
    };
    const storage = storageFromForage(forage), eventBus = { emit: vi.fn(async () => {}) };
    const coordinator = mutationCoordinator ?? new StorageMutationCoordinator({ lockManager: null });
    const service = new StateService(storage, eventBus, coordinator, {
        now: () => "2026-08-22 12:00:00", currentUrl: () => "https://javdb.example/v/1", origin: () => "https://javdb.example",
        logger: uiDiagnostics.clog ?? diagnosticConsole, notifications: uiDiagnostics.show,
    });
    return { service, forage, eventBus, data };
}

describe("StateService durable transactions", () => {
    it("confirms only the matching ambiguous offline attempt without adding a second history entry", async () => {
        const { service, eventBus } = createHarness();
        const record = await service.appendOfflineHistory({ id: "pending-1", providerId: "115", resource: "magnet:test",
            carNum: "ABC-1", status: "pending", submissionOutcome: "unknown", errorCode: "TIMEOUT" });
        await expect(service.confirmOfflineSubmission({ attemptId: record.id, providerId: "123", resource: record.resource })).resolves.toBe(false);
        const attempt = { attemptId: record.id, providerId: record.providerId, resource: record.resource };
        await expect(service.confirmOfflineSubmission(attempt)).resolves.toBe(true);
        await expect(service.confirmOfflineSubmission(attempt)).resolves.toBe(false);
        const history = await service.getOfflineHistory();
        expect(history).toHaveLength(1);
        expect(history[0]).toMatchObject({ id: record.id, createdAt: record.createdAt, status: "submitted", submissionOutcome: "exists" });
        expect(history[0]).not.toHaveProperty("errorCode");
        expect(eventBus.emit).toHaveBeenLastCalledWith("offline-history-changed", { ids: [record.id] }, { broadcastFirst: true });
    });

    it("adds known cast without replacing legacy names and reverts cast additions with the mark", async () => {
        const { service } = createHarness();
        await service.patch("ABC-1", { favorite: true }, { record: { names: "既有演员", remark: "旧备注" } });
        const options = { keepExistingNames: true };
        const marked = await service.patch(["ABC-1"], { watched: true }, { ...options,
            records: [{ carNum: "ABC-1", names: "作品原题", title: "作品原题", actorNames: [" 新演员 ", "", "新演员"] }],
        });
        expect(await service.getState("ABC-1")).toMatchObject({
            names: "既有演员", title: "作品原题", actorNames: ["新演员"], remark: "旧备注",
            stateFlags: { favorite: true, watched: true },
        });
        await expect(service.patch("ABC-1", {}, { record: { actorNames: ["新演员"] } }))
            .resolves.toEqual({ changed: [], transactionId: null });
        const another = await service.patch("ABC-1", { downloaded: true }, { record: { actorNames: ["新演员", "另一演员"] } });
        expect((await service.getState("ABC-1")).actorNames).toEqual(["新演员", "另一演员"]);
        await service.undoTransaction(another.transactionId);
        expect((await service.getState("ABC-1")).actorNames).toEqual(["新演员"]);
        await service.undoTransaction(marked.transactionId);
        const restored = await service.getState("ABC-1");
        expect(restored).toMatchObject({ names: "既有演员", remark: "旧备注", stateFlags: { favorite: true, watched: false } });
        expect(restored).not.toHaveProperty("actorNames");
        expect(restored).not.toHaveProperty("title");
    });

    it("updates existing batch targets without resurrecting a deleted record", async () => {
        const { service } = createHarness();
        await service.patch(["ABC-1", "ABC-2"], { favorite: true });
        await service.remove("ABC-1");

        const update = await service.patch(["ABC-1", "ABC-2"], { downloaded: true }, { existingOnly: true });
        expect(update.changed).toEqual(["ABC-2"]);
        expect(await service.getState("ABC-1")).toBeFalsy();
        expect((await service.getState("ABC-2")).stateFlags.downloaded).toBe(true);
        await service.undoTransaction(update.transactionId);
        expect(await service.getState("ABC-1")).toBeFalsy();
        expect((await service.getState("ABC-2")).stateFlags.downloaded).toBe(false);
    });

    it("can save a personal flag independently of the new-work queue and undo each action", async () => {
        const { service, data } = createHarness({
            car_list: [],
            favorite_actresses: [{ starId: "a", newVideoList: ["ABC-1"] }],
        });
        const flag = await service.toggle("ABC-1", "favorite", { preserveNewVideo: true });
        expect(data.get("favorite_actresses")[0].newVideoList).toEqual(["ABC-1"]);
        const decision = await service.setNewVideoDecision("ABC-1", "dismissed");
        expect(data.get("new_video_decisions")["ABC-1"].action).toBe("dismissed");
        await service.undoTransaction(decision.transactionId);
        expect(data.get("new_video_decisions")["ABC-1"]).toBeUndefined();
        expect(data.get("car_list")[0].stateFlags.favorite).toBe(true);
        await service.undoTransaction(flag.transactionId);
        expect(data.get("favorite_actresses")[0].newVideoList).toEqual(["ABC-1"]);
    });

    it("does not rewrite unrelated new-work domains for a movie absent from those domains", async () => {
        const f = createHarness({ car_list: [], favorite_actresses: [{ starId: "actor-1", newVideoList: [{ carNum: "OTHER-1" }] }], new_video_decisions: { "OTHER-1": { action: "dismissed" } }, activity_log: { entries: [] } });
        await f.service.patch("ABC-123", { favorite: true });
        const writes = f.forage.setItem.mock.calls.map(([key]) => key);
        expect(writes).toContain("car_list");
        expect(writes).not.toContain("favorite_actresses");
        expect(writes).not.toContain("new_video_decisions");
        expect(f.data.get("favorite_actresses")).toEqual([{ starId: "actor-1", newVideoList: [{ carNum: "OTHER-1" }] }]);
    });

    it("reads persisted actress records and indexes movies", async () => {
        const { service, forage } = createHarness({ favorite_actresses: [{ starId: "actor-1" }], car_list: [{ carNum: "ABC-123" }] });
        await expect(service.getFavoriteActressList()).resolves.toEqual([{ starId: "actor-1" }]);
        await expect(service.getCarMap()).resolves.toEqual(new Map([["ABC-123", { carNum: "ABC-123" }]]));
        expect(forage.getItem.mock.calls).toEqual([["favorite_actresses"], ["car_list"]]);
    });

    it("updates an actress queue inside the shared mutation coordinator", async () => {
        const coordinator = new StorageMutationCoordinator({ lockManager: null });
        const lock = vi.spyOn(coordinator, "runExclusive");
        const { service, data } = createHarness({ favorite_actresses: [{ starId: "actor-1", newVideoList: ["ABC-123"] }] }, coordinator);
        await expect(service.updateFavoriteActress({ starId: "actor-1", newVideoList: [] })).resolves.toBe(true);
        expect(data.get("favorite_actresses")[0].newVideoList).toEqual([]);
        expect(lock).toHaveBeenCalledOnce();
    });

    it("reads the persisted blacklist records", async () => {
        const { service, forage } = createHarness({ blacklist: [{ starId: "actor-1" }] });
        await expect(service.getBlacklist()).resolves.toEqual([{ starId: "actor-1" }]);
        expect(forage.getItem).toHaveBeenCalledExactlyOnceWith("blacklist");
    });

    it("removes the actor and their blocked records without altering other actors", async () => {
        const kept = { starId: "actor-2", carNum: "ABC-3" };
        const { service, data } = createHarness({ blacklist: [{ starId: "actor-1" }, { starId: "actor-2" }],
            blacklist_car_list: [{ starId: "actor-1", carNum: "ABC-1" }, { starId: "actor-1", carNum: "ABC-2" }, kept] });
        await expect(service.removeBlacklistActor("actor-1")).resolves.toEqual({ removedActor: true, removedCarRecords: 2 });
        expect(data.get("blacklist")).toEqual([{ starId: "actor-2" }]);
        expect(data.get("blacklist_car_list")).toEqual([kept]);
    });

    it("saves canonical blacklist records and updates the actor's scan evidence", async () => {
        const { service, data } = createHarness({ blacklist: [{ starId: "actor-1" }] });
        await expect(service.batchSaveBlacklistCarList([{ carNum: "abc_1", url: "/v/1", actionType: "filter", starId: "actor-1" }])).resolves.toEqual({ changed: ["ABC-1"] });
        await service.updateBlacklistItem({ starId: "actor-1", checkTime: "2026-09-27" });
        expect(data.get("blacklist_car_list")).toMatchObject([{ carNum: "ABC-1", status: "filter", starId: "actor-1" }]);
        expect(data.get("blacklist")).toEqual([{ starId: "actor-1", checkTime: "2026-09-27" }]);
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
        const { service, forage, data, eventBus } = createHarness({ car_list: [] }, coordinator);
        eventBus.emit.mockRejectedValue(new Error("channel closed"));
        await expect(service.patch("ABC-1", { favorite: true })).resolves.toMatchObject({ changed: [ "ABC-1" ] });
        expect(coordinator.runExclusive).toHaveBeenCalledOnce();
        expect(data.get("car_list")[0].stateFlags.favorite).toBe(true);
        const journal = forage.setItem.mock.calls.find(([ key ]) => key === "mutation_journal")?.[1];
        expect(journal).toMatchObject({ schema: 2, state: "prepared", touchedDomains: [ "carList", "activity" ] });
        expect(Object.keys(journal.before)).toEqual([ "carList", "activity" ]);
    });
    it.each(["mutation_journal", "car_list", "favorite_actresses", "new_video_decisions", "activity_log", "journal-clear"])("recovers an undo failure at %s without losing retry eligibility", async stage => {
        const { service, forage, data } = createHarness({ car_list: [{ carNum: "ABC-1", stateFlags: {}, status: "" }], favorite_actresses: [{ starId: "a", newVideoList: ["ABC-1"] }], new_video_decisions: { "ABC-1": { action: "snoozed" } } });
        const result = await service.patch("ABC-1", { favorite: true }), before = structuredClone(Object.fromEntries(data));
        let failed = false;
        const write = async (key, value) => { if (!failed && key === stage) { failed = true; throw new Error("injected undo failure"); } data.set(key, value); };
        forage.setItem.mockImplementation(write);
        forage.removeItem.mockImplementation(async key => { if (!failed && stage === "journal-clear") { failed = true; throw new Error("injected undo failure"); } data.delete(key); });
        await expect(service.undoTransaction(result.transactionId)).rejects.toThrow("injected undo failure");
        await service.recoverPendingTransaction();
        expect(Object.fromEntries(data)).toEqual(before);
        expect((await service.undoTransaction(result.transactionId)).reverted).toEqual(["ABC-1"]);
    });
    it("restores undo eligibility when the activity write fails", async () => {
        const { service, data, forage } = createHarness({ car_list: [{ carNum: "ABC-1", stateFlags: {}, status: "" }] });
        const result = await service.patch("ABC-1", { favorite: true });
        let failed = false;
        forage.setItem.mockImplementation(async (key, value) => {
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
        expect(eventBus.emit).toHaveBeenCalledWith("car-state-changed", expect.anything(), { broadcastFirst: true });
    });

    it("rolls back every touched domain when actresses fail after pending activity", async () => {
        const before = {
            car_list: [{ carNum: "ABC-1", stateFlags: {}, status: "" }],
            favorite_actresses: [{ starId: "a", newVideoList: ["ABC-1"] }],
            new_video_decisions: { "ABC-1": { action: "ignored" } },
            activity_log: { entries: [] },
        };
        const { service, data, forage } = createHarness(before);
        let failed = false;
        forage.setItem.mockImplementation(async (key, value) => {
            if (!failed && key === "favorite_actresses") { failed = true; throw new Error("actress write failed"); }
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
        conflict.forage.setItem.mockImplementation(async (key, value) => {
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
        conflict.forage.setItem.mockImplementation(async (key, value) => {
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
        const { service, data, forage } = createHarness({ car_list: [{ carNum: "ABC-1", stateFlags: { downloaded: false }, status: "" }], favorite_actresses: [], new_video_decisions: {} });
        const transaction = await service.patch("ABC-1", { downloaded: true });
        data.get("car_list")[0].stateFlags.downloaded = false;
        const journals = [];
        forage.setItem.mockImplementation(async (key, value) => {
            if (key === "mutation_journal") journals.push(value);
            data.set(key, value);
        });
        await service.undoTransaction(transaction.transactionId);
        expect(journals[0].touchedDomains).toEqual(["activity"]);
    });
});

it("undoes only the initial flag when a created movie acquired later state and metadata", async () => {
    const { service, data } = createHarness({ car_list: [], favorite_actresses: [{ starId: "a", newVideoList: ["ABC-123"] }], new_video_decisions: {} });
    const first = await service.patch("ABC-123", { favorite: true });
    await service.patch("ABC-123", { downloaded: true }, { record: { carNum: "ABC-123", remark: "later" } });
    expect(await service.undoTransaction(first.transactionId)).toMatchObject({ reverted: ["ABC-123"], conflicts: [] });
    expect(data.get("car_list")[0]).toMatchObject({ remark: "later", stateFlags: { favorite: false, downloaded: true } });
    expect(data.get("favorite_actresses")[0].newVideoList).toEqual([]);
});

it("keeps a later handled movie out of pending work when undoing manual removal", async () => {
    const {service,data}=createHarness({car_list:[],favorite_actresses:[{starId:"a",newVideoList:["ABC-123"]}],new_video_decisions:{}});
    const removed=await service.removeFromNewVideoList("ABC-123");
    await service.patch("ABC-123",{downloaded:true});
    expect(await service.undoTransaction(removed.transactionId)).toMatchObject({reverted:["ABC-123"],conflicts:[]});
    expect(data.get("favorite_actresses")[0].newVideoList).toEqual([]);
    expect(data.get("car_list")[0].stateFlags.downloaded).toBe(true);
});
