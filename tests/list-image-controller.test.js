import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListImageController } from "../src/features/list/list-image-controller.js";

describe("ListImageController", () => {
    it("upgrades JavDB images and restores the original source on error", () => {
        const scope = new LifecycleScope("feature:list"), image = { dataset: { full: "https://jdbstatic.com/thumbs/ABC.jpg" }, currentSrc: "https://jdbstatic.com/thumbs/ABC.jpg", src: "https://jdbstatic.com/thumbs/ABC.jpg", title: "", complete: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }, controller = new ListImageController({ scope, site: "javdb", selector: ".cover img" });

        controller.replaceHdImg([image]);

        expect(image.src).toBe("https://jdbstatic.com/covers/ABC.jpg");
        expect(image.dataset.hdReplaced).toBe("true");
        image.onerror();
        expect(image.src).toBe("https://jdbstatic.com/thumbs/ABC.jpg");
        controller.dispose();
        scope.dispose();
    });

    it("cleans pending image listeners and hover preview on disposal", () => {
        const scope = new LifecycleScope("feature:list"), image = { dataset: {}, currentSrc: "https://jdbstatic.com/thumbs/ABC.jpg", src: "https://jdbstatic.com/thumbs/ABC.jpg", title: "cover", complete: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }, preview = { destroy: vi.fn() }, runtimeWindow = { imageHoverPreviewObj: preview }, controller = new ListImageController({ scope, window: runtimeWindow, site: "javdb", selector: ".cover img" });

        controller.configureHoverPreview("no");
        controller.scheduleHdUpgrade(image);
        controller.dispose();

        expect(image.removeEventListener).toHaveBeenCalledTimes(2);
        expect(preview.destroy).toHaveBeenCalledOnce();
        expect(runtimeWindow.imageHoverPreviewObj).toBeNull();
        scope.dispose();
    });

    it("normalizes visible JavBus image heights by row and skips vertical mode", async () => {
        const dom = new JSDOM('<div class="item"><img></div><div class="item"><img></div><div class="item"><img></div>'), scope = new LifecycleScope("feature:list"), items = [...dom.window.document.querySelectorAll(".item")], images = items.map((item) => item.querySelector("img"));
        items.forEach((item) => Object.defineProperty(item, "offsetWidth", { configurable: true, value: 100 }));
        [120, 200, 90].forEach((height, index) => Object.defineProperty(images[index], "offsetHeight", { configurable: true, value: height }));
        const controller = new ListImageController({ scope, document: dom.window.document, window: dom.window, site: "javbus", selector: ".item img", itemSelector: ".item" });

        await controller.logImageHeightsByRow({ vertical: "no", columns: 2 });

        expect(images[0].style.getPropertyValue("height")).toBe("");
        expect(images[1].style.getPropertyValue("height")).toBe("120px");
        expect(images[1].style.getPropertyPriority("height")).toBe("important");
        expect(images[2].style.getPropertyValue("height")).toBe("");
        await controller.logImageHeightsByRow({ vertical: "yes", columns: 2 });
        expect(images[1].style.getPropertyValue("height")).toBe("120px");
        scope.dispose();
    });
});
