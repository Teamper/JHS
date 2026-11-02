import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { openFavoriteActressDetail } from "../harness/favorite-actresses.js";

for (const theme of ["light", "dark"]) {
  test(`favorite actress borders on direct detail ${theme}`, async ({ page, context }, info) => {
    test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop/mobile matrix");
    await openFavoriteActressDetail(context, page, theme);
    const actor = page.locator("#saved-actor");
    await expect(actor).toHaveCSS("border-top-width", "2px");
    await expect(actor).toHaveCSS("border-top-style", "solid");
    await expect(actor).toHaveCSS("border-top-color", "rgb(206, 34, 34)");
    await expect(page.locator("#legacy-actor")).toHaveCSS("border-top-width", "2px");
    await expect(page.locator("#jhs-list-category-fold-feature")).toHaveCount(0);
    for (const id of ["unsaved-actor", "male-actor", "unknown-actor"]) {
      await expect(page.locator(`#${id}`)).toHaveCSS("border-top-width", "0px");
    }
    await actor.focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#unsaved-actor")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(actor).toBeFocused();
    expect(await actor.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe("none");
    await page.evaluate(async () => {
      const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
      await settings.set("highlightedTagNumber", 3);
      await settings.set("highlightedTagColor", "#123456");
    });
    await expect(actor).toHaveCSS("border-top-width", "3px");
    await expect(actor).toHaveCSS("border-top-color", "rgb(18, 52, 86)");
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enableFavoriteActresses", "no"));
    await expect(actor).toHaveCSS("border-top-width", "0px");
    await expect(actor).toHaveAttribute("title", "原提示");
    await expect(page.locator("#jhs-favorite-actresses-feature")).toHaveCount(0);
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enableFavoriteActresses", "yes"));
    await expect(actor).toHaveCSS("border-top-width", "3px");
  });
}

const actorPage = `
  <main>
    <div class="actor-section-name">演员甲, Actor A</div>
    <div class="section-meta">演员乙</div>
    <span class="avatar" style="background-image:url(https://img.example/avatar.jpg)"></span>
    <a id="button-collect-actor" href="/actors/fixtureactor/collect">收藏</a>
    <a id="button-uncollect-actor" href="/actors/fixtureactor/uncollect">取消收藏</a>
  </main>`;

async function readFavoriteActresses(page) {
  return page.evaluate(async () => {
    const forage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
    return await forage.getItem("favorite_actresses") || [];
  });
}

test("favorite actress actions are feature-owned and retain the legacy disable ID", async ({ page, context, browser }, info) => {
  test.skip(info.project.name !== "desktop-wide", "explicit viewport matrix owner");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/actors/fixtureactor");
  await page.evaluate((html) => { document.body.innerHTML = html; }, actorPage);
  await injectUserscriptRuntime(page);
  await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
  await page.evaluate(() => document.querySelector("#button-collect-actor").dispatchEvent(new Event("click", { bubbles: true })));
  await expect.poll(async () => (await readFavoriteActresses(page)).length).toBe(1);
  expect(await readFavoriteActresses(page)).toMatchObject([{ starId: "fixtureactor", name: "演员甲", allName: ["演员甲", "Actor A", "演员乙"], avatar: "https://img.example/avatar.jpg" }]);
  const runtime = await page.evaluate(() => ({
    pluginRegistered: window.unsafeWindow.pluginManager.getPluginNames().includes("FavoriteActressesPlugin"),
    descriptorPreserved: window.unsafeWindow.pluginManager.getPluginDescriptors().some(item => item.name === "FavoriteActressesPlugin"),
  }));
  expect(runtime).toEqual({ pluginRegistered: false, descriptorPreserved: true });

  const disabledContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    await fulfillHostFixtures(disabledContext);
    const disabledPage = await disabledContext.newPage();
    await disabledPage.goto("https://javdb.com/actors/fixtureactor");
    await disabledPage.evaluate((html) => { document.body.innerHTML = html; }, actorPage);
    await injectUserscriptRuntime(disabledPage, { disabledPlugins: ["FavoriteActressesPlugin"] });
    await disabledPage.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await disabledPage.evaluate(() => document.querySelector("#button-collect-actor").dispatchEvent(new Event("click", { bubbles: true })));
    await expect.poll(async () => (await readFavoriteActresses(disabledPage)).length).toBe(0);
    await disabledPage.close();
  } finally {
    await disabledContext.close();
  }
});
