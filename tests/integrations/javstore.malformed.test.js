import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { parseJavStoreSearch } from "../../src/integrations/javstore/parser.js";

it("rejects malformed JavStore candidates", () => {
    const dom = new JSDOM('<a href="javascript:alert(1)">ABC-123</a>');
    expect(parseJavStoreSearch(jquery(dom.window)(dom.window.document), "ABC-123")).toEqual([]);
});
