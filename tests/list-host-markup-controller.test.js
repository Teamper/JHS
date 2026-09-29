import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { ListHostMarkupController } from "../src/features/list/list-host-markup-controller.js";

function createController(html, site = "javbus") {
    const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
    return {
        dom,
        controller: new ListHostMarkupController({ hostAdapter: { site, document: dom.window.document } }),
    };
}

describe("ListHostMarkupController", () => {
    it("normalizes duplicate JavBus roots in place while preserving the masonry root", () => {
        const { dom, controller } = createController(`
            <header id="waterfall_h">Page header</header>
            <main id="before"></main>
            <div id="waterfall"><section id="moved">Moved card wrapper</section></div>
            <div id="waterfall" class="masonry"><div class="item"></div></div>
        `);
        const document = dom.window.document;

        expect(controller.normalizeInitialMarkup()).toBe(true);
        expect(document.querySelector("#waterfall_h")).toBeNull();
        expect(document.querySelector("#no-page")?.textContent).toBe("Page header");
        expect(document.querySelector("#waterfall")?.classList.contains("masonry")).toBe(true);
        expect(document.querySelector("#moved")?.previousElementSibling?.id).toBe("before");
        expect(document.querySelector("#moved")?.nextElementSibling?.classList.contains("masonry")).toBe(true);

        controller.normalizeInitialMarkup();
        expect(document.querySelectorAll("#no-page")).toHaveLength(1);
        expect(document.querySelectorAll("#waterfall")).toHaveLength(1);
        dom.window.close();
    });

    it("wraps the first JavBus title node without dropping sibling tags or identity/date nodes", () => {
        const maliciousTitle = '<img src=x onerror="globalThis.pwned=true">';
        const { dom, controller } = createController(`
            <article class="item" id="movie">
                <img title='${maliciousTitle}'>
                <div class="photo-info"><span>Host title<br><div class="item-tag">昨日新種</div><date>ABC-123</date> / <date>2026-09-01</date></span></div>
            </article>
            <article class="item avatar-box" id="avatar"><img title="Actor"><div class="photo-info"><span>Actor name</span><br></div></article>
        `);
        const document = dom.window.document;
        const cards = [...document.querySelectorAll(".item")];

        expect(controller.normalizeCards(cards)).toBe(1);
        const wrapper = document.querySelector("#movie .photo-info .video-title");
        expect(wrapper?.getAttribute("title")).toBe(maliciousTitle);
        expect(wrapper?.firstChild?.nodeType).toBe(dom.window.Node.TEXT_NODE);
        expect(wrapper?.firstChild?.textContent).toBe(maliciousTitle);
        expect(wrapper?.querySelector("img")).toBeNull();
        expect(document.querySelectorAll("#movie br")).toHaveLength(0);
        expect(document.querySelector("#movie .item-tag")?.textContent).toBe("昨日新種");
        expect([...document.querySelectorAll("#movie date")].map((node) => node.textContent)).toEqual(["ABC-123", "2026-09-01"]);
        expect(document.querySelectorAll("#avatar .video-title")).toHaveLength(0);
        expect(document.querySelectorAll("#avatar br")).toHaveLength(1);

        expect(controller.normalizeCards(cards)).toBe(0);
        expect(document.querySelectorAll("#movie .video-title")).toHaveLength(1);
        dom.window.close();
    });

    it("removes the original JavBus title after the date without duplicating it", () => {
        const originalTitle = "LOCK-ON@ななは 憧れの芸能界デビュー";
        const { dom, controller } = createController(`
            <article class="item movie-box" id="movie">
                <img title="${originalTitle}">
                <div class="photo-info"><span>
                    <div class="item-tag">今日新種</div>
                    <date>LOCK-018</date> / <date>2026-09-27</date>${originalTitle}
                </span></div>
            </article>
        `);
        const document = dom.window.document;
        const card = document.querySelector("#movie");
        const details = card.querySelector(".photo-info > span");

        expect(controller.normalizeCards([card])).toBe(1);
        expect(details.querySelector(".video-title")?.textContent).toBe(originalTitle);
        expect(details.querySelector(".video-title")?.getAttribute("title")).toBe(originalTitle);
        expect([...details.childNodes].filter((node) => node.nodeType === dom.window.Node.TEXT_NODE && node.textContent.includes(originalTitle))).toHaveLength(0);
        expect(details.textContent.split(originalTitle)).toHaveLength(2);
        expect(details.querySelector(".item-tag")?.textContent).toBe("今日新種");
        expect([...details.querySelectorAll("date")].map((node) => node.textContent)).toEqual(["LOCK-018", "2026-09-27"]);
        expect(controller.normalizeCards([card])).toBe(0);
        dom.window.close();
    });

    it("leaves JavDB host markup unchanged", () => {
        const { dom, controller } = createController('<div id="waterfall_h"></div><div id="waterfall"><span class="photo-info"><span>ABC-123</span><br></span></div>', "javdb");
        const document = dom.window.document;

        expect(controller.normalizeInitialMarkup()).toBe(false);
        expect(controller.normalizeCards([...document.querySelectorAll("#waterfall")])).toBe(0);
        expect(document.querySelector("#waterfall_h")).not.toBeNull();
        expect(document.querySelector("#waterfall")).not.toBeNull();
        expect(document.querySelector("br")).not.toBeNull();
        dom.window.close();
    });
});
