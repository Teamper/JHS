import { afterEach, describe, expect, it, vi } from "vitest";
import * as identity from "../src/core/movie-identity.js";
import { StateService } from "../src/core/state-service.js";
import { StorageManager } from "../src/core/storage.js";
import { countPendingNewVideos } from "../src/core/new-video-model.js";

function harness(initial = {}) {
    const data = new Map(Object.entries(structuredClone(initial))), storage = Object.create(StorageManager.prototype);
    Object.assign(storage, {
        car_list_key: "car_list", favorite_actresses_key: "favorite_actresses", blacklist_car_list_key: "blacklist_car_list",
        getCar: async carNum => (data.get("car_list") || []).find(item => item.carNum === carNum),
        getCarMap: async () => new Map((data.get("car_list") || []).map(item => [item.carNum, item])),
        getFavoriteActressList: async () => data.get("favorite_actresses") || [],
        getBlacklistCarList: async () => data.get("blacklist_car_list") || [],
        _invalidateCache() {}, withActressLock: operation => operation(), _withCrossTabLock: (name, operation) => operation(),
        forage: { getItem: async key => data.get(key), setItem: vi.fn(async (key, value) => data.set(key, structuredClone(value))), removeItem: async key => data.delete(key) },
    });
    storage._setItemAndInvalidate = (key, value) => storage.forage.setItem(key, value);
    vi.stubGlobal("utils", { getNowStr: () => "2026-10-23 00:00:00" });
    vi.stubGlobal("window", { location: { href: "https://javdb.com/v/1", origin: "https://javdb.com" } });
    vi.stubGlobal("clog", { html() {}, log() {}, warn() {} });
    vi.stubGlobal("show", { error() {} });
    const service = new StateService(storage, { emit: async () => {} });
    storage.stateService = service;
    return { data, storage, service };
}

