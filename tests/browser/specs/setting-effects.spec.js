import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("feature disabled leaves no dead list button", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers capability rendering");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { disabledPlugins: ["NewVideoPlugin", "BlacklistPlugin"] });
  await expect.poll(() => page.evaluate(() => window.isListPage)).toBe(true);
  await expect(page.locator("#newVideoBtn")).toHaveCount(0);
  await expect(page.locator("#blacklistBtn")).toHaveCount(0);
  await expect(page.locator("#waitCheckBtn")).toHaveCount(1);
});

test("screenshot master switch OFF removes detail screenshot UI", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers screenshot gating");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enableLoadScreenShot", "no"));
  await page.waitForTimeout(300);
  await expect(page.locator(".screen-container")).toHaveCount(0);
  await expect(page.locator(".jhs-screenshot-providers")).toHaveCount(0);
});

test("preview master switch OFF removes card preview buttons", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers preview gating");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enablePreviewVideo", "no"));
  await page.waitForTimeout(300);
  await expect(page.locator(".videoSvg")).toHaveCount(0);
});

test("all quick filter is the true full set including blocked items", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers frozen filter semantics");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("ListPagePlugin"))).toBe(true);
  await page.evaluate(async () => {
    const listPage = window.unsafeWindow.pluginManager.getBean("ListPagePlugin");
    const item = document.querySelector(".movie-list .item");
    const { carNum, url } = listPage.findCarNumAndHref(window.$ ? window.$(item) : null);
    await window.stateService.patch(carNum, { blocked: true }, { type: "browser-setting-effect", record: { carNum, url, names: "", publishTime: "" } });
  });
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin").setQuickFilter("all"));
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".movie-list .item")).display)).not.toBe("none");
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin").setQuickFilter("favorite"));
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".movie-list .item")).display)).toBe("none");
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin").setQuickFilter("blockedItems"));
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".movie-list .item")).display)).not.toBe("none");
});
