import { expect, test } from "@playwright/test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const devUserscriptPath = join(repoRoot, "dist", "dev", "JHS-7.0.dev.user.js");

async function addJavBusNavbar(page) {
  await page.evaluate(() => {
    const navbar = document.createElement("div");
    navbar.id = "navbar";
    navbar.innerHTML = "<div><div><span></span></div></div>";
    document.body.prepend(navbar);
  });
}

test.describe("JavBus navigation Feature migration", () => {
  test("preserves the image-search entry through the injected capability and legacy disable ID", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://www.javbus.com/", { waitUntil: "domcontentloaded" });
    await addJavBusNavbar(page);
    await injectUserscriptRuntime(page, { userscriptPath: devUserscriptPath });
    await expect(page.locator("#search-img-btn")).toHaveText("识图");
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("BusNavBarPlugin"))).toBe(false);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name }) => name === "BusNavBarPlugin"))).toBe(true);
    await page.evaluate(() => {
      window.imageSearchOpenCount = 0;
      const layer = window.unsafeWindow.layer;
      const open = layer.open;
      layer.open = function(options, ...args) {
        if (options.title === "以图识图") window.imageSearchOpenCount += 1;
        return open.call(this, options, ...args);
      };
    });
    await page.locator("#search-img-btn").click();
    await expect.poll(() => page.evaluate(() => window.imageSearchOpenCount)).toBe(1);
    await expect(page.locator('.jhs-image-search [data-role="upload-area"]')).toBeVisible();

    const disabledPage = await context.newPage();
    await disabledPage.goto("https://www.javbus.com/", { waitUntil: "domcontentloaded" });
    await addJavBusNavbar(disabledPage);
    await injectUserscriptRuntime(disabledPage, { disabledPlugins: ["BusNavBarPlugin"], userscriptPath: devUserscriptPath });
    await disabledPage.waitForSelector("#jhs-quick-filter");
    await expect(disabledPage.locator("#search-img-btn")).toHaveCount(0);
    expect(await disabledPage.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name }) => name === "BusNavBarPlugin"))).toBe(true);
    await disabledPage.close();
  });

  test("keeps the image-search entry hidden when its optional capability is disabled", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://www.javbus.com/", { waitUntil: "domcontentloaded" });
    await addJavBusNavbar(page);
    await injectUserscriptRuntime(page, { disabledPlugins: ["SearchByImagePlugin"], userscriptPath: devUserscriptPath });
    await page.waitForSelector("#jhs-quick-filter");
    await expect(page.locator("#search-img-btn")).toHaveCount(0);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("BusNavBarPlugin"))).toBe(false);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("SearchByImagePlugin"))).toBe(false);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name }) => name === "SearchByImagePlugin"))).toBe(true);
  });
});
