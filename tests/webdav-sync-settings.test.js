import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsRegistry } from "../src/app/settings-registry.js";
import { registerDefaultSettings } from "../src/app/settings-catalog.js";
import { emptySyncModel, projectSyncData, syncFileName, syncHash, validateSyncEnvelope, validateSyncState, versionSyncDiff } from "../src/core/webdav-sync-model.js";
import { encryptPortableBackup } from "../src/core/credential-crypto.js";
import { SYNC_JOURNAL_KEY } from "../src/core/webdav-sync-store.js";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";

const replicaId = "11111111-1111-4111-8111-111111111111", createdAt = "2026-10-22T00:00:00.000Z";
const registry = new SettingsRegistry(); registerDefaultSettings(registry);
const validateSetting = (key, value) => registry.validateSync(key, value);
const model = setting => versionSyncDiff(emptySyncModel(), {}, projectSyncData({ setting }), [1, replicaId]).model;
const envelope = state => ({ schema: 1, dataVersion: 3, replicaId, seq: 1, createdAt, state });
afterEach(() => vi.unstubAllGlobals());

describe("descriptor-owned synchronized setting validation", () => {
    it.each([
        ["webDavSyncKeepCount", "3"], ["webDavSyncHistoryDays", "0"], ["webDavSyncHistoryDays", 365],
        ["themeMode", "auto"], ["enablePreviewVideo", "yes"], ["enable115Offline", "no"], ["videoMuted", false],
        ["offlineProviderMode", "115"], ["oneOneFiveConcurrency", "10"],
        ["enabledExternalSites", ["javbus", "custom"]], ["imageSearchSelections", { google: true, yandex: false }],
        ["magnetHubSelectedEngine", "custom-id"], ["newVideoViewMode", "grid"], ["tagExpanded", true], ["actressAvatarSourceIndex", 2],
        ["screenshotProviders", '[{"id":"legacy"}]'], ["magnetTagRules", '[{"name":"tag","type":"regex","pattern":"a+"}]'],
        ["magnetFilterRules", [{ name: "rule", pattern: "literal" }]],
        ["magnetBuiltInSources", '[{"id":"btsow","baseUrl":"https://example.test","priority":"2"}]'],
        ["customMagnetSources", '[{"id":"custom","name":"Source","parserType":"magnet-links","searchUrlTemplate":"https://example.test/search?q={keyword}","targetUrlTemplate":"https://example.test/search?q={keyword}","enabled":true,"priority":100}]'],
        ["detailShortcuts", { favorite: { code: "KeyF", ctrl: true }, watched: null }],
        ["futureUnknownPreference", { nested: [null, "anything", 3] }],
    ])("accepts %s without rewriting its versioned representation", (key, value) => {
        const state = model({ [key]: value }), serialized = JSON.stringify(state);
        expect(validateSyncEnvelope(envelope(state), validateSetting).state).toBe(state);
        expect(JSON.stringify(state)).toBe(serialized);
    });

    it.each([
        ["webDavSyncKeepCount", 2], ["webDavSyncKeepCount", true], ["webDavSyncKeepCount", ""], ["webDavSyncHistoryDays", 366],
        ["webDavSyncHistoryDays", 1.5], ["themeMode", "invalid"], ["themeMode", ["dark"]], ["enablePreviewVideo", "sometimes"],
        ["offlineProviderMode", "unsupported"], ["offlineProviderMode", 115], ["oneOneFiveConcurrency", "11"],
        ["enabledExternalSites", ["google", 1]], ["imageSearchSelections", { google: "yes" }],
        ["enabledExternalSites", '["google"]'], ["imageSearchSelections", '{"google":true}'], ["detailShortcuts", '{"favorite":{"code":"KeyF"}}'],
        ["magnetHubSelectedEngine", {}], ["newVideoViewMode", []], ["tagExpanded", {}], ["actressAvatarSourceIndex", -1],
        ["tagExpanded", "yes"], ["actressAvatarSourceIndex", "2"],
        ["screenshotProviders", "{}"], ["magnetTagRules", '[{"name":"bad","type":"regex","pattern":"["}]'],
        ["magnetFilterRules", [{ name: "empty", pattern: "" }]],
        ["magnetBuiltInSources", [{ id: "btsow", baseUrl: "http://example.test" }]],
        ["customMagnetSources", [{ name: "script", script: "run()" }]],
        ["detailShortcuts", { favorite: { code: "Tab" } }],
    ])("rejects invalid active %s with the setting name and reason", (key, value) => {
        expect(() => validateSyncState(model({ [key]: value }), validateSetting)).toThrow(key);
    });

    it("does not block a deletion because its historical setting value is no longer valid", () => {
        const state = model({ themeMode: "old-invalid-mode" });
        state.records["setting/themeMode"].death = [2, replicaId];
        expect(validateSyncState(state, validateSetting)).toBe(state);
    });

    it("rejects an intact encrypted invalid setting before applying data or making any upload/delete", async () => {
        const dav = memoryDav(), local = await syncReplica(dav, { data: { setting: { themeMode: "light" }, filter_keyword_title: ["keep"] } });
        const content = await encryptPortableBackup(JSON.stringify(envelope(model({ themeMode: "bad-mode" }))));
        dav.files.set(syncFileName(replicaId, 1, createdAt, await syncHash(content)), content);
        await local.service.check();
        expect(local.values.get("setting")).toEqual({ themeMode: "light" });
        expect(local.values.get("filter_keyword_title")).toEqual(["keep"]);
        expect(local.values.has(SYNC_JOURNAL_KEY)).toBe(false);
        expect((await local.service.getStatus()).message).toContain("themeMode");
        expect(dav.client.writeSyncFile).not.toHaveBeenCalled(); expect(dav.client.deleteSyncFile).not.toHaveBeenCalled();
    });

    it("also validates the final merged state at the business persistence boundary", async () => {
        const local = await syncReplica(memoryDav(), { data: { setting: { themeMode: "light" } } });
        await expect(local.store.merge([model({ themeMode: "bad-mode" })], "binding", async () => {})).rejects.toThrow("themeMode");
        expect(local.values.get("setting")).toEqual({ themeMode: "light" });
        expect(local.values.has(SYNC_JOURNAL_KEY)).toBe(false);
    });
});
