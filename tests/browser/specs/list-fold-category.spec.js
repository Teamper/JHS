import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("list fold-category contribution owns its DOM, setting, and cleanup lifecycle", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one desktop project covers the leaf contribution lifecycle");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const tags = document.createElement("div");
    tags.id = "tags";
    const list = document.createElement("dl");
    const selected = document.createElement("div");
    selected.className = "tag is-info";
    selected.textContent = "动作";
    const category = document.createElement("div");
    category.className = "tag-category";
    const tag = document.createElement("a");
    tag.className = "tag";
    tag.href = "/tags/action";
    tag.textContent = "剧情 (3)";
    category.append(tag);
    list.append(selected, category);
    tags.append(list);
    const tabs = document.createElement("div");
    tabs.className = "tabs";
    const title = document.createElement("h2");
    title.className = "section-title";
    title.textContent = "影片";
    const section = document.createElement("section");
    const outer = document.createElement("div");
    const box = document.createElement("div");
    box.className = "box";
    box.textContent = "分类结果";
    outer.append(box);
    section.append(outer);
    document.body.append(tags, tabs, title, section);
  });
  await injectUserscriptRuntime(page);

  await expect(page.locator(".jhs-fold-category-btn")).toHaveCount(2);
  await expect(page.locator("section > div > div.box")).toBeVisible();
  await page.locator("#tags a.tag").hover();
  await expect(page.locator("#tags a.tag .highlight-btn")).toHaveCount(1);
  await page.locator("#tags a.tag .highlight-btn").click();
  await expect(page.locator("#tags a.tag")).toHaveClass(/highlighted/);

  await page.locator(".jhs-fold-category-btn").first().click();
  await expect.poll(() => page.evaluate(() => window.settingsService.snapshot().foldCategoryCollapsed)).toBe(true);
  await expect(page.locator("section > div > div.box")).toBeHidden();
});
