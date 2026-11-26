import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const detailPage = `
  <main>
    <div class="panel-block"><span>演员甲</span><i class="female"></i></div>
    <div id="actor-heading"><strong>演员</strong></div>
  </main>`;

test("actress info is feature-owned, keeps its setting behavior, and preserves the old disable ID", async ({ page, context, browser }, info) => {
  test.skip(info.project.name !== "desktop-wide", "explicit viewport matrix owner");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/actress-info-fixture");
  await page.evaluate((html) => { document.body.innerHTML = html; }, detailPage);
  await injectUserscriptRuntime(page, { settingOverrides: { enableLoadActressInfo: "yes" } });
  await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
  await expect(page.locator("#actor-heading + .actress-info")).toHaveCount(1, { timeout: 10000 });
  const enabledRuntime = await page.evaluate(() => ({
    descriptorPreserved: window.__jhsBrowserDiagnostics.diagnostics.exportSnapshot().contributionDescriptors.some(item => item.id === "identity.actress-info"),
  }));
  expect(enabledRuntime).toEqual({ descriptorPreserved: true });

  const disabledContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    await fulfillHostFixtures(disabledContext);
    const disabledPage = await disabledContext.newPage();
    await disabledPage.goto("https://javdb.com/v/actress-info-fixture");
    await disabledPage.evaluate((html) => { document.body.innerHTML = html; }, detailPage);
    await injectUserscriptRuntime(disabledPage, { disabledPlugins: ["ActressInfoPlugin"] });
    await disabledPage.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await expect(disabledPage.locator(".actress-info")).toHaveCount(0);
    await disabledPage.close();
  } finally {
    await disabledContext.close();
  }
});

