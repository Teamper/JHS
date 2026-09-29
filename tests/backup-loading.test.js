import { describe, expect, it, vi } from "vitest";

vi.mock("../src/core/credential-crypto.js", () => ({
    decryptCredential: vi.fn(async () => "secret"),
    decryptPortableBackup: vi.fn(),
    encryptPortableBackup: vi.fn(async value => `encrypted:${value}`),
}));

import { backupDataByWebDav, backupListBtnByWebDav, exportSettingData, importSettingData } from "../src/plugins/backup/setting-backup.js";

function createDependencies(overrides = {}) {
    return {
        document: globalThis.document ?? {},
        legacyStorage: {
            getSetting: vi.fn(async () => ({ webDavUrl: "https://dav.example", webDavUsername: "user", webDavPassword: "encrypted" })),
            exportData: vi.fn(async () => ({ records: [1] })),
        },
        utilities: { getNowStr: vi.fn(() => "2026_08_28") },
        notifications: { ok: vi.fn(), error: vi.fn() },
        logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        domUi: { loading: vi.fn(() => ({ close: vi.fn() })), tableConstructor: null },
        window: { performance: globalThis.performance, setTimeout: vi.fn(), FileReader: class {} },
        jquery: vi.fn(),
        ...overrides,
    };
}

describe("backup loading lifecycle", () => {
    it("shows loading before exporting and keeps it until upload completes", async () => {
        const close = vi.fn(), loading = vi.fn(() => ({ close })), exportData = vi.fn(async () => ({ records: [1] })), backup = vi.fn(async () => {});
        const dependencies = createDependencies({
            legacyStorage: {
                getSetting: vi.fn(async () => ({ webDavUrl: "https://dav.example", webDavUsername: "user", webDavPassword: "encrypted" })),
                exportData,
            },
            domUi: { loading, tableConstructor: null },
        });
        await backupDataByWebDav("JHS", { createClient: vi.fn(() => ({ backup })) }, dependencies);
        expect(loading.mock.invocationCallOrder[0]).toBeLessThan(exportData.mock.invocationCallOrder[0]);
        expect(backup.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0]);
    });

    it("records each backup stage and payload size without recording credentials or content", async () => {
        const log = vi.fn(), warn = vi.fn(), close = vi.fn(), backup = vi.fn(async (_folder, _name, content, onStage) => {
            onStage({ stage: "建目录", result: "success", durationMs: 2, timeoutMs: 10_000 });
            onStage({ stage: "上传", result: "success", durationMs: 8, bytes: content.length, timeoutMs: 10_000 });
        });
        const dependencies = createDependencies({
            legacyStorage: { exportData: async () => ({ records: ["private-record"] }) },
            utilities: { getNowStr: () => "2026_09_25" },
            notifications: { ok: vi.fn(), error: vi.fn() },
            logger: { log, warn, error: vi.fn() },
            domUi: { loading: () => ({ close }), tableConstructor: null },
        });
        await backupDataByWebDav("JHS", {
            getProfile: async () => ({ url: "https://dav.example/secret", username: "private-user", password: "private-password" }),
            createClient: () => ({ backup }),
        }, dependencies);
        const records = log.mock.calls.map(([, record]) => record);
        expect(records.map(record => record.stage)).toEqual(["读取凭据", "导出数据", "加密", "建目录", "上传", "合计"]);
        expect(records.at(-1)).toMatchObject({ result: "success", bytes: expect.any(Number) });
        expect(warn).not.toHaveBeenCalled();
        expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-password|private-user|private-record|dav\.example/);
        expect(close).toHaveBeenCalledOnce();
    });

    it("records credential lookup failure and closes loading without uploading", async () => {
        const log = vi.fn(), warn = vi.fn(), error = vi.fn(), close = vi.fn(), backup = vi.fn();
        const dependencies = createDependencies({
            notifications: { ok: vi.fn(), error },
            logger: { log, warn, error: vi.fn() },
            domUi: { loading: () => ({ close }), tableConstructor: null },
        });
        await backupDataByWebDav("JHS", {
            getProfile: async () => { throw Object.assign(new Error("credential lookup failed"), { code: "CREDENTIAL_READ_FAILED" }); },
            createClient: () => ({ backup }),
        }, dependencies);
        expect(warn.mock.calls.map(([, record]) => record)).toMatchObject([
            { stage: "读取凭据", result: "error", code: "CREDENTIAL_READ_FAILED" },
            { stage: "合计", result: "error" },
        ]);
        expect(error).toHaveBeenCalledOnce();
        expect(backup).not.toHaveBeenCalled();
        expect(close).toHaveBeenCalledOnce();
    });

    it("does not report an uploaded backup as failed when its success notification fails", async () => {
        const backup = vi.fn(async () => {}), error = vi.fn(), close = vi.fn();
        const dependencies = createDependencies({
            notifications: { ok: vi.fn(() => { throw new Error("synthetic notification failure"); }), error },
            domUi: { loading: () => ({ close }), tableConstructor: null },
        });
        await backupDataByWebDav("JHS", { createClient: () => ({ backup }) }, dependencies);
        expect(backup).toHaveBeenCalledOnce();
        expect(error).not.toHaveBeenCalled();
        expect(close).toHaveBeenCalledOnce();
    });

    it("does not reject or invite a retry when closing the loading indicator fails after upload", async () => {
        const backup = vi.fn(async () => {}), ok = vi.fn(), error = vi.fn(), warn = vi.fn();
        const dependencies = createDependencies({
            notifications: { ok, error },
            logger: { log: vi.fn(), warn, error: vi.fn() },
            domUi: { loading: () => ({ close: () => { throw new Error("synthetic layer cleanup failure"); } }), tableConstructor: null },
        });
        await expect(backupDataByWebDav("JHS", { createClient: () => ({ backup }) }, dependencies)).resolves.toBeUndefined();
        expect(backup).toHaveBeenCalledOnce();
        expect(ok).toHaveBeenCalledWith("备份完成");
        expect(error).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith("[WebDAV备份] 关闭加载提示失败", expect.any(Object));
    });

    it("lists WebDAV backups through injected services and releases loading after rendering", async () => {
        const files = [{ name: "backup.json", size: 12, createTime: "2026-09-27", fileId: "id-1" }];
        const close = vi.fn(), getBackupList = vi.fn(async () => files), openList = vi.fn();
        const dependencies = createDependencies({
            notifications: { error: vi.fn() },
            domUi: { loading: vi.fn(() => ({ close })), tableConstructor: null },
        });
        await backupListBtnByWebDav("JHS", openList, {
            getProfile: async () => ({ url: "https://dav.example", username: "user", password: "secret" }),
            createClient: vi.fn(() => ({ getBackupList })),
        }, dependencies);
        expect(getBackupList).toHaveBeenCalledWith("JHS");
        expect(openList).toHaveBeenCalledWith(files, expect.any(Object), "WebDav");
        expect(close).toHaveBeenCalledOnce();
    });

    it("imports a selected JSON backup using injected document, reader, storage, and UI services", async () => {
        const imported = { records: ["synthetic"] }, diff = { summary: { added: 1 } };
        const input = { remove: vi.fn(), click: vi.fn() };
        let reader;
        class FakeFileReader {
            constructor() { reader = this; }
            readAsText(file) {
                this.result = file.contents;
                this.pending = this.onload?.({ currentTarget: this });
            }
        }
        const close = vi.fn(), preview = vi.fn();
        const dependencies = createDependencies({
            document: { createElement: vi.fn(() => input), body: { appendChild: vi.fn() } },
            legacyStorage: { exportData: vi.fn(async () => ({ records: [] })), diffData: vi.fn(async () => diff) },
            domUi: { loading: vi.fn(() => ({ close })), tableConstructor: null },
            window: { performance: globalThis.performance, setTimeout: vi.fn(), FileReader: FakeFileReader },
        });
        await importSettingData(preview, dependencies);
        await input.onchange({ currentTarget: { files: [{ contents: JSON.stringify(imported) }] } });
        await reader.pending;
        expect(preview).toHaveBeenCalledWith(diff, imported, null);
        expect(close).toHaveBeenCalledOnce();
        expect(input.remove).toHaveBeenCalledOnce();
    });

    it("exports data through injected storage and download services", async () => {
        const download = vi.fn(), ok = vi.fn();
        const dependencies = createDependencies({
            legacyStorage: { exportData: vi.fn(async () => ({ records: [1] })) },
            utilities: { getNowStr: vi.fn(() => "2026_09_27"), download },
            notifications: { ok, error: vi.fn() },
        });
        await exportSettingData(dependencies);
        expect(download).toHaveBeenCalledWith(JSON.stringify({ records: [1] }), "2026_09_27.json");
        expect(ok).toHaveBeenCalledWith("数据导出成功");
    });
});
