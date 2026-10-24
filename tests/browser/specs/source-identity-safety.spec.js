import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

const screenshotRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../output/compatibility-repair");
const shortcuts = { blocked: { code: "KeyB" }, favorite: { code: "KeyF" }, downloaded: { code: "KeyD" }, watched: { code: "KeyW" } };
const settings = {
  needClosePage: "no", autoPage: "no", defaultQuickFilterTab: "all", mobileMode: "auto",
  enableLoadReview: "no", enableLoadRelatedList: "no", enableLoadOtherSite: "no", enableLoadActressInfo: "no",
  enableLoadScreenShot: "no", enableLoadPreviewVideo: "no", enableClog: "no", enableMagnetsFilter: "yes",
  autoRemoveNewVideoMarkAfterBrowse: "yes", detailShortcuts: shortcuts,
};

test.beforeEach(({}, info) => test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "桌面与移动视口覆盖来源身份保护"));

// Seed historical records directly in the isolated fixture DB, before the real userscript initializes.
async function seedLegacyRecords(page, carNums) {
  await page.evaluate(async (keys) => {
    const storage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
    await storage.setItem("data_version", 3);
    await storage.setItem("car_list", keys.map(carNum => ({
      carNum, url: "/v/legacy", status: "favorite",
      stateFlags: { favorite: true, blocked: true, downloaded: true, watched: true },
    })));
    await storage.setItem("favorite_actresses", [{
      starId: "source-safety-fixture", name: "Fixture Actor",
      newVideoList: keys.map(carNum => ({ carNum, url: "/v/legacy", publishTime: "2026-10-01" })),
    }]);
    await storage.setItem("new_video_decisions", {});
    await storage.setItem("activity_log", { entries: [] });
  }, carNums);
}

async function readStateDomains(page) {
  return page.evaluate(async () => {
    const storage = window.storageManager.forage;
    return Object.fromEntries(await Promise.all(["car_list", "favorite_actresses", "new_video_decisions", "activity_log"].map(async key => [key, await storage.getItem(key)])));
  });
}

async function capture(page, info, name) {
  await mkdir(screenshotRoot, { recursive: true });
  await page.screenshot({ path: resolve(screenshotRoot, `source-identity-${name}-${info.project.name}.png`), animations: "disabled", fullPage: false });
}

for (const theme of ["light", "dark"]) {
  for (const scenario of [
    { name: "label", nativeCarNum: "Studio Name", carNums: ["STUDIO-NAME"], query: "" },
    { name: "hint-conflict", nativeCarNum: "ABC-123", carNums: ["ABC-123", "DEF-456"], query: "?jhsCarNum=DEF-456" },
  ]) {
    test(`detail identity ${scenario.name} keeps legacy state isolated and blocks shortcuts ${theme}`, async ({ page, context }, info) => {
      await fulfillHostFixtures(context);
      const fixture = await readFile(new URL("../fixtures/javdb-detail-interactions.html", import.meta.url), "utf8");
      const body = fixture.replace('data-clipboard-text="ABC-123">ABC-123</a>', `data-clipboard-text="${scenario.nativeCarNum}">${scenario.nativeCarNum}</a>`);
      await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html; charset=utf-8", body }));
      await page.goto(`https://javdb.com/v/source-identity-${scenario.name}${scenario.query}`);
      await injectUserscriptRuntime(page, {
        hostStyles: true, realFeedback: true,
        settingOverrides: { ...settings, themeMode: theme },
        beforeUserscriptInjection: async hostPage => { await injectRealLayer(hostPage); await seedLegacyRecords(hostPage, scenario.carNums); },
      });

      for (const id of ["filterBtn", "favoriteBtn", "hasDownBtn", "hasWatchBtn"]) {
        await expect(page.locator(`#${id}`)).toBeDisabled();
        await expect(page.locator(`#${id}`)).toHaveAttribute("aria-pressed", "false");
      }
      const before = await readStateDomains(page);
      expect(before.favorite_actresses[0].newVideoList.map(item => item.carNum)).toEqual(scenario.carNums);
      expect(before.car_list.every(item => item.stateFlags.favorite)).toBe(true);

      await page.locator("h1").click();
      for (const key of ["f", "d", "w", "b"]) await page.keyboard.press(key);
      await expect(page.locator(".layui-layer-dialog")).toHaveCount(0);
      for (const id of ["filterBtn", "favoriteBtn", "hasDownBtn", "hasWatchBtn"]) await expect(page.locator(`#${id}`)).toHaveAttribute("aria-pressed", "false");

      // Exercise the real resource-filter control while identity-based state actions are unavailable.
      await expect(page.locator("#enable-magnets-filter")).toBeEnabled();
      await page.locator("#enable-magnets-filter").click();
      await expect(page.locator("#magnets-span")).toHaveText("开启磁力过滤");
      await expect(page.locator('#magnets-content a[href^="magnet:"]').first()).toBeVisible();
      expect(await readStateDomains(page)).toEqual(before);
      await capture(page, info, `${scenario.name}-${theme}`);
    });
  }

  test(`unreliable list cards ignore historical badges and keep resource and browsing actions ${theme}`, async ({ page, context }, info) => {
    await fulfillHostFixtures(context);
    const fixture = await readFile(new URL("../fixtures/javdb-list.html", import.meta.url), "utf8");
    const body = fixture.replace("<strong>ABC-123</strong>", "<strong>FC2</strong>").replace('class="tags" style="display:none"', 'class="tags" style="display:flex"');
    await context.route("https://javdb.com/", route => route.fulfill({ contentType: "text/html; charset=utf-8", body }));
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://javdb.com" });
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, {
      hostStyles: true, realFeedback: true,
      settingOverrides: { ...settings, themeMode: theme },
      beforeUserscriptInjection: async hostPage => { await injectRealLayer(hostPage); await seedLegacyRecords(hostPage, ["FC2"]); },
    });

    const card = page.locator(".movie-list .item").first();
    await expect(card).toHaveAttribute("data-jhs-flags", /"favorite":false/);
    await expect(card).toBeVisible();
    await expect(card.locator(".status-tag")).toHaveCount(0);
    const before = await readStateDomains(page);
    expect(before.favorite_actresses[0].newVideoList.map(item => item.carNum)).toEqual(["FC2"]);
    await card.locator(".handleSvg .jhs-card-menu-trigger").click();
    const stateMenu = page.locator(".jhs-owned-popover .jhs-card-status-item");
    await expect(stateMenu).toHaveCount(4);
    for (let index = 0; index < 4; index++) await expect(stateMenu.nth(index)).toBeDisabled();
    await capture(page, info, `list-${theme}`);
    await page.keyboard.press("Escape");

    await card.locator("img").dispatchEvent("contextmenu");
    await expect(page.locator(".layui-layer-dialog")).toHaveCount(0);
    await card.locator(".copySvg .jhs-card-menu-trigger").click();
    await page.locator(".jhs-owned-popover .titleSvg").click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("JavDB Fixture Movie");
    expect(await readStateDomains(page)).toEqual(before);

    // Open the actual movie-detail surface through the host card, without replacing Feature methods.
    await card.locator(".video-title").click();
    await expect(page.locator('.layui-layer iframe[src*="/v/abc-123"]')).toHaveCount(1);
  });
}
