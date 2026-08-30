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
