// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageManager } from "../src/core/storage.js";
import { StateService } from "../src/core/state-service.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";

const copy = (value) => value == null ? value : structuredClone(value);
function fixture(initial = {}) {
    const data = new Map(Object.entries({ data_version: 3, car_list: [], favorite_actresses: [], new_video_decisions: {}, activity_log: { entries: [] }, ...initial }).map(([key, value]) => [key, copy(value)]));
    const forage = {
        getItem: vi.fn(async (key) => copy(data.get(key) ?? null)),
        setItem: vi.fn(async (key, value) => { data.set(key, copy(value)); return copy(value); }),
        removeItem: vi.fn(async (key) => data.delete(key)),
        keys: vi.fn(async () => [...data.keys()]),
    };
    vi.stubGlobal("localforage", { INDEXEDDB: "indexeddb", createInstance: () => forage });
    vi.stubGlobal("utils", { getNowStr: () => "2026-10-20 12:00:00" });
    vi.stubGlobal("clog", { log: vi.fn(), warn: vi.fn(), error: vi.fn(), html: vi.fn() });
    vi.stubGlobal("show", { info: vi.fn() });
    StorageManager.instance = null;
    const storage = new StorageManager(), coordinator = new StorageMutationCoordinator({ lockManager: null }), eventBus = { emit: vi.fn(async () => {}) };
    const state = new StateService(storage, eventBus, coordinator);
    storage.mutationCoordinator = coordinator;
    storage.stateService = state;
    return { storage, state, eventBus, data, forage };
}
afterEach(() => { StorageManager.instance = null; vi.unstubAllGlobals(); });

describe("stable identity in new-video undo", () => {
    it("does not restore a removed actress's movie into the next array member", async () => {
        const { state, data } = fixture({ favorite_actresses: [{ starId: "a", name: "A", newVideoList: ["ABC-123"] }, { starId: "b", name: "B", newVideoList: [] }] });
        const transaction = await state.removeFromNewVideoList("ABC-123");
        await state.removeFavoriteActress("a");
        await expect(state.undoTransaction(transaction.transactionId)).resolves.toEqual({ reverted: [], conflicts: ["ABC-123"] });
        expect(data.get("favorite_actresses")).toEqual([{ starId: "b", name: "B", newVideoList: [] }]);
    });

    it("restores by stable id after a public delete and re-add changes the index", async () => {
        const { state, storage, data } = fixture({ favorite_actresses: [{ starId: "a", name: "A", newVideoList: ["ABC-123"] }, { starId: "b", name: "B", newVideoList: [] }] });
        const transaction = await state.removeFromNewVideoList("ABC-123");
        await state.removeFavoriteActress("a");
        await storage.addFavoriteActressList([{ starId: "a", name: "A" }]);
        await expect(state.undoTransaction(transaction.transactionId)).resolves.toEqual({ reverted: ["ABC-123"], conflicts: [] });
        expect(data.get("favorite_actresses").map((actor) => [actor.starId, actor.newVideoList || []])).toEqual([["b", []], ["a", ["ABC-123"]]]);
    });

    it.each(["duplicate", "missing", "legacy"])("keeps ambiguous %s identity as a conflict", async (kind) => {
        const actors = [{ ...(kind === "missing" ? {} : { starId: "a" }), name: "A", newVideoList: ["ABC-123"] }];
        if (kind === "duplicate") actors.push({ starId: "a", name: "Other A", newVideoList: [] });
        const { state, data } = fixture({ favorite_actresses: actors });
        const transaction = await state.removeFromNewVideoList("ABC-123");
        if (kind === "legacy") {
            const log = data.get("activity_log");
            log.entries[0].changes[0].newVideoEffect.actressItems.forEach((entry) => delete entry.starId);
        }
        await expect(state.undoTransaction(transaction.transactionId)).resolves.toEqual({ reverted: [], conflicts: ["ABC-123"] });
        expect(data.get("favorite_actresses").every((actor) => !actor.newVideoList.length)).toBe(true);
    });

    it("keeps old state-only undo available without actress effects", async () => {
        const { state } = fixture();
        const transaction = await state.patch("ABC-123", { watched: true });
        await expect(state.undoTransaction(transaction.transactionId)).resolves.toEqual({ reverted: ["ABC-123"], conflicts: [] });
    });

    it("does not guess identity after duplicate ids at capture time are repaired", async () => {
        const { state, data, forage } = fixture({ favorite_actresses: [{ starId: "a", name: "A", newVideoList: ["ABC-123"] }, { starId: "a", name: "Other A", newVideoList: [] }] });
        const transaction = await state.removeFromNewVideoList("ABC-123");
        await forage.setItem("favorite_actresses", data.get("favorite_actresses").slice(0, 1));
        await expect(state.undoTransaction(transaction.transactionId)).resolves.toEqual({ reverted: [], conflicts: ["ABC-123"] });
        expect(data.get("favorite_actresses")[0].newVideoList).toEqual([]);
    });

    it.each([[{ actor: "a" }, "[object Object]"], [true, "true"], [NaN, "NaN"], ["   ", "   "]])("rejects malformed captured actor id %j", async (starId, replacement) => {
        const { state, data, forage } = fixture({ favorite_actresses: [{ starId, name: "A", newVideoList: ["ABC-123"] }] });
        const transaction = await state.removeFromNewVideoList("ABC-123");
        await forage.setItem("favorite_actresses", [{ starId: replacement, name: "B", newVideoList: [] }]);
        await expect(state.undoTransaction(transaction.transactionId)).resolves.toEqual({ reverted: [], conflicts: ["ABC-123"] });
        expect(data.get("favorite_actresses")[0]).toMatchObject({ name: "B", newVideoList: [] });
    });
});

