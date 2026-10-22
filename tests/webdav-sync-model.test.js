import { describe, expect, it } from "vitest";
import { emptySyncModel, joinSyncModels, materializeSyncData, projectSyncData, versionSyncDiff, syncJson, syncFileName, parseSyncFileName, retainedSyncFiles, validateSyncEnvelope, pruneSyncHistory } from "../src/core/webdav-sync-model.js";

const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const record = flags => ({ carNum: "ABC-123", stateFlags: { favorite: false, downloaded: false, watched: false, blocked: false, ...flags }, remark: "" });
const projection = value => projectSyncData({ car_list: [value] });
const change = (model, before, after, counter, replica = A) => versionSyncDiff(model, before, after, [counter, replica]).model;

describe("versioned WebDAV state", () => {
    it("retains independent fields when two offline devices first add the same record", () => {
        const a = change(emptySyncModel(), {}, projection({ ...record({ favorite: true }), remark: "note" }), 2);
        const b = change(emptySyncModel(), {}, projection({ ...record({ watched: true }), names: "actor" }), 3, B);
        const merge = joinSyncModels(a, b);
        expect(materializeSyncData(merge, {}).car_list[0]).toMatchObject({ stateFlags: { favorite: true, watched: true }, remark: "note", names: "actor" });
        const deleted = change(a, projection({ ...record({ favorite: true }), remark: "note" }), {}, 4);
        const rebuilt = change(deleted, {}, projection(record({ downloaded: true })), 5);
        const left = joinSyncModels(joinSyncModels(a, b), rebuilt), right = joinSyncModels(a, joinSyncModels(b, rebuilt));
        expect(syncJson(left)).toBe(syncJson(right));
        expect(materializeSyncData(left, {}).car_list[0].stateFlags).toMatchObject({ favorite: false, watched: false, downloaded: true });
    });
    it("converges under arbitrary merge order without losing independent flags, fields or preferences", () => {
        const initial = projection(record({})), base = change(emptySyncModel(), {}, initial, 1);
        const left = change(base, initial, projection({ ...record({ favorite: true }), remark: "left" }), 2);
        const right = change(base, initial, projection(record({ watched: true })), 2, B);
        const merged = joinSyncModels(left, right), reverse = joinSyncModels(right, left);
        expect(syncJson(merged)).toBe(syncJson(reverse));
        expect(syncJson(joinSyncModels(merged, merged))).toBe(syncJson(merged));
        expect(materializeSyncData(merged, {}).car_list[0]).toMatchObject({ stateFlags: { favorite: true, watched: true }, remark: "left" });
    });
    it("persists cancellation and delete generations; an old offline edit cannot resurrect a record", () => {
        const before = projection(record({ favorite: true })), base = change(emptySyncModel(), {}, before, 1);
        const canceled = change(base, before, projection(record({ favorite: false })), 2);
        expect(materializeSyncData(joinSyncModels(base, canceled), {}).car_list[0].stateFlags.favorite).toBe(false);
        const deleted = change(canceled, projection(record({ favorite: false })), {}, 3);
        const stale = change(base, before, projection({ ...record({ favorite: true }), remark: "offline" }), 100, B);
        expect(materializeSyncData(joinSyncModels(deleted, stale), {}).car_list).toEqual([]);
        const rebuilt = change(deleted, {}, projection(record({ watched: true })), 101);
        expect(materializeSyncData(joinSyncModels(rebuilt, stale), {}).car_list[0]).toMatchObject({ stateFlags: { watched: true, favorite: false } });
        expect(materializeSyncData(joinSyncModels(rebuilt, stale), {}).car_list[0].remark || "").toBe("");
    });
    it("uses deterministic field ordering for same-field edits and rejects same-version different values", () => {
        const old = projectSyncData({ setting: { themeMode: "light" } }), base = change(emptySyncModel(), {}, old, 1);
        const a = change(base, old, projectSyncData({ setting: { themeMode: "dark" } }), 2);
        const b = change(base, old, projectSyncData({ setting: { themeMode: "auto" } }), 2, B);
        expect(materializeSyncData(joinSyncModels(a, b), {}).setting.themeMode).toBe("auto");
        const invalid = structuredClone(a); invalid.records["setting/themeMode"].fields.value.value = "auto";
        expect(() => joinSyncModels(a, invalid)).toThrow("同一版本");
    });
    it("keeps layout and credentials local, synchronizes JSON as one field and collection members separately", () => {
        const data = { setting: { themeMode: "dark", mobileMode: "on", containerColumns: 2, webDavUrl: "https://dav.example", webDavPassword: "secret", trustedLocalOrigins: ["private"], customSources: [{ id: "one" }] }, highlighted_tags: ["中文", "tag"], filter_keyword_title: ["blocked"] };
        const model = change(emptySyncModel(), {}, projectSyncData(data), 1);
        const text = JSON.stringify(model); expect(text).not.toContain("secret"); expect(text).not.toContain("webDavUrl");
        const result = materializeSyncData(model, { setting: { mobileMode: "off", containerColumns: 7, webDavPassword: "local" } });
        expect(result.setting).toMatchObject({ themeMode: "dark", mobileMode: "off", containerColumns: 7, webDavPassword: "local", customSources: [{ id: "one" }] });
        const removed = change(model, projectSyncData(data), projectSyncData({ ...data, highlighted_tags: ["中文"] }), 2);
        expect(materializeSyncData(joinSyncModels(model, removed), {}).highlighted_tags).toEqual(["中文"]);
    });
    it("distinguishes null, unset and false and ignores bookkeeping-only updates", () => {
        const p = projectSyncData({ setting: { optional: null, toggle: false } });
        const base = change(emptySyncModel(), {}, p, 1);
        expect(materializeSyncData(base, {}).setting).toEqual({ optional: null, toggle: false });
        const unset = change(base, p, projectSyncData({ setting: { toggle: false } }), 2);
        expect(materializeSyncData(unset, {}).setting).toEqual({ toggle: false });
        const old = projection({ ...record({}), updateDate: "old" });
        expect(versionSyncDiff(change(emptySyncModel(), {}, old, 1), old, projection({ ...record({}), updateDate: "new" }), [2, A]).changed).toBe(false);
    });
    it("prunes history with a monotone frontier so old snapshots cannot refill it", () => {
        const history = Array.from({ length: 1005 }, (_, i) => ({ id: `id-${String(i).padStart(5, "0")}`, createdAt: "2026-10-01T00:00:00.000Z", carNum: "ABC-123" }));
        const all = change(emptySyncModel(), {}, projectSyncData({ offline_history: history }), 1);
        const compact = pruneSyncHistory(structuredClone(all), {}, Date.UTC(2026, 9, 22));
        expect(materializeSyncData(joinSyncModels(compact, all), {}).offline_history).toHaveLength(1000);
    });
    it("validates future data and isolates malformed field versions", () => {
        const state = change(emptySyncModel(), {}, projection(record({})), 1);
        const envelope = { schema: 1, dataVersion: 3, replicaId: A, seq: 1, createdAt: new Date().toISOString(), state };
        expect(validateSyncEnvelope(envelope)).toBe(envelope);
        expect(() => validateSyncEnvelope({ ...envelope, schema: 2 })).toThrow("不支持");
        expect(() => validateSyncEnvelope({ ...envelope, dataVersion: 999 })).toThrow("不支持");
        const invalid = structuredClone(envelope); invalid.state.records["car_list/ABC-123"].fields["f:carNum"].v = [NaN, A];
        expect(() => validateSyncEnvelope(invalid)).toThrow("字段");
    });
});

