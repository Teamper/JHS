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
    await expect(page.locator(".main-tabs a").nth(1)).toHaveAttribute("href", "/rankings/playback?p=daily&t=high_score");
    await expect(page.locator("#jhs-123av-nav")).toHaveAttribute("href", "/tags/fc2?c10=1&jhs_source=123av");
    await expect(page.locator(".main-tabs #jhs-123av-nav")).toHaveCount(0);
    expect(await page.locator(".movie-list").getAttribute("data-jhs-ranking")).toBeNull();
    const popupPromise = context.waitForEvent("page");
    await page.locator(".main-tabs a").nth(1).click({ modifiers: ["Control"] });
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    expect(new URL(page.url()).pathname).toBe("/rankings/movies");
    expect(new URL(popup.url()).hostname).toBe("javdb.com");
    await popup.close();
    await page.locator(".main-tabs a").nth(1).click();
    await page.waitForURL(/\/rankings\/playback\?/);
    expect(new URL(page.url()).searchParams.get("t")).toBe("high_score");
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

  test("a disabled Playback contribution does not disable shared list actions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await page.goto("https://javdb.com/rankings/playback?p=monthly&t=all", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { disabledPlugins: ["HitShowPlugin"] });
    await expect(page.locator("#native-first")).toBeVisible();
    await expect(page.locator("#jhs-quick-filter")).toBeVisible();
    await expect(page.locator("#waitCheckBtn")).toBeVisible();
    await expect(page.locator(".movie-list")).not.toHaveAttribute("data-jhs-ranking", "playback");
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
});
