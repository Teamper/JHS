// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListCategoryFoldController } from "../src/features/list/list-category-fold-controller.js";

function setup({ href = "https://javdb.com/", highlighted = [], foldCategoryCollapsed = false, failSetting = false } = {}) {
    document.body.innerHTML = `
        <div class="tabs"></div>
        <section>
            <h2 class="section-title">分类</h2>
            <div><div class="box" id="category-box">
                <div id="tags">
                    <dl><div><div class="tag is-info">剧情</div></div></dl>
                    <div class="tag-category"><div class="collapse"><button class="tag-expand" type="button"></button></div></div>
                    <a class="tag" href="/tags/drama">剧情 (12)</a>
                </div>
            </div></div>
        </section>`;
    window.isListPage = true;
    document.querySelector(".tag-expand").addEventListener("click", (event) => event.currentTarget.parentElement.classList.remove("collapse"));
    const committed = { foldCategoryCollapsed, highlightedTagNumber: 2, highlightedTagColor: "#ce2222" };
    const settings = new EventTarget();
    settings.snapshot = () => ({ ...committed });
    settings.set = vi.fn(async (key, value) => {
        if (failSetting) throw new Error("setting write failed");
        committed[key] = value;
        settings.dispatchEvent(new CustomEvent("settings.changed", { detail: { names: [key], snapshot: { ...committed } } }));
    });
    const data = new Map([["highlighted_tags", highlighted]]);
    const storage = { get: vi.fn(async (key) => data.get(key)), set: vi.fn(async (key, value) => data.set(key, value)) };
    const storageMutation = { runExclusive: vi.fn(async (operation) => operation()) };
    const releaseStyle = vi.fn(), styles = { register: vi.fn(() => releaseStyle) };
    const notifications = { error: vi.fn(), info: vi.fn(), ok: vi.fn() };
    const diagnostics = { recordError: vi.fn() };
    const scope = new LifecycleScope("test-list-category-fold");
    const controller = new ListCategoryFoldController({
        hostAdapter: { document, location: { href } }, settings, storage, storageMutation, styles, notifications, diagnostics, scope, route: "list",
    });
    return { controller, scope, committed, data, settings, storage, storageMutation, styles, releaseStyle, notifications, diagnostics };
}

describe("List Feature category highlight and folding", () => {
    it("restores and toggles the 6.5.1 highlight key through the shared mutation lock", async () => {
        const test = setup({ highlighted: ["剧情"] });
        await expect(test.controller.start()).resolves.toBe(true);
        const tag = document.querySelector("#tags a.tag");
        expect(tag.classList.contains("highlighted")).toBe(true);
        tag.dispatchEvent(new Event("pointerover", { bubbles: true }));
        const click = new MouseEvent("click", { bubbles: true, cancelable: true });
        tag.querySelector(".highlight-btn").dispatchEvent(click);
        await vi.waitFor(() => expect(test.data.get("highlighted_tags")).toEqual([]));
        expect(test.storageMutation.runExclusive).toHaveBeenCalledOnce();
        expect(test.storage.set).toHaveBeenCalledWith("highlighted_tags", []);
        expect(tag.classList.contains("highlighted")).toBe(false);
        expect(click.defaultPrevented).toBe(true);
        test.scope.dispose();
    });

    it("makes the highlight action available when a tag receives keyboard focus", async () => {
        const test = setup();
        await test.controller.start();
        document.querySelector("#tags a.tag").dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        expect(document.querySelector("#tags a.tag .highlight-btn")).not.toBeNull();
        test.scope.dispose();
    });

    it("keeps the selected label, two fold controls, expand behavior and persistent fold setting", async () => {
        const test = setup();
        await expect(test.controller.start()).resolves.toBe(true);
        expect(document.querySelector("#jhs-check-tag").textContent).toBe("剧情");
        expect(document.querySelectorAll(".jhs-fold-category-btn")).toHaveLength(2);
        expect(document.querySelector(".tag-category > div").classList.contains("collapse")).toBe(false);
        const box = document.querySelector("#category-box");
        expect(box.hidden).toBe(false);
        document.querySelector(".jhs-fold-category-btn").click();
        await vi.waitFor(() => expect(test.committed.foldCategoryCollapsed).toBe(true));
        expect(box.hidden).toBe(true);
        expect(document.querySelectorAll('.jhs-fold-category-btn[aria-expanded="false"]')).toHaveLength(2);
        test.scope.dispose();
    });

    it("rolls back a failed fold-setting write and preserves noFold initial visibility", async () => {
        const failed = setup({ failSetting: true });
        await failed.controller.start();
        const box = document.querySelector("#category-box");
        document.querySelector(".jhs-fold-category-btn").click();
        await vi.waitFor(() => expect(failed.notifications.error).toHaveBeenCalledOnce());
        expect(failed.committed.foldCategoryCollapsed).toBe(false);
        expect(box.hidden).toBe(false);
        expect(failed.diagnostics.recordError).toHaveBeenCalledOnce();
        failed.scope.dispose();

        const noFold = setup({ href: "https://javdb.com/?noFold=1", foldCategoryCollapsed: true });
        await noFold.controller.start();
        expect(document.querySelector("#category-box").hidden).toBe(false);
        expect(document.querySelector(".jhs-fold-category-btn").textContent).toContain("展开");
        noFold.scope.dispose();
    });

    it("releases listeners, highlighting, fold UI and registered style on dispose", async () => {
        const test = setup({ highlighted: ["剧情"] });
        await test.controller.start();
        document.querySelector("#tags a.tag").dispatchEvent(new Event("pointerover", { bubbles: true }));
        expect(test.scope.snapshot().listeners).toBeGreaterThan(0);
        test.scope.dispose();
        expect(test.scope.snapshot().listeners).toBe(0);
        expect(document.querySelector(".jhs-fold-category-btn")).toBeNull();
        expect(document.querySelector(".jhs-fold-category-toolbar")).toBeNull();
        expect(document.querySelector("#tags a.tag").classList.contains("highlighted")).toBe(false);
        expect(document.querySelector("#tags a.tag .highlight-btn")).toBeNull();
        expect(test.releaseStyle).toHaveBeenCalledOnce();
    });

    it("does not install list behavior on advanced search routes", async () => {
        const test = setup({ href: "https://javdb.com/advanced_search" });
        window.isListPage = false;
        await expect(test.controller.start()).resolves.toBe(false);
        expect(test.styles.register).not.toHaveBeenCalled();
        expect(document.querySelector(".jhs-fold-category-btn")).toBeNull();
        test.scope.dispose();
    });
});
