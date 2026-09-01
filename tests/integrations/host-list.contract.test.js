import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { parseDetailPage } from "../../src/integrations/host-list/parser.js";
import { JavBusHostAdapter } from "../../src/platform/hosts/javbus-host-adapter.js";
import { JavDbHostAdapter } from "../../src/platform/hosts/javdb-host-adapter.js";

it("normalizes a host list page state", () => {
    const dom = new JSDOM('<main class="movie-list"><article class="item"></article></main>');
    expect(parseDetailPage(jquery(dom.window)(dom.window.document), { boxSelector: ".movie-list", requestDomItemSelector: ".item" })).toMatchObject({ state: "valid", isEmpty: false });
});

it("exposes list selectors through each host adapter", () => {
    const dom = new JSDOM("<main></main>");
    expect(new JavDbHostAdapter(dom.window.document, dom.window.location).getListSelectors()).toMatchObject({
        boxSelector: ".movie-list", itemSelector: ".movie-list .item", nextPageSelector: ".pagination-next",
    });
    expect(new JavBusHostAdapter(dom.window.document, dom.window.location).getListSelectors()).toMatchObject({
        boxSelector: ".masonry", itemSelector: ".masonry .item", nextPageSelector: "#next",
    });
});

it("normalizes JavBus list wrappers and title boxes idempotently", () => {
    const dom = new JSDOM('<div id="waterfall_h"><div id="waterfall"><div class="masonry"><div class="item movie-box"><img title="Title <unsafe>"><div class="photo-info"><span>Original title<br></span></div></div></div></div></div>');
    const host = new JavBusHostAdapter(dom.window.document, dom.window.location);

    host.prepareList();
    host.prepareList();

    const item = dom.window.document.querySelector(".masonry .item"), titleBox = item.querySelector(".video-title");
    expect(dom.window.document.querySelector("#waterfall_h")).toBeNull();
    expect(dom.window.document.querySelector("#no-page")).not.toBeNull();
    expect(dom.window.document.querySelectorAll(".video-title")).toHaveLength(1);
    expect(titleBox.getAttribute("title")).toBe("Title <unsafe>");
    expect(titleBox.textContent).toBe("Original title");
    expect(item.querySelectorAll("br")).toHaveLength(0);
});

it("reads the JavBus detail number instead of the 識別碼 label", () => {
    const textNodeDom = new JSDOM('<div class="info"><p><span class="header">識別碼:</span> ABC-123</p></div>', { url: "https://www.javbus.com/ABC-123" });
    expect(new JavBusHostAdapter(textNodeDom.window.document, textNodeDom.window.location).readMovieRef()).toMatchObject({ carNum: "ABC-123" });

    const siblingDom = new JSDOM('<div class="info"><p><span class="header">識別碼:</span><span>ABC123</span></p></div>', { url: "https://www.javbus.com/ABC-123" });
    expect(new JavBusHostAdapter(siblingDom.window.document, siblingDom.window.location).readMovieRef()).toMatchObject({ carNum: "ABC-123" });
});

it("reads JavDB detail numbers from copy actions and legacy value nodes", () => {
    const copyDom = new JSDOM('<div class="video-detail"><div class="column-video-info"><div class="panel-block first-block"><strong>番號:</strong><span class="value"><a data-clipboard-text="PETS-071" title="複製番號">PETS</a>-071</span></div></div></div>', { url: "https://javdb.com/v/test" });
    expect(new JavDbHostAdapter(copyDom.window.document, copyDom.window.location).readMovieRef()).toMatchObject({ carNum: "PETS-071" });

    const legacyDom = new JSDOM('<div class="container"><section class="movie-panel-info"><div class="panel-block first-block"><span class="value">ABC-123</span></div></section></div>', { url: "https://javdb.com/v/test" });
    expect(new JavDbHostAdapter(legacyDom.window.document, legacyDom.window.location).readMovieRef()).toMatchObject({ carNum: "ABC-123" });
});

it("keeps the legacy JavDB injected number fallback and canonical URL", () => {
    const dom = new JSDOM('<main class="video-detail"></main>', { url: "https://javdb.com/v/fixture?jhsCarNum=PETS-071&from=dialog#top" });
    expect(new JavDbHostAdapter(dom.window.document, dom.window.location).readMovieRef()).toMatchObject({ carNum: "PETS-071", url: "https://javdb.com/v/fixture" });
});

it("keeps the JavBus URL fallback and strips the legacy date suffix", () => {
    const dom = new JSDOM('<main class="container"></main>', { url: "https://www.javbus.com/ABC-123_2026-08-30?from=dialog#top" });
    expect(new JavBusHostAdapter(dom.window.document, dom.window.location).readMovieRef()).toMatchObject({ carNum: "ABC-123", url: "https://www.javbus.com/ABC-123_2026-08-30" });
});

it("keeps the JavDB detail actress and publish metadata for state records", () => {
    const dom = new JSDOM(`
        <div class="video-detail">
            <div class="column-video-info">
                <div class="panel-block first-block"><strong>番號:</strong><span class="value"><a data-clipboard-text="ABC-123">ABC-123</a></span></div>
                <div class="panel-block"><strong>日期:</strong><span class="value">2026-08-30</span></div>
            </div>
            <div class="actor-list"><span>演员甲</span><span class="female">有码</span><span>演员乙</span><span class="female">无码</span></div>
        </div>
    `, { url: "https://javdb.com/v/test" });
    expect(new JavDbHostAdapter(dom.window.document, dom.window.location).readMovieRef()).toMatchObject({ carNum: "ABC-123", actress: "演员甲 演员乙", publishTime: "2026-08-30" });
});

it("keeps the JavBus detail actress and publish metadata for state records", () => {
    const dom = new JSDOM(`
        <div class="info">
            <p><span class="header">識別碼:</span><span>ABC-123</span></p>
            <p><span class="header">發行日期:</span>2026-08-30</p>
            <span onmouseover="star_1"><a>演员甲</a></span><span onmouseover="star_2"><a>演员乙</a></span>
        </div>
    `, { url: "https://www.javbus.com/ABC-123" });
    expect(new JavBusHostAdapter(dom.window.document, dom.window.location).readMovieRef()).toMatchObject({ carNum: "ABC-123", actress: "演员甲 演员乙", publishTime: "2026-08-30" });
});
