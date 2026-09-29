import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { _ } from "../src/core/constants.js";
import { ListHoverPreviewController } from "../src/features/list/list-hover-preview-controller.js";

describe("ListHoverPreviewController", () => {
    let dom, scope, controller;

    afterEach(() => {
        controller?.dispose();
        scope?.dispose();
        dom?.window.close();
        dom = scope = controller = null;
    });

    function mount(value = "yes") {
        dom = new JSDOM("<div class='movie-list'></div>", { url: "https://javdb.com/" });
        scope = new LifecycleScope("test:list-hover-preview");
        const settings = Object.assign(new dom.window.EventTarget(), {
            value,
            snapshot() { return { hoverBigImg: this.value }; },
            update(next) {
                this.value = next;
                this.dispatchEvent(new dom.window.CustomEvent("settings.changed", { detail: { names: ["hoverBigImg"] } }));
            },
        });
        const instances = [];
        const ui = {
            createImageHoverPreview: vi.fn((config) => {
                const instance = { config, destroy: vi.fn() };
                instances.push(instance);
                return instance;
            }),
        };
        controller = new ListHoverPreviewController({
            hostAdapter: { getListSelectors: () => ({ coverImgSelector: ".movie-list .cover img" }) },
            settings, ui, scope, window: dom.window,
        });
        expect(controller.start()).toBe(true);
        return { settings, ui, instances };
    }

    it("matches the legacy default and live ON/OFF lifecycle without duplicate instances", () => {
        const { settings, ui, instances } = mount(_);
        expect(ui.createImageHoverPreview).toHaveBeenCalledWith({ selector: ".movie-list .cover img" });
        expect(dom.window.imageHoverPreviewObj).toBe(instances[0]);
        expect(scope.snapshot().listeners).toBe(1);

        settings.update("no");
        expect(instances[0].destroy).toHaveBeenCalledOnce();
        expect(dom.window.imageHoverPreviewObj).toBeNull();
        settings.update("yes");
        expect(instances).toHaveLength(2);
        expect(dom.window.imageHoverPreviewObj).toBe(instances[1]);
        settings.update("yes");
        expect(instances).toHaveLength(2);

        controller.dispose();
        expect(instances[1].destroy).toHaveBeenCalledOnce();
        expect(dom.window.imageHoverPreviewObj).toBeNull();
        expect(scope.snapshot().listeners).toBe(0);
    });

    it("isolates the optional image preview factory when unavailable", () => {
        dom = new JSDOM("", { url: "https://javdb.com/" });
        scope = new LifecycleScope("test:list-hover-preview-unavailable");
        controller = new ListHoverPreviewController({
            hostAdapter: { getListSelectors: () => ({ coverImgSelector: ".cover img" }) },
            settings: { snapshot: () => ({ hoverBigImg: "yes" }) }, ui: {}, scope, window: dom.window,
        });
        expect(controller.start()).toBe(false);
        expect(scope.snapshot().listeners).toBe(0);
        expect(dom.window.imageHoverPreviewObj).toBeUndefined();
    });
});
