import { describe, expect, it, vi } from "vitest";
import { StateService } from "../src/core/state-service.js";
import { storageFromForage } from "./helpers/atomic-storage.js";

function fixture(initial = []) {
    const values = new Map([["car_list", initial]]);
    const setItem = vi.fn(async (key, value) => values.set(key, structuredClone(value)));
    const storage = storageFromForage({ getItem: async key => structuredClone(values.get(key)), setItem, removeItem: async key => values.delete(key) });
    const state = new StateService(storage, {}, undefined, { currentUrl: () => "https://javdb.test/v/1" });
    return { state, values, setItem };
}

describe("state persistence through the storage port", () => {
    it("preserves a completed mark and skips the duplicate write", async () => {
        const { state, setItem, values } = fixture();
        await expect(state.patch("abc-1", { favorite: true })).resolves.toMatchObject({ changed: ["ABC-1"] });
        setItem.mockClear();
        await expect(state.patch("ABC-1", { favorite: true })).resolves.toMatchObject({ changed: [] });
        expect(setItem).not.toHaveBeenCalled();
        expect(values.get("car_list")).toMatchObject([{ carNum: "ABC-1", stateFlags: { favorite: true } }]);
    });

    it("rejects every write if any record in a submitted batch is ambiguous", async () => {
        const { state, setItem } = fixture();
        await expect(state.patch(["ABC-1", "HEYZO"], { favorite: true })).rejects.toMatchObject({ code: "UNRELIABLE_MOVIE_IDENTITY" });
        expect(setItem).not.toHaveBeenCalled();
    });

    it("does not recreate missing data during an existing-record edit", async () => {
        const { state, setItem, values } = fixture();
        await expect(state.patch("ABC-1", {}, { existingOnly: true, record: { names: "Updated" } })).resolves.toMatchObject({ changed: [] });
        expect(setItem).not.toHaveBeenCalled();
        expect(values.get("car_list")).toEqual([]);
    });
});
