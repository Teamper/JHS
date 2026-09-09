import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

for (const url of ["https://javdb.com/v/test-id", "https://www.javbus.com/ABC-123"]) {
  test(`review preference mounts from OFF and blocks hidden pagination: ${url}`, async ({ page, context }, testInfo) => {
    test.skip(!["desktop-wide", "mobile"].includes(testInfo.project.name), "desktop and mobile own this interaction contract");
    await fulfillHostFixtures(context);
    await page.goto(url);
    await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview: "no", reviewCount: 1 } });
    await expect.poll(() => page.evaluate(() => Boolean(window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]))).toBe(true);
    await page.evaluate(async () => {
      const plugin = window.unsafeWindow.pluginManager.getBean("ReviewPlugin");
      window.reviewRegressionRequests = 0;
      plugin.getRuntimeService("movie").resolve = async () => ({ movieId: "test-id" });
      plugin.getRuntimeService("review").list = async () => { window.reviewRegressionRequests++; return [{ author: "fixture", content: "review body", createdAt: "2026-09-08" }]; };
      await plugin.getRuntimeService("settings").set("enableLoadReview", "yes");
    });
    await expect(page.locator(".jhs-review-item")).toHaveCount(1);
    await expect(page.locator(".jhs-review-toggle")).toHaveAttribute("aria-expanded", "true");
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ReviewPlugin").getRuntimeService("settings").set("enableLoadReview", "no"));
    await expect(page.locator(".jhs-review-toggle")).toHaveAttribute("aria-expanded", "false");
    await page.locator(".jhs-review-load-more").evaluate(button => button.click());
    expect(await page.evaluate(() => window.reviewRegressionRequests)).toBe(1);
  });
}
