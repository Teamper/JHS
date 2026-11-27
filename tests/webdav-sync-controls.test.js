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
        const apply = vi.fn(async () => {});
        const previewRecovery = vi.fn(async () => ({
            apply,
            diff: { summary: { added: 0, removed: 0, modified: 1, unchanged: 0 },
                stores: { setting: { status: "modified", oldCount: 1, newCount: 1, added: [], removed: [], modified: { themeMode: {} } } } },
        }));
        const dialog = { open: vi.fn(() => 1), close: vi.fn() };
        const webdavSync = Object.assign(new EventTarget(), {
            getStatus: vi.fn(async () => ({ busy: false, paused: false, enabled: true, profileConflict: false })),
            previewRecovery,
        });
        const dependencies = {
            jquery,
            scope,
            notifications: { ok: vi.fn(), error: vi.fn() },
            utilities: { getResponsiveArea: () => ["700px", "auto"] },
            dialog, domUi: { loading: () => ({ close: vi.fn() }) }, window,
            webdavSync,
        };
        const root = jquery("#sync-root");
        bindWebDavSyncControls(root, dependencies);

        root.find("#webdavSyncRestoreBtn").trigger("click");
        await vi.waitFor(() => expect(previewRecovery).toHaveBeenCalledTimes(1));
        expect(previewRecovery).toHaveBeenLastCalledWith("backup-1.json", false, scope, { data: false, preferences: true });
        expect(apply).not.toHaveBeenCalled();
        await vi.waitFor(() => expect(dialog.open).toHaveBeenCalledWith(expect.objectContaining({ title: "数据差异预览", btn: ["取消", "恢复"] })));
        dialog.open.mock.calls[0][0].end();
        await vi.waitFor(() => expect(root.find("#webdavSyncRestoreBtn").prop("disabled")).toBe(false));

        root.find("#webdavSyncRestoreData").prop("checked", true);
        root.find("#webdavSyncRestoreBtn").trigger("click");
        await vi.waitFor(() => expect(previewRecovery).toHaveBeenCalledTimes(2));
        expect(previewRecovery).toHaveBeenLastCalledWith("backup-1.json", false, scope, { data: true, preferences: true });
        scope.dispose();
    });
});
