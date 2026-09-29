import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListTagExpansionController } from "../src/features/list/list-tag-expansion-controller.js";

describe("ListTagExpansionController", () => {
    let dom, scope, controller;

    afterEach(() => {
        controller?.dispose();
        scope?.dispose();
        dom?.window.close();
        dom = scope = controller = null;
    });

    function mount({ saved = "true", href = "https://javdb.com/actors/fixture", failRead = false } = {}) {
        dom = new JSDOM('<section class="actor-tags"><div class="content collapse"></div><button class="tag-expand">toggle</button></section>', { url: href });
        const button = dom.window.document.querySelector(".tag-expand"), content = dom.window.document.querySelector(".content");
        button.addEventListener("click", () => content.classList.toggle("collapse"));
        const storage = {
            getLocal: vi.fn(() => { if (failRead) throw new Error("storage blocked"); return saved; }),
            setLocal: vi.fn(),
        };
        const diagnostics = { recordError: vi.fn() };
        scope = new LifecycleScope("test:list-tag-expansion");
        controller = new ListTagExpansionController({
            hostAdapter: { location: dom.window.location, document: dom.window.document }, storage, scope, diagnostics,
        });
        return { button, content, storage, diagnostics };
    }

    it("restores the legacy key before subscribing and persists the host's post-click state", () => {
        const { button, content, storage } = mount();
        expect(controller.start()).toBe(true);
        expect(content.classList.contains("collapse")).toBe(false);
        expect(storage.setLocal).not.toHaveBeenCalled();
        expect(scope.snapshot().listeners).toBe(1);
        expect(controller.start()).toBe(true);

        button.click();
        expect(content.classList.contains("collapse")).toBe(true);
        expect(storage.setLocal).toHaveBeenCalledOnce();
        expect(storage.setLocal).toHaveBeenCalledWith("jhs_tag_expand", "false");

        controller.dispose();
        expect(scope.snapshot().listeners).toBe(0);
        button.click();
        expect(storage.setLocal).toHaveBeenCalledOnce();
    });

    it("keeps the list mount available when reading the local preference fails", () => {
        const { content, diagnostics } = mount({ failRead: true });
        expect(controller.start()).toBe(true);
        expect(content.classList.contains("collapse")).toBe(true);
        expect(diagnostics.recordError).toHaveBeenCalledWith(expect.objectContaining({ contributionId: "list.core" }));
    });

    it("does not attach outside actor pages or when the host control is absent", () => {
        mount({ href: "https://javdb.com/" });
        expect(controller.start()).toBe(false);
        expect(scope.snapshot().listeners).toBe(0);
        controller.dispose();

        dom.window.document.querySelector(".tag-expand").remove();
        const nextScope = new LifecycleScope("test:list-tag-expansion-no-button");
        const next = new ListTagExpansionController({
            hostAdapter: { location: dom.window.location, document: dom.window.document },
            storage: { getLocal: () => null, setLocal: vi.fn() }, scope: nextScope,
        });
        expect(next.start()).toBe(false);
        expect(nextScope.snapshot().listeners).toBe(0);
        next.dispose();
        nextScope.dispose();
    });
});
