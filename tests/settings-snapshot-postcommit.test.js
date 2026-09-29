// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { renderSnapshotPanel, showDiffPreview } from "../src/plugins/backup/setting-panels.js";

function createDependencies(storage, noticeFailure = new Error("toast unavailable")) {
    const notifications = { ok: vi.fn(() => { throw noticeFailure; }), error: vi.fn() };
    const logger = { error: vi.fn(), warn: vi.fn() };
    const close = vi.fn();
    const timers = [];
    const window = { setTimeout: vi.fn((callback, delay) => { timers.push({ callback, delay }); return timers.length; }), location: { reload: vi.fn() } };
    const utilities = { getResponsiveArea: () => ["700px", "auto"], q: vi.fn((_event, _message, confirm) => { utilities.confirmPromise = confirm(); }) };
    return { jquery, legacyStorage: storage, utilities, notifications, logger, domUi: { loading: () => ({ close }) }, window, timers, close };
}

function installSnapshotTable(deps) {
    deps.domUi.tableConstructor = class {
        constructor(_target, options) {
            const row = document.createElement("div");
            let rendered;
            row.innerHTML = options.columns.at(-1).formatter({ getData: () => options.data[0], getElement: () => row }, null, (callback) => { rendered = callback; });
            document.querySelector("#snapshot-list").append(row);
            rendered();
        }
    };
}

describe("settings backup post-commit boundary", () => {
    beforeEach(() => { document.body.innerHTML = '<div id="snapshot-list"></div>'; });

    it("reloads after a committed import even when its success notice fails", async () => {
        const storage = { createSnapshot: vi.fn(async () => {}), importData: vi.fn(async () => {}) };
        const deps = createDependencies(storage);
        let options;
        const dialog = { open: vi.fn((value) => { options = value; return 7; }), close: vi.fn() };
        const diff = { summary: { added: 1, removed: 0, modified: 0, unchanged: 0 }, stores: { appData: { status: "added", oldCount: 0, newCount: 1, added: [1], removed: [], modified: [] } } };
        const backup = { data_version: 3, setting: { themeMode: "dark" } };
        showDiffPreview(diff, backup, null, dialog, deps);

        await options.yes(7);

        expect(storage.createSnapshot).toHaveBeenCalledOnce();
        expect(storage.importData).toHaveBeenCalledExactlyOnceWith(backup);
        expect(deps.notifications.error).not.toHaveBeenCalled();
        expect(deps.timers).toHaveLength(1);
        expect(deps.timers[0].delay).toBe(1000);
        expect(deps.close).toHaveBeenCalledOnce();
    });

    it("reloads after a committed snapshot restore even when its success notice fails", async () => {
        const storage = { getSnapshotList: vi.fn(async () => [{ id: "synthetic-snapshot", name: "synthetic", source: "manual" }]), restoreSnapshot: vi.fn(async () => {}) };
        const deps = createDependencies(storage);
        installSnapshotTable(deps);
        await renderSnapshotPanel(deps);

        document.querySelector(".snap-restore").click();
        await deps.utilities.confirmPromise;

        expect(storage.restoreSnapshot).toHaveBeenCalledExactlyOnceWith("synthetic-snapshot");
        expect(deps.notifications.error).not.toHaveBeenCalled();
        expect(deps.timers).toHaveLength(1);
        expect(deps.close).toHaveBeenCalledOnce();
    });

    it("refreshes the list after a committed snapshot deletion when its success notice fails", async () => {
        let deleted = false;
        const storage = {
            getSnapshotList: vi.fn(async () => deleted ? [] : [{ id: "synthetic-snapshot", name: "synthetic", source: "manual" }]),
            deleteSnapshot: vi.fn(async () => { deleted = true; }),
        };
        const deps = createDependencies(storage);
        installSnapshotTable(deps);
        await renderSnapshotPanel(deps);

        document.querySelector(".snap-delete").click();
        await deps.utilities.confirmPromise;

        expect(storage.deleteSnapshot).toHaveBeenCalledExactlyOnceWith("synthetic-snapshot");
        expect(deps.notifications.error).not.toHaveBeenCalled();
        expect(jquery("#snapshot-list").text()).toContain("暂无快照");
    });

    it("reports a real import persistence failure and does not schedule a reload", async () => {
        const storage = { createSnapshot: vi.fn(async () => {}), importData: vi.fn(async () => { throw new Error("synthetic write failure"); }) };
        const deps = createDependencies(storage);
        let options;
        const dialog = { open: vi.fn((value) => { options = value; return 7; }), close: vi.fn() };
        const diff = { summary: { added: 1, removed: 0, modified: 0, unchanged: 0 }, stores: { appData: { status: "added", oldCount: 0, newCount: 1, added: [1], removed: [], modified: [] } } };
        showDiffPreview(diff, { data_version: 3 }, null, dialog, deps);

        await options.yes(7);

        expect(deps.notifications.error).toHaveBeenCalledWith("导入失败: synthetic write failure");
        expect(deps.timers).toHaveLength(0);
        expect(deps.close).toHaveBeenCalledOnce();
    });
});
