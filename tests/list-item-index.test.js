import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { ListItemIndex } from "../src/features/list/list-item-index.js";

function createIndex() {
    return new ListItemIndex({ readCarNum: (item) => item.getAttribute("data-car-num") });
}

describe("ListItemIndex", () => {
    it("normalizes identity and returns every connected duplicate card once", () => {
        const dom = new JSDOM('<main><article data-car-num="abc-123"></article><article data-car-num=" ABC-123 "></article></main>');
        const [first, duplicate] = dom.window.document.querySelectorAll("article"), index = createIndex();
        index.add([first, duplicate]);

        expect(index.get(["ABC-123", "abc-123"])).toEqual([first, duplicate]);
    });

    it("removes cards with a detached subtree and prunes stale disconnected entries", () => {
        const dom = new JSDOM('<main><section><article data-car-num="ABC-123"></article><article data-car-num="XYZ-9"></article></section></main>');
        const document = dom.window.document, section = document.querySelector("section"), items = [...document.querySelectorAll("article")];
        const index = createIndex();
        index.add(items);
        section.remove();
        index.removeNodes([section], "article");

        expect(index.get(["ABC-123", "XYZ-9"])).toEqual([]);
    });

    it("re-indexes a card after its identity changes and clears references at disposal", () => {
        const dom = new JSDOM('<main><article data-car-num="ABC-123"></article></main>');
        const item = dom.window.document.querySelector("article"), index = createIndex();
        index.add([item]);
        item.setAttribute("data-car-num", "XYZ-9");
        index.add([item]);

        expect(index.get(["ABC-123"])).toEqual([]);
        expect(index.get(["XYZ-9"])).toEqual([item]);
        index.clear();
        expect(index.get(["XYZ-9"])).toEqual([]);
    });

    it("isolates identity parser failures and continues indexing subsequent cards", () => {
        const dom = new JSDOM('<main><article id="bad"></article><article id="good" data-car-num="ABC-123"></article></main>'), items = [...dom.window.document.querySelectorAll("article")];
        const onReadError = vi.fn(), index = new ListItemIndex({
            readCarNum: (item) => { if (item.id === "bad") throw new Error("bad identity"); return item.getAttribute("data-car-num"); },
            onReadError,
        });
        index.add(items);

        expect(onReadError).toHaveBeenCalledOnce();
        expect(index.get(["ABC-123"])).toEqual([items[1]]);
    });
});
