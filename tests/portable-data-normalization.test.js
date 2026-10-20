import { describe, expect, it } from "vitest";
import { LEGACY_DATA_ALIASES, normalizePortableData } from "../src/core/migration.js";

const tombstone = { carNum: "ABC-1", url: "", names: "", status: "" };
const activity = { entries: [{ type: "new-video-remove", commitState: "committed", changes: [{ carNum: "ABC-1" }] }] };

describe("portable source normalization", () => {
    it.each(Object.entries(LEGACY_DATA_ALIASES))("maps %s to %s without expanding the import scope", (alias, key) => {
        const result = normalizePortableData({ data_version: 3, [alias]: [] });
        expect(result.data).toEqual({ [key]: [] });
    });

    it.each([[], null])("prefers an explicitly empty canonical domain (%s) over its alias", (canonical) => {
        expect(normalizePortableData({ data_version: 3, blacklist: canonical, filter_actor_actress_info_list: [{ name: "stale" }] }).data).toEqual({ blacklist: [] });
    });

    it("rejects malformed canonical or selected alias data instead of falling back", () => {
        expect(() => normalizePortableData({ blacklist: {}, filter_actor_actress_info_list: [] })).toThrow("blacklist 必须为数组");
        expect(() => normalizePortableData({ filter_actor_actress_info_list: {} })).toThrow("blacklist 必须为数组");
    });

    it("normalizes historical record fields without pairwise pruning or live settings writes", () => {
        const source = {
            setting: { enableCheckFilterActorActress: "no", enableCheckBlacklist: "yes" },
            blacklist: [{ name: "A", isActor: true, url: "https://example.test/actors/a?sort_type=1", recordTime: "old" }],
            favorite_actresses: [{ dbId: "a", newVideoList: ["abc123", { carNum: "def456" }] }],
            car_list: [{ carNum: "abc123", status: "favorite", actress: "A" }],
        };
        const before = structuredClone(source), { data } = normalizePortableData(source);
        expect(data.setting).toEqual({ enableCheckBlacklist: "yes" });
        expect(data.blacklist).toHaveLength(1);
        expect(data.blacklist[0]).toMatchObject({ starId: "a", role: "actor", createTime: "old", url: "https://example.test/actors/a" });
        expect(data.favorite_actresses[0]).toMatchObject({ starId: "a", newVideoList: ["ABC-123", { carNum: "DEF456" }] });
        expect(data.car_list[0]).toMatchObject({ carNum: "ABC-123", names: "A", stateFlags: { favorite: true } });
        expect(source).toEqual(before);
        expect(normalizePortableData(data).data).toEqual(data);
    });

    it("preserves explicit flags and reports canonical collisions", () => {
        const { data, warnings } = normalizePortableData({ car_list: [
            { carNum: "abc123", status: "favorite", stateFlags: { watched: true } },
            { carNum: "ABC-123", status: "hasDown" },
        ] });
        expect(data.car_list).toHaveLength(1);
        expect(data.car_list[0].stateFlags).toMatchObject({ watched: true, downloaded: true, favorite: false });
        expect(warnings[0].type).toBe("canonical-collision");
    });

    it("repairs tombstones only with all three supplied domains and committed non-reverted evidence", () => {
        const full = { data_version: 2, car_list: [tombstone], activity_log: activity, new_video_decisions: null };
        expect(normalizePortableData(full).data).toMatchObject({ car_list: [], new_video_decisions: { "ABC-1": { action: "dismissed" } } });
        for (const missing of ["activity_log", "new_video_decisions"]) {
            const partial = { ...full }; delete partial[missing];
            const { data } = normalizePortableData(partial);
            expect(data.car_list).toEqual([tombstone]);
            expect(Object.hasOwn(data, missing)).toBe(false);
        }
        for (const entry of [
            { ...activity.entries[0], commitState: "pending" },
            { ...activity.entries[0], changes: [{ carNum: "ABC-1", undoState: "reverted" }] },
        ]) expect(normalizePortableData({ ...full, activity_log: { entries: [entry] } }).data.car_list).toEqual([tombstone]);
    });

    it("ignores caches, snapshots and unrecognized keys", () => {
        expect(normalizePortableData({ data_version: 3, third_party_ttl_cache: {}, snapshots: [], unknown: "ignored" }).data).toEqual({});
    });
});
