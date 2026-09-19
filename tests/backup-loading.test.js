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
});
