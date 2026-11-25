// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { bindWebDavSyncControls } from "../src/ui/settings/webdav-sync-controls.js";

describe("webdav sync restore controls", () => {
    it("forwards the selected recovery domains to the restore service", async () => {
        document.body.innerHTML = `
            <div id="sync-root">
                <div id="jhs-auto-backup-status"></div>
                <button id="webdavSyncPauseBtn" type="button"></button>
                <button id="webdavSyncChooseBtn" type="button"></button>
                <select id="webdavSyncRecoveryFile"><option value="backup-1.json" selected>backup-1</option></select>
                <input id="webdavSyncRestoreLayout" type="checkbox">
                <input id="webdavSyncRestoreData" type="checkbox">
                <input id="webdavSyncRestorePreferences" type="checkbox" checked>
                <button id="webdavSyncRestoreBtn" type="button">恢复</button>
            </div>
        `;
        const scope = new LifecycleScope("test:webdav-controls");
        const restore = vi.fn(async () => {});
        const webdavSync = Object.assign(new EventTarget(), {
            getStatus: vi.fn(async () => ({ busy: false, paused: false, enabled: true, profileConflict: false })),
            restore,
        });
        const dependencies = {
            jquery,
            scope,
            notifications: { ok: vi.fn(), error: vi.fn() },
            utilities: { q: vi.fn((_ev, _msg, confirm) => confirm()) },
            webdavSync,
        };
        const root = jquery("#sync-root");
        bindWebDavSyncControls(root, dependencies);

        root.find("#webdavSyncRestoreBtn").trigger("click");
        await vi.waitFor(() => expect(restore).toHaveBeenCalledTimes(1));
        expect(restore).toHaveBeenLastCalledWith("backup-1.json", false, scope, { data: false, preferences: true });

        root.find("#webdavSyncRestoreData").prop("checked", true);
        root.find("#webdavSyncRestoreBtn").trigger("click");
        await vi.waitFor(() => expect(restore).toHaveBeenCalledTimes(2));
        expect(restore).toHaveBeenLastCalledWith("backup-1.json", false, scope, { data: true, preferences: true });
        scope.dispose();
    });
});
