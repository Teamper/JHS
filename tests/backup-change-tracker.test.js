import { describe, expect, it, vi } from "vitest";
import { BackupChangeTracker, AUTO_BACKUP_STATE_KEY } from "../src/core/backup-change-tracker.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";

function fixture() {
    const values = new Map();
    const forage = { getItem: async key => structuredClone(values.get(key) ?? null), setItem: vi.fn(async (key, value) => { values.set(key, structuredClone(value)); }) };
    const coordinator = new StorageMutationCoordinator({ lockManager: null }), tracker = new BackupChangeTracker(forage, coordinator);
    tracker.enabled = true; coordinator.observer = tracker;
    const write = async (key, value) => { await tracker.capture(key); await forage.setItem(key, value); };
    return { values, forage, coordinator, tracker, write };
}

describe("committed backup change accounting", () => {
    it("counts a batch by actual record identities, then counts a subsequent real update again", async () => {
        const f = fixture(), movies = Array.from({ length: 10 }, (_, index) => ({ carNum: `MOVIE-${index}`, stateFlags: { favorite: true } }));
        await f.coordinator.runExclusive(() => f.write("car_list", movies));
        expect((await f.tracker.read()).totalRevision).toBe(10);
        await f.coordinator.runExclusive(() => f.write("car_list", structuredClone(movies)));
        expect((await f.tracker.read()).totalRevision).toBe(10);
        movies[0].stateFlags.favorite = false;
        await f.coordinator.runExclusive(() => f.write("car_list", movies));
        expect((await f.tracker.read()).totalRevision).toBe(11);
    });
    it("settles only the final committed value and ignores a complete rollback", async () => {
        const f = fixture(); f.values.set("car_list", [{ carNum: "A", value: 1 }]);
        await expect(f.coordinator.runExclusive(async () => {
            await f.write("car_list", [{ carNum: "A", value: 2 }]);
            await f.write("car_list", [{ carNum: "A", value: 1 }]);
            throw new Error("rolled back");
        })).rejects.toThrow("rolled back");
        expect(f.values.has(AUTO_BACKUP_STATE_KEY)).toBe(false);
    });
    it("does not count state journal stages, notifications or derived linked records twice", async () => {
        const f = fixture();
        await f.coordinator.runExclusive(async () => {
            await f.write("car_list", [{ carNum: "A" }, { carNum: "B" }]);
            await f.write("favorite_actresses", [{ starId: "actor", newVideoList: [] }]);
            await f.write("new_video_decisions", { A: { status: "handled" }, B: { status: "handled" } });
            await f.write("activity_log", { entries: [1, 2] });
            f.tracker.primary(["A", "B", "A"]);
        });
        expect((await f.tracker.read()).totalRevision).toBe(2);
    });
    it.each(["favorite_actresses", "blacklist", "blacklist_car_list", "filter_keyword_title", "filter_keyword_review", "highlighted_tags", "new_video_decisions", "offline_history"])("covers business domain %s", async key => {
        const f = fixture();
        const value = key === "new_video_decisions" ? { A: { action: "hide" }, B: { action: "hide" } } : [{ id: "A", value: 1 }, { id: "B", value: 2 }];
        await f.coordinator.runExclusive(() => f.write(key, value));
        expect((await f.tracker.read()).totalRevision).toBe(2);
    });
    it("ignores settings, caches, snapshots, logs, and bookkeeping-only actor timestamps", async () => {
        const f = fixture(); f.values.set("favorite_actresses", [{ starId: "A", name: "Actor", updateDate: "old" }]);
        await f.coordinator.runExclusive(async () => {
            for (const key of ["setting", "third_party_ttl_cache", "activity_log", "mutation_journal", "snapshots", AUTO_BACKUP_STATE_KEY + "_diagnostic"]) await f.write(key, ["different"]);
            await f.write("favorite_actresses", [{ starId: "A", name: "Actor", updateDate: "new" }]);
        });
        expect(f.values.has(AUTO_BACKUP_STATE_KEY)).toBe(false);
    });
    it("retains counter progress when reconstructed after navigation", async () => {
        const f = fixture(); await f.coordinator.runExclusive(() => f.write("highlighted_tags", ["one", "two"]));
        const reopened = new BackupChangeTracker(f.forage, f.coordinator);
        expect((await reopened.read()).totalRevision).toBe(2);
        expect((await reopened.read()).sourceId).toBe((await f.tracker.read()).sourceId);
    });
    it("keeps a successful business write successful when counter persistence fails", async () => {
        const f = fixture(), original = f.forage.setItem.getMockImplementation();
        f.forage.setItem.mockImplementation(async (key, value) => { if (key === AUTO_BACKUP_STATE_KEY) throw new Error("quota"); return original(key, value); });
        await expect(f.coordinator.runExclusive(async () => { await f.write("car_list", [{ carNum: "A" }]); return "saved"; })).resolves.toBe("saved");
        expect(f.values.get("car_list")).toEqual([{ carNum: "A" }]);
        expect(f.tracker.needsBackup).toBe(true);
    });
    it("collects only touched tables and performs no accounting while disabled", async () => {
        const f = fixture(); f.tracker.enabled = false;
        await f.coordinator.runExclusive(() => f.write("car_list", [{ carNum: "A" }]));
        expect(f.values.has(AUTO_BACKUP_STATE_KEY)).toBe(false);
    });
});
