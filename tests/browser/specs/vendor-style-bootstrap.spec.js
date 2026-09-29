import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("vendor styles start after the userscript's synchronous evaluation stack", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic browser covers the bootstrap stack boundary");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, {
    beforeUserscriptInjection: async (hostPage) => {
      await hostPage.evaluate(() => {
        window.__jhsVendorStyleStack = [];
        const appendChild = document.head.appendChild;
        document.head.appendChild = function(node) {
          if (node instanceof HTMLLinkElement && node.href.includes("cdn.jsdelivr.net/npm/")) {
            window.__jhsVendorStyleStack.push({ href: node.href, currentScript: document.currentScript?.tagName ?? null });
          }
          return appendChild.call(this, node);
        };
      });
    },
  });
  const styles = await page.evaluate(() => window.__jhsVendorStyleStack);
  expect(styles).toHaveLength(4);
  expect(styles.every((style) => style.currentScript === null)).toBe(true);
});
