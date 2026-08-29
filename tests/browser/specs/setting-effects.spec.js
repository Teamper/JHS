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
  await expect(page.locator(".videoSvg")).toBeHidden(); // 实现为 toggle(false) 隐藏，语义：列表工具按钮隐藏而非 unmount
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


test("mobileMode force on/off swaps FAB and the desktop commandbar/setting surfaces", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers mobileMode live layout");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect(page.locator("#jhs-fab")).toHaveCount(0);
  await expect(page.locator("#jhs-page-commandbar")).toHaveCount(1);
  await expect(page.locator("#setting-btn")).toHaveCount(1);
  const toolbarSelectors = ["#waitCheckBtn", "#newVideoBtn", "#jhs-quick-filter", ".jhs-sort-control", "#favoriteAllVideo", "#hasDownAllVideo"];
  for (const selector of toolbarSelectors) await expect(page.locator(selector)).toHaveCount(1);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("mobileMode", "on"));
  await expect(page.locator("#jhs-fab")).toBeVisible();
  await expect(page.locator("#jhs-fab-safe-area")).toHaveCount(1);
  await expect(page.locator("html")).toHaveClass(/jhs-fab-mounted/);
  await expect(page.locator("#jhs-page-commandbar")).toHaveCount(0);
  await expect(page.locator("#setting-btn")).toHaveCount(0);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("mobileMode", "off"));
  await expect(page.locator("#jhs-fab")).toHaveCount(0);
  await expect(page.locator("#jhs-fab-safe-area")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/jhs-fab-mounted/);
  await expect(page.locator("#jhs-page-commandbar")).toHaveCount(1);
  await expect(page.locator("#setting-btn")).toHaveCount(1);
  for (const selector of toolbarSelectors) await expect(page.locator(selector)).toHaveCount(1);
  // 真实 click 验证 handler 在切换后仍然有效。
  await page.evaluate(() => {
    window.__waitCheckClicks = 0;
    const plugin = window.unsafeWindow.pluginManager.getBean("ListPageButtonPlugin");
    plugin.openWaitCheck = async () => { window.__waitCheckClicks++; };
  });
  await page.locator("#waitCheckBtn").click();
  await expect.poll(() => page.evaluate(() => window.__waitCheckClicks)).toBe(1);
});

test("search list pages get batch favorite/download buttons without an actress name", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers search batch entries");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/search?q=test", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect.poll(() => page.evaluate(() => window.isListPage)).toBe(true);
  await expect(page.locator("#favoriteAllVideo")).toHaveCount(1);
  await expect(page.locator("#hasDownAllVideo")).toHaveCount(1);
  // 搜索页不渲染演员专用的批量屏蔽入口。
  await expect(page.locator("#addBlacklistBtn")).toHaveCount(0);
});

test("Preview master ON + DMM OFF leaves no DMM-only card button", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers preview capability gating");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const setSetting = (key, value) => page.evaluate(({ key, value }) => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set(key, value), { key, value });
  // fixture 卡片带隐藏 .tags 宿主，卡片工具可被创建；DMM OFF 时按钮隐藏，ON 时恢复。
  await expect(page.locator(".videoSvg")).toHaveCount(1);
  await setSetting("enableLoadPreviewVideo", "no");
  await page.waitForTimeout(300);
  await expect(page.locator(".videoSvg")).toBeHidden();
  await setSetting("enableLoadPreviewVideo", "yes");
  await page.waitForTimeout(300);
  await expect(page.locator(".videoSvg")).toHaveCount(1);
  const display = await page.locator(".videoSvg").first().evaluate((element) => getComputedStyle(element).display);
  expect(display).not.toBe("none");
});

test("JavBus JHS preview entry disappears when the DMM sub switch is OFF", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers JavBus preview capability");
  await fulfillHostFixtures(context);
  await page.goto("https://www.javbus.com/ABC-123", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect(page.locator(".preview-video-container")).toHaveCount(1);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enableLoadPreviewVideo", "no"));
  await page.waitForTimeout(300);
  await expect(page.locator(".preview-video-container")).toHaveCount(0);
});

test("FC2 OtherSite slot survives OFF→ON toggles", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers FC2 stable slots");
  await fulfillHostFixtures(context);
  const url = "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const slot = page.locator('[data-jhs-role="other-sites"]');
  const group = page.locator('.jhs-fc2-resource-group:has([data-jhs-role="other-sites"])');
  const setOtherSite = (value) => page.evaluate((v) => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enableLoadOtherSite", v), value);
  await expect(slot).toHaveCount(1);
  await expect(group).toBeVisible();
  await setOtherSite("no");
  await expect(slot).toHaveCount(1);
  await expect(group).toBeHidden();
  await setOtherSite("yes");
  await expect(slot).toHaveCount(1);
  await expect(group).toBeVisible();
  await setOtherSite("no");
  await expect(slot).toHaveCount(1);
  await setOtherSite("yes");
  await expect(slot).toHaveCount(1);
  await expect(group).toBeVisible();
});

test("batch actions are single-flight while a batch is running", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers batch single flight");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => {
    const listPage = window.unsafeWindow.pluginManager.getBean("ListPagePlugin");
    const original = listPage.getRuntimeService.bind(listPage);
    window.__httpCalls = 0;
    window.__releaseBatch = null;
    listPage.getRuntimeService = (name) => name === "http" ? {
      request: () => { window.__httpCalls++; return new Promise((resolve) => { window.__releaseBatch = resolve; }); },
    } : original(name);
  });
  const batchToggle = ".jhs-commandbar__batch .jhs-commandbar__menu-toggle";
  await page.locator(batchToggle).click();
  await page.locator("#favoriteAllVideo").click();
  await page.evaluate(() => document.querySelector(".layui-layer-btn0").click());
  await expect(page.locator("#jhs-batch-progress")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__httpCalls)).toBe(1);
  // 批量任务期间 loading 遮罩会拦截指针事件：用原生 click 验证 Single Flight 拒绝第二个任务。
  await page.evaluate(() => document.querySelector(".jhs-commandbar__batch .jhs-commandbar__menu-toggle").click());
  await page.evaluate(() => document.querySelector("#hasDownAllVideo").click());
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__httpCalls)).toBe(1);
  // 释放第一个任务，进度浮层消失、按钮恢复。
  await page.evaluate(() => window.__releaseBatch?.({ data: "" }));
  await expect(page.locator("#jhs-batch-progress")).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator("#favoriteAllVideo")).not.toHaveAttribute("aria-disabled", "true");
});

test("FC2 detail screenshot slot follows the master switch live", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers FC2 screenshot lifecycle");
  await fulfillHostFixtures(context);
  const url = "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect(page.locator(".jhs-fc2-workspace")).toBeVisible();
  await expect(page.locator('[data-jhs-role="screenshot"]')).toHaveCount(1);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enableLoadScreenShot", "no"));
  await expect(page.locator('[data-jhs-role="screenshot"]')).toBeEmpty();
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enableLoadScreenShot", "yes"));
  await expect(page.locator('[data-jhs-role="screenshot"]')).not.toBeEmpty();
});
