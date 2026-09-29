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
