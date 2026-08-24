import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { parseJavDbActorList } from "../../src/integrations/javdb/parser.js";

it("normalizes JavDB actor contracts", () => {
    const dom = new JSDOM('<div id="actors"><div class="actor-box"><a href="/actors/a1" title="Actor"><span class="info">有码</span></a></div></div>');
    expect(parseJavDbActorList(jquery(dom.window)(dom.window.document), "https://javdb.com")).toMatchObject({ state: "valid", actors: [{ starId: "a1", name: "Actor" }] });
});
