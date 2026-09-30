import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("List Feature owns JavDB card-state badges and preserves the legacy page summary", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers list card-state presentation");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.delegate?.cardStatePresenter))).toBe(true);
  await expect(page.locator("#jhs-list-card-state-feature")).toHaveCount(1);
  await page.evaluate(async () => {
    const item = document.querySelector(".movie-list .item");
    await window.stateService.patch("ABC-123", { favorite: true }, {
      record: { carNum: "ABC-123", url: "https://javdb.com/v/abc-123", names: "Fixture Actor", publishTime: "2026-08-25" },
    });
    return item;
  });

  await expect(page.locator(".movie-list .item .tags .jhs-status-tags .status-tag")).toHaveText(["已收藏"]);
  await expect.poll(() => page.evaluate(() => {
    const listPage = window.unsafeWindow.pluginManager.getBean("ListPagePlugin");
    const summary = listPage.getCurrentPageSummary();
    return { nativePresenter: Boolean(listPage.delegate?.cardStatePresenter), favorite: summary.favorite, total: summary.total };
  })).toEqual({ nativePresenter: true, favorite: 1, total: 1 });
});

test("quick-filter buttons change card visibility without a full state refresh", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the list quick-filter interaction");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);

  const card = page.locator(".movie-list .item").first();
  await expect(card).toHaveAttribute("data-jhs-flags", /favorite/);
  await expect(card).toBeVisible();

  await page.locator('#jhs-quick-filter [data-jhs-filter="favorite"]').click();
  await expect(page.locator('#jhs-quick-filter [data-jhs-filter="favorite"]')).toHaveAttribute("aria-selected", "true");
  await expect(card).toBeHidden();

  await page.locator('#jhs-quick-filter [data-jhs-filter="all"]').click();
  await expect(card).toBeVisible();

  await page.locator('#jhs-quick-filter [data-jhs-filter="hasDown"]').click();
  await expect(card).toBeHidden();

  await page.locator("#jhs-quick-filter .jhs-quick-filter__toggle").click();
  await page.locator('#jhs-quick-filter [data-jhs-filter="blockedItems"]').click();
  await expect(page.locator('#jhs-quick-filter [data-jhs-filter="blockedItems"]')).toHaveAttribute("aria-checked", "true");
  await expect(card).toBeHidden();
});

test("narrow cards keep all enabled cover actions inside the tag area", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers narrow card layout");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.addStyleTag({ content: ".movie-list .item { width: 154px; } .movie-list .item .tags { display: flex !important; width: 154px; flex-wrap: wrap; }" });

  const tools = page.locator(".movie-list .item .jhs-cover-tools").first();
  await expect(tools.locator(".screenSvg")).toBeVisible();
  await expect(tools.locator(".videoSvg")).toBeVisible();
  await expect(tools.locator(".handleSvg .jhs-card-menu-trigger")).toBeVisible();
  await expect(tools.locator(".siteSvg .jhs-card-menu-trigger")).toBeVisible();
  await expect(tools.locator(".copySvg .jhs-card-menu-trigger")).toBeVisible();
  const geometry = await tools.evaluate((element) => {
    const tagRight = element.parentElement.getBoundingClientRect().right;
    return [...element.children].filter((child) => getComputedStyle(child).display !== "none")
      .map((child) => ({ right: child.getBoundingClientRect().right, tagRight }));
  });
  expect(geometry).toHaveLength(5);
  expect(geometry.every(({ right, tagRight }) => right <= tagRight + 1)).toBe(true);
});
