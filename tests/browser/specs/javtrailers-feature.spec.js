import { expect, test } from "@playwright/test";
import { injectUserscriptRuntime } from "../harness/runtime.js";

async function prepareJavTrailers(page) {
  await page.route("https://javtrailers.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: '<!doctype html><html><head><title>JavTrailers fixture</title></head><body><div id="videoPlayerContainer"><div id="vjs_video_3"><canvas></canvas><video id="vjs_video_3_html5_api"></video></div><div class="vjs-control-bar"></div></div></body></html>',
  }));
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      configurable: true,
      get() { return Number(this.dataset.fixtureTime || 0); },
      set(value) { this.dataset.fixtureTime = String(value); },
    });
    HTMLMediaElement.prototype.play = () => Promise.resolve();
  });
  await page.goto("https://javtrailers.com/videos/sample?handle=1", { waitUntil: "domcontentloaded" });
}

test("JavTrailers preview behavior runs under its Feature while retaining its legacy disable ID", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one fixture project covers the JavTrailers site contribution");
  await prepareJavTrailers(page);
  await injectUserscriptRuntime(page);
  await expect.poll(() => page.locator("#vjs_video_3_html5_api").getAttribute("data-fixture-time")).toBe("5");
  await expect(page.locator("#vjs_video_3_html5_api")).toHaveCSS("position", "fixed");
  await expect(page.locator("#vjs_video_3 canvas")).toHaveCSS("position", "fixed");
  const runtime = await page.evaluate(() => ({
    pluginNames: window.unsafeWindow.pluginManager.getPluginNames(),
    descriptors: window.unsafeWindow.pluginManager.getPluginDescriptors(),
  }));
  expect(runtime.pluginNames).not.toContain("JavTrailersPlugin");
  expect(runtime.descriptors).toContainEqual({ name: "JavTrailersPlugin", disableable: true });
});

test("the saved JavTrailersPlugin disable key prevents Feature preview activation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one fixture project covers legacy setting compatibility");
  await prepareJavTrailers(page);
  await injectUserscriptRuntime(page, { disabledPlugins: ["JavTrailersPlugin"] });
  await expect(page.locator("#vjs_video_3_html5_api")).not.toHaveCSS("position", "fixed");
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames())).not.toContain("JavTrailersPlugin");
});

async function prepareSubtitleCat(page) {
  await page.route("https://subtitlecat.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: '<!doctype html><html><body><div class="t-banner-inner">banner</div><nav id="navbar">nav</nav><h2 class="sec-title">3 <span>字幕</span></h2><table class="sub-table"><tr><td><a href="/abc">ABC-1 中文</a></td></tr><tr><td><a href="/def">DEF-2 中文字幕</a></td></tr></table></body></html>',
  }));
  await page.goto("https://subtitlecat.com/index.php?search=ABC-1", { waitUntil: "domcontentloaded" });
}

test("SubtitleCat result filtering runs in the Feature and keeps its legacy disable ID", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one fixture project covers SubtitleCat filtering");
  await prepareSubtitleCat(page);
  await injectUserscriptRuntime(page);
  await expect(page.locator(".t-banner-inner")).toBeHidden();
  await expect(page.locator("#navbar")).toBeHidden();
  await expect(page.locator(".sub-table tr").nth(0)).toBeVisible();
  await expect(page.locator(".sub-table tr").nth(1)).toBeHidden();
  await expect(page.locator(".sec-title")).toHaveText("1 字幕");
  const runtime = await page.evaluate(() => ({
    pluginNames: window.unsafeWindow.pluginManager.getPluginNames(),
    descriptors: window.unsafeWindow.pluginManager.getPluginDescriptors(),
  }));
  expect(runtime.pluginNames).not.toContain("SubTitleCatPlugin");
  expect(runtime.descriptors).toContainEqual({ name: "SubTitleCatPlugin", disableable: true });
});

test("the saved SubTitleCatPlugin disable key leaves the subtitle page intact", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one fixture project covers legacy setting compatibility");
  await prepareSubtitleCat(page);
  await injectUserscriptRuntime(page, { disabledPlugins: ["SubTitleCatPlugin"] });
  await expect(page.locator(".t-banner-inner")).toBeVisible();
  await expect(page.locator("#navbar")).toBeVisible();
  await expect(page.locator(".sub-table tr").nth(1)).toBeVisible();
  await expect(page.locator(".sec-title")).toHaveText("3 字幕");
});
