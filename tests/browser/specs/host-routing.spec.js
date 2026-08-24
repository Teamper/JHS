import { expect, test } from "@playwright/test";
import budget from "../../../performance-budget.json" with { type: "json" };
import { assertNoHorizontalOverflow, fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

for (const [label, url, expectedPlugin] of [
  ["JavDB", "https://javdb.com/v/test-id", "DetailPagePlugin"],
  ["JavBus", "https://www.javbus.com/ABC-123", "BusDetailPagePlugin"]
]) {
  test(`${label} uses the real host origin with local fixtures`, async ({ context, page }) => {
    await fulfillHostFixtures(context);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    await expect.poll(() => page.evaluate((name) => window.unsafeWindow.pluginManager.getPluginNames().includes(name), expectedPlugin)).toBe(true);
    await expect(page.locator("body")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.waitForTimeout(250);
    const initialRequests = await page.evaluate(() => window.__jhsBrowserDiagnostics.requests.length);
    expect(initialRequests, "deterministic fixture startup request budget").toBeLessThanOrEqual(budget.browserFixture.maximumInitialRequests[label]);
  });
}
