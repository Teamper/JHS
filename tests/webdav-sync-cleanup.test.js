import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";

afterEach(() => vi.unstubAllGlobals());

async function fullRetention() {
    const dav = memoryDav(), replica = await syncReplica(dav, { data: { setting: { webDavSyncKeepCount: 3, webDavSyncHistoryDays: 0 } } });
    await replica.service.check();
    for (let i = 0; i < 2; i++) { replica.advance(1000); await replica.state.patch([`CLEAN-${i}`], { favorite: true }); await replica.service.check(); }
    return { ...replica, dav };
}
async function publishOverflow(a, failure) {
    a.dav.client.deleteSyncFile.mockRejectedValueOnce(failure);
    a.advance(1000); await a.state.patch(["CLEAN-3"], { favorite: true }); await a.service.check();
}

describe("independent sync cleanup retries", () => {
    it.each([401, 403])("pauses a cleanup-only %i without advancing success or reuploading", async status => {
        const a = await fullRetention(); await publishOverflow(a, new Error("offline"));
        const success = (await a.store.read()).lastSuccessAt, writes = a.dav.client.writeSyncFile.mock.calls.length;
        a.advance(60001); a.dav.client.deleteSyncFile.mockRejectedValueOnce(Object.assign(new Error("forbidden"), { details: { status } }));
        await a.service.check();
        expect(await a.store.read()).toMatchObject({ paused: true, lastSuccessAt: success, dirty: false, pending: null });
        expect((await a.store.read()).error).toContain("暂停");
        const requests = a.dav.client.ensureFolder.mock.calls.length;
        await a.service.check(); expect(a.dav.client.ensureFolder).toHaveBeenCalledTimes(requests);
        expect(a.dav.client.writeSyncFile).toHaveBeenCalledTimes(writes);
        a.shared.revision = "revalidated"; await a.service.check();
        expect(await a.store.read()).toMatchObject({ paused: false, cleanupError: "", cleanupFailures: 0, cleanupRetryAt: 0, lastSuccessAt: success });
    });

    it("retains an already confirmed upload when its first cleanup is forbidden", async () => {
        const a = await fullRetention(), success = (await a.store.read()).lastSuccessAt;
        await publishOverflow(a, Object.assign(new Error("forbidden"), { details: { status: 403 } }));
        const after = await a.store.read();
        expect(after).toMatchObject({ paused: true, dirty: false, pending: null });
        expect(after.lastSuccessAt).toBeGreaterThan(success); expect(after.cleanupError).toContain("同步已成功");
        expect(after.publishedRevision).toBe(after.localRevision);
    });

    it("propagates an unsupported protocol discovered during cleanup into the pause path", async () => {
        const a = await fullRetention(); await publishOverflow(a, new Error("offline")); a.advance(60001);
        const list = a.dav.client.listSyncFiles.getMockImplementation(); let calls = 0;
        a.dav.client.listSyncFiles.mockImplementation(async () => { if (++calls === 2) throw Object.assign(new Error("new protocol"), { code: "SYNC_FUTURE_VERSION" }); return list(); });
        const before = await a.store.read(); await a.service.check();
        expect(await a.store.read()).toMatchObject({ paused: true, lastSuccessAt: before.lastSuccessAt });
        expect(a.dav.client.deleteSyncFile).toHaveBeenCalledOnce();
    });

    it("backs off ordinary cleanup independently while allowing new local uploads", async () => {
        const a = await fullRetention(); await publishOverflow(a, new Error("offline"));
        const first = await a.store.read();
        expect(first.cleanupRetryAt - first.lastSuccessAt).toBe(60000);
        a.advance(1000); await a.state.patch(["CLEAN-4"], { favorite: true }); await a.service.check();
        expect(a.dav.client.writeSyncFile).toHaveBeenCalledTimes(5); expect(a.dav.client.deleteSyncFile).toHaveBeenCalledOnce();
        const success = (await a.store.read()).lastSuccessAt;
        a.advance(59001); a.dav.client.deleteSyncFile.mockRejectedValueOnce(new Error("still offline")); await a.service.check();
        const second = await a.store.read();
        expect(second).toMatchObject({ cleanupFailures: 2, lastSuccessAt: success, paused: false, retryAt: 0, dirty: false });
        expect(second.cleanupRetryAt - first.cleanupRetryAt).toBe(120001);
        a.advance(120001); await a.service.check();
        expect(await a.store.read()).toMatchObject({ cleanupFailures: 0, cleanupRetryAt: 0, cleanupError: "", lastSuccessAt: success });
        expect(a.dav.client.writeSyncFile).toHaveBeenCalledTimes(5); expect(a.dav.files.size).toBe(3);
    });

    it("rechecks persisted retention after every deletion even when another tab changes it", async () => {
        const a = await fullRetention(); await publishOverflow(a, new Error("offline"));
        a.advance(1000); await a.state.patch(["CLEAN-4"], { favorite: true }); await a.service.check();
        const b = await syncReplica(a.dav, { values: a.values, locks: a.locks });
        const remove = a.dav.client.deleteSyncFile.getMockImplementation();
        a.dav.client.deleteSyncFile.mockImplementationOnce(async name => { await remove(name); await b.settings.set("webDavSyncKeepCount", 5); });
        a.advance(60001); await a.service.check();
        expect(a.dav.client.deleteSyncFile).toHaveBeenCalledTimes(2);
        expect(a.dav.files.size).toBe(4);
        expect(await a.store.read()).toMatchObject({ cleanupError: "", deleting: [], dirty: true });
    });

    it("rejects a future protocol appearing in the final listing before DELETE", async () => {
        const a = await fullRetention(); await publishOverflow(a, new Error("offline")); a.advance(60001);
        const list = a.dav.client.listSyncFiles.getMockImplementation(); let calls = 0;
        a.dav.client.listSyncFiles.mockImplementation(async () => {
            const files = await list();
            return ++calls === 3 ? [...files, { schema: 2 }] : files;
        });
        await a.service.check();
        expect((await a.store.read()).paused).toBe(true);
        expect(a.dav.client.deleteSyncFile).toHaveBeenCalledOnce();
        expect(a.dav.files.size).toBe(4);
    });

    it("advances data success for a remote merge independently of cleanup, but not for an empty poll", async () => {
        const a = await fullRetention(); await publishOverflow(a, new Error("offline"));
        const firstSuccess = (await a.store.read()).lastSuccessAt;
        a.advance(1000); await a.service.check();
        expect((await a.store.read()).lastSuccessAt).toBe(firstSuccess);
        const b = await syncReplica(a.dav); await b.service.check();
        a.advance(60001); a.dav.client.deleteSyncFile.mockRejectedValueOnce(new Error("offline again")); await a.service.check();
        const merged = await a.store.read();
        expect(merged.lastSuccessAt).toBeGreaterThan(firstSuccess);
        expect(merged.cleanupError).toContain("清理未完成");
        const writes = a.dav.client.writeSyncFile.mock.calls.length;
        a.advance(120001); await a.service.check();
        expect((await a.store.read()).lastSuccessAt).toBe(merged.lastSuccessAt);
        expect(a.dav.client.writeSyncFile).toHaveBeenCalledTimes(writes);
    });

    it.each(["closed", "connection changed"])("keeps deletion confirmation pending after the page is %s", async reason => {
        const a = await fullRetention(), deleted = [];
        const remove = a.dav.client.deleteSyncFile.getMockImplementation();
        a.dav.client.deleteSyncFile.mockImplementationOnce(async name => {
            deleted.push(name); await remove(name);
            if (reason === "closed") { a.service.suspended = true; a.service.cancel(); }
            else a.shared.revision = "changed";
        });
        a.advance(1000); await a.state.patch(["CLEAN-3"], { favorite: true }); await a.service.check();
        const state = await a.store.read();
        expect(deleted).toHaveLength(1); expect(state.deleting).toContain(deleted[0]); expect(Object.hasOwn(state.known, deleted[0])).toBe(true);
        expect(a.dav.client.deleteSyncFile).toHaveBeenCalledOnce();
    });
});
