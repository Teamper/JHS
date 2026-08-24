import { describe, expect, it } from "vitest";
import * as api from "../src/features/list/list-filters.js";

const flags = (...active) => Object.fromEntries(["favorite", "downloaded", "watched", "blocked"].map(key => [key, active.includes(key)]));
const reasons = (...active) => Object.fromEntries(["keyword", "actorBlacklist", "actressBlacklist"].map(key => [key, active.includes(key)]));

describe("multi-state list visibility", () => {
    it("normalizes legacy and invalid quick-filter keys at the boundary", () => {
        expect(api.normalizeQuickFilterKey("filter")).toBe("blockedItems");
        expect(api.normalizeQuickFilterKey("recent7d")).toBe("recent7d");
        expect(api.normalizeQuickFilterKey("unknown")).toBe("waitCheck");
        expect(Array.from(api.PRIMARY_QUICK_FILTERS)).toEqual(["all", "waitCheck", "favorite", "hasDown", "hasWatch"]);
        expect(Array.from(api.SECONDARY_QUICK_FILTERS)).toEqual(["blockedItems", "favoriteUndownloaded", "favoriteUnwatched", "downloadedUnwatched", "recent7d"]);
    });

    it.each([
        [flags(), reasons(), false],
        [flags("blocked"), reasons(), true],
        [flags(), reasons("keyword"), true],
        [flags(), reasons("actorBlacklist"), true],
        [flags(), reasons("actressBlacklist"), true],
        [flags("blocked"), reasons("keyword", "actorBlacklist", "actressBlacklist"), true]
    ])("computes hard-hidden union for %#", (stateFlags, visibilityReasons, expected) => {
        expect(api.isHardHidden(stateFlags, visibilityReasons)).toBe(expected);
    });

    it.each([
        ["waitCheck", flags(), reasons(), false, true],
        ["waitCheck", flags(), reasons("keyword"), false, false],
        ["favorite", flags("favorite"), reasons(), false, true],
        ["favorite", flags("favorite"), reasons("actorBlacklist"), false, false],
        ["hasDown", flags("downloaded", "blocked"), reasons(), false, false],
        ["hasWatch", flags("watched"), reasons(), false, true],
        ["favoriteUndownloaded", flags("favorite"), reasons(), false, true],
        ["favoriteUndownloaded", flags("favorite", "downloaded"), reasons(), false, false],
        ["favoriteUnwatched", flags("favorite"), reasons(), false, true],
        ["downloadedUnwatched", flags("downloaded"), reasons(), false, true],
        ["recent7d", flags(), reasons(), true, true],
        ["blockedItems", flags(), reasons("keyword"), false, true],
        ["blockedItems", flags("blocked"), reasons(), false, true]
    ])("matches %s with hard-hidden precedence", (filter, stateFlags, visibilityReasons, recent, expected) => {
        expect(api.matchesQuickFilter(filter, stateFlags, { visibilityReasons, recent })).toBe(expected);
    });

    it("matches the complete primary-filter matrix without a second visibility rule", () => {
        const records = {
            A: flags(),
            B: flags("favorite"),
            C: flags("downloaded"),
            D: flags("watched"),
            E: flags("favorite", "downloaded"),
            F: flags("favorite", "watched"),
            G: flags("downloaded", "watched"),
            H: flags("favorite", "downloaded", "watched"),
            I: flags("blocked")
        }, visible = filter => Object.entries(records).filter(([, stateFlags]) => api.shouldShowItem({
            filter,
            flags: stateFlags,
            visibilityReasons: reasons(),
            recent: false
        })).map(([key]) => key);
        expect(visible("all")).toEqual([ "A", "B", "C", "D", "E", "F", "G", "H" ]);
        expect(visible("waitCheck")).toEqual([ "A" ]);
        expect(visible("favorite")).toEqual([ "B", "E", "F", "H" ]);
        expect(visible("hasDown")).toEqual([ "C", "E", "G", "H" ]);
        expect(visible("hasWatch")).toEqual([ "D", "F", "G", "H" ]);
        expect(visible("blockedItems")).toEqual([ "I" ]);
    });

    it("keeps every hard-hidden reason out of all and exposes it through blocked items", () => {
        for (const visibilityReasons of [ reasons("keyword"), reasons("actorBlacklist"), reasons("actressBlacklist") ]) {
            expect(api.shouldShowItem({ filter: "all", flags: flags("favorite"), visibilityReasons, recent: false })).toBe(false);
            expect(api.shouldShowItem({ filter: "blockedItems", flags: flags("favorite"), visibilityReasons, recent: false })).toBe(true);
        }
    });
});
