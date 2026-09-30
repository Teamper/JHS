import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(async ({ context }) => { await fulfillHostFixtures(context); });

test("JavBus mounts settings on list and detail routes", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-wide", "one desktop viewport covers native settings entry");
  await page.goto("https://www.javbus.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect(page.locator("#setting-btn")).toHaveCount(1);
  await expect(page.locator("#setting-btn")).toBeVisible();
  await page.locator("#setting-btn").click();
  await expect(page.locator(".layui-layer #saveBtn")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("https://www.javbus.com/ABC-123", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect(page.locator("#setting-btn")).toHaveCount(1);
  await expect(page.locator("#setting-btn")).toBeVisible();
});

test("detail magnet search resolves its asynchronous surface", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-wide", "one desktop viewport covers detail magnet dialog");
  await page.goto("https://www.javbus.com/ABC-123", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.locator("#magnetSearchBtn").click();
  await expect(page.locator(".layui-layer .jhs-magnet-dialog .magnet-container")).toHaveCount(1);
  await expect(page.locator(".layui-layer .magnet-tabs")).toBeVisible();
});

test("landscape FAB keeps first and last actions reachable after rotation", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-landscape", "844 by 390 viewport covers the regression");
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.locator("#jhs-fab").click();
  const menu = page.locator("#jhs-fab-menu");
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(390);
  await menu.locator(".jhs-fab-menu-item").first().focus();
  await page.keyboard.press("End");
  await expect(menu.locator(".jhs-fab-menu-item").last()).toBeFocused();
  await expect(menu.locator(".jhs-fab-menu-item").last()).toBeInViewport();
  await page.keyboard.press("Home");
  await expect(menu.locator(".jhs-fab-menu-item").first()).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(page.locator("#jhs-fab")).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#jhs-fab").click();
  await expect(menu.locator(".jhs-fab-menu-item").first()).toBeInViewport();
});

test("new video scan tips show the scheduler defaults", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-wide", "one desktop viewport covers task tips");
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.locator("#newVideoBtn").click();
  await expect(page.locator("#checkFavoriteActress")).toHaveAttribute("data-tip", /检测间隔时间: 24小时/);
  await expect(page.locator("#checkNewVideo")).toHaveAttribute("data-tip", /检测间隔时间: 12小时/);
});
