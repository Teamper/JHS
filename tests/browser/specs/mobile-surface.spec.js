import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(async ({ context }) => {
  await fulfillHostFixtures(context);
});

test("compact list exposes only the FAB surface", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "one compact viewport covers mobile surfaces");
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect(page.locator("#jhs-fab")).toBeVisible();
  await expect(page.locator("#jhs-fab-safe-area")).toHaveCount(1);
  await expect(page.locator("#jhs-page-commandbar, #setting-btn")).toHaveCount(0);
});

test("compact detail can scroll the last toggle clear of the FAB", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "one compact viewport covers FAB clearance");
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const toggle = page.locator(".jhs-related-toggle");
  await expect(toggle).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const overlaps = await page.evaluate(() => {
    const fab = document.querySelector("#jhs-fab")?.getBoundingClientRect();
    const control = document.querySelector(".jhs-related-toggle")?.getBoundingClientRect();
    if (!fab || !control) return true;
    return !(control.right <= fab.left || control.left >= fab.right || control.bottom <= fab.top || control.top >= fab.bottom);
  });
  expect(overlaps).toBe(false);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("full settings layer stays above the compact FAB", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "one compact viewport covers dialog stacking");
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => window.unsafeWindow.__jhsFeatureRuntime.getFeatureApi("settings").then((api) => api?.openSettingDialog?.()));
  const layer = page.locator(".layui-layer");
  const save = layer.locator("#saveBtn");
  await expect(save).toHaveAttribute("data-jhs-settings-ready", "true");
  const fab = page.locator("#jhs-fab");
  await expect(fab).toBeVisible();
  await expect(layer).toBeVisible();
  const stacking = {
    fab: await fab.evaluate((element) => Number(getComputedStyle(element).zIndex)),
    layer: await layer.evaluate((element) => Number(getComputedStyle(element).zIndex)),
  };
  expect(stacking.layer).toBeGreaterThan(stacking.fab);
  await save.click({ trial: true });
});

test("backup loading feedback stays above the full settings layer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic viewport covers loading stacking");
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => window.unsafeWindow.__jhsFeatureRuntime.getFeatureApi("settings").then((api) => api?.openSettingDialog?.()));
  const layer = page.locator(".layui-layer");
  await expect(layer.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await page.evaluate(() => { window.__jhsLoadingFixture = window.loading(); });
  const loading = page.locator(".loading-container");
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute("role", "status");
  await expect(loading).toHaveAttribute("aria-live", "polite");
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(loading).toHaveAttribute("aria-label", "处理中");
  const stacking = {
    layer: await layer.evaluate((element) => Number(getComputedStyle(element).zIndex)),
    loading: await loading.evaluate((element) => Number(getComputedStyle(element).zIndex)),
  };
  expect(stacking.loading).toBeGreaterThan(stacking.layer);
  await page.evaluate(() => window.__jhsLoadingFixture.close());
  await expect(loading).toHaveCount(0);
});
