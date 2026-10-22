import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";

afterEach(() => vi.unstubAllGlobals());

describe("same-origin sync polling", () => {
    it("shares the poll window across staggered tabs and refreshed pages", async () => {
        const dav = memoryDav(), first = await syncReplica(dav);
        await first.service.check({ scheduled: true });
        const tabs = [first];
        for (let i = 0; i < 4; i++) tabs.push(await syncReplica(dav, { values: first.values, locks: first.locks }));
        const lists = dav.client.listSyncFiles.mock.calls.length;
        for (const tab of tabs) await tab.service.check({ scheduled: true });
        expect(dav.client.ensureFolder).toHaveBeenCalledOnce();
        expect(dav.client.listSyncFiles).toHaveBeenCalledTimes(lists);
        const reads = dav.client.readSyncFile.mock.calls.length;
        for (const tab of tabs) tab.advance(30001);
        for (const tab of tabs) await tab.service.check({ scheduled: true });
        expect(dav.client.ensureFolder).toHaveBeenCalledTimes(2);
        expect(dav.client.readSyncFile).toHaveBeenCalledTimes(reads);
        expect(dav.client.writeSyncFile).toHaveBeenCalledOnce();
    });

    it("publishes pending local edits and allows explicit checks before the poll deadline", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check({ scheduled: true });
        const b = await syncReplica(dav, { values: a.values, locks: a.locks });
        await a.state.patch(["POLL-1"], { favorite: true });
        await b.service.check({ scheduled: true });
        expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(2);
        await a.service.retry(); expect(dav.client.ensureFolder).toHaveBeenCalledTimes(3);
        expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(2);
    });

    it("repairs a previous page's missed metadata before suppressing the first scheduled poll", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check({ scheduled: true });
        // Business persistence completed, but its metadata write never happened.
        a.values.set("filter_keyword_title", ["saved-before-crash"]);
        const b = await syncReplica(dav, { values: a.values, locks: a.locks });
        await b.service.check({ scheduled: true });
        expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(2);
        expect((await b.store.read()).model.records["filter_keyword_title/saved-before-crash"].fields.value.value).toBe("saved-before-crash");
    });

    it("honors foreground/background intervals and checks again after a clock rollback", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); a.service.document = { hidden: true };
        await a.service.check({ scheduled: true }); a.advance(30001);
        await a.service.check({ scheduled: true }); expect(dav.client.ensureFolder).toHaveBeenCalledOnce();
        a.service.document = { hidden: false };
        await a.service.check({ scheduled: true }); expect(dav.client.ensureFolder).toHaveBeenCalledTimes(2);
        a.advance(-60000); await a.service.check({ scheduled: true });
        expect(dav.client.ensureFolder).toHaveBeenCalledTimes(3);
    });

    it("does not skip a changed connection or bypass another tab's retry backoff", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check({ scheduled: true });
        a.shared.revision = "updated";
        dav.client.listSyncFiles.mockRejectedValueOnce(new Error("offline"));
        await a.service.check({ scheduled: true }); expect(dav.client.ensureFolder).toHaveBeenCalledTimes(2);
        const b = await syncReplica(dav, { values: a.values, locks: a.locks }); b.shared.revision = "updated";
        await b.service.check({ scheduled: true }); expect(dav.client.ensureFolder).toHaveBeenCalledTimes(2);
        b.advance(60001); await b.service.check({ scheduled: true }); expect(dav.client.ensureFolder).toHaveBeenCalledTimes(3);
    });
});
