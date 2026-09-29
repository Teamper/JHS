import { expect, test } from "@playwright/test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const devUserscriptPath = join(repoRoot, "dist", "dev", "JHS-7.0.dev.user.js");

test.describe("JavBus image layout Feature migration", () => {
  test("keeps image row sizing available through the injected capability without the old plugin", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://www.javbus.com/", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { userscriptPath: devUserscriptPath });
    await page.waitForSelector("#jhs-quick-filter");

    const imageStyles = await page.evaluate(async () => {
      const root = document.querySelector(".masonry");
      if (!root) throw new Error("JavBus list fixture is missing");
      root.replaceChildren();
      const naturalHeights = [100, 230, 150];
      for (const height of naturalHeights) {
        const item = document.createElement("div");
        item.className = "item movie-box";
        item.dataset.jhsProcessed = "true";
        const image = document.createElement("img");
        Object.defineProperty(item, "offsetWidth", { configurable: true, get: () => 120 });
        Object.defineProperty(item, "offsetHeight", { configurable: true, get: () => 200 });
        Object.defineProperty(image, "offsetHeight", { configurable: true, get: () => height });
        item.append(image);
        root.append(item);
      }
      const manager = window.unsafeWindow.pluginManager;
      const setting = manager.getBean("SettingPlugin");
      await setting.getRuntimeService("busImageLayout").logImageHeightsByRow({ vertical: "no", columns: 3 });
      return [...root.querySelectorAll("img")].map((image) => ({ height: image.style.getPropertyValue("height"), priority: image.style.getPropertyPriority("height") }));
    });

    expect(imageStyles).toEqual([
      { height: "", priority: "" },
      { height: "100px", priority: "important" },
      { height: "100px", priority: "important" },
    ]);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("BusImgPlugin"))).toBe(false);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name }) => name === "BusImgPlugin"))).toBe(true);
  });

  test("the old BusImgPlugin disable ID keeps the feature contribution inactive", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide");
    await fulfillHostFixtures(context);
    await page.goto("https://www.javbus.com/", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { disabledPlugins: ["BusImgPlugin"], userscriptPath: devUserscriptPath });
    await page.waitForSelector("#jhs-quick-filter");

    const heights = await page.evaluate(async () => {
      const root = document.querySelector(".masonry");
      if (!root) throw new Error("JavBus list fixture is missing");
      root.replaceChildren();
      for (const height of [100, 230, 150]) {
        const item = document.createElement("div");
        item.className = "item movie-box";
        item.dataset.jhsProcessed = "true";
        const image = document.createElement("img");
        Object.defineProperty(item, "offsetWidth", { configurable: true, get: () => 120 });
        Object.defineProperty(item, "offsetHeight", { configurable: true, get: () => 200 });
        Object.defineProperty(image, "offsetHeight", { configurable: true, get: () => height });
        item.append(image);
        root.append(item);
      }
      await window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("busImageLayout").logImageHeightsByRow({ vertical: "no", columns: 3 });
      return [...root.querySelectorAll("img")].map((image) => image.style.getPropertyValue("height"));
    });

    expect(heights).toEqual(["", "", ""]);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("BusImgPlugin"))).toBe(false);
  });
});
