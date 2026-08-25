import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

/**
 * 视觉回归（第一阶段核心页面）。
 * 首次运行生成基线：JHS_VISUAL_REGRESSION=1 npx playwright test --update-snapshots
 * 普通 CI 默认跳过（由 JHS_VISUAL_REGRESSION=1 显式开启）。
 * 断言为真实 PNG diff（toHaveScreenshot），不再只验证“能截出一张图”。
 */
const ENABLED = process.env.JHS_VISUAL_REGRESSION === "1";

const pages = [
  ["JavDB List", "https://javdb.com/", ".movie-list"],
  ["JavDB Detail", "https://javdb.com/v/test-id", ".video-meta-panel"],
  ["JavBus List", "https://www.javbus.com/", ".masonry"],
  ["JavBus Detail", "https://www.javbus.com/ABC-123", ".row.movie"],
  ["FC2 Detail", "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2", ".jhs-fc2-workspace"],
];

for (const [label, url, selector] of pages) {
  for (const theme of ["light", "dark"]) {
    test(`${label} ${theme} baseline`, async ({ context, page }, testInfo) => {
      test.skip(!ENABLED, "visual regression is opt-in via JHS_VISUAL_REGRESSION=1");
      await fulfillHostFixtures(context);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await injectUserscriptRuntime(page);
      await expect.poll(() => page.evaluate(() => window.__jhsBrowserDiagnostics.requests !== undefined)).toBe(true);
      await page.evaluate((mode) => {
        const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
        return settings.set("themeMode", mode);
      }, theme);
      await page.waitForTimeout(300);
      await expect(page.locator(selector).first()).toBeVisible();
      await expect(page).toHaveScreenshot(`${label.replace(/\s+/g, "-")}-${theme}.png`, { fullPage: false, maxDiffPixelRatio: 0.02 });
    });
  }
}

test("Settings dialog visual baseline", async ({ context, page }, testInfo) => {
  test.skip(!ENABLED, "visual regression is opt-in via JHS_VISUAL_REGRESSION=1");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
  await expect(page.locator(".layui-layer #saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await expect(page).toHaveScreenshot("settings-dialog.png", { fullPage: false, maxDiffPixelRatio: 0.02 });
});
