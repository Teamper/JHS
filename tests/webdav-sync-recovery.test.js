import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

afterEach(() => vi.unstubAllGlobals());

describe("selected WebDAV recovery", () => {
    it("preserves a new local operation committed after the import releases its lock", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check();
        const file = [...dav.files.keys()][0], importData = a.storage.importDataWithGuard.bind(a.storage);
        let fresh;
        vi.spyOn(a.storage, "importDataWithGuard").mockImplementationOnce(async (...args) => {
            await importData(...args);
            fresh = await a.state.patch("AFTER-201", { downloaded: true });
        });
        await a.service.restore(file, false, undefined, { data: true, preferences: false });
        expect(a.store.canUndo(fresh.transactionId)).toBe(true);
        await expect(a.state.undoTransaction(fresh.transactionId)).resolves.toBeTruthy();
    });
    it.each([
        ["preferences", { preferences: true, data: false }, false],
        ["data", { preferences: false, data: true }, false],
        ["layout", { preferences: false, data: false }, true],
    ])("preserves unselected concurrent changes when restoring %s", async (_name, selection, layout) => {
        const dav = memoryDav(), a = await syncReplica(dav, { data: { setting: { themeMode: "dark", containerColumns: 7 }, filter_keyword_title: ["before"] } });
        await a.service.check();
        const file = [...dav.files.keys()][0];
        await a.settings.patch({ themeMode: "light", containerColumns: 2 });
        const original = a.storage.importDataWithGuard.bind(a.storage);
        vi.spyOn(a.storage, "importDataWithGuard").mockImplementationOnce(async (...args) => {
            // Another writer commits after restore starts, before it acquires the lock.
            await a.state.patch(["CONCURRENT-1"], { favorite: true });
            await a.settings.patch({ themeMode: "system", containerColumns: 4 });
            await a.coordinator.runExclusive(() => a.storage._setItemAndInvalidate("filter_keyword_title", ["before", "concurrent-new"]));
            return original(...args);
        });
        await a.service.restore(file, layout, undefined, selection);
        expect(a.values.get("setting")).toMatchObject({ themeMode: selection.preferences ? "dark" : "system", containerColumns: layout ? 7 : 4 });
        expect(a.values.get("filter_keyword_title")).toEqual(selection.data ? ["before"] : ["before", "concurrent-new"]);
        expect(a.values.get("car_list").map(car => car.carNum)).toEqual(selection.data ? [] : ["CONCURRENT-1"]);
        const snapshot = a.values.get("snapshots").find(item => item.source === "auto-import");
        expect(snapshot).toBeTruthy();
    });

    it("allows explicit recovery while paused without publishing until resumed", async () => {
        const dav = memoryDav(), a = await syncReplica(dav, { data: { setting: { themeMode: "dark" } } });
        await a.service.check(); const file = [...dav.files.keys()][0];
        await a.settings.set("themeMode", "light"); await a.service.check();
        await a.service.pause(true);
        const writes = dav.client.writeSyncFile.mock.calls.length, scope = new LifecycleScope("recovery");
        expect((await a.service.listRecoveryFiles(scope)).some(item => item.name === file)).toBe(true);
        await a.service.restore(file, false, scope, { preferences: true, data: false });
        expect(a.values.get("setting").themeMode).toBe("dark");
        expect(await a.shared.paused()).toBe(true);
        await a.service.check(); expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(writes);
        await a.service.pause(false); expect(dav.client.writeSyncFile).toHaveBeenCalledTimes(writes + 1);
        scope.dispose();
    });

    it.each(["connection", "lifecycle"])("still cancels recovery when its %s changes before commit", async cause => {
        const dav = memoryDav(), a = await syncReplica(dav, { data: { setting: { themeMode: "dark" } } });
        await a.service.check(); const file = [...dav.files.keys()][0];
        await a.settings.set("themeMode", "light"); await a.service.pause(true);
        const scope = new LifecycleScope("recovery"), original = a.storage.importDataWithGuard.bind(a.storage);
        vi.spyOn(a.storage, "importDataWithGuard").mockImplementationOnce(async (...args) => {
            if (cause === "connection") a.shared.revision = "new-connection";
            else scope.dispose();
            return original(...args);
        });
        await expect(a.service.restore(file, false, scope, { preferences: true, data: false })).rejects.toMatchObject({ name: "AbortError" });
        expect(a.values.get("setting").themeMode).toBe("light");
        scope.dispose();
    });
});
