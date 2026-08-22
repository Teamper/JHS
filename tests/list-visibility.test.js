import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

function loadVisibility() {
    const source = readFileSync(join(process.cwd(), "src/plugins/status/list-page.js"), "utf8"), start = source.indexOf("const QUICK_FILTER_LABELS"), end = source.indexOf("class ListPagePlugin", start), context = vm.createContext({ _: "yes", C: "no", hasAnyState: flags => Object.values(flags).some(Boolean) });
    vm.runInContext(`${source.slice(start, end)};globalThis.api={normalizeQuickFilterKey,isHardHidden,matchesQuickFilter,shouldHideInDefaultView,shouldShowItem,PRIMARY_QUICK_FILTERS,SECONDARY_QUICK_FILTERS}`, context);
    return context.api;
}

const flags = (...active) => Object.fromEntries(["favorite", "downloaded", "watched", "blocked"].map(key => [key, active.includes(key)]));
const reasons = (...active) => Object.fromEntries(["keyword", "actorBlacklist", "actressBlacklist"].map(key => [key, active.includes(key)]));

describe("multi-state list visibility", () => {
    const api = loadVisibility();

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

    it.each([
        [["favorite"], { showFavoriteItem: "no" }, true],
        [["downloaded"], { showHasDownItem: "yes" }, false],
        [["watched"], { showHasWatchItem: "no" }, true],
        [["favorite", "downloaded"], { showFavoriteItem: "no", showHasDownItem: "yes" }, false],
        [["favorite", "watched"], { showFavoriteItem: "no", showHasWatchItem: "no" }, true],
        [[], { showFavoriteItem: "no", showHasDownItem: "no", showHasWatchItem: "no" }, false]
    ])("computes all-view state preference for %j", (active, settings, hidden) => expect(api.shouldHideInDefaultView(flags(...active), settings)).toBe(hidden));

    it("applies state display preferences only to all", () => {
        const stateFlags = flags("favorite"), visibilityReasons = reasons();
        expect(api.shouldShowItem({ filter: "all", flags: stateFlags, visibilityReasons, settingHidden: true, recent: false })).toBe(false);
        expect(api.shouldShowItem({ filter: "favorite", flags: stateFlags, visibilityReasons, settingHidden: true, recent: false })).toBe(true);
        expect(api.shouldShowItem({ filter: "favorite", flags: stateFlags, visibilityReasons: reasons("keyword"), settingHidden: false, recent: false })).toBe(false);
    });
});
