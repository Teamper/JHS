import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptPortableBackup } from "../src/core/credential-crypto.js";
import { emptySyncModel, projectSyncData, syncFileName, syncHash, syncRetention, versionSyncDiff } from "../src/core/webdav-sync-model.js";
import { SYNC_STATE_KEY } from "../src/core/webdav-sync-store.js";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";

const id = "11111111-1111-4111-8111-111111111111", createdAt = "2026-10-22T00:00:00.000Z";
async function oldLibrary(dav, setting = {}) {
    const state = versionSyncDiff(emptySyncModel(), {}, projectSyncData({ setting }), [1, id]).model;
    const content = await encryptPortableBackup(JSON.stringify({ schema: 1, dataVersion: 3, replicaId: id, seq: 1, createdAt, state }));
    const name = syncFileName(id, 1, createdAt, await syncHash(content)); dav.files.set(name, content); return name;
}
afterEach(() => vi.unstubAllGlobals());

describe("library-owned snapshot retention policy", () => {
    it("publishes 5/7 only for an empty new library and another device inherits it", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check();
        expect(a.values.get("setting")).toMatchObject({ webDavSyncKeepCount: 5, webDavSyncHistoryDays: 7 });
        const b = await syncReplica(dav); await b.service.check();
        expect(b.values.get("setting")).toMatchObject({ webDavSyncKeepCount: 5, webDavSyncHistoryDays: 7 });
        expect((await b.store.read()).dirty).toBe(false);
    });
    it("preserves each explicit local value when creating an empty library", async () => {
        const a = await syncReplica(memoryDav(), { data: { setting: { webDavSyncKeepCount: "12" } } }); await a.service.check();
        expect(a.values.get("setting")).toMatchObject({ webDavSyncKeepCount: "12", webDavSyncHistoryDays: 7 });
    });
    it("uses legacy 10/30 for a nonempty library even when its snapshot contains no business records", async () => {
        const dav = memoryDav(); await oldLibrary(dav);
        const a = await syncReplica(dav, { data: { setting: { webDavSyncKeepCount: 5, webDavSyncHistoryDays: 7 } } }); await a.service.check();
        expect(a.values.get("setting")).toMatchObject({ webDavSyncKeepCount: 10, webDavSyncHistoryDays: 30 });
        const b = await syncReplica(dav); await b.service.check();
        expect(b.values.get("setting")).toMatchObject({ webDavSyncKeepCount: 10, webDavSyncHistoryDays: 30 });
    });
    it("inherits the existing library's explicit values and fills only its missing legacy value", async () => {
        const dav = memoryDav(); await oldLibrary(dav, { webDavSyncKeepCount: "18" });
        const a = await syncReplica(dav, { data: { setting: { webDavSyncKeepCount: 5, webDavSyncHistoryDays: 7 } } }); await a.service.check();
        expect(a.values.get("setting")).toMatchObject({ webDavSyncKeepCount: "18", webDavSyncHistoryDays: 30 });
    });
    it("migrates an already joined old device once without changing its replica or replaying policy writes", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check();
        const state = a.values.get(SYNC_STATE_KEY), originalId = state.replicaId;
        delete state.retentionPolicyInitialized;
        for (const key of ["webDavSyncKeepCount", "webDavSyncHistoryDays"]) {
            delete a.values.get("setting")[key]; delete state.model.records[`setting/${key}`]; delete state.shadow[`setting/${key}`];
        }
        await a.service.check();
        expect(a.values.get("setting")).toMatchObject({ webDavSyncKeepCount: 10, webDavSyncHistoryDays: 30 });
        const migrated = await a.store.read(), writes = dav.client.writeSyncFile.mock.calls.length;
        expect(migrated.replicaId).toBe(originalId);
        await a.service.check(); const restarted = await a.restart(); await restarted.service.check();
        expect((await restarted.store.read()).counter).toBe(migrated.counter);
        expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(writes);
    });
    it("restores an old version's missing preferences with legacy policy while leaving data-only restores unchanged", async () => {
        const dav = memoryDav(), name = await oldLibrary(dav, { themeMode: "dark" });
        const a = await syncReplica(dav); await a.service.check();
        await a.settings.patch({ webDavSyncKeepCount: 8, webDavSyncHistoryDays: 14 });
        await a.service.restore(name, false, undefined, { data: true, preferences: false });
        expect(a.values.get("setting")).toMatchObject({ webDavSyncKeepCount: 8, webDavSyncHistoryDays: 14 });
        await a.service.restore(name, false, undefined, { data: false, preferences: true });
        expect(a.values.get("setting")).toMatchObject({ webDavSyncKeepCount: 10, webDavSyncHistoryDays: 30, themeMode: "dark" });
        const progress = await a.store.read(); await a.service.check();
        expect((await a.store.read()).seq).toBeGreaterThan(progress.seq);
    });
    it("keeps legacy fallback when callers inspect old snapshots without explicit settings", () => {
        expect(syncRetention({})).toEqual({ count: 10, days: 30 });
    });
});
