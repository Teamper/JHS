import { expect, test } from "@playwright/test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const devUserscriptPath = join(repoRoot, "dist", "dev", "JHS-7.0.dev.user.js");

async function mountSelectedCategories(page) {
  await page.evaluate(() => {
    const section = document.querySelector("main section");
    section.insertAdjacentHTML("afterbegin", `
      <h2 class="section-title">影片分类</h2>
      <div><div class="box" id="category-box">
        <div id="tags">
          <dl><div><div class="tag is-info">剧情</div></div></dl>
          <div class="tag-category"><div class="collapse"><button class="tag-expand" type="button">展开分类</button></div></div>
          <a class="tag" href="/tags/drama">剧情 (12)</a>
        </div>
      </div></div>`);
    const expand = document.querySelector(".tag-expand");
    expand.addEventListener("click", () => expand.parentElement.classList.remove("collapse"));
    const tabs = document.createElement("div");
    tabs.className = "tabs";
    section.insertBefore(tabs, section.firstChild);
  });
}

test.describe("JavDB category fold migration", () => {
  test("preserves 6.5.1 controls and data keys without instantiating the old plugin", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await mountSelectedCategories(page);
    await injectUserscriptRuntime(page, { userscriptPath: devUserscriptPath });

    await expect(page.locator(".jhs-fold-category-btn")).toHaveCount(2);
    await expect(page.locator("#jhs-check-tag")).toHaveText("剧情");
    await expect(page.locator(".tag-category > div")).not.toHaveClass(/collapse/);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("FoldCategoryPlugin"))).toBe(false);

    const tag = page.locator("#tags a.tag");
    await tag.hover();
    await tag.locator(".highlight-btn").click();
    await expect(tag).toHaveClass(/highlighted/);
    await expect.poll(() => page.evaluate(async () => {
      const forage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
      return forage.getItem("highlighted_tags");
    })).toEqual(["剧情"]);

    await page.locator(".jhs-fold-category-btn").first().click();
    await expect(page.locator("#category-box")).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().foldCategoryCollapsed)).toBe(true);
  });

  test("the saved FoldCategoryPlugin disable ID still disables the Feature-owned contribution", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await mountSelectedCategories(page);
    await injectUserscriptRuntime(page, { disabledPlugins: ["FoldCategoryPlugin"], userscriptPath: devUserscriptPath });

    await expect(page.locator(".jhs-fold-category-btn")).toHaveCount(0);
    await expect(page.locator("#tags a.tag .highlight-btn")).toHaveCount(0);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("FoldCategoryPlugin"))).toBe(false);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name }) => name === "FoldCategoryPlugin"))).toBe(true);
  });
});
