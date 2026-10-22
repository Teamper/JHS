import { afterEach, describe, expect, it, vi } from "vitest";
import { emptySyncModel, materializeSyncData, projectSyncData, syncFileName, syncHash, validateSyncEnvelope, validateSyncState, versionSyncDiff } from "../src/core/webdav-sync-model.js";
import { encryptPortableBackup } from "../src/core/credential-crypto.js";
import { SYNC_JOURNAL_KEY } from "../src/core/webdav-sync-store.js";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";

const replicaId = "11111111-1111-4111-8111-111111111111", stamp = [1, replicaId], createdAt = "2026-10-22T00:00:00.000Z";
const field = value => ({ v: stamp, value });
const record = fields => ({ birth: stamp, generation: null, death: null, fields });
const envelope = state => ({ schema: 1, dataVersion: 3, replicaId, seq: 1, createdAt, state });
const model = (key, fields) => ({ records: { [key]: record(fields) }, frontiers: {} });
const fromData = data => versionSyncDiff(emptySyncModel(), {}, projectSyncData(data), stamp).model;

afterEach(() => { vi.unstubAllGlobals(); });

describe("WebDAV domain semantics at the external-state boundary", () => {
    it("accepts existing projected data, sparse legacy records, unknown JSON metadata and nullable settings without rewriting", () => {
        const data = {
            car_list: [{ carNum: "abc-123", names: "Actor", stateFlags: { favorite: true }, importedMetadata: { labels: ["one"], score: 4.5 } }],
            blacklist_car_list: [{ carNum: "XYZ-999", names: "Blocked", starId: 42 }],
            favorite_actresses: [{ starId: 42, name: "Actor", allName: ["Actor", "别名"], newVideoList: ["abc-123", { carNum: "XYZ-999", title: "Title", publishTime: "2026-10-01" }] }],
            blacklist: [{ starId: "legacy/actor", role: "演员" }],
            filter_keyword_title: ["a/b"], filter_keyword_review: ["中文"], highlighted_tags: ["tag"],
            new_video_decisions: { "ABC-123": { action: "snoozed" }, "XYZ-999": { action: "ignored", until: null, createdAt, updatedAt: createdAt } },
            activity_log: { entries: [{ id: "legacy-activity", createdAt, commitState: "committed", changes: [{ carNum: "ABC-123", undoState: "pending" }] }] },
            offline_history: [{ id: "legacy-offline", createdAt, carNum: null, status: "submitted", providerId: "115" }],
            setting: { themeMode: "dark", optional: null, toggle: false, customSources: [{ id: "source", url: "https://example.test" }] },
        };
        const state = fromData(data), before = JSON.stringify(state);
        expect(validateSyncEnvelope(envelope(state)).state).toBe(state);
        expect(JSON.stringify(state)).toBe(before);
        expect(materializeSyncData(state, {}).favorite_actresses[0].newVideoList).toHaveLength(2);
    });

    it.each([
        ["car_list/ABC-123", { value: field({ carNum: "XYZ-999", stateFlags: { favorite: "not-a-boolean" } }) }],
        ["blacklist_car_list/ABC-123", { "f:carNum": field("ABC-123"), "flag:blocked": field(true) }],
        ["favorite_actresses/actor", { "f:starId": field("actor"), "flag:favorite": field(true) }],
        ["blacklist/actor", { "f:starId": field("actor"), "video:ABC-123": field("ABC-123") }],
        ["setting/themeMode", { "f:value": field("dark") }],
        ["highlighted_tags/tag", { "f:name": field("tag") }],
        ["new_video_decisions/ABC-123", { "flag:watched": field(true) }],
        ["activity_log/log", { "f:id": field("log") }],
        ["offline_history/log", { "f:id": field("log") }],
    ])("rejects fields from a different domain: %s", (key, fields) => {
        expect(() => validateSyncState(model(key, fields))).toThrow("字段");
    });

    it.each([
        ["car_list/ABC-123", { "f:carNum": field("XYZ-999") }],
        ["car_list/ABC-123", { "f:carNum": field("ABC-123"), "flag:favorite": field("true") }],
        ["car_list/ABC-123", { "f:carNum": field("ABC-123"), "f:stateFlags": field({ favorite: true }) }],
        ["car_list/ABC-123", { "f:carNum": field("ABC-123"), "f:names": field(["Actor"]) }],
        ["favorite_actresses/42", { "f:starId": field(43) }],
        ["favorite_actresses/42", { "f:starId": field(42), "f:allName": field("Actor") }],
        ["favorite_actresses/42", { "f:starId": field(42), "video:ABC-123": field({ carNum: "XYZ-999" }) }],
        ["filter_keyword_title/one", { value: field("two") }],
        ["filter_keyword_review/one", { value: field({ text: "one" }) }],
        ["highlighted_tags/one", { value: field(1) }],
        ["new_video_decisions/ABC-123", { value: field({ action: "submit" }) }],
        ["new_video_decisions/ABC-123", { value: field({ action: "snoozed", until: "invalid" }) }],
        ["activity_log/log", { value: field({ id: "other", createdAt, commitState: "committed", changes: [] }) }],
        ["activity_log/log", { value: field({ id: "log", createdAt, commitState: "pending", changes: [] }) }],
        ["activity_log/log", { value: field({ id: "log", createdAt, commitState: "committed", changes: [{ carNum: "ABC-123", fields: "favorite" }] }) }],
        ["offline_history/log", { value: field({ id: "log", createdAt: "invalid" }) }],
        ["offline_history/log", { value: field({ id: "log", createdAt, resource: {} }) }],
        ["setting/customSources", { value: field({ score: Infinity }) }],
    ])("rejects invalid primary keys and field values: %s", (key, fields) => {
        expect(() => validateSyncState(model(key, fields))).toThrow("字段");
    });

    it("allows removed optional metadata and deleted generations, but refuses missing active identities", () => {
        const state = model("car_list/ABC-123", { "f:carNum": field("ABC-123"), "f:remark": { v: stamp, unset: true } });
        expect(validateSyncState(state)).toBe(state);
        delete state.records["car_list/ABC-123"].fields["f:carNum"];
        expect(() => validateSyncState(state)).toThrow("字段");
        state.records["car_list/ABC-123"].death = [2, replicaId];
        expect(validateSyncState(state)).toBe(state);
    });

    it.each(["car_list/", "car_list/abc-123", "car_list/%ZZ", "setting/a/b", "setting/%74heme", "unknown/key"])("rejects ambiguous or noncanonical record keys: %s", key => {
        expect(() => validateSyncState(model(key, { value: field("dark") }))).toThrow();
    });

    it("rejects malformed containers, field wrappers, private settings and history frontiers", () => {
        for (const records of [[], null, "records"]) expect(() => validateSyncState({ records, frontiers: {} })).toThrow();
        for (const fields of [[], null, { value: null }, { value: { v: stamp, value: "dark", unset: true } }, { value: { v: stamp, value: "dark", unset: false } }]) {
            expect(() => validateSyncState(model("setting/themeMode", fields))).toThrow();
        }
        expect(() => validateSyncState(model("setting/webDavPassword", { value: field("secret") }))).toThrow("本机");
        for (const frontiers of [[], { car_list: `${createdAt}\u0000id` }, { activity_log: "9999" }, { offline_history: `${createdAt}\u0000` }]) {
            expect(() => validateSyncState({ records: {}, frontiers })).toThrow("边界");
        }
        expect(validateSyncState({ records: {}, frontiers: { activity_log: "", offline_history: `${createdAt}\u0000old-id` } })).toBeTruthy();
        const coercible = model("setting/themeMode", { value: field("dark") });
        coercible.records["setting/themeMode"].birth = [1, [replicaId]];
        expect(() => validateSyncState(coercible)).toThrow("版本");
        expect(() => validateSyncEnvelope({ ...envelope(emptySyncModel()), replicaId: [replicaId] })).toThrow("格式");
    });

    it("rejects a correctly encrypted and hashed malformed snapshot before any business writes or publication", async () => {
        const dav = memoryDav(), local = await syncReplica(dav, { data: { car_list: [{ carNum: "KEEP-1", stateFlags: { favorite: true } }] } });
        const invalid = envelope(model("car_list/ABC-123", { value: field({ carNum: "XYZ-999", stateFlags: { favorite: "not-a-boolean" } }) }));
        const content = await encryptPortableBackup(JSON.stringify(invalid)), hash = await syncHash(content);
        dav.files.set(syncFileName(replicaId, 1, createdAt, hash), content);
        await local.service.check();
        expect(local.values.get("car_list")).toEqual([{ carNum: "KEEP-1", stateFlags: { favorite: true } }]);
        expect(local.values.has(SYNC_JOURNAL_KEY)).toBe(false);
        expect((await local.service.getStatus()).message).toContain("字段");
        expect(dav.client.writeSyncFile).not.toHaveBeenCalled();
        expect(dav.client.deleteSyncFile).not.toHaveBeenCalled();
    });

    it("accepts offline tasks without a movie number through the actual writer, publication and remote readback", async () => {
        const dav = memoryDav(), local = await syncReplica(dav);
        await local.state.appendOfflineHistory({ id: "task-without-movie", resource: "magnet:?xt=urn:btih:0123456789abcdef" });
        expect(local.values.get("offline_history")[0].carNum).toBeNull();
        await local.service.check();
        expect((await local.store.read()).pending).toBeNull();
        expect((await local.store.read()).lastSuccessAt).toBeGreaterThan(0);
        const other = await syncReplica(dav); await other.service.check();
        expect(other.values.get("offline_history")).toEqual(local.values.get("offline_history"));
        expect(other.values.get("offline_history")[0]).toMatchObject({ id: "task-without-movie", carNum: null });
    });
});
