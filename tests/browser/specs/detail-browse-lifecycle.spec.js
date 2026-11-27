import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers detail browse state mutation"));

async function bootDetail(page, context, { enabled = true } = {}) {
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id?jhsCarNum=ABC-123", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, {
    disabledPlugins: enabled ? [] : ["DetailPageButtonPlugin"],
    settingOverrides: { autoRemoveNewVideoMarkAfterBrowse: "yes", enableLoadPreviewVideo: "no", enableLoadReview: "no" },
    beforeUserscriptInjection: hostPage => hostPage.evaluate(async () => {
      const number = document.createElement("a");
      number.title = "複製番號";
      number.setAttribute("data-clipboard-text", "ABC-123");
      document.querySelector(".column-video-info").append(number);
      const storage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
      await storage.setItem("favorite_actresses", [{ starId: "fixture-star", name: "测试演员", newVideoList: ["ABC-123"] }]);
    }),
  });
  await page.waitForFunction(() => Boolean(window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]));
}

async function readBrowseState(page) {
  return page.evaluate(async () => {
    const storage = window.__jhsBrowserDiagnostics.detailServices.storage;
    return {
      actresses: await storage.get("favorite_actresses"),
      decisions: await storage.get("new_video_decisions"),
    };
  });
}

test("detail Feature removes the browsed movie mark once when its setting is enabled", async ({ page, context }) => {
  await bootDetail(page, context);
  await expect.poll(async () => readBrowseState(page)).toEqual({
    actresses: [{ starId: "fixture-star", name: "测试演员", newVideoList: [] }],
    decisions: expect.objectContaining({ "ABC-123": expect.objectContaining({ action: "dismissed" }) }),
  });
  const removals = await page.evaluate(async () => (await window.__jhsBrowserDiagnostics.detailServices.storage.get("activity_log"))?.entries?.filter(entry => entry.type === "new-video-remove").length ?? 0);
  expect(removals).toBe(1);
});

test("legacy DetailPageButtonPlugin disable ID still suppresses detail browse state mutation", async ({ page, context }) => {
  await bootDetail(page, context, { enabled: false });
  await expect.poll(async () => readBrowseState(page)).toEqual({
    actresses: [{ starId: "fixture-star", name: "测试演员", newVideoList: ["ABC-123"] }],
    decisions: null,
  });
});

test("closing an FC2 dialog cancels browse removal while it waits for the storage lock", async ({ page, context }) => {
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/");
  await injectUserscriptRuntime(page, {
    beforeUserscriptInjection: injectRealLayer,
    settingOverrides: { autoRemoveNewVideoMarkAfterBrowse: "yes", enableLoadScreenShot: "no", enableLoadReview: "no" },
  });
  await page.evaluate(async () => {
    const { state, storage } = window.__jhsBrowserDiagnostics.detailServices;
    await storage.set("favorite_actresses", [{ starId: "fixture-star", name: "测试演员", newVideoList: ["FC2-1234567"] }]);
    const acquired = Promise.withResolvers(), blocker = Promise.withResolvers();
    window.releaseBrowseLock = blocker.resolve;
    void state.mutationCoordinator.runExclusive(() => {
      acquired.resolve();
      return blocker.promise;
    });
    await acquired.promise;
    window.unsafeWindow.pluginManager.getBean("Fc2Plugin").openFc2Dialog("test-id", "FC2-1234567", "/v/test-id", { source: "fc2" });
  });
  const dialog = page.locator(".layui-layer").filter({ has: page.locator(".jhs-fc2-workspace") });
  await dialog.locator(".layui-layer-close").click();
  await expect(dialog).toHaveCount(0);
  await page.evaluate(async () => {
    window.releaseBrowseLock();
    await window.__jhsBrowserDiagnostics.detailServices.state.mutationCoordinator.waitForIdle();
  });
  expect(await readBrowseState(page)).toMatchObject({
    actresses: [{ starId: "fixture-star", newVideoList: ["FC2-1234567"] }],
    decisions: null,
  });
});
