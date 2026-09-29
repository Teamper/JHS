import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { HitShowController } from "../src/features/discovery/hit-show-controller.js";

function setup(path, html = `<section><div class="container"><div class="movie-list">
  <div class="item" id="first"><a href="/v/first" class="box">1</a></div>
  <div class="item" id="second"><a href="/v/second" class="box">2</a></div>
</div><nav class="pagination"><a href="?page=2">下一页</a></nav></div></section>`) {
    const dom = new JSDOM(html, { url: `https://javdb.com${path}` });
    vi.stubGlobal("window", dom.window);
    const host = new JavDbHostAdapter(dom.window.document, dom.window.location);
    const scope = new LifecycleScope("test-hit-show");
    const controller = new HitShowController({ hostAdapter: host, scope });
    return { dom, controller, scope, document: dom.window.document };
}

afterEach(() => vi.unstubAllGlobals());

describe("Playback native-list enhancement", () => {
    it.each(["high_score", "all"].flatMap(filter => ["daily", "weekly", "monthly"].map(period => [filter, period])))
    ("marks Playback %s / %s without replacing native cards", async (filter, period) => {
        const { controller, document } = setup(`/rankings/playback?p=${period}&t=${filter}`);
        const originalCards = [...document.querySelectorAll(".movie-list .item")];
        expect(controller.start()).toBe(true);
        expect([...document.querySelectorAll(".movie-list .item")]).toEqual(originalCards);
        expect(originalCards.map(card => card.id)).toEqual(["first", "second"]);
        expect(document.querySelector(".movie-list").dataset).toMatchObject({ jhsRanking: "playback", jhsRankingPeriod: period, jhsRankingFilter: filter });
        expect(document.querySelector("nav.pagination a").getAttribute("href")).toBe("?page=2");
        expect(document.querySelector("#first a").getAttribute("href")).toBe("/v/first");
    });

    it.each(["/rankings/movies?p=daily&t=fc2", "/rankings/top", "/rankings/actors", "/rankings/fanza_award", "/search_advanced?type=3"])
    ("does not treat %s as Playback", async path => {
        const { controller, document } = setup(path);
        expect(controller.start()).toBe(false);
        expect(document.querySelector(".movie-list").hasAttribute("data-jhs-ranking")).toBe(false);
    });

    it("does not fabricate a list when the native page has no cards", async () => {
        const { controller, document } = setup("/rankings/playback", "<h1>404</h1>");
        expect(controller.start()).toBe(false);
        expect(document.querySelector(".movie-list")).toBeNull();
    });

    it("restores attributes owned by the feature on disposal", () => {
        const { controller, scope, document } = setup("/rankings/playback?p=weekly&t=all", `<div class="movie-list" data-jhs-ranking="custom" data-jhs-ranking-filter="kept"></div>`);
        expect(controller.start()).toBe(true);
        const root = document.querySelector(".movie-list");
        expect(root?.dataset).toMatchObject({ jhsRanking: "playback", jhsRankingPeriod: "weekly", jhsRankingFilter: "all" });
        scope.dispose();
        expect(root?.getAttribute("data-jhs-ranking")).toBe("custom");
        expect(root?.hasAttribute("data-jhs-ranking-period")).toBe(false);
        expect(root?.getAttribute("data-jhs-ranking-filter")).toBe("kept");
    });

    it("does not overwrite an attribute changed by another owner after mounting", () => {
        const { controller, scope, document } = setup("/rankings/playback?p=daily&t=high_score");
        expect(controller.start()).toBe(true);
        const root = document.querySelector(".movie-list");
        root?.setAttribute("data-jhs-ranking-period", "external-update");
        scope.dispose();
        expect(root?.getAttribute("data-jhs-ranking-period")).toBe("external-update");
    });
});
