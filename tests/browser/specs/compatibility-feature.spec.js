import { expect, test } from "@playwright/test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const devUserscriptPath = join(repoRoot, "dist", "dev", "JHS-7.0.dev.user.js");

test("compatibility decorations run as a native Feature and retain the old disable ID", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic browser project covers compatibility ownership");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/actors/compat-fixture", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, {
    userscriptPath: devUserscriptPath,
    beforeUserscriptInjection: (hostPage) => hostPage.evaluate(async () => {
      const forage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
      await forage.setItem("data_version", 3);
      await forage.setItem("favorite_actresses", [{ starId: "compat-fixture", name: "合成演员", allName: ["合成演员"] }]);
      await forage.setItem("blacklist", [{ starId: "compat-fixture", name: "合成演员", allName: ["合成演员"], role: "女演员", movieType: "有码", url: "https://javdb.com/actors/compat-fixture" }]);
      const profile = document.createElement("h1");
      profile.className = "actor-section-name";
      profile.textContent = "合成演员";
      document.body.prepend(profile);
      const actorCard = document.createElement("div");
      actorCard.className = "actor-box";
      const actorLink = document.createElement("a");
      actorLink.href = "/actors/compat-fixture";
      actorLink.textContent = "演员卡";
      actorCard.append(actorLink);
      document.body.append(actorCard);
      const ad = document.createElement("div");
      ad.className = "sda-content";
      document.body.append(ad);
    }),
  });

  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.diagnostics.exportSnapshot().activeContributions)).toContain("compatibility.enhancements");
  await expect(page.locator(".actor-section-name .jhs-badge--fav")).toHaveCount(1);
  await expect(page.locator(".actor-section-name .jhs-badge--danger")).toHaveCount(1);
  await expect(page.locator(".actor-box .jhs-badge--fav")).toHaveCount(1);
  await expect.poll(() => page.locator(".sda-content").evaluate((element) => getComputedStyle(element).display)).toBe("none");

  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("CompatibilityEnhancementsPlugin"))).toBe(false);
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name }) => name === "CompatibilityEnhancementsPlugin"))).toBe(true);

  await page.evaluate(async () => {
    await window.unsafeWindow.stateService.removeFavoriteActress("compat-fixture");
    document.dispatchEvent(new CustomEvent("actress-state-changed", { detail: { starId: "compat-fixture" } }));
  });
  await expect(page.locator(".actor-section-name .jhs-badge--fav")).toHaveCount(0);
  await expect(page.locator(".actor-section-name .jhs-badge--danger")).toHaveCount(1);
});
