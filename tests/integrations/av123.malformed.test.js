import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { parse123AvCards } from "../../src/integrations/av123/parser.js";

it("treats malformed 123AV cards as an empty contract", () => {
    const dom = new JSDOM('<article class="card"><script>alert(1)</script></article>');
    expect(parse123AvCards(jquery(dom.window)(dom.window.document))).toEqual([]);
});
