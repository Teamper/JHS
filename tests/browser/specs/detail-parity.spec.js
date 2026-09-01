import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

for (const [label, url] of [
  ["JavDB", "https://javdb.com/v/test-id"],
  ["JavBus", "https://www.javbus.com/ABC-123"],
]) {
  test(`${label} detail parity binds every state action to the normalized movie identity`, async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers each native detail host");
    await fulfillHostFixtures(context);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    await expect(page.locator(".jhs-detail-btn-row")).toBeVisible();
    for (const [selector, flag] of [["#favoriteBtn", "favorite"], ["#hasDownBtn", "downloaded"], ["#hasWatchBtn", "watched"]]) {
      await page.locator(selector).click();
      await expect.poll(() => page.evaluate(async (stateFlag) => (await window.stateService.getCar("ABC-123"))?.stateFlags?.[stateFlag], flag)).toBe(true);
      await expect(page.locator(selector)).toHaveAttribute("aria-pressed", "true");
    }
    await expect.poll(() => page.evaluate(async () => {
      const record = await window.stateService.getCar("ABC-123");
      return { names: record?.names, publishTime: record?.publishTime };
    })).toEqual({ names: "演员甲", publishTime: "2026-08-30" });
  });
}