describe("committed state journal cleanup", () => {
    it("returns success and notifies once when the first journal cleanup fails", async () => {
        const { state, storage, forage, data, eventBus } = fixture();
        forage.removeItem.mockRejectedValueOnce(new Error("temporary journal cleanup failure"));
        await expect(state.toggle("ABC-123", "favorite")).resolves.toMatchObject({ changed: ["ABC-123"] });
        expect((await state.getState("ABC-123")).stateFlags.favorite).toBe(true);
        expect(data.has("mutation_journal")).toBe(true);
        expect(eventBus.emit.mock.calls.filter(([name]) => name === "car-state-changed")).toHaveLength(1);
        const writes = forage.setItem.mock.calls.length;
        await state.recoverPendingTransaction();
        expect(data.has("mutation_journal")).toBe(false);
        expect(forage.setItem.mock.calls).toHaveLength(writes);
        expect((await storage.getCar("ABC-123")).stateFlags.favorite).toBe(true);
        expect(eventBus.emit.mock.calls.filter(([name]) => name === "car-state-changed")).toHaveLength(1);
    });

    it("does not replay old tables over a later actress edit and blocks journal replacement", async () => {
        const { state, data, forage } = fixture({ favorite_actresses: [{ starId: "a", name: "A", newVideoList: ["ABC-123"] }] });
        forage.removeItem.mockRejectedValue(new Error("cleanup unavailable"));
        const transaction = await state.patch("ABC-123", { favorite: true });
        await state.updateFavoriteActress({ starId: "a", name: "Edited", newVideoList: ["NEW-222"] });
        await expect(state.patch("XYZ-999", { watched: true })).rejects.toThrow("cleanup unavailable");
        expect(data.get("mutation_journal").id).toBe(transaction.transactionId);
        expect(data.get("favorite_actresses")[0]).toMatchObject({ name: "Edited", newVideoList: ["NEW-222"] });
        forage.removeItem.mockImplementation(async (key) => data.delete(key));
        await state.recoverPendingTransaction();
        expect(data.get("favorite_actresses")[0]).toMatchObject({ name: "Edited", newVideoList: ["NEW-222"] });
        expect(data.get("car_list").map((record) => record.carNum)).toEqual(["ABC-123"]);
    });
});
