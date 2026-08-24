import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { parse123AvCards } from "../../src/integrations/av123/parser.js";

it("normalizes 123AV cards without returning DOM", () => {
    const dom = new JSDOM('<article class="card"><a class="card__link" href="/cn/v/fc2-ppv-123">FC2-PPV-123 — Title</a></article>');
    const cards = parse123AvCards(jquery(dom.window)(dom.window.document));
    expect(cards[0]).toMatchObject({ carNum: "FC2-123", title: "Title" });
    expect(cards[0]).not.toBeInstanceOf(dom.window.Node);
});
