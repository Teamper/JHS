import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { HitShowPlugin } from "../src/plugins/external-search/hit-show.js";

function setup(path, html = `<section><div class="container"><div class="movie-list">
  <div class="item" id="first"><a href="/v/first" class="box">1</a></div>
  <div class="item" id="second"><a href="/v/second" class="box">2</a></div>
</div><nav class="pagination"><a href="?page=2">下一页</a></nav></div></section>`) {
    const dom = new JSDOM(html, { url: `https://javdb.com${path}` });
    vi.stubGlobal("window", dom.window);
    const host = new JavDbHostAdapter(dom.window.document, dom.window.location);
    const plugin = new HitShowPlugin();
    plugin.getRuntimeService = name => name === "host" ? host : undefined;
    return { dom, plugin, document: dom.window.document };
}

afterEach(() => vi.unstubAllGlobals());

describe("Playback native-list enhancement", () => {
    it.each(["high_score", "all"].flatMap(filter => ["daily", "weekly", "monthly"].map(period => [filter, period])))
    ("marks Playback %s / %s without replacing native cards", async (filter, period) => {
        const { plugin, document } = setup(`/rankings/playback?p=${period}&t=${filter}`);
        const originalCards = [...document.querySelectorAll(".movie-list .item")];
        await plugin.handle();
        expect([...document.querySelectorAll(".movie-list .item")]).toEqual(originalCards);
        expect(originalCards.map(card => card.id)).toEqual(["first", "second"]);
        expect(document.querySelector(".movie-list").dataset).toMatchObject({ jhsRanking: "playback", jhsRankingPeriod: period, jhsRankingFilter: filter });
        expect(document.querySelector("nav.pagination a").getAttribute("href")).toBe("?page=2");
        expect(document.querySelector("#first a").getAttribute("href")).toBe("/v/first");
    });

    it.each(["/rankings/movies?p=daily&t=fc2", "/rankings/top", "/rankings/actors", "/rankings/fanza_award", "/search_advanced?type=3"])
    ("does not treat %s as Playback", async path => {
        const { plugin, document } = setup(path);
        await plugin.handle();
        expect(document.querySelector(".movie-list").hasAttribute("data-jhs-ranking")).toBe(false);
    });

    it("does not fabricate a list when the native page has no cards", async () => {
        const { plugin, document } = setup("/rankings/playback", "<h1>404</h1>");
        await expect(plugin.handle()).resolves.toBeUndefined();
        expect(document.querySelector(".movie-list")).toBeNull();
    });
});
