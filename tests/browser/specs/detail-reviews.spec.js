import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("detail reviews are mounted into the owned slot without the legacy plugin", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one desktop project covers the detail reviews contribution");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview: "no" } });

  const panel = page.locator('[data-jhs-slot="reviews"] [data-jhs-panel="reviews"]');
  await expect(panel).toHaveCount(1);
  await expect(panel).toHaveAttribute("data-jhs-movie-id", "test-id");
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.__jhsFeatureRuntime.getActiveFeatureIds().includes("detail"))).toBe(true);
});
