import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/core/credential-crypto.js", () => ({
    decryptCredential: vi.fn(async () => "secret"),
    decryptPortableBackup: vi.fn(),
    encryptPortableBackup: vi.fn(async value => `encrypted:${value}`),
}));

import { backupDataByWebDav } from "../src/plugins/backup/setting-backup.js";

describe("backup loading lifecycle", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("shows loading before exporting and keeps it until upload completes", async () => {
        const close = vi.fn(), loading = vi.fn(() => ({ close })), exportData = vi.fn(async () => ({ records: [1] })), backup = vi.fn(async () => {});
        vi.stubGlobal("loading", loading);
        vi.stubGlobal("storageManager", {
            getSetting: vi.fn(async () => ({ webDavUrl: "https://dav.example", webDavUsername: "user", webDavPassword: "encrypted" })),
            exportData,
        });
        vi.stubGlobal("utils", { getNowStr: vi.fn(() => "2026_08_28") });
        vi.stubGlobal("show", { ok: vi.fn(), error: vi.fn() });
        vi.stubGlobal("clog", { error: vi.fn() });
        await backupDataByWebDav("JHS", { createClient: vi.fn(() => ({ backup })) });
        expect(loading.mock.invocationCallOrder[0]).toBeLessThan(exportData.mock.invocationCallOrder[0]);
        expect(backup.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0]);
    });

    it("records each backup stage and payload size without recording credentials or content", async () => {
        const log = vi.fn(), warn = vi.fn(), close = vi.fn(), backup = vi.fn(async (_folder, _name, content, onStage) => {
            onStage({ stage: "建目录", result: "success", durationMs: 2, timeoutMs: 10_000 });
            onStage({ stage: "上传", result: "success", durationMs: 8, bytes: content.length, timeoutMs: 10_000 });
        });
        vi.stubGlobal("loading", () => ({ close }));
        vi.stubGlobal("storageManager", { exportData: async () => ({ records: ["private-record"] }) });
        vi.stubGlobal("utils", { getNowStr: () => "2026_09_25" });
        vi.stubGlobal("show", { ok: vi.fn(), error: vi.fn() });
        vi.stubGlobal("clog", { log, warn, error: vi.fn() });
        await backupDataByWebDav("JHS", {
            getProfile: async () => ({ url: "https://dav.example/secret", username: "private-user", password: "private-password" }),
            createClient: () => ({ backup }),
        });
        const records = log.mock.calls.map(([, record]) => record);
        expect(records.map(record => record.stage)).toEqual(["读取凭据", "导出数据", "加密", "建目录", "上传", "合计"]);
        expect(records.at(-1)).toMatchObject({ result: "success", bytes: expect.any(Number) });
        expect(warn).not.toHaveBeenCalled();
        expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-password|private-user|private-record|dav\.example/);
        expect(close).toHaveBeenCalledOnce();
    });

    it("records credential lookup failure and closes loading without uploading", async () => {
        const log = vi.fn(), warn = vi.fn(), error = vi.fn(), close = vi.fn(), backup = vi.fn();
        vi.stubGlobal("loading", () => ({ close }));
        vi.stubGlobal("show", { ok: vi.fn(), error });
        vi.stubGlobal("clog", { log, warn, error: vi.fn() });
        await backupDataByWebDav("JHS", {
            getProfile: async () => { throw Object.assign(new Error("credential lookup failed"), { code: "CREDENTIAL_READ_FAILED" }); },
            createClient: () => ({ backup }),
        });
        expect(warn.mock.calls.map(([, record]) => record)).toMatchObject([
            { stage: "读取凭据", result: "error", code: "CREDENTIAL_READ_FAILED" },
            { stage: "合计", result: "error" },
        ]);
        expect(error).toHaveBeenCalledOnce();
        expect(backup).not.toHaveBeenCalled();
        expect(close).toHaveBeenCalledOnce();
    });
});
