import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

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
