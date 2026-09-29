import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListCoverImageController } from "../src/features/list/list-cover-image-controller.js";

function createImage(html, site, windowRuntime = {}) {
    const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { url: `https://${site === "javbus" ? "www.javbus.com" : "javdb.com"}/` });
    const controller = new ListCoverImageController({
        hostAdapter: { site, document: dom.window.document, getListSelectors: () => ({ coverImgSelector: ".cover" }) },
        window: windowRuntime,
    });
    return { dom, image: dom.window.document.querySelector("img"), controller };
}

describe("ListCoverImageController", () => {
    it("upgrades JavDB thumbnails to covers and falls back when the cover fails", () => {
        const { dom, image, controller } = createImage('<img class="cover" src="https://jdbstatic.com/thumbs/abc.jpg" title="Movie">', "javdb");
        Object.defineProperty(image, "complete", { configurable: true, value: true });

        expect(controller.replace()).toBe(1);
        expect(image.src).toBe("https://jdbstatic.com/covers/abc.jpg");
        expect(image.dataset.full).toBe(image.src);
        expect(image.dataset.hdReplaced).toBe("true");
        expect(image.title).toBe("");
        image.onerror.call(image, new dom.window.Event("error"));
        expect(image.src).toBe("https://jdbstatic.com/thumbs/abc.jpg");
        expect(image.onerror).toBeNull();
        dom.window.close();
    });

    it("keeps JavBus thumb, ps, title and delayed thumbnail semantics", () => {
        const { dom, image, controller } = createImage('<img class="cover" src="https://www.javbus.com/imgs/thumb/abc.jpg" title="Fixture title">', "javbus");
        Object.defineProperty(image, "complete", { configurable: true, value: true });

        controller.replace();
        expect(image.src).toBe("https://www.javbus.com/imgs/cover/abc_b.jpg");
        expect(image.dataset.title).toBe("Fixture title");
        expect(image.title).toBe("");
        dom.window.close();

        const ps = createImage('<img class="cover" src="https://www.javbus.com/pics/abcps.jpg" title="PS title">', "javbus");
        Object.defineProperty(ps.image, "complete", { configurable: true, value: true });
        ps.controller.replace();
        expect(ps.image.src).toBe("https://www.javbus.com/pics/abcpl.jpg");
        expect(ps.image.dataset.title).toBe("PS title");
        ps.dom.window.close();

        const delayed = createImage('<img class="cover" src="https://www.javbus.com/imgs/thumb/later.jpg">', "javbus");
        Object.defineProperty(delayed.image, "complete", { configurable: true, value: false });
        delayed.controller.replace();
        expect(delayed.image.src).toBe("https://www.javbus.com/imgs/thumb/later.jpg");
        delayed.image.dispatchEvent(new delayed.dom.window.Event("load"));
        expect(delayed.image.src).toBe("https://www.javbus.com/imgs/cover/later_b.jpg");
        delayed.dom.window.close();
    });

    it("releases intersection and pending image listeners when the Feature scope stops", () => {
        class FakeIntersectionObserver {
            static current = null;
            constructor(callback, options) { this.callback = callback; this.options = options; this.observed = new Set(); this.disconnect = vi.fn(() => this.observed.clear()); FakeIntersectionObserver.current = this; }
            observe(image) { this.observed.add(image); }
            unobserve(image) { this.observed.delete(image); }
            trigger(image) { this.callback([{ target: image, isIntersecting: true }]); }
        }
        const scope = new LifecycleScope("feature:list"), runtime = { IntersectionObserver: FakeIntersectionObserver };
        const { dom, image, controller } = createImage('<img class="cover" src="https://www.javbus.com/imgs/thumb/pending.jpg">', "javbus", runtime);
        Object.defineProperty(image, "complete", { configurable: true, value: false });
        controller.scope = scope;

        controller.replace();
        const observer = FakeIntersectionObserver.current;
        expect(image.dataset.jhsHdObserved).toBe("true");
        expect(observer.options).toEqual({ rootMargin: "200px" });
        expect(observer.observed.has(image)).toBe(true);
        observer.trigger(image);
        expect(image.dataset.jhsHdPending).toBe("true");
        controller.dispose();
        image.dispatchEvent(new dom.window.Event("load"));

        expect(observer.disconnect).toHaveBeenCalledOnce();
        expect(image.dataset.jhsHdObserved).toBeUndefined();
        expect(image.dataset.jhsHdPending).toBeUndefined();
        expect(image.src).toBe("https://www.javbus.com/imgs/thumb/pending.jpg");
        scope.dispose();
        dom.window.close();
    });
});
