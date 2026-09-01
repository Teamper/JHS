import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("JavDB native detail contribution opens external metadata links in a new tab", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one desktop project covers the native detail contribution");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/external-fixture";
    link.textContent = "外部资料";
    document.querySelector(".video-meta-panel").append(link);
  });
  await injectUserscriptRuntime(page);

  await expect(page.locator(".video-meta-panel a[href='/external-fixture']")).toHaveAttribute("target", "_blank");
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.__jhsFeatureRuntime.getActiveFeatureIds().includes("detail"))).toBe(true);
});
