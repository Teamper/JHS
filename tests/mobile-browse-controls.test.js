import { expect, it } from "vitest";
import { appendCatalogItems, orderMovies } from "../src/app/mobile/browse-controls.js";
import { isSharedSetting } from "../src/core/webdav-sync-model.js";

it("deduplicates both pages and sorts titles without moving the original source array", () => {
    const row = (id, carNum, fields = {}) => ({ id, carNum, ...fields });
    const works = [row("a", "JHSTEST-10", { releaseDate: "2024-09-01", ratingValue: 4.25 }),
        row("b", "JHSTEST-2", { releaseDate: "2024-02-01", ratingValue: 4.25 }), row("c", null)];
    appendCatalogItems(works, [row("b", "JHSTEST-2"), row("d", "JHSTEST-5", { ratingValue: 5 }), row("d", "JHSTEST-5")]);
    const ids = (order, options) => orderMovies(works, order, options).map(work => work.id);
    expect(ids("source")).toEqual(["a", "b", "c", "d"]);
    expect(ids("code")).toEqual(["b", "d", "a", "c"]);
    expect(ids("rating")).toEqual(["d", "a", "b", "c"]);
    expect(ids("date-asc")).toEqual(["b", "a", "c", "d"]);
    expect(ids("rating", { exact: "JHSTEST-2" })).toEqual(["b", "d", "a", "c"]);
    expect(ids("personal", { ratings: { "JHSTEST-5": { rating: 3 }, "JHSTEST-2": { rating: 5 } } })).toEqual(["b", "d", "a", "c"]);
    expect(works.map(work => work.id)).toEqual(["a", "b", "c", "d"]);
});

it("keeps the Android layout and title switch local when desktop prefs sync", () => {
    expect(isSharedSetting("androidTranslateTitle")).toBe(false);
    expect(isSharedSetting("androidCatalogLayout")).toBe(false);
    expect(isSharedSetting("translateTitle")).toBe(true);
});
