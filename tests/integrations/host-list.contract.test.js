import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { parseDetailPage } from "../../src/core/host-list-page-parser.js";

it("normalizes a host list page state", () => {
    const dom = new JSDOM('<main class="movie-list"><article class="item"></article></main>');
    expect(parseDetailPage(jquery(dom.window)(dom.window.document), { boxSelector: ".movie-list", requestDomItemSelector: ".item" })).toMatchObject({ state: "valid", isEmpty: false });
});
