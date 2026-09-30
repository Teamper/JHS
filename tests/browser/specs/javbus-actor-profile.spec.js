import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("JavBus actor profile is not parsed as a movie card during startup", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the actor profile boundary");
  await fulfillHostFixtures(context);
  await page.route("https://www.javbus.com/star/jhs-profile", (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: `<!doctype html><html><head><meta charset="utf-8"><title>Actor fixture</title></head><body>
      <main class="container-fluid"><div class="row"><div class="masonry">
        <div class="item"><div class="avatar-box"><img alt="Fixture Actor"></div></div>
        <div class="item movie-box"><a href="/ABC-123"><img title="Movie 1"><date>ABC-123</date><date>2026-09-29</date></a></div>
        <div class="item movie-box"><a href="/DEF-456"><img title="Movie 2"><date>DEF-456</date><date>2026-09-28</date></a></div>
        <div class="item movie-box"><a href="/GHI-789"><img title="Movie 3"><date>GHI-789</date><date>2026-09-27</date></a></div>
      </div></div></main></body></html>`,
  }));
  await page.goto("https://www.javbus.com/star/jhs-profile", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.__jhsToastErrors = [];
    Object.defineProperty(window, "show", {
      configurable: true,
      set(value) {
        const originalError = value.error;
        value.error = (message, ...args) => {
          window.__jhsToastErrors.push(message);
          return originalError(message, ...args);
        };
        Object.defineProperty(window, "show", { value, configurable: true, writable: true });
      },
    });
  });

  await injectUserscriptRuntime(page);
  await expect(page.locator(".masonry .item.movie-box[data-jhs-processed='true']")).toHaveCount(3);
  expect(await page.evaluate(() => window.__jhsToastErrors)).not.toContain("提取番号信息失败");
  await expect(page.locator(".masonry .item.movie-box[data-jhs-flags]")).toHaveCount(3);
});
