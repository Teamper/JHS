import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers detail browse state mutation"));

async function bootDetail(page, context, { enabled = true } = {}) {
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id?jhsCarNum=ABC-123", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, {
    disabledPlugins: enabled ? [] : ["DetailPageButtonPlugin"],
    settingOverrides: { autoRemoveNewVideoMarkAfterBrowse: "yes", enableLoadPreviewVideo: "no", enableLoadReview: "no" },
    beforeUserscriptInjection: hostPage => hostPage.evaluate(async () => {
      const storage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
      await storage.setItem("favorite_actresses", [{ starId: "fixture-star", name: "测试演员", newVideoList: ["ABC-123"] }]);
    }),
  });
  await page.waitForFunction(() => Boolean(window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]));
}

async function readBrowseState(page) {
  return page.evaluate(async () => {
    const storage = window.storageManager.forage;
    return {
      actresses: await storage.getItem("favorite_actresses"),
      decisions: await storage.getItem("new_video_decisions"),
    };
  });
}

test("detail Feature removes the browsed movie mark once when its setting is enabled", async ({ page, context }) => {
  await bootDetail(page, context);
  await expect.poll(async () => readBrowseState(page)).toEqual({
    actresses: [{ starId: "fixture-star", name: "测试演员", newVideoList: [] }],
    decisions: expect.objectContaining({ "ABC-123": expect.objectContaining({ action: "dismissed" }) }),
  });
  const removals = await page.evaluate(async () => (await window.storageManager.forage.getItem("activity_log"))?.entries?.filter(entry => entry.type === "new-video-remove").length ?? 0);
  expect(removals).toBe(1);
});

test("legacy DetailPageButtonPlugin disable ID still suppresses detail browse state mutation", async ({ page, context }) => {
  await bootDetail(page, context, { enabled: false });
  await expect.poll(async () => readBrowseState(page)).toEqual({
    actresses: [{ starId: "fixture-star", name: "测试演员", newVideoList: ["ABC-123"] }],
    decisions: null,
  });
});
