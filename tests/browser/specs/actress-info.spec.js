import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const detailPage = `
  <main>
    <div class="panel-block"><span>演员甲</span><i class="female"></i></div>
    <div id="actor-heading"><strong>演员</strong></div>
  </main>`;

test("actress info is feature-owned, keeps its setting behavior, and preserves the old disable ID", async ({ page, context, browser }, info) => {
  test.skip(info.project.name !== "desktop-wide", "explicit viewport matrix owner");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/actress-info-fixture");
  await page.evaluate((html) => { document.body.innerHTML = html; }, detailPage);
  await injectUserscriptRuntime(page, { settingOverrides: { enableLoadActressInfo: "yes" } });
  await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
  await expect(page.locator("#actor-heading + .actress-info")).toHaveCount(1, { timeout: 10000 });
  const enabledRuntime = await page.evaluate(() => ({
    pluginRegistered: window.unsafeWindow.pluginManager.getPluginNames().includes("ActressInfoPlugin"),
    descriptorPreserved: window.unsafeWindow.pluginManager.getPluginDescriptors().some(item => item.name === "ActressInfoPlugin"),
  }));
  expect(enabledRuntime).toEqual({ pluginRegistered: false, descriptorPreserved: true });

  const disabledContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    await fulfillHostFixtures(disabledContext);
    const disabledPage = await disabledContext.newPage();
    await disabledPage.goto("https://javdb.com/v/actress-info-fixture");
    await disabledPage.evaluate((html) => { document.body.innerHTML = html; }, detailPage);
    await injectUserscriptRuntime(disabledPage, { disabledPlugins: ["ActressInfoPlugin"] });
    await disabledPage.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await expect(disabledPage.locator(".actress-info")).toHaveCount(0);
    await disabledPage.close();
  } finally {
    await disabledContext.close();
  }
});
