import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { parseJavStoreSearch } from "../../src/integrations/javstore/parser.js";

it("normalizes JavStore search results", () => {
    const dom = new JSDOM('<a href="/ABC-123-pn.html">ABC-123</a>');
    expect(parseJavStoreSearch(jquery(dom.window)(dom.window.document), "ABC-123")).toEqual(["https://javstore.net/ABC-123-pn.html"]);
});
