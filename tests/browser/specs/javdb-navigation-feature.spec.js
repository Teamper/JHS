import { expect, test } from "@playwright/test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const devUserscriptPath = join(repoRoot, "dist", "dev", "JHS-7.0.dev.user.js");

async function addJavDbNavbar(page) {
  await page.evaluate(() => {
    const nav = document.createElement("nav");
    nav.innerHTML = `
      <div class="navbar-menu">
        <div id="navbar-menu-hero"></div>
        <div class="navbar-item"><a class="navbar-link" href="/makers">片商</a></div>
        <a id="old-feedback" href="/feedbacks/new">反馈</a>
        <a id="porn-link" href="https://theporndude.com">站外</a>
      </div>
      <div id="search-bar-container" style="display:none"><input type="search" placeholder="宿主搜索"></div>
      <a class="search-image" id="button-search-image"><span>原生识图</span></a>`;
    nav.querySelector(".search-image").addEventListener("click", () => { window.hostImageSearchClicks = (window.hostImageSearchClicks || 0) + 1; });
    document.body.prepend(nav);
  });
}

test.describe("JavDB navigation Feature migration", () => {
  test("keeps search, image search, external links, highlighting, and responsive search handoff", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/search?q=ABC-123&f=code", { waitUntil: "domcontentloaded" });
    await addJavDbNavbar(page);
    await injectUserscriptRuntime(page, { userscriptPath: devUserscriptPath });
    await page.waitForSelector("#jhs-quick-filter");

    await expect(page.locator("#search-keyword")).toHaveValue("ABC-123");
    await expect(page.locator("#search-type")).toHaveValue("code");
    await expect(page.locator(".video-title strong")).toHaveClass(/highlight-red/);
    await expect(page.locator("#old-feedback")).toHaveCount(0);
    await expect(page.locator("#porn-link")).toHaveCount(0);
    await expect(page.locator(".navbar-item.has-dropdown a[href='/feedbacks/new']")).toHaveText("反饋");

    await page.setViewportSize({ width: 1701, height: 900 });
    await page.evaluate(() => {
      window.imageSearchOpenCount = 0;
      const layer = window.unsafeWindow.layer;
      const open = layer.open;
      layer.open = function(options, ...args) {
        if (options.title === "以图识图") window.imageSearchOpenCount += 1;
        return open.call(this, options, ...args);
      };
    });
    await page.locator("#search-img-btn").click();
    await expect.poll(() => page.evaluate(() => window.imageSearchOpenCount)).toBe(1);
    await expect(page.locator('.jhs-image-search [data-role="upload-area"]')).toBeVisible();
    await page.locator(".search-image").click();
    await expect.poll(() => page.evaluate(() => window.imageSearchOpenCount)).toBe(2);
    expect(await page.evaluate(() => window.hostImageSearchClicks || 0)).toBe(0);

    await page.locator("#search-keyword").fill("A&B/# +");
    await page.evaluate(() => {
      const select = document.querySelector("#search-type");
      select.value = "actor";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.setViewportSize({ width: 1599, height: 900 });
    await expect(page.locator("#search-box")).toBeHidden();
    await expect(page.locator("#search-bar-container")).toBeVisible();
    await page.setViewportSize({ width: 1701, height: 900 });
    await expect(page.locator("#search-box")).toBeVisible();
    await expect(page.locator("#search-bar-container")).toBeHidden();
    await page.locator("#search-btn").click();
    await expect(page).toHaveURL(/\/search\?q=A%26B%2F%23%20%2B&f=actor/);
  });

  test("preserves the NavBarPlugin disable key and leaves host search untouched", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await addJavDbNavbar(page);
    await injectUserscriptRuntime(page, { disabledPlugins: ["NavBarPlugin"], userscriptPath: devUserscriptPath });
    await page.waitForSelector("#jhs-quick-filter");

    await expect(page.locator("#search-box")).toHaveCount(0);
    await expect(page.locator(".search-image")).toHaveCount(1);
    await page.locator(".search-image").click();
    expect(await page.evaluate(() => window.hostImageSearchClicks)).toBe(1);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("NavBarPlugin"))).toBe(false);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name }) => name === "NavBarPlugin"))).toBe(true);
  });

  test("opens a new-tab search from non-search pages", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await addJavDbNavbar(page);
    await injectUserscriptRuntime(page, {
      userscriptPath: devUserscriptPath,
      beforeUserscriptInjection: (hostPage) => hostPage.evaluate(() => {
        window.openedSearch = null;
        window.open = (...args) => { window.openedSearch = args; return null; };
      }),
    });
    await page.waitForSelector("#jhs-quick-filter");
    await page.setViewportSize({ width: 1701, height: 900 });
    await page.locator("#search-keyword").fill("a b");
    await page.evaluate(() => {
      const select = document.querySelector("#search-type");
      select.value = "maker";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.locator("#search-btn").click();
    await expect.poll(() => page.evaluate(() => window.openedSearch)).toEqual(["/search?q=a%20b&f=maker", "_blank", "noopener"]);
  });
});
