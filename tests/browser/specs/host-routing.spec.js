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
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--jhs-accent").trim()), "Bootstrap must inject the core theme tokens").not.toBe("");
    await expect(page.locator("body")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.waitForTimeout(250);
    const initialRequests = await page.evaluate(() => window.__jhsBrowserDiagnostics.requests);
    expect(initialRequests.length, `deterministic fixture startup request budget: ${JSON.stringify(initialRequests)}`).toBeLessThanOrEqual(budget.browserFixture.maximumInitialRequests[label]);
  });
}

for (const [label, url] of [
  ["JavDB", "https://javdb.com/"],
  ["JavBus", "https://www.javbus.com/"]
]) {
  test(`${label} list route uses its HostAdapter and list runtime`, async ({ context, page }, testInfo) => {
    await fulfillHostFixtures(context);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    await expect.poll(() => page.evaluate(() => window.isListPage)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("ListPagePlugin"))).toBe(true);
    await expect(page.locator(label === "JavDB" ? ".movie-list .item" : ".masonry .movie-box")).toHaveCount(1);
    if (testInfo.project.name.startsWith("mobile")) {
      await expect(page.locator("#jhs-fab")).toBeVisible();
      await expect(page.locator("#jhs-fab-menu .jhs-mobile-filter-menu")).toHaveCount(1);
    } else await expect(page.locator("#jhs-quick-filter")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
}

test("legacy disabled plugin migrates to one contribution only", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers storage migration");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { disabledPlugins: ["ReviewPlugin"] });
  const pluginNames = await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames());
  expect(pluginNames).not.toContain("ReviewPlugin");
  expect(pluginNames).toContain("RelatedPlugin");
  expect(pluginNames).toContain("DetailWorkspacePlugin");
});
