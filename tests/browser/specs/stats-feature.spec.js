import { expect, test } from "@playwright/test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const devUserscriptPath = join(repoRoot, "dist", "dev", "JHS-7.0.dev.user.js");

async function seedLibraryBeforeInjection(page) {
  await page.evaluate(async () => {
    const forage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
    await forage.setItem("data_version", 3);
    await forage.setItem("car_list", [
      { carNum: "STAT-A", status: "屏蔽", stateFlags: { blocked: true, favorite: false, downloaded: false, watched: false }, names: "统计演员" },
      { carNum: "STAT-B", status: "已观看", stateFlags: { blocked: false, favorite: true, downloaded: true, watched: true }, names: "统计演员", starId: "stats-actor" },
      { carNum: "STAT-C", status: "", stateFlags: { blocked: false, favorite: false, downloaded: false, watched: false } },
    ]);
    await forage.setItem("favorite_actresses", [{ starId: "stats-actor", name: "统计演员" }]);
    await forage.setItem("blacklist", [{ starId: "blocked-actor", name: "屏蔽演员" }]);
  });
}

test("statistics dashboard is a native Feature and preserves read metrics and list actions", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic browser project covers the stats Feature");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { userscriptPath: devUserscriptPath, beforeUserscriptInjection: seedLibraryBeforeInjection });
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.diagnostics.exportSnapshot().activeContributions)).toContain("stats.dashboard");
  await expect(page.locator("#newVideoBtn + #statsBtn")).toBeVisible();
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("StatsPlugin"))).toBe(false);
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name, disableable }) => name === "StatsPlugin" && !disableable))).toBe(true);

  await page.locator("#statsBtn").click();
  const dialog = page.locator(".layui-layer").filter({ has: page.locator(".jhs-stats") }).last();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".jhs-stats__group").first()).toContainText("总记录");
  await expect(dialog.locator(".jhs-stats__group").first().locator(".jhs-stats__metric").filter({ hasText: "总记录" }).locator("strong")).toHaveText("3");
  await expect(dialog.locator(".jhs-stats__group").first().locator(".jhs-stats__metric").filter({ hasText: "手动屏蔽" }).locator("strong")).toHaveText("1");
  await expect(dialog.locator(".jhs-stats__group").nth(1)).toContainText("0");
  await dialog.locator("button[data-action='filter']").click();
  await expect(page.locator('.jhs-filter-option[aria-checked="true"][data-jhs-filter="blockedItems"]')).toHaveCount(1);
  await expect(page.locator(".jhs-stats")).toHaveCount(0);
});

test("statistics remains non-disableable when old configuration contains its legacy ID", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic browser project covers the legacy non-disableable behavior");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { disabledPlugins: ["StatsPlugin"], userscriptPath: devUserscriptPath });
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.diagnostics.exportSnapshot().activeContributions)).toContain("stats.dashboard");
  await expect(page.locator("#statsBtn")).toBeVisible();
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("StatsPlugin"))).toBe(false);
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name, disableable }) => name === "StatsPlugin" && !disableable))).toBe(true);
});
