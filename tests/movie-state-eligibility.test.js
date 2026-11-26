import { afterEach, describe, expect, it, vi } from "vitest";
import * as identity from "../src/core/movie-identity.js";
import { StateService } from "../src/core/state-service.js";
import { storageFromForage } from "./helpers/atomic-storage.js";
import { countPendingNewVideos } from "../src/core/new-video-model.js";

function harness(initial = {}) {
    const data = new Map(Object.entries(structuredClone(initial)));
    const forage = {
        getItem: async key => structuredClone(data.get(key)),
        setItem: vi.fn(async (key, value) => data.set(key, structuredClone(value))),
        removeItem: async key => data.delete(key),
    };
    const service = new StateService(storageFromForage(forage), { emit: async () => {} }, undefined, {
        currentUrl: () => "https://javdb.com/v/1", origin: () => "https://javdb.com",
    });
    return { data, forage, service };
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
        const { service, forage, data } = harness({ car_list: [{ carNum: "HEYZO", stateFlags: { favorite: true } }] });
        await expect(operation === "patch" ? service.patch("HEYZO", { favorite: false }) : service.toggle("HEYZO", "favorite")).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(forage.setItem).not.toHaveBeenCalled();
        expect((await service.getState("HEYZO")).stateFlags.favorite).toBe(true);
        expect(data.get("car_list")).toHaveLength(1);
    });
    it("preflights all patch keys and supplied records before writing any batch", async () => {
        const { service, forage } = harness();
        for (const [keys, options] of [ [["ABC-1", "HEYZO"], {}], [["ABC-1", ""], {}], ["ABC-1", { records: [{ carNum: "ABC-1" }, { carNum: "FC2" }] }], ["ABC-1", { record: { carNum: "ABC-1", stateEligibility: { eligible: false, reason: "conflicting" } } }] ]) {
            await expect(service.patch(keys, { favorite: true }, options)).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        }
        expect(forage.setItem).not.toHaveBeenCalled();
    });
    it("guards direct shared patch calls and toggle metadata before recovery writes", async () => {
        const { service, forage } = harness();
        service._recoverWithoutLock = vi.fn(async () => forage.setItem("recovery-marker", true));
        await expect(service._patchWithoutLock(["FC2"], { favorite: true }, {})).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        await expect(service.toggle("ABC-1", "favorite", { record: { carNum: "ABC-1", stateEligibility: { eligible: false } } })).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(forage.setItem).not.toHaveBeenCalled();
    });
    it("captures supported records before awaiting storage", async () => {
        const { service, data } = harness();
        let release;
        service.mutationCoordinator = { runExclusive: operation => new Promise(resolve => { release = () => resolve(operation()); }) };
        const input = [{ carNum: "ABC-1", url: "/v/1" }, { carNum: "ABC-2", url: "/v/2", stateEligibility: { eligible: true } }];
        const pending = service.patch(input.map(item => item.carNum), { favorite: true }, { records: input });
        input[1].carNum = "HEYZO";
        input[1].stateEligibility.eligible = false;
        release();
        await expect(pending).resolves.toMatchObject({ changed: ["ABC-1", "ABC-2"] });
        expect(data.get("car_list").map(item => item.carNum)).toEqual(["ABC-1", "ABC-2"]);
    });

    it("allows explicit history deletion and undo to preserve ambiguous legacy records", async () => {
        const record = { carNum: "HEYZO", stateFlags: { favorite: true }, names: "Legacy" }, { service, data } = harness({ car_list: [record] });
        const result = await service.remove("HEYZO");
        expect(data.get("car_list")).toEqual([]);
        expect((await service.undoTransaction(result.transactionId)).reverted).toEqual(["HEYZO"]);
        expect(data.get("car_list")).toEqual([record]);
    });
    it.each(["setNewVideoDecision", "removeFromNewVideoList"])("guards %s batches without partial updates", async operation => {
        const { service, forage } = harness({ favorite_actresses: [{ starId: "a", newVideoList: ["ABC-1", "HEYZO"] }] });
        await expect(service[operation](["ABC-1", "HEYZO"], "ignored")).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(forage.setItem).not.toHaveBeenCalled();
    });
    it.each(["setNewVideoDecision", "removeFromNewVideoList"])("validates the captured actual targets when %s waits for its lock", async operation => {
        const { service, forage } = harness({ favorite_actresses: [{ starId: "a", newVideoList: ["HEYZO"] }] });
        let release;
        service.mutationCoordinator = { runExclusive: operation => new Promise(resolve => { release = () => resolve(operation()); }) };
        const targets = ["HEYZO"], pending = service[operation](targets, "ignored");
        targets[0] = "ABC-1";
        release();
        await expect(pending).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(forage.setItem).not.toHaveBeenCalled();
    });
    it("strips transient eligibility from appended offline history without blocking incomplete history identities", async () => {
        const { service, data } = harness();
        const result = await service.appendOfflineHistory({ id: "offline-1", carNum: "HEYZO", status: "submitted", stateEligibility: { eligible: false, reason: "prefix-only" } });
        expect(result).toMatchObject({ id: "offline-1", carNum: "HEYZO", status: "submitted" });
        expect(result).not.toHaveProperty("stateEligibility");
        expect(data.get("offline_history")[0]).not.toHaveProperty("stateEligibility");
    });
    it("guards direct blacklist storage batches, including known entries carrying conflict evidence", async () => {
        const { service, forage } = harness({ blacklist_car_list: [{ carNum: "ABC-1" }] });
        await expect(service.batchSaveBlacklistCarList([{ carNum: "ABC-2", url: "/v/2", actionType: "filter" }, { carNum: "HEYZO", url: "/v/3", actionType: "filter" }])).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        await expect(service.batchSaveBlacklistCarList([{ carNum: "ABC-1", stateEligibility: { eligible: false } }])).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(forage.setItem).not.toHaveBeenCalled();
    });
    it("rejects direct ordinary inbox removals of unreliable numbers", async () => {
        const { service, forage } = harness({ favorite_actresses: [{ starId: "a", newVideoList: ["HEYZO"] }] });
        await expect(service.removeFromNewVideoList("HEYZO")).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(forage.setItem).not.toHaveBeenCalled();
    });
    it("carries unchanged legacy inbox entries while rejecting unreliable additions and edits", async () => {
        const legacy = { carNum: "HEYZO", title: "Legacy" }, { service, forage, data } = harness({ favorite_actresses: [{ starId: "a", newVideoList: [legacy] }] });
        await expect(service.updateFavoriteActress({ starId: "a", name: "Updated" })).resolves.toBe(true);
        await expect(service.updateFavoriteActress({ starId: "a", newVideoList: [structuredClone(legacy), { carNum: "ABC-1", stateEligibility: { eligible: true, reason: null } }] })).resolves.toBe(true);
        expect(data.get("favorite_actresses")[0].newVideoList).toEqual([legacy, { carNum: "ABC-1" }]);
        forage.setItem.mockClear();
        await expect(service.updateFavoriteActress({ starId: "a", newVideoList: [{ ...legacy, title: "Changed" }] })).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        await expect(service.updateFavoriteActress({ starId: "a", newVideoList: [legacy, "FC2"] })).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(forage.setItem).not.toHaveBeenCalled();
    });
    it.each(["HEYZO", { carNum: "HEYZO", stateEligibility: { eligible: false } }, 42, false])("rejects malformed direct inbox replacement %j", async newVideoList => {
        const { service, forage } = harness({ favorite_actresses: [{ starId: "a", newVideoList: [] }] });
        await expect(service.updateFavoriteActress({ starId: "a", newVideoList })).rejects.toThrow(TypeError);
        expect(forage.setItem).not.toHaveBeenCalled();
    });
    it("keeps null inbox updates as metadata-only edits and permits replacing malformed legacy lists", async () => {
        const { service, data } = harness({ favorite_actresses: [{ starId: "a", newVideoList: "legacy" }] });
        await service.updateFavoriteActress({ starId: "a", name: "Updated", newVideoList: null });
        expect(data.get("favorite_actresses")[0]).toMatchObject({ name: "Updated", newVideoList: "legacy" });
        await expect(service.updateFavoriteActress({ starId: "a", newVideoList: [{ carNum: "ABC-1" }] })).resolves.toBe(true);
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
