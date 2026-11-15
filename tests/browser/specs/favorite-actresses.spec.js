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

for (const theme of ["light", "dark"]) {
  test(`favorite actress poster-wall highlight renders on JavDB and JavBus ${theme}`, async ({ page, context }, info) => {
    test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop/mobile matrix");
    await fulfillHostFixtures(context);

    const seedPosterWallData = async (currentPage) => {
      await currentPage.evaluate(async () => {
        const forage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
        await forage.setItem("data_version", 3);
        await forage.setItem("favorite_actresses", [
          { starId: "fav-a", name: "收藏女优甲", allName: ["收藏女优甲", "AliasA"], actressType: "censored", avatar: "", newVideoList: [{ carNum: "ABC-123", title: "Matched via newVideoList" }] },
          { starId: "fav-b", name: "收藏女优乙", allName: ["收藏女优乙"], actressType: "censored", avatar: "", newVideoList: [] },
        ]);
        await forage.setItem("car_list", [
          { carNum: "DEF-456", url: "https://javdb.com/v/def-456", names: "收藏女优乙 其他演员", stateFlags: { favorite: true, downloaded: false, watched: false, blocked: false } },
          { carNum: "GHI-789", url: "https://javdb.com/v/ghi-789", names: "未收藏演员", stateFlags: { favorite: false, downloaded: false, watched: false, blocked: false } },
        ]);
      });
    };

    const javdbListHtml = `
      <main class="container"><section><div class="container"><div class="movie-list">
        <div class="item" id="card-abc"><a href="/v/abc-123" title="Hit NewVideo"><div class="cover"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div><div class="video-title"><strong>ABC-123</strong> Hit NewVideo</div><div class="meta">2026-10-01</div></a><div class="tags"></div></div>
        <div class="item" id="card-def"><a href="/v/def-456" title="Hit CarNames"><div class="cover"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div><div class="video-title"><strong>DEF-456</strong> Hit CarNames</div><div class="meta">2026-10-02</div></a><div class="tags"></div></div>
        <div class="item" id="card-ghi"><a href="/v/ghi-789" title="Other"><div class="cover"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div><div class="video-title"><strong>GHI-789</strong> Other</div><div class="meta">2026-10-03</div></a><div class="tags"></div></div>
      </div></div></section></main>`;

    await page.goto("https://javdb.com/");
    await page.evaluate((html) => { document.body.innerHTML = html; }, javdbListHtml);
    await injectUserscriptRuntime(page, {
      hostStyles: true,
      settingOverrides: { themeMode: theme, defaultQuickFilterTab: "all", enableFavoriteActresses: "yes", highlightedTagNumber: 2, highlightedTagColor: "#ff4757" },
      beforeUserscriptInjection: seedPosterWallData,
    });
    await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    const cardAbc = page.locator("#card-abc"), cardDef = page.locator("#card-def"), cardGhi = page.locator("#card-ghi");
    await expect(cardAbc).toHaveAttribute("data-jhs-favorite-actress", "yes");
    await expect(cardDef).toHaveAttribute("data-jhs-favorite-actress", "yes");
    await expect(cardGhi).not.toHaveAttribute("data-jhs-favorite-actress", "yes");
    await expect(cardAbc.locator(".status-tag--favorite-actress")).toHaveText("收藏演员");
    await expect(cardGhi.locator(".status-tag--favorite-actress")).toHaveCount(0);
    await expect(cardAbc).not.toHaveCSS("box-shadow", "none");
    await expect(cardGhi).toHaveCSS("box-shadow", "none");
    if (info.project.name === "desktop-wide") {
      await page.locator("[data-jhs-primary-list]").scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`poster-wall-javdb-${theme}.png`) });
    }

    await page.evaluate(async () => {
      const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
      await settings.set("enableFavoriteActresses", "no");
    });
    await expect(cardAbc).not.toHaveAttribute("data-jhs-favorite-actress", "yes");
    await expect(cardAbc.locator(".status-tag--favorite-actress")).toHaveCount(0);
    await expect(cardAbc).toHaveCSS("box-shadow", "none");

    await page.evaluate(async () => {
      const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
      await settings.set("highlightedTagColor", "#10ac84");
      await settings.set("enableFavoriteActresses", "yes");
    });
    await expect(cardAbc).toHaveAttribute("data-jhs-favorite-actress", "yes");
    await expect(cardAbc).not.toHaveCSS("box-shadow", "none");

    const javbusListHtml = `
      <main class="container-fluid"><div class="row"><div class="masonry">
        <div class="item movie-box" id="bus-abc"><a href="/ABC-123"><div class="photo-frame"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" title="JavBus Hit"></div><div class="photo-info"><span>JavBus Hit<br><div class="item-tag"></div><date>ABC-123</date> / <date>2026-10-01</date></span></div></a></div>
        <div class="item movie-box" id="bus-xyz"><a href="/XYZ-001"><div class="photo-frame"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" title="JavBus Miss"></div><div class="photo-info"><span>JavBus Miss<br><div class="item-tag"></div><date>XYZ-001</date> / <date>2026-10-02</date></span></div></a></div>
      </div></div></main>`;
    await page.goto("https://www.javbus.com/");
    await page.evaluate((html) => { document.body.innerHTML = html; }, javbusListHtml);
    await injectUserscriptRuntime(page, {
      hostStyles: true,
      settingOverrides: { themeMode: theme, defaultQuickFilterTab: "all", enableFavoriteActresses: "yes", highlightedTagNumber: 2, highlightedTagColor: "#ff4757" },
      beforeUserscriptInjection: seedPosterWallData,
    });
    await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await expect(page.locator("#bus-abc")).toHaveAttribute("data-jhs-favorite-actress", "yes");
    await expect(page.locator("#bus-abc .status-tag--favorite-actress")).toHaveText("收藏演员");
    await expect(page.locator("#bus-abc")).not.toHaveCSS("box-shadow", "none");
    await expect(page.locator("#bus-xyz")).not.toHaveAttribute("data-jhs-favorite-actress", "yes");
    await expect(page.locator("#bus-xyz")).toHaveCSS("box-shadow", "none");
    if (info.project.name === "desktop-wide") {
      await page.screenshot({ path: info.outputPath(`poster-wall-javbus-${theme}.png`) });
    }
  });
}
