import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

test.beforeEach(({}, info) => test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and touch own the JavBus media dialog lifecycle"));
async function boot(page, context, theme = "light") {
  await fulfillHostFixtures(context);
  await page.goto("https://www.javbus.com/ABC-123");
  await page.evaluate(() => {
    document.querySelector("#sample-waterfall").style.display = "";
    document.body.style.minHeight = "2400px";
    localStorage.setItem("jhs_dmm_video", JSON.stringify({ "ABC-123": {
      hhb: "https://example.test/720.mp4", mhb: "https://example.test/480.mp4", time: Date.now(),
    } }));
    window.__mediaPauses = 0;
    HTMLMediaElement.prototype.play = async function () { this.dataset.playing = "true"; };
    HTMLMediaElement.prototype.pause = function () { window.__mediaPauses++; this.dataset.playing = "false"; };
    HTMLMediaElement.prototype.load = function () {};
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", { configurable: true, get() { return Number(this.dataset.time || 0); }, set(value) { this.dataset.time = String(value); } });
  });
  await injectUserscriptRuntime(page, {
    hostStyles: true, realFeedback: true, beforeUserscriptInjection: injectRealLayer,
    settingOverrides: { themeMode: theme, enablePreviewVideo: "yes", enableLoadPreviewVideo: "yes", videoQuality: "hhb", enableLoadReview: "no" },
  });
  await page.evaluate(() => {
    window.__mediaErrors = [];
    const error = window.show.error.bind(window.show);
    window.show.error = message => { window.__mediaErrors.push(message); return error(message); };
  });
}

for (const theme of ["light", "dark"]) test(`JavBus media dialog owns keyboard and scroll and preserves replay state ${theme}`, async ({ page, context }, info) => {
  await boot(page, context, theme);
  const trigger = page.locator(".preview-video-container");
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "视频预览", exact: true }), video = modal.locator("video");
  await expect(modal).toBeVisible(); await expect(video).toBeFocused();
  await expect(modal).toHaveAttribute("aria-modal", "true");
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let count = 0; count < 10; count++) {
      await page.keyboard.press(key);
      expect(await modal.evaluate(root => root.contains(document.activeElement))).toBe(true);
    }
  }
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.mouse.move(4, 4); await page.mouse.wheel(0, 400); await page.waitForTimeout(100);
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
  await video.evaluate(media => { window.__retainedMedia = media; media.currentTime = 17; media.muted = false; media.dispatchEvent(new Event("volumechange")); });
  await modal.locator('[data-quality="mhb"]').click();
  await expect(modal.locator('[data-quality="mhb"]')).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: info.outputPath(`javbus-media-${theme}.png`), animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(modal).toBeVisible();
  expect(await video.evaluate(media => ({ same: media === window.__retainedMedia, time: media.currentTime, muted: media.muted }))).toEqual({ same: true, time: 17, muted: false });
  await modal.locator('[data-quality="hhb"]').click();
  await expect(modal.locator('[data-quality="hhb"]')).toHaveAttribute("aria-pressed", "true");
  await expect(video.locator("source")).toHaveAttribute("src", "https://example.test/720.mp4");
  await page.evaluate(() => window.showImageViewer("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect width='20' height='20' fill='red'/%3E%3C/svg%3E"));
  await expect(page.locator(".jhs-image-viewer.viewer-in")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".jhs-image-viewer")).toHaveCount(0); await expect(modal).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await modal.locator(".layui-layer-close").click();
  await expect(modal).toHaveCount(0); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  expect(await page.evaluate(() => window.__mediaErrors)).toEqual([]);
});

for (const settle of ["resolve", "reject"]) test(`closing the media dialog ignores a late play ${settle}`, async ({ page, context }) => {
  await boot(page, context);
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = function () { return new Promise((resolve, reject) => { window.__pendingPlay = { resolve, reject }; }); };
  });
  await page.locator(".preview-video-container").click();
  const modal = page.getByRole("dialog", { name: "视频预览", exact: true });
  await expect(modal).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__pendingPlay))).toBe(true);
  // The shade exercises the vendor's close path rather than the controller method.
  await page.locator(".layui-layer-shade").last().click({ position: { x: 2, y: 2 } });
  await expect(modal).toHaveCount(0);
  const pauses = await page.evaluate(() => window.__mediaPauses);
  await page.evaluate(async settle => { window.__pendingPlay[settle](settle === "reject" ? new Error("late decoder failure") : undefined); await new Promise(resolve => setTimeout(resolve, 0)); }, settle);
  await expect.poll(() => page.evaluate(() => window.__mediaPauses)).toBeGreaterThan(pauses);
  expect(await page.evaluate(() => window.__mediaErrors)).toEqual([]);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});
