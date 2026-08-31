import { describe, expect, it, vi } from "vitest";
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
});
