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
