import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { ListNavigationController } from "../src/features/list/list-navigation-controller.js";

describe("ListNavigationController", () => {
    it("preserves card identity, autoplay, iframe arguments, and modifier-key navigation", () => {
        const dom = new JSDOM('<article class="item"><a href="/v/abc-123?source=fixture"></a></article>', { url: "https://javdb.com/" });
        const card = dom.window.document.querySelector(".item"), openPage = vi.fn();
        const controller = new ListNavigationController({
            hostAdapter: { location: dom.window.location },
            list: { findCarNumAndHref: vi.fn(() => ({ carNum: "ABC-123", aHref: "/v/abc-123?source=fixture" })) },
            ui: { jquery: (value) => value, openPage },
        });
        const event = new dom.window.MouseEvent("click", { ctrlKey: true, bubbles: true });
        controller.openMovieDetail(card, { event, autoplay: true });

        expect(openPage).toHaveBeenCalledWith("https://javdb.com/v/abc-123?source=fixture&autoPlay=1", "ABC-123", true, { event, newTab: true });
        controller.openMovieDetail(card);
        expect(openPage).toHaveBeenLastCalledWith("https://javdb.com/v/abc-123?source=fixture", "ABC-123", true, { event: null, newTab: false });
        dom.window.close();
    });

    it("keeps FC2 cards and disposed navigation inert", () => {
        const dom = new JSDOM("<article class='item'></article>", { url: "https://javdb.com/" });
        const openPage = vi.fn(), list = { findCarNumAndHref: vi.fn(() => ({ carNum: "FC2-PPV-1", aHref: "/v/fc2" })) };
        const controller = new ListNavigationController({ hostAdapter: { location: dom.window.location }, list, ui: { jquery: (value) => value, openPage } });
        controller.openMovieDetail(dom.window.document.querySelector(".item"));
        expect(openPage).not.toHaveBeenCalled();
        controller.dispose();
        list.findCarNumAndHref.mockReturnValue({ carNum: "ABC-1", aHref: "/v/abc-1" });
        controller.openMovieDetail(dom.window.document.querySelector(".item"));
        expect(openPage).not.toHaveBeenCalled();
        dom.window.close();
    });
});