describe("movie state identity eligibility", () => {
    afterEach(() => vi.unstubAllGlobals());
    it.each([["", "missing"], ["undefined", "missing"], ["null", "missing"], ["N/A", "missing"], ["----", "missing"], ["Sample Label", "label-only"], ["HEYZO", "prefix-only"], ["FC2", "prefix-only"], ["fc2_ppv", "prefix-only"]])("rejects incomplete %s", (value, reason) => {
        expect(identity.getMovieStateEligibility?.(value)).toEqual({ eligible: false, reason });
    });
    it.each(["HEYZO1234", "FC2-PPV-1234567", "FC21234567", "123456_789", "ABC-1", "1PONDO-123456-001"])("keeps numeric identity %s", value => {
        expect(identity.getMovieStateEligibility?.(value)).toEqual({ eligible: true, reason: null });
    });
    it("does not trust a true override and preserves explicit negative evidence", () => {
        expect(identity.getMovieStateEligibility?.({ carNum: "FC2", stateEligibility: { eligible: true } })).toEqual({ eligible: false, reason: "prefix-only" });
        expect(identity.getMovieStateEligibility?.({ carNum: "ABC-1", stateEligibility: { eligible: false, reason: "conflicting" } })).toEqual({ eligible: false, reason: "conflicting" });
        expect(identity.getMovieStateEligibility?.({ carNum: "ABC-1", stateEligibility: { eligible: false, reason: "bogus" } })).toEqual({ eligible: false, reason: "conflicting" });
    });
    it.each(["patch", "toggle"])("rejects ordinary %s on restored ambiguous records before writes", async operation => {
        const { service, storage, data } = harness({ car_list: [{ carNum: "HEYZO", stateFlags: { favorite: true } }] });
        await expect(operation === "patch" ? service.patch("HEYZO", { favorite: false }) : service.toggle("HEYZO", "favorite")).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(storage.forage.setItem).not.toHaveBeenCalled();
        expect((await service.getState("HEYZO")).stateFlags.favorite).toBe(true);
        expect(data.get("car_list")).toHaveLength(1);
    });
    it("preflights all patch keys and supplied records before writing any batch", async () => {
        const { service, storage } = harness();
        for (const [keys, options] of [ [["ABC-1", "HEYZO"], {}], [["ABC-1", ""], {}], ["ABC-1", { records: [{ carNum: "ABC-1" }, { carNum: "FC2" }] }], ["ABC-1", { record: { carNum: "ABC-1", stateEligibility: { eligible: false, reason: "conflicting" } } }] ]) {
            await expect(service.patch(keys, { favorite: true }, options)).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        }
        expect(storage.forage.setItem).not.toHaveBeenCalled();
    });
    it("guards direct shared patch calls and toggle metadata before recovery writes", async () => {
        const { service, storage } = harness();
        service._recoverWithoutLock = vi.fn(async () => storage.forage.setItem("recovery-marker", true));
        await expect(service._patchWithoutLock(["FC2"], { favorite: true }, {})).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        await expect(service.toggle("ABC-1", "favorite", { record: { carNum: "ABC-1", stateEligibility: { eligible: false } } })).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(storage.forage.setItem).not.toHaveBeenCalled();
    });
    it("preflights legacy storage batches across different flag groups", async () => {
        const { storage } = harness();
        await expect(storage.saveCarList([{ carNum: "ABC-1", url: "/v/1", actionType: "favorite" }, { carNum: "HEYZO", url: "/v/2", actionType: "filter" }])).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(storage.forage.setItem).not.toHaveBeenCalled();
    });
    it("captures a legacy storage batch before awaiting metadata reads", async () => {
        const { storage, data } = harness();
        let resumeMap;
        storage.getCarMap = () => new Promise(resolve => { resumeMap = () => resolve(new Map()); });
        const input = [{ carNum: "ABC-1", url: "/v/1", actionType: "favorite" }, { carNum: "ABC-2", url: "/v/2", actionType: "filter", stateEligibility: { eligible: true } }];
        const pending = storage.saveCarList(input);
        input[1].carNum = "HEYZO";
        input[1].stateEligibility.eligible = false;
        resumeMap();
        await expect(pending).resolves.toBeUndefined();
        expect(data.get("car_list").map(item => item.carNum)).toEqual(["ABC-1", "ABC-2"]);
    });
    it("preserves negative identity evidence in the legacy metadata update route", async () => {
        const { storage } = harness({ car_list: [{ carNum: "ABC-1", stateFlags: {} }] });
        await expect(storage.updateCarInfo({ carNum: "ABC-1", url: "/v/1", actionType: "favorite", stateEligibility: { eligible: false, reason: "conflicting" } })).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(storage.forage.setItem).not.toHaveBeenCalled();
    });
    it("allows explicit history deletion and undo to preserve ambiguous legacy records", async () => {
        const record = { carNum: "HEYZO", stateFlags: { favorite: true }, names: "Legacy" }, { service, data } = harness({ car_list: [record] });
        const result = await service.remove("HEYZO");
        expect(data.get("car_list")).toEqual([]);
        expect((await service.undoTransaction(result.transactionId)).reverted).toEqual(["HEYZO"]);
        expect(data.get("car_list")).toEqual([record]);
    });
    it.each(["setNewVideoDecision", "removeFromNewVideoList"])("guards %s batches without partial updates", async operation => {
        const { service, storage } = harness({ favorite_actresses: [{ starId: "a", newVideoList: ["ABC-1", "HEYZO"] }] });
        await expect(service[operation](["ABC-1", "HEYZO"], "ignored")).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(storage.forage.setItem).not.toHaveBeenCalled();
    });
    it.each(["setNewVideoDecision", "removeFromNewVideoList"])("validates the captured actual targets when %s waits for its lock", async operation => {
        const { service, storage } = harness({ favorite_actresses: [{ starId: "a", newVideoList: ["HEYZO"] }] });
        let release;
        service.mutationCoordinator = { runExclusive: operation => new Promise(resolve => { release = () => resolve(operation()); }) };
        const targets = ["HEYZO"], pending = service[operation](targets, "ignored");
        targets[0] = "ABC-1";
        release();
        await expect(pending).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(storage.forage.setItem).not.toHaveBeenCalled();
    });
    it("strips transient eligibility from appended offline history without blocking incomplete history identities", async () => {
        const { service, data } = harness();
        const result = await service.appendOfflineHistory({ id: "offline-1", carNum: "HEYZO", status: "submitted", stateEligibility: { eligible: false, reason: "prefix-only" } });
        expect(result).toMatchObject({ id: "offline-1", carNum: "HEYZO", status: "submitted" });
        expect(result).not.toHaveProperty("stateEligibility");
        expect(data.get("offline_history")[0]).not.toHaveProperty("stateEligibility");
    });
    it("guards direct blacklist storage batches, including known entries carrying conflict evidence", async () => {
        const { storage } = harness({ blacklist_car_list: [{ carNum: "ABC-1" }] });
        await expect(storage.batchSaveBlacklistCarList([{ carNum: "ABC-2", url: "/v/2", actionType: "filter" }, { carNum: "HEYZO", url: "/v/3", actionType: "filter" }])).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        await expect(storage.batchSaveBlacklistCarList([{ carNum: "ABC-1", stateEligibility: { eligible: false } }])).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(storage.forage.setItem).not.toHaveBeenCalled();
    });
    it("rejects direct ordinary inbox removals of unreliable numbers", async () => {
        const { storage } = harness({ favorite_actresses: [{ starId: "a", newVideoList: ["HEYZO"] }] });
        await expect(storage.removeNewVideoList("HEYZO")).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(storage.forage.setItem).not.toHaveBeenCalled();
    });
    it("carries unchanged legacy inbox entries while rejecting unreliable additions and edits", async () => {
        const legacy = { carNum: "HEYZO", title: "Legacy" }, { storage, data } = harness({ favorite_actresses: [{ starId: "a", newVideoList: [legacy] }] });
        await expect(storage.updateFavoriteActress({ starId: "a", name: "Updated" })).resolves.toBe(true);
        await expect(storage.updateFavoriteActress({ starId: "a", newVideoList: [structuredClone(legacy), { carNum: "ABC-1", stateEligibility: { eligible: true, reason: null } }] })).resolves.toBe(true);
        expect(data.get("favorite_actresses")[0].newVideoList).toEqual([legacy, { carNum: "ABC-1" }]);
        storage.forage.setItem.mockClear();
        await expect(storage.updateFavoriteActress({ starId: "a", newVideoList: [{ ...legacy, title: "Changed" }] })).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        await expect(storage.updateFavoriteActress({ starId: "a", newVideoList: [legacy, "FC2"] })).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(storage.forage.setItem).not.toHaveBeenCalled();
    });
    it.each(["HEYZO", { carNum: "HEYZO", stateEligibility: { eligible: false } }, 42, false])("rejects malformed direct inbox replacement %j", async newVideoList => {
        const { storage } = harness({ favorite_actresses: [{ starId: "a", newVideoList: [] }] });
        await expect(storage._rawUpdateFavoriteActress({ starId: "a", newVideoList })).rejects.toThrow(TypeError);
        expect(storage.forage.setItem).not.toHaveBeenCalled();
    });
    it("keeps null inbox updates as metadata-only edits and permits replacing malformed legacy lists", async () => {
        const { storage, data } = harness({ favorite_actresses: [{ starId: "a", newVideoList: "legacy" }] });
        await storage._rawUpdateFavoriteActress({ starId: "a", name: "Updated", newVideoList: null });
        expect(data.get("favorite_actresses")[0]).toMatchObject({ name: "Updated", newVideoList: "legacy" });
        await expect(storage._rawUpdateFavoriteActress({ starId: "a", newVideoList: [{ carNum: "ABC-1" }] })).resolves.toBe(true);
        expect(data.get("favorite_actresses")[0].newVideoList).toEqual([{ carNum: "ABC-1" }]);
    });
    it("keeps runtime eligibility out of persisted state and excludes unreliable pending groups", async () => {
        const { service, data } = harness();
        await service.patch("ABC-1", { favorite: true }, { record: { carNum: "ABC-1", stateEligibility: { eligible: true } } });
        expect(JSON.stringify(Object.fromEntries(data))).not.toContain("stateEligibility");
        const actresses = [{ newVideoList: ["HEYZO", { carNum: "ABC-2", stateEligibility: { eligible: false, reason: "conflicting" } }, "ABC-3"] }];
        expect(countPendingNewVideos(actresses, new Map(), {})).toBe(1);
        expect(actresses[0].newVideoList).toHaveLength(3);
    });
});
