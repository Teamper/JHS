import { afterEach, describe, expect, it, vi } from "vitest";
import { emptySyncModel, projectSyncData, validateSyncState, versionSyncDiff } from "../src/core/webdav-sync-model.js";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";

const legacy = () => [
    { carNum: "ABC123", starId: "actor-1", names: "Older", url: "https://javdb.com/v/old", remark: "keep local note", createDate: "2026-10-01", updateDate: "2026-10-20" },
    { carNum: "ＡＢＣ－１２３", starId: "actor-1", names: "Latest", url: "", publishTime: "2026-10-02", createDate: "2026-10-03", updateDate: "2026-10-22" },
];
const input = carNum => ({ carNum, starId: "actor-1", names: "Actor", url: "https://javdb.com/v/test", actionType: "filter" });
afterEach(() => vi.unstubAllGlobals());

describe("legacy blocked movie identity collisions", () => {
    it.each([false, true])("projects duplicate blocked movies without losing complementary metadata (exact duplicate=%s)", exact => {
        const list = legacy(); if (exact) list[1].carNum = list[0].carNum;
        const before = structuredClone(list), projected = projectSyncData({ blacklist_car_list: list });
        expect(Object.keys(projected)).toEqual(["blacklist_car_list/ABC-123"]);
        expect(projected["blacklist_car_list/ABC-123"]).toMatchObject({
            "f:carNum": "ABC-123", "f:starId": "actor-1", "f:names": "Latest", "f:url": "https://javdb.com/v/old",
            "f:remark": "keep local note", "f:publishTime": "2026-10-02", "f:createDate": "2026-10-01", "f:updateDate": "2026-10-22",
        });
        const state = versionSyncDiff(emptySyncModel(), {}, projected, [1, "11111111-1111-4111-8111-111111111111"]).model;
        expect(validateSyncState(state)).toBe(state);
        expect(list).toEqual(before);
    });

    it("keeps invalid blocked identities and other duplicate domains rejected", () => {
        expect(() => projectSyncData({ blacklist_car_list: [{ carNum: "undefined" }] })).toThrow("缺少稳定标识");
        expect(() => projectSyncData({ car_list: [{ carNum: "ABC123" }, { carNum: "ABC-123" }] })).toThrow("标识重复");
    });

    it("preserves explicit null and empty metadata on an unambiguous blocked record", () => {
        const item = { carNum: "ABC123", starId: "actor-1", remark: null, url: "", names: "Actor" };
        expect(projectSyncData({ blacklist_car_list: [item] })["blacklist_car_list/ABC-123"]).toEqual({
            "f:carNum": "ABC123", "f:starId": "actor-1", "f:remark": null, "f:url": "", "f:names": "Actor",
        });
    });

    it("does not append another canonical movie when a legacy spelling already exists", async () => {
        const a = await syncReplica(memoryDav(), { data: { blacklist_car_list: [input("ABC123")] } });
        const before = structuredClone(a.values.get("blacklist_car_list"));
        expect(await a.storage.batchSaveBlacklistCarList([input("ABC-123")])).toEqual({ changed: [] });
        expect(a.values.get("blacklist_car_list")).toEqual(before);
    });

    it("stores one canonical blocked movie when a batch contains different spellings", async () => {
        const a = await syncReplica(memoryDav());
        expect(await a.storage.batchSaveBlacklistCarList([input("ABC123"), input("abc-123")])).toEqual({ changed: ["ABC-123"] });
        expect(a.values.get("blacklist_car_list")).toHaveLength(1);
        expect(a.values.get("blacklist_car_list")[0]).toMatchObject({ carNum: "ABC-123", starId: "actor-1", status: "filter" });
        await a.service.check();
        expect((await a.store.read()).error).toBe("");
        expect((await a.store.read()).dirty).toBe(false);
    });

    it.each([false, true])("syncs historical collisions and retains their original rows in a local restore point (already joined=%s)", async joined => {
        const dav = memoryDav(), list = legacy(), a = await syncReplica(dav, { data: joined ? {} : { blacklist_car_list: list } });
        if (joined) { await a.service.check(); a.values.set("blacklist_car_list", structuredClone(list)); a.advance(60001); }
        await a.service.retry();
        expect((await a.store.read()).error).toBe("");
        expect((await a.store.read()).dirty).toBe(false);
        expect(a.values.get("blacklist_car_list")).toHaveLength(1);
        expect(a.values.get("blacklist_car_list")[0]).toMatchObject({ carNum: "ABC-123", names: "Latest", remark: "keep local note" });
        expect(a.values.get("snapshots").some(snapshot => JSON.stringify(snapshot.data.blacklist_car_list) === JSON.stringify(list))).toBe(true);
        const size = dav.files.size, snapshots = a.values.get("snapshots").length;
        await a.service.check(); expect(dav.files.size).toBe(size); expect(a.values.get("snapshots")).toHaveLength(snapshots);
        const b = await syncReplica(dav); await b.service.check();
        expect(b.values.get("blacklist_car_list")).toEqual(a.values.get("blacklist_car_list"));
    });

    it("preserves original rows and makes no new upload if the repair restore point cannot be saved", async () => {
        const dav = memoryDav(), a = await syncReplica(dav); await a.service.check();
        const list = legacy(); a.values.set("blacklist_car_list", structuredClone(list)); a.advance(60001);
        const save = a.forage.setItem.getMockImplementation(), size = dav.files.size;
        a.forage.setItem.mockImplementation(async (key, value) => { if (key === "snapshots") throw new Error("restore point quota"); return save(key, value); });
        await a.service.retry();
        expect((await a.store.read()).error).toContain("restore point quota");
        expect(a.values.get("blacklist_car_list")).toEqual(list); expect(dav.files.size).toBe(size);
    });
});
