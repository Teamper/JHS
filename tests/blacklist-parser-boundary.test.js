import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { getBlacklistSubjectInfo, parseBlacklistFilterPage } from "../src/integrations/host-list/blacklist-parser.js";

afterEach(() => vi.unstubAllGlobals());

function createPage(html, href = "https://javdb.com/actors/a") {
    const dom = new JSDOM(html, { url: href }), $ = jqueryFactory(dom.window);
    vi.stubGlobal("$", $);
    vi.stubGlobal("document", dom.window.document);
    return { dom, $ };
}

const actorCard = (carNum, href = "/v/1", publishTime = "2026-08-01") => `<div class="item"><a href="${href}"><img src="/thumb.jpg"><div class="video-title"><strong>${carNum}</strong>Title</div><div class="meta">${publishTime}</div></a></div>`;

describe("blacklist parser boundary", () => {
    it("rejects challenge pages, missing containers and empty pages with pagination", () => {
        let page = createPage('<title>Just a moment...</title><div class="cf-chl-test"></div>');
        expect(() => parseBlacklistFilterPage({ page: page.$(page.dom.window.document), name: "Actor", starId: "a", site: "javdb", jquery: page.$ })).toThrow("challenge");
        page = createPage("<main>login</main>");
        expect(() => parseBlacklistFilterPage({ page: page.$(page.dom.window.document), name: "Actor", starId: "a", site: "javdb", jquery: page.$ })).toThrow("invalid");
        page = createPage('<div class="movie-list"></div><a class="pagination-next" href="?page=2"></a>');
        expect(() => parseBlacklistFilterPage({ page: page.$(page.dom.window.document), name: "Actor", starId: "a", site: "javdb", jquery: page.$ })).toThrow("空页面包含下一页");
        page.dom.window.close();
    });

    it("parses established record fields and selects the latest publication date without writing", () => {
        const { dom, $ } = createPage(`<div class="movie-list">${actorCard("A-1", "/v/1", "2026-08-01")}${actorCard("A-2", "/v/2", "2026-09-03")}${actorCard("A-3", "/v/3", "invalid")}</div><a class="pagination-next" href="?page=2">Next</a>`);
        const parsed = parseBlacklistFilterPage({ page: $(dom.window.document), name: "Actor A", starId: "actor-a", site: "javdb", jquery: $ });
        expect(parsed).toMatchObject({ nextPageLink: "?page=2", lastPublishTime: "2026-09-03", recordCount: 3 });
        expect(parsed.records[1]).toMatchObject({ carNum: "A-2", url: "/v/2", names: "Actor A", actionType: "filter", starId: "actor-a", publishTime: "2026-09-03" });
        dom.window.close();
    });

    it("keeps explicit site selection and JavBus waterfall parsing", () => {
        const { dom, $ } = createPage(`<div class="masonry"></div><div id="waterfall">${actorCard("BUS-1", "/ABC-1", "2026-09-02")}</div>`, "https://www.javbus.com/star/a");
        expect(parseBlacklistFilterPage({ page: $(dom.window.document), name: "Actor", starId: "a", site: "javbus", jquery: $ })).toMatchObject({ recordCount: 1, lastPublishTime: "2026-09-02" });
        expect(() => parseBlacklistFilterPage({ page: $(dom.window.document), name: "Actor", starId: "a", site: "unknown", jquery: $ })).toThrow("未知黑名单来源站点");
        dom.window.close();
    });

    it("ignores the native JavBus actor profile card before reading movie numbers", () => {
        const html = '<div id="waterfall"><div class="item"><div class="avatar-box">Actor</div></div><div class="item"><a href="/BUS-1"><img title="Movie"><date>BUS-1</date><date>2026-09-02</date></a></div></div>';
        const { dom, $ } = createPage(html, "https://www.javbus.com/star/a");
        const parsed = parseBlacklistFilterPage({ page: $(dom.window.document), name: "Actor", starId: "a", site: "javbus", jquery: $ });
        expect(parsed).toMatchObject({ recordCount: 1, lastPublishTime: "2026-09-02" });
        expect(parsed.records).toEqual([{ carNum: "BUS-1", url: "/BUS-1", names: "Actor", actionType: "filter", starId: "a", publishTime: "2026-09-02" }]);
        expect(dom.window.document.querySelector(".avatar-box")).not.toBeNull();
        dom.window.close();
    });

    it("treats a JavBus profile-only page as empty after excluding the profile item", () => {
        const html = '<div id="waterfall"><div class="item"><div class="avatar-box">Actor</div></div></div>';
        const { dom, $ } = createPage(html, "https://www.javbus.com/star/a");
        expect(parseBlacklistFilterPage({ page: $(dom.window.document), name: "Actor", starId: "a", site: "javbus", jquery: $ })).toMatchObject({ recordCount: 0, records: [] });
        const next = dom.window.document.createElement("a");
        next.id = "next";
        next.href = "/star/a/2";
        dom.window.document.body.append(next);
        expect(() => parseBlacklistFilterPage({ page: $(dom.window.document), name: "Actor", starId: "a", site: "javbus", jquery: $ })).toThrow("空页面包含下一页");
        dom.window.close();
    });

    it("extracts stable actor and tag identity without losing query filters", () => {
        let { dom, $ } = createPage('<h2 class="actor-section-name">演员甲, 别名甲</h2><div class="section-meta">男優</div><div class="section-meta">無碼</div>', "https://javdb.com/actors/actor-a?sort_type=1&page=3&t=d");
        expect(getBlacklistSubjectInfo({ site: "javdb", href: dom.window.location.href, document: dom.window.document, jquery: $ })).toMatchObject({
            starId: "actor-a", name: "演员甲", allName: ["演员甲", "别名甲", "男優", "無碼"], role: "actor", movieType: "uncensored", blacklistUrl: "https://javdb.com/actors/actor-a?t=d",
        });
        dom.window.close();
        ({ dom, $ } = createPage('<span id="jhs-check-tag">分類 &amp; 名稱</span>', "https://javdb.com/tags?tag=14&page=2"));
        expect(getBlacklistSubjectInfo({ site: "javdb", href: dom.window.location.href, document: dom.window.document, jquery: $ })).toMatchObject({ starId: "no-分類 & 名稱", role: "虚拟演员", movieType: "分類 & 名稱", blacklistUrl: "https://javdb.com/tags?tag=14" });
        dom.window.close();
    });
});
