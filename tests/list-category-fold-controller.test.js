// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListCategoryFoldController } from "../src/features/list/list-category-fold-controller.js";

describe("ListCategoryFoldController", () => {
  let scope;
  let settings;
  let storage;
  let document;

  beforeEach(() => {
    document = globalThis.document;
    document.body.innerHTML = `
      <div id="tags"><dl><div class="tag is-info">动作</div><div class="tag-category"><a class="tag" href="/tags/x">剧情 (3)</a><span class="tag-expand"></span></div></dl></div>
      <div class="tabs"></div><h2 class="section-title">影片</h2><section><div><div class="box">内容</div></div></section>`;
    scope = new LifecycleScope("feature:list");
    settings = new EventTarget();
    settings.snapshot = () => ({ foldCategoryCollapsed: false, highlightedTagNumber: 2, highlightedTagColor: "#ce2222" });
    settings.set = vi.fn(async (key, value) => { settings.snapshot = () => ({ foldCategoryCollapsed: key === "foldCategoryCollapsed" ? value : false, highlightedTagNumber: 2, highlightedTagColor: "#ce2222" }); });
    const values = new Map([["highlighted_tags", ["剧情"]]]);
    storage = { get: vi.fn(async (key) => values.get(key)), set: vi.fn(async (key, value) => values.set(key, value)) };
  });

  it("restores highlighted tags, mounts fold controls, and persists toggle", async () => {
    const controller = new ListCategoryFoldController({ hostAdapter: { document, location: document.location }, settings, storage, ui: { getClog: () => ({}) }, scope, route: "list" });
    globalThis.window.isListPage = true;
    await controller.start();

    const tag = document.querySelector("#tags a.tag");
    expect(tag.classList.contains("highlighted")).toBe(true);
    expect(document.querySelectorAll(".jhs-fold-category-btn")).toHaveLength(2);
    expect(document.querySelector(".jhs-fold-category-btn")?.getAttribute("aria-expanded")).toBe("true");
    expect(document.documentElement.style.getPropertyValue("--jhs-highlighted-tag-number")).toBe("2px");

    const highlightButton = document.createElement("button");
    highlightButton.className = "highlight-btn";
    tag.append(highlightButton);
    highlightButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(storage.set).toHaveBeenCalledWith("highlighted_tags", []);

    document.querySelector(".jhs-fold-category-btn")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settings.set).toHaveBeenCalledWith("foldCategoryCollapsed", true);
    expect(document.querySelector("section > div > div.box").hidden).toBe(true);
  });

  it("removes its listeners and owned DOM on dispose", async () => {
    const controller = new ListCategoryFoldController({ hostAdapter: { document, location: document.location }, settings, storage, scope, route: "list" });
    globalThis.window.isListPage = true;
    await controller.start();
    controller.dispose();
    expect(document.querySelector(".jhs-fold-category-btn")).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--jhs-highlighted-tag-number")).toBe("");
  });
});