describe("immutable file retention", () => {
    const file = (seq, day, replica = A) => parseSyncFileName(syncFileName(replica, seq, `2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`, "a".repeat(64)));
    it("keeps recent versions plus each UTC day's last version, without selecting foreign files", () => {
        const files = [file(1, 1), file(2, 1), file(3, 2), file(4, 3), file(5, 3), file(6, 4), file(100, 1, B)];
        const keep = retainedSyncFiles(files, A, 3, 30, Date.UTC(2026, 9, 5));
        expect([...keep]).toEqual(expect.arrayContaining([files[1].name, files[2].name, files[3].name, files[4].name, files[5].name]));
        expect(keep.has(files[0].name)).toBe(false); expect(keep.has(files[6].name)).toBe(false);
    });
    it("retains old latest states indefinitely and suppresses GC on clock anomalies", () => {
        const files = [file(1, 1), file(2, 2), file(3, 3), file(4, 4)];
        expect(retainedSyncFiles(files, A, 3, 1, Date.UTC(2027, 1, 1)).size).toBe(3);
        expect(retainedSyncFiles(files, A, 3, 1, Date.UTC(2026, 8, 1)).size).toBe(4);
        expect(retainedSyncFiles([file(1, 3), file(2, 2), file(3, 4), file(4, 5)], A, 3, 1, Date.UTC(2026, 9, 6)).size).toBe(4);
    });
});
