import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("JavBus native detail enhancements are owned by the detail Feature", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one desktop project covers the JavBus native detail contribution");
  await fulfillHostFixtures(context);
  await page.goto("https://www.javbus.com/ABC-123", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const main = document.querySelector("main");
    const recommendation = document.createElement("h4");
    recommendation.textContent = "推薦作品";
    main.append(recommendation);
    const genre = document.createElement("div");
    genre.className = "genre";
    const genreLink = document.createElement("a");
    genreLink.id = "fixture-genre";
    genreLink.href = "https://example.com/genre";
    genreLink.textContent = "外部分類";
    genre.append(genreLink);
    main.append(genre);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value) => { window.__jhsCopiedCarNum = value; } } });
  });
  await injectUserscriptRuntime(page);

  await expect(page.locator("h4").filter({ hasText: "推薦作品" })).toBeHidden();
  await expect(page.locator("#fixture-genre")).toHaveAttribute("target", "_blank");
  const copyButton = page.locator(".jhs-copy-car-number");
  await expect(copyButton).toHaveCount(1);
  await copyButton.click();
  await expect(copyButton).toHaveText("已复制");
  await expect.poll(() => page.evaluate(() => window.__jhsCopiedCarNum)).toBe("ABC-123");
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.__jhsFeatureRuntime.getActiveFeatureIds().includes("detail"))).toBe(true);
});
