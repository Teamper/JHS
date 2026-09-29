import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListPaginationController } from "../src/features/list/list-pagination-controller.js";

function createHarness({ url = "https://javdb.com/?page=3&keyword=abc", route = "list", currentPage = true } = {}) {
    const dom = new JSDOM(`<!doctype html><ul class="pagination-list">${currentPage ? '<li><a class="pagination-link is-current">3</a></li>' : ""}</ul>`, { url });
    const hostAdapter = { document: dom.window.document, location: dom.window.location, detectRoute: () => route };
    const navigation = { assign: vi.fn() }, scope = new LifecycleScope("feature:list");
    const controller = new ListPaginationController({ hostAdapter, navigation, scope });
    return { dom, hostAdapter, navigation, scope, controller };
}

describe("ListPaginationController", () => {
    afterEach(() => vi.restoreAllMocks());

    it("adds next-page input and preserves other query parameters on click", () => {
        const { dom, navigation, scope, controller } = createHarness();
        expect(controller.start()).toBe(true);
        expect(dom.window.document.querySelector("#jumpPageInput").value).toBe("4");
        dom.window.document.querySelector(".jhs-jump-page-btn").click();
        expect(navigation.assign).toHaveBeenCalledOnce();
        const target = new URL(navigation.assign.mock.calls[0][0]);
        expect(target.searchParams.get("page")).toBe("4");
        expect(target.searchParams.get("keyword")).toBe("abc");
        scope.dispose();
        expect(dom.window.document.querySelector("#gemini-jump-page-control")).toBeNull();
        dom.window.close();
    });

    it("submits Enter, focuses invalid values, and disposes idempotently", () => {
        const { dom, navigation, scope, controller } = createHarness();
        controller.start();
        const input = dom.window.document.querySelector("#jumpPageInput");
        input.value = "0";
        input.dispatchEvent(new dom.window.KeyboardEvent("keypress", { key: "Enter", bubbles: true, cancelable: true }));
        expect(navigation.assign).not.toHaveBeenCalled();
        expect(dom.window.document.activeElement).toBe(input);
        input.value = "8";
        const enter = new dom.window.KeyboardEvent("keypress", { key: "Enter", bubbles: true, cancelable: true });
        input.dispatchEvent(enter);
        expect(enter.defaultPrevented).toBe(true);
        expect(new URL(navigation.assign.mock.calls[0][0]).searchParams.get("page")).toBe("8");
        controller.dispose();
        controller.dispose();
        scope.dispose();
        expect(dom.window.document.querySelector("#gemini-jump-page-control")).toBeNull();
        dom.window.close();
    });

    it("keeps the control absent until native pagination appears and ignores other routes", async () => {
        const noCurrentPage = createHarness({ currentPage: false });
        expect(noCurrentPage.controller.start()).toBe(true);
        expect(noCurrentPage.dom.window.document.querySelector("#gemini-jump-page-control")).toBeNull();
        const current = noCurrentPage.dom.window.document.createElement("a");
        current.className = "pagination-link is-current";
        current.textContent = "3";
        noCurrentPage.dom.window.document.querySelector(".pagination-list").append(current);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(noCurrentPage.dom.window.document.querySelector("#gemini-jump-page-control")).not.toBeNull();
        noCurrentPage.scope.dispose();
        noCurrentPage.dom.window.close();

        const wrongRoute = createHarness({ route: "detail" });
        expect(wrongRoute.controller.start()).toBe(false);
        expect(wrongRoute.dom.window.document.querySelector("#gemini-jump-page-control")).toBeNull();
        wrongRoute.scope.dispose();
        wrongRoute.dom.window.close();
    });
});