test("uses stored actressProfile without network lookup, strips actor-page badges, and filters new-video workspace on desktop and 320px compact", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop-wide", "explicit viewport matrix owner");
  await fulfillHostFixtures(context);

  // Seed favorite_actresses first on javdb origin
  await page.goto("https://javdb.com/");
  await injectUserscriptRuntime(page, { settingOverrides: { enableLoadActressInfo: "yes", enableLoadReview: "no" } });
  await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
  await page.evaluate(async () => {
    const actresses = [
      {
        starId: "actor1",
        name: "演员甲",
        allName: ["演员甲", "Actor One"],
        actressType: "censored",
        actressProfileVerifiedUrl: "https://ja.wikipedia.org/wiki/Actor_One",
        actressProfile: {
          url: "https://ja.wikipedia.org/wiki/Actor_One",
          birthday: "1995年1月2日",
          age: "31岁",
          height: "162cm",
          weight: "46kg",
          threeSizeText: "85 - 58 - 86",
          braSize: "D",
          matchedName: "演员甲",
        },
        newVideoList: [{ carNum: "ABC-101", title: "Alpha", publishTime: "2026-10-01" }],
      },
      {
        starId: "actor2",
        name: "演员乙",
        allName: ["演员乙"],
        actressType: "uncensored",
        actressProfileVerifiedUrl: "https://ja.wikipedia.org/wiki/Actor_Two",
        actressProfile: {
          url: "https://ja.wikipedia.org/wiki/Actor_Two",
          birthday: "2000年3月4日",
          age: "26岁",
          height: "152cm",
          weight: "42kg",
          threeSizeText: "95 - 57 - 88",
          braSize: "I",
          matchedName: "演员乙",
        },
        newVideoList: [{ carNum: "XYZ-202", title: "Beta", publishTime: "2026-10-02" }],
      },
    ];
    await window.storageManager.forage.setItem(window.storageManager.favorite_actresses_key, actresses);
    window.storageManager._invalidateCache(window.storageManager.favorite_actresses_key);
  });

  // 1. Detail page renders stored actressProfile without requesting ja.wikipedia.org
  await page.goto("https://javdb.com/v/actress-info-stored");
  await page.evaluate(() => {
    document.body.innerHTML = `<main><div class="panel-block"><a class="actor-female" href="/actors/actor1">演员甲</a></div><div id="actor-heading"><strong>演员</strong></div></main>`;
  });
  await injectUserscriptRuntime(page, { preserveStorage: true });
  await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
  await expect(page.locator("#actor-heading + .actress-info")).toContainText("162cm 46kg");
  await expect(page.locator("#actor-heading + .actress-info a")).toHaveAttribute("href", "https://ja.wikipedia.org/wiki/Actor_One");
  expect(await page.evaluate(() => window.__jhsBrowserDiagnostics.requests.filter((r) => r.url.includes("wikipedia.org")))).toEqual([]);

  // 2. Actor page uses hostAdapter.readActorProfile (stripping badges) and stored profile
  await page.goto("https://javdb.com/actors/actor1");
  await page.evaluate(() => {
    document.body.innerHTML = `<main><div class="actor-section-name">演员甲(無碼)<span class="jhs-badge">收藏</span></div><div class="section-meta">12 影片</div></main>`;
  });
  await injectUserscriptRuntime(page, { preserveStorage: true });
  await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
  await expect(page.locator(".actress-info")).toContainText("出生日期: 1995年1月2日");
  await expect(page.locator(".actress-info")).toHaveAttribute("href", "https://ja.wikipedia.org/wiki/Actor_One");
  expect(await page.evaluate(() => window.__jhsBrowserDiagnostics.requests.filter((r) => r.url.includes("wikipedia.org")))).toEqual([]);

  // 3. New-video workspace dual-view body filtering and 320px compact zero horizontal overflow
  await page.goto("https://javdb.com/");
  await injectUserscriptRuntime(page, { preserveStorage: true });
  await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
  await page.locator("#newVideoBtn").click();
  const workspace = page.locator(".newVideoToolBox");
  await expect(workspace).toBeVisible();
  await workspace.locator("#nvViewActress").click();
  await expect(workspace.locator(".actress-card")).toHaveCount(2);
  await expect(workspace.locator('.actress-card[data-starId="actor1"]')).toContainText("162cm · D杯 · 85 - 58 - 86 · 31岁");

  // Filter actress view by height >= 160
  await workspace.locator("#nvHeightMin").fill("160");
  await expect(workspace.locator(".actress-card")).toHaveCount(1);
  await expect(workspace.locator("#nvBodyReset")).toBeVisible();
  await workspace.locator("#nvBodyReset").click();
  await expect(workspace.locator(".actress-card")).toHaveCount(2);

  // Switch to list view and filter by H+ cup
  await workspace.locator("#nvViewList").click();
  await expect(workspace.locator("#nv-grid .nv-card")).toHaveCount(2);
  await workspace.locator('.jhs-nv-cup-checkbox[value="H+"]').check();
  await expect(workspace.locator("#nv-grid .nv-card")).toHaveCount(1);
  await expect(workspace.locator("#nv-grid .nv-card").first()).toHaveAttribute("data-car", "XYZ-202");
  await workspace.locator("#nvBodyReset").click();
  await expect(workspace.locator("#nv-grid .nv-card")).toHaveCount(2);

  // Desktop list container >= 160px
  expect((await workspace.locator("#new-video-list-container").boundingBox()).height).toBeGreaterThanOrEqual(160);

  // Compact 320px zero horizontal overflow
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(workspace).toHaveAttribute("data-jhs-compact", "true");
  await workspace.locator("#nvFilterToggle").click();
  await expect(workspace.locator("#nv-filter-panel")).toBeVisible();
  const overflow = await page.evaluate(() => {
    const box = document.querySelector(".newVideoToolBox");
    const panel = document.querySelector("#nv-filter-panel");
    return {
      boxOverflow: box.scrollWidth - box.clientWidth,
      panelOverflow: panel.scrollWidth - panel.clientWidth,
    };
  });
  expect(overflow.boxOverflow).toBeLessThanOrEqual(0);
  expect(overflow.panelOverflow).toBeLessThanOrEqual(0);
});
