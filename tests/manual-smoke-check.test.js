import { describe, expect, it } from "vitest";
import { PLACEHOLDER_VERSIONS, REQUIRED_MANUAL_SMOKE_CHECKS, isVersionAtLeast, validateManualSmokeRecord } from "../scripts/manual-smoke-check.mjs";

function createRecord() {
    return {
        version: "6.5.0",
        testedAt: "2026-08-25T12:00:00.000Z",
        tester: "release tester",
        humanVerified: true,
        browser: { channel: "msedge", version: "151.0" },
        userscriptManager: { name: "Tampermonkey", version: "5.4.0" },
        artifact: { sha256: "abc123" },
        checks: Object.fromEntries(REQUIRED_MANUAL_SMOKE_CHECKS.map((check) => [check, true])),
    };
}

describe("manual Tampermonkey smoke gate", () => {
    it("requires the gate from 6.5.0 without treating later 6.4 patches as newer", () => {
        expect(isVersionAtLeast("6.4.10", "6.5.0")).toBe(false);
        expect(isVersionAtLeast("6.5.0", "6.5.0")).toBe(true);
        expect(isVersionAtLeast("7.0.0", "6.5.0")).toBe(true);
    });

    it("accepts a complete record for the exact artifact", () => {
        expect(validateManualSmokeRecord(createRecord(), { version: "6.5.0", artifactSha256: "abc123" }).tester).toBe("release tester");
    });

    it("rejects a record for a different artifact", () => {
        expect(() => validateManualSmokeRecord(createRecord(), { version: "6.5.0", artifactSha256: "different" })).toThrow(/artifact\.sha256/);
    });

    it("rejects machine-generated or placeholder records", () => {
        const bot = createRecord();
        bot.tester = "JHS Release Bot";
        expect(() => validateManualSmokeRecord(bot, { version: "6.5.0", artifactSha256: "abc123" })).toThrow(/human|bot/);

        for (const version of PLACEHOLDER_VERSIONS) {
            const browser = createRecord();
            browser.browser.version = version;
            expect(() => validateManualSmokeRecord(browser, { version: "6.5.0", artifactSha256: "abc123" })).toThrow(/browser\.version/);

            const manager = createRecord();
            manager.userscriptManager.version = version;
            expect(() => validateManualSmokeRecord(manager, { version: "6.5.0", artifactSha256: "abc123" })).toThrow(/userscriptManager\.version/);
        }
    });

    it("rejects a record that lacks human verification", () => {
        const record = createRecord();
        delete record.humanVerified;
        expect(() => validateManualSmokeRecord(record, { version: "6.5.0", artifactSha256: "abc123" })).toThrow(/humanVerified/);
    });

    it("requires the new 6.5 regression checks, not just page-level smoke", () => {
        expect(REQUIRED_MANUAL_SMOKE_CHECKS).toEqual(expect.arrayContaining([
            "settings.crossTabSync",
            "fc2.autopagePage2",
            "dialog.layeredBlacklistSettingsWebdav",
            "plugin.disabledNewVideo",
            "plugin.disabledBlacklist",
            "cloud.115",
            "cloud.123",
        ]));
        const record = createRecord();
        record.checks["fc2.autopagePage2"] = false;
        expect(() => validateManualSmokeRecord(record, { version: "6.5.0", artifactSha256: "abc123" })).toThrow(/fc2\.autopagePage2/);
    });

    it("rejects any omitted real-page smoke item", () => {
        const record = createRecord();
        record.checks["javbus.detail"] = false;
        expect(() => validateManualSmokeRecord(record, { version: "6.5.0", artifactSha256: "abc123" })).toThrow(/javbus\.detail/);
    });
});
