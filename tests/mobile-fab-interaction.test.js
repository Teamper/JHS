// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import $ from "jquery";
import { ResponsiveShellController } from "../src/features/system/responsive-shell-controller.js";

let controller;
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function mount() {
    window.isListPage = true;
    let committed = "default";
    const pending = [];
    const buttons = { activeSortMethod: () => committed, selectSortMethod: vi.fn(value => {
        const task = deferred(); pending.push(task);
        return task.promise.then(() => { committed = value; });
    }) };
    const labels = { all: "全部", favorite: "收藏" };
    const list = { activeQuickFilter: "all", getQuickFilterCatalog: () => ({ primary: ["all", "favorite"], secondary: [], labels, normalize: () => "all" }), syncQuickFilterUi() {} };
    controller = new ResponsiveShellController({ jquery: $, window, document, profile: {}, settings: { snapshot: () => ({ sortMethod: committed }) }, host: {}, state: {}, logger: { error: vi.fn() }, notifications: { error: vi.fn() }, capabilities: { ListPagePlugin: list, ListPageButtonPlugin: buttons } });
    controller.mountBottomBar();
    const select = value => {
        $("#jhs-fab").trigger("click");
        $('[data-action="sort"]').trigger("click");
        $(`[data-jhs-sort="${value}"]`).trigger("click");
    };
    return { pending, select, buttons };
}
afterEach(() => { controller?.dispose(); document.body.innerHTML = ""; });

describe("mobile FAB interaction ownership", () => {
    it.each([
        [null, ".jhs-fab-menu-item"],
        ["quickFilter", ".jhs-mobile-filter-option"],
        ["sort", ".jhs-mobile-sort-option"],
    ])("keeps keyboard navigation and the close target for %s", (action, selector) => {
        mount(); $("#jhs-fab").trigger("click");
        if (action) $(`[data-action="${action}"]`).trigger("click");
        const items = $(selector).toArray(), scroll = vi.fn();
        items.forEach(item => { item.scrollIntoView = scroll; });
        const key = value => $(document.activeElement).trigger($.Event("keydown", { key: value }));
        key("End"); expect(document.activeElement).toBe(items.at(-1));
        key("ArrowDown"); expect(document.activeElement).toBe(items[0]);
        key("ArrowUp"); expect(document.activeElement).toBe(items.at(-1));
        key("Home"); expect(document.activeElement).toBe(items[0]);
        expect(scroll).toHaveBeenCalledTimes(4);
        expect(scroll).toHaveBeenLastCalledWith({ block: "nearest" });
        key("Escape");
        expect(document.activeElement).toBe(document.querySelector(action ? `[data-action="${action}"]` : "#jhs-fab"));
        expect($("#jhs-fab").attr("aria-expanded")).toBe(action ? "true" : "false");
    });

    it("makes the closed menu inert while preserving programmatic keyboard navigation", () => {
        mount();
        const menu = document.querySelector("#jhs-fab-menu");
        expect(menu.hasAttribute("inert")).toBe(true);
        expect([...menu.querySelectorAll("button")].every(button => button.tabIndex === -1)).toBe(true);
        $("#jhs-fab").trigger("click");
        expect(menu.hasAttribute("inert")).toBe(false);
        expect(menu.contains(document.activeElement)).toBe(true);
        $(document.activeElement).trigger($.Event("keydown", { key: "Escape" }));
        expect(menu.hasAttribute("inert")).toBe(true);
        expect(document.activeElement.id).toBe("jhs-fab");
        $("#jhs-fab").trigger("click");
        $(document.activeElement).trigger($.Event("keydown", { key: "Tab" }));
        expect(menu.hasAttribute("inert")).toBe(true);
    });

    it("closes on selection and leaves a subsequently opened filter and its focus intact", async () => {
        const { select, pending } = mount();
        select("date");
        expect($("#jhs-fab").attr("aria-expanded")).toBe("false");
        $("#jhs-fab").trigger("click"); $('[data-action="quickFilter"]').trigger("click");
        const focused = document.activeElement;
        pending[0].resolve();
        await vi.waitFor(() => expect($('[data-action="sort"]').text()).toBe("排序：时间"));
        expect($("#jhs-fab-menu").hasClass("jhs-fab-filter-open")).toBe(true);
        expect(document.activeElement).toBe(focused);
    });

    it("does not let an older rejection undo or report over the latest sort", async () => {
        const { select, pending } = mount();
        select("date"); select("rateCount");
        pending[1].resolve();
        await vi.waitFor(() => expect($('[data-action="sort"]').text()).toBe("排序：评价人数"));
        pending[0].reject(new Error("old failure")); await new Promise(resolve => setTimeout(resolve, 0));
        expect($('[data-jhs-sort="rateCount"]').attr("aria-checked")).toBe("true");
        expect(controller.services.notifications.error).not.toHaveBeenCalled();
    });

    it("rolls the latest failure back to committed state without changing another menu", async () => {
        const { select, pending } = mount();
        select("date"); $("#jhs-fab").trigger("click"); $('[data-action="quickFilter"]').trigger("click");
        const focused = document.activeElement;
        pending[0].reject(new Error("save failure"));
        await vi.waitFor(() => expect(controller.services.notifications.error).toHaveBeenCalledOnce());
        expect($('[data-jhs-sort="default"]').attr("aria-checked")).toBe("true");
        expect($("#jhs-fab-menu").hasClass("jhs-fab-filter-open")).toBe(true);
        expect(document.activeElement).toBe(focused);
    });

    it.each(["dispose", "unmountBottomBar"])("ignores sort feedback after %s", async method => {
        const { select, pending } = mount(); select("date");
        controller[method](); pending[0].reject(new Error("stale failure"));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(controller.services.notifications.error).not.toHaveBeenCalled();
        expect(document.querySelector("#jhs-fab-menu")).toBeNull();
    });
});
