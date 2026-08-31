import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListPaginationController } from "../src/features/list/list-pagination-controller.js";

describe("ListPaginationController", () => {
    it("creates an idempotent jump control and navigates to the requested page", () => {
        const dom = new JSDOM('<ul class="pagination-list"><li><a class="pagination-link is-current">2</a></li></ul>', { url: "https://javdb.com/search?query=test&page=2" });
        const scope = new LifecycleScope("feature:list"), navigate = vi.fn();
        const controller = new ListPaginationController({ scope, document: dom.window.document, location: dom.window.location, navigate });

        controller.start();
        controller.start();
        const input = dom.window.document.querySelector("#jumpPageInput"), button = dom.window.document.querySelector(".jhs-jump-page-btn");
        expect(dom.window.document.querySelectorAll("#gemini-jump-page-control")).toHaveLength(1);
        expect(input.value).toBe("3");
        input.value = "4";
        button.click();
        expect(navigate).toHaveBeenCalledWith("https://javdb.com/search?query=test&page=4");
        controller.dispose();
        scope.dispose();
    });

    it("rejects invalid pages and handles Enter without navigating", () => {
        const dom = new JSDOM('<ul class="pagination-list"><li><a class="pagination-link is-current">1</a></li></ul>', { url: "https://javdb.com/search" });
        const scope = new LifecycleScope("feature:list"), navigate = vi.fn();
        const controller = new ListPaginationController({ scope, document: dom.window.document, location: dom.window.location, navigate });

        controller.start();
        const input = dom.window.document.querySelector("#jumpPageInput"), button = dom.window.document.querySelector(".jhs-jump-page-btn");
        input.value = "0";
        button.click();
        expect(navigate).not.toHaveBeenCalled();
        input.value = "2";
        input.dispatchEvent(new dom.window.KeyboardEvent("keypress", { key: "Enter", bubbles: true, cancelable: true }));
        expect(navigate).toHaveBeenCalledWith("https://javdb.com/search?page=2");
        scope.dispose();
    });
});
