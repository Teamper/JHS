import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { Top250Plugin, hasChineseSubtitleMagnet } from "../src/plugins/external-search/top250.js";

const nativeHtml = `<section><div class="container">
  <h2 class="section-title">Top250</h2>
  <div class="tabs"><a id="category" href="/rankings/top?t=3">FC2</a>
    <select id="year" data-url="/rankings/top?t=%25s"><option>2026</option></select></div>
  <div class="movie-list">
    <div class="item" id="with"><a class="box" href="/v/with"><span class="tags"><span class="tag is-warning">含中字磁链</span></span></a></div>
    <div class="item" id="playable"><a class="box" href="/v/playable"><span class="tag-can-play cnsub">中字播放</span></a></div>
    <div class="item" id="plain"><a class="box" href="/v/plain"><span class="tags"><span class="tag">其他</span></span></a></div>
  </div><nav class="pagination"><a class="pagination-next" href="/rankings/top?page=2">下一页</a></nav>
</div></section>`;

function setup(url = "https://javdb.com/rankings/top?t=y2026&page=2", html = nativeHtml) {
    const dom = new JSDOM(html, { url });
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    const host = new JavDbHostAdapter(dom.window.document, dom.window.location);
    const plugin = new Top250Plugin();
    plugin.getRuntimeService = name => name === "host" ? host : undefined;
    return { dom, plugin, host, document: dom.window.document };
}

afterEach(() => vi.unstubAllGlobals());

describe("TOP250 native-list enhancement", () => {
    it("preserves native ranks, card links, category and pagination", async () => {
        const { plugin, document } = setup();
        const cards = [...document.querySelectorAll(".movie-list .item")];
        await plugin.handle();
        await plugin.handle();
        expect([...document.querySelectorAll(".movie-list .item")]).toEqual(cards);
        expect(document.querySelector("#with a").getAttribute("href")).toBe("/v/with");
        expect(document.querySelector("#category").getAttribute("href")).toBe("/rankings/top?t=3");
        expect(document.querySelector(".pagination-next").getAttribute("href")).toBe("/rankings/top?page=2");
        expect(document.querySelectorAll(".jhs-top250-subtitle")).toHaveLength(1);
    });

    it("filters only loaded cards by the magnet tag and restores all cards", async () => {
        const { plugin, document, dom } = setup();
        await plugin.handle();
        document.querySelector('button[data-jhs-subtitle="with"]').click();
        expect(document.querySelector("#with").classList.contains("jhs-top250-subtitle-hidden")).toBe(false);
        expect(document.querySelector("#playable").classList.contains("jhs-top250-subtitle-hidden")).toBe(true);
        expect(document.querySelector("#plain").classList.contains("jhs-top250-subtitle-hidden")).toBe(true);
        expect(dom.window.location.search).toContain("jhs_subtitle=with");
        expect(document.querySelector(".pagination-next").getAttribute("href")).toContain("jhs_subtitle=with");
        expect(document.querySelector("#category").getAttribute("href")).toContain("jhs_subtitle=with");
        expect(document.querySelector("#year").getAttribute("data-url")).toContain("jhs_subtitle=with");
        document.querySelector('button[data-jhs-subtitle="without"]').click();
        expect(document.querySelector("#with").classList.contains("jhs-top250-subtitle-hidden")).toBe(true);
        expect(document.querySelector("#playable").classList.contains("jhs-top250-subtitle-hidden")).toBe(false);
        document.querySelector('button[data-jhs-subtitle="all"]').click();
        expect([...document.querySelectorAll(".movie-list .item")].some(card => card.classList.contains("jhs-top250-subtitle-hidden"))).toBe(false);
        expect(dom.window.location.search).not.toContain("jhs_subtitle");
    });

    it("applies a migrated filter when the native page loads", async () => {
        const { plugin, document } = setup("https://javdb.com/rankings/top?t=3&jhs_subtitle=without");
        await plugin.handle();
        expect(document.querySelector("#with").classList.contains("jhs-top250-subtitle-hidden")).toBe(true);
        expect(document.querySelector('button[data-jhs-subtitle="without"]').getAttribute("aria-pressed")).toBe("true");
    });

    it("does not fabricate a list on a 404 page without a native container", async () => {
        const { plugin, document } = setup("https://javdb.com/rankings/top", "<h1>404</h1>");
        await expect(plugin.handle()).resolves.toBeUndefined();
        expect(document.querySelector(".movie-list")).toBeNull();
        expect(document.querySelector(".jhs-top250-subtitle")).toBeNull();
    });

    it("keeps playable subtitle badges separate from subtitle-magnet tags", () => {
        const { document } = setup();
        expect(hasChineseSubtitleMagnet(document.querySelector("#with"))).toBe(true);
        expect(hasChineseSubtitleMagnet(document.querySelector("#playable"))).toBe(false);
    });
});
