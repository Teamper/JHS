import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListDomObserver } from "../src/features/list/list-dom-observer.js";

function flush(ms = 15) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function createObserver(dom, options = {}) {
    vi.stubGlobal("MutationObserver", dom.window.MutationObserver);
    const scope = new LifecycleScope("feature:list"), onRemoved = vi.fn(), onAddedNodes = vi.fn(), onAdded = vi.fn();
    const observer = new ListDomObserver({
        root: dom.window.document.querySelector("main"), itemSelector: ".item", scope,
        getRevision: () => "1:0", isProcessed: (item) => item.getAttribute("data-jhs-processed") === "true",
        onRemoved, onAddedNodes, onAdded, delay: 5, ...options,
    });
    return { scope, observer, onRemoved, onAddedNodes, onAdded };
}

describe("ListDomObserver", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("coalesces host-added cards, skips already processed nodes, and passes a fresh revision", async () => {
        const dom = new JSDOM("<!doctype html><main></main>", { url: "https://javdb.com/" }), harness = createObserver(dom);
        harness.observer.start();
        const wrapper = dom.window.document.createElement("section");
        wrapper.innerHTML = '<article class="item"></article><article class="item" data-jhs-processed="true"></article>';
        dom.window.document.querySelector("main").append(wrapper);
        await vi.waitFor(() => {
            expect(harness.onAddedNodes).toHaveBeenCalledOnce();
            expect(harness.onAdded).toHaveBeenCalledOnce();
        });
        expect(harness.onAdded.mock.calls[0][0]).toEqual([wrapper.querySelector(".item")]);
        expect(harness.onAdded.mock.calls[0][1]).toBe("1:0");
        harness.scope.dispose();
    });

    it("reports removed subtrees and stops observing when disposed", async () => {
        const dom = new JSDOM('<!doctype html><main><section><article class="item"></article></section></main>', { url: "https://javdb.com/" }), harness = createObserver(dom);
        const section = dom.window.document.querySelector("section");
        harness.observer.start();
        section.remove();
        await vi.waitFor(() => expect(harness.onRemoved).toHaveBeenCalledOnce());
        expect([...harness.onRemoved.mock.calls[0][0]]).toContain(section);
        harness.scope.dispose();
        expect(harness.scope.snapshot().observers).toBe(0);
    });

    it("cancels queued card processing when the feature closes before the debounce expires", async () => {
        const dom = new JSDOM("<!doctype html><main></main>", { url: "https://javdb.com/" }), harness = createObserver(dom);
        harness.observer.start();
        const item = dom.window.document.createElement("article");
        item.className = "item";
        dom.window.document.querySelector("main").append(item);
        await flush(0);
        harness.scope.dispose();
        await flush();

        expect(harness.onAdded).not.toHaveBeenCalled();
        expect(harness.scope.snapshot()).toMatchObject({ disposed: true, observers: 0 });
    });
});
