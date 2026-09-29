import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("JavDB want/watch import is mounted and completed through the Library feature", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one synthetic import owner");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/want_watch_videos", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, {
    settingOverrides: { enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" },
    beforeUserscriptInjection: (hostPage) => hostPage.evaluate(() => {
      const heading = document.createElement("h3");
      heading.textContent = "想看的影片";
      document.querySelector("main")?.prepend(heading);
      const item = document.createElement("div");
      item.className = "item";
      const link = document.createElement("a");
      link.href = "/v/synthetic-abc-123";
      item.append(link);
      const title = document.createElement("div");
      title.className = "video-title";
      const carNum = document.createElement("strong");
      carNum.textContent = "ABC-123";
      title.append(carNum);
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = "2026-09-26";
      item.append(title, meta);
      const list = document.createElement("div");
      list.className = "movie-list";
      list.append(item);
      document.querySelector("main")?.append(list);
    }),
  });

  await expect(page.locator("#wantWatchBtn")).toHaveText("导入至 JHS");
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("WantAndWatchedVideosPlugin"))).toBe(false);
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(item => item.name === "WantAndWatchedVideosPlugin"))).toBe(true);
  await page.locator("#wantWatchBtn").click();
  await expect(page.locator(".layui-layer-dialog-content")).toContainText("想看的影片导入到 JHS 收藏");
  await page.locator(".layui-layer-btn0").click();
  await page.waitForFunction(async () => (await window.stateService.getState("ABC-123"))?.stateFlags?.favorite === true);
  await expect(page.locator("#wantWatchBtn")).toBeVisible();
});
