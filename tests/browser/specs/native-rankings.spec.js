import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.describe("JavDB native rankings", () => {
  test.beforeEach(async ({ context }) => { await fulfillHostFixtures(context); });

  test("the old carrier route is a real 404 without a list", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    const response = await page.goto("https://javdb.com/advanced_search?handleTop=1&handleType=all", { waitUntil: "domcontentloaded" });
    expect(response.status()).toBe(404);
    await expect(page.locator(".movie-list, section .container")).toHaveCount(0);
  });

  for (const [oldPath, destinationPath, expected] of [
    ["/advanced_search?handlePlayback=1&period=weekly", "/rankings/playback", { p: "weekly", t: "high_score" }],
    ["/advanced_search?handleTop=1&handleType=year&type_value=2026&page=3&has_cnsub=1", "/rankings/top", { t: "y2026", page: "3", jhs_subtitle: "with" }],
    ["/advanced_search?type=3&keyword=FC2-123", "/search_advanced", { type: "3", keyword: "FC2-123" }],
    ["/advanced_search?type=100&released_start=2099-09&keyword=FC2-123", "/tags/fc2", { jhs_source: "123av", keyword: "FC2-123" }],
  ]) {
    test(`migrates a 404 legacy link before list mounting: ${oldPath}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-wide");
      const response = await page.goto(`https://javdb.com${oldPath}`, { waitUntil: "domcontentloaded" });
      expect(response.status()).toBe(404);
      await injectUserscriptRuntime(page, { expectRedirect: true });
      await expect.poll(() => new URL(page.url()).pathname).toBe(destinationPath);
      const result = new URL(page.url());
      for (const [key, value] of Object.entries(expected)) expect(result.searchParams.get(key)).toBe(value);
    });
  }

  test("Movies and Playback keep their separate native categories, controls, and links", async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await page.goto("https://javdb.com/rankings/movies?p=weekly&t=fc2", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    await expect(page.locator("#native-first")).toBeVisible();
    await expect(page.locator(".movie-list .item")).toHaveCount(3);
    await expect(page.locator("#movie-fc2")).toHaveAttribute("href", "/rankings/movies?p=weekly&t=fc2");
    const playbackLink = page.locator('.section a[href="/rankings/playback"]');
    await expect(playbackLink).toHaveCount(1);
    await expect(page.locator("#jhs-123av-nav")).toHaveAttribute("href", "/tags/fc2?c10=1&jhs_source=123av");
    await expect(page.locator(".section #jhs-123av-nav")).toHaveCount(0);
    expect(await page.locator(".movie-list").getAttribute("data-jhs-ranking")).toBeNull();
    await playbackLink.evaluate((link) => {
      link.addEventListener("click", (event) => {
        window.__nativePlaybackClick = {
          ctrlKey: event.ctrlKey, metaKey: event.metaKey, defaultPrevented: event.defaultPrevented,
          href: link.href, target: link.target,
        };
      }, { capture: true });
      window.addEventListener("click", (event) => {
        if (link.contains(event.target)) window.__nativePlaybackClick.finalDefaultPrevented = event.defaultPrevented;
      });
    });
    const popupPromise = context.waitForEvent("page", { timeout: 5000 }).catch(() => null);
    await playbackLink.click({ modifiers: ["Control"] });
    const popup = await popupPromise;
    const clickState = await page.evaluate(() => window.__nativePlaybackClick);
    expect(clickState).toMatchObject({ ctrlKey: true, defaultPrevented: false, finalDefaultPrevented: false, href: "https://javdb.com/rankings/playback" });
    expect(popup, `Control-clicking the native ranking anchor should open a tab; click=${JSON.stringify(clickState)}, pages=${context.pages().length}`).not.toBeNull();
    await popup.waitForLoadState("domcontentloaded");
    expect(new URL(page.url()).pathname).toBe("/rankings/movies");
    expect(new URL(popup.url()).hostname).toBe("javdb.com");
    await popup.close();
    await playbackLink.click();
    await page.waitForURL(/\/rankings\/playback(?:\?|$)/);
    await injectUserscriptRuntime(page);
    await expect(page.locator(".movie-list")).toHaveAttribute("data-jhs-ranking", "playback");
    await expect(page.locator("#native-first")).toBeVisible();
  });

  test("TOP250 filters loaded cards while retaining rank order and native pagination", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await page.goto("https://javdb.com/rankings/top?t=y2026&page=2", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { settingOverrides: { sortMethod: "rateCount" } });
    const order = () => page.locator(".movie-list .item").evaluateAll(items => items.map(item => item.id));
    await expect.poll(order).toEqual(["native-first", "native-second", "native-fc2"]);
    await expect(page.locator("#jhs-sort-current")).toHaveText("默认");
    await page.locator('button[data-jhs-subtitle="with"]').click();
    await expect(page.locator("#native-first")).toBeVisible();
    await expect(page.locator("#native-second")).toBeHidden();
    await expect(page.locator("#native-fc2")).toBeHidden();
    await expect(page.locator(".pagination-next")).toHaveAttribute("href", /jhs_subtitle=with/);
    await expect(page.locator("#top-fc2")).toHaveAttribute("href", /jhs_subtitle=with/);
    await page.locator('button[data-jhs-subtitle="all"]').click();
    await page.locator("#sort-toggle-btn").click();
    await page.locator('[data-sort-method="date"]').click();
    await expect.poll(order).toEqual(["native-second", "native-fc2", "native-first"]);
    await page.locator("#sort-toggle-btn").click();
    await page.locator('[data-sort-method="default"]').click();
    await expect.poll(order).toEqual(["native-first", "native-second", "native-fc2"]);
    await expect(page.locator("[data-native-pagination]")).toHaveCount(1);
  });

  test("TOP250 subtitle controls remain scrollable on a narrow screen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-small", "narrow-screen control layout");
    await page.goto("https://javdb.com/rankings/top?t=y2026&page=2", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    const controls = page.locator(".jhs-top250-subtitle");
    await expect(controls).toBeVisible();
    const layout = await controls.evaluate((element) => ({
      overflow: getComputedStyle(element).overflowX,
      width: element.clientWidth,
      contentWidth: element.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(layout.overflow).toBe("auto");
    expect(layout.width).toBeLessThanOrEqual(layout.viewport);
    expect(layout.contentWidth).toBeGreaterThan(layout.width);
    await controls.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    await expect.poll(() => controls.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await page.locator('button[data-jhs-subtitle="with"]').click();
    await expect(page.locator("#native-second")).toBeHidden();
  });

  test("TOP250 batch confirmation names the display-only subtitle filter", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await page.goto("https://javdb.com/rankings/top?t=y2026&page=2", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    await page.locator('button[data-jhs-subtitle="with"]').click();
    await expect(page.locator("#native-second")).toBeHidden();

    await page.getByRole("button", { name: "批量操作" }).click();
    await page.locator("#favoriteAllVideo").click();
    const dialog = page.locator(".layui-layer").filter({ hasText: "当前字幕筛选只影响显示，不限制批量处理范围" });
    await expect(dialog).toBeVisible();
    await dialog.locator(".layui-layer-btn1").click();
    await expect(dialog).toHaveCount(0);
  });

  test("the retained TOP250 disable ID disables only its feature-owned filter", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await page.goto("https://javdb.com/rankings/top?t=y2026&page=2", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { disabledPlugins: ["TOP250Plugin"] });
    await expect(page.locator(".movie-list .item")).toHaveCount(3);
    await expect(page.locator(".jhs-top250-subtitle")).toHaveCount(0);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("TOP250Plugin"))).toBe(false);
  });

  test("a disabled Playback contribution does not disable shared list actions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await page.goto("https://javdb.com/rankings/playback?p=monthly&t=all", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { disabledPlugins: ["HitShowPlugin"] });
    await expect(page.locator("#native-first")).toBeVisible();
    await expect(page.locator("#jhs-quick-filter")).toBeVisible();
    await expect(page.locator("#waitCheckBtn")).toBeVisible();
    await expect(page.locator(".movie-list")).not.toHaveAttribute("data-jhs-ranking", "playback");
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("HitShowPlugin"))).toBe(false);
  });

  test("123AV catalog mounts on the FC2 category route with its own source label", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await page.goto("https://javdb.com/tags/fc2?c10=1&jhs_source=123av", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    await expect(page.locator(".jhs-123av-list")).toHaveCount(1);
    await expect(page.locator("h2.section-title")).toContainText("123AV · FC2片库");
    await expect(page.locator("#search-123av-keyword")).toBeVisible();
    await expect(page.locator(".movie-list")).toHaveCount(1);
  });

  test("stopping the 123AV catalog restores native controls before their following sibling", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await page.goto("https://javdb.com/tags/fc2?c10=1&jhs_source=123av", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const pagination = document.createElement("nav");
      pagination.className = "pagination";
      pagination.dataset.nativePagination = "";
      pagination.textContent = "Host pages";
      const sentinel = document.createElement("div");
      sentinel.id = "native-after-list";
      document.querySelector("section .container").append(pagination, sentinel);
    });
    await injectUserscriptRuntime(page);
    await expect(page.locator(".jhs-123av-list")).toHaveCount(1);
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("Fc2By123AvPlugin").dispose());
    await expect(page.locator(".jhs-123av-list, .page-box, #search-123av-keyword")).toHaveCount(0);
    await expect(page.locator('.movie-list .item[data-jhs-fc2-source="fc2"]')).toBeVisible();
    expect(await page.locator("section .container").evaluate((container) => {
      const list = container.querySelector(":scope > .movie-list");
      const pagination = container.querySelector(":scope > nav[data-native-pagination]");
      const sentinel = container.querySelector(":scope > #native-after-list");
      return Boolean(list && pagination && sentinel
        && (list.compareDocumentPosition(pagination) & Node.DOCUMENT_POSITION_FOLLOWING)
        && (pagination.compareDocumentPosition(sentinel) & Node.DOCUMENT_POSITION_FOLLOWING));
    })).toBe(true);
  });

  test("the retained FC2 123AV disable ID suppresses the migrated feature and compatibility bean", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await page.goto("https://javdb.com/tags/fc2?c10=1&jhs_source=123av", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { disabledPlugins: ["Fc2By123AvPlugin"] });
    await expect(page.locator(".movie-list .item")).toHaveCount(1);
    await expect(page.locator(".jhs-123av-list, #jhs-123av-nav, #search-123av-keyword")).toHaveCount(0);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("Fc2By123AvPlugin"))).toBe(false);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("Fc2By123AvPlugin"))).toBeUndefined();
  });
});
