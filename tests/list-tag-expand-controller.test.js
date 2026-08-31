import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListTagExpandController } from "../src/features/list/list-tag-expand-controller.js";

describe("ListTagExpandController", () => {
    it("restores the remembered actor tag state and persists later toggles", () => {
        const dom = new JSDOM('<button class="tag-expand">展开</button><div class="actor-tags"><div class="content collapse"></div></div>', { url: "https://javdb.com/actors/test" });
        const scope = new LifecycleScope("feature:list"), storage = { getLocal: vi.fn(() => "true"), setLocal: vi.fn() }, button = dom.window.document.querySelector(".tag-expand");
        button.click = vi.fn();
        const controller = new ListTagExpandController({ scope, document: dom.window.document, location: dom.window.location, storage });

        controller.start();
        expect(button.click).toHaveBeenCalledOnce();
        dom.window.document.querySelector(".content").classList.remove("collapse");
        button.dispatchEvent(new dom.window.Event("click"));
        expect(storage.setLocal).toHaveBeenCalledWith("jhs_tag_expand", "true");
        scope.dispose();
    });

    it("does not mount outside actor pages", () => {
        const dom = new JSDOM('<button class="tag-expand">展开</button><div class="actor-tags"><div class="content collapse"></div></div>', { url: "https://javdb.com/search" });
        const scope = new LifecycleScope("feature:list"), storage = { getLocal: vi.fn(() => "true"), setLocal: vi.fn() }, controller = new ListTagExpandController({ scope, document: dom.window.document, location: dom.window.location, storage });

        controller.start();
        expect(storage.getLocal).not.toHaveBeenCalled();
        scope.dispose();
    });
});
