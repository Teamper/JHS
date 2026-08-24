import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { parseJavDbActorList } from "../../src/integrations/javdb/parser.js";

it("classifies malformed JavDB actor pages", () => {
    const dom = new JSDOM("<main></main>");
    expect(parseJavDbActorList(jquery(dom.window)(dom.window.document), "https://javdb.com").state).toBe("invalid");
});
