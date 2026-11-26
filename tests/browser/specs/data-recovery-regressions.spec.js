import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { CURRENT_DATA_VERSION } from "../../../src/core/constants.js";

test.beforeEach(async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop-wide", "storage regressions use one real IndexedDB browser project");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id");
});

test("unversioned import retains favorite when another state is changed", async ({ page }) => {
  await injectUserscriptRuntime(page);
  const result = await page.evaluate(async () => {
    const { state, storage, backup } = window.__jhsBrowserDiagnostics.detailServices;
    await backup.importData({ car_list: [{ carNum: "ABC-123", url: "/v/old", status: "favorite" }] });
    const favorites = (await state.getCarList()).filter(record => record.stateFlags.favorite).length;
    await state.patch("ABC-123", { downloaded: true });
    return { favorites, record: await state.getState("ABC-123"), version: await storage.get("data_version") };
  });
  expect(result).toMatchObject({ favorites: 1, version: CURRENT_DATA_VERSION, record: { stateFlags: { favorite: true, downloaded: true } } });
});

test("undo cannot transfer a deleted actress's new movie to another actress", async ({ page }) => {
  await injectUserscriptRuntime(page);
  const result = await page.evaluate(async () => {
    const { storage, state, backup } = window.__jhsBrowserDiagnostics.detailServices;
    await backup.importData({ data_version: 3, favorite_actresses: [
      { starId: "actor-A", name: "A", newVideoList: ["XYZ-001"] },
      { starId: "actor-B", name: "B", newVideoList: [] },
    ] });
    const removed = await state.removeFromNewVideoList("XYZ-001");
    await state.removeFavoriteActress("actor-A");
    return { undo: await state.undoTransaction(removed.transactionId), actresses: await storage.get("favorite_actresses") };
  });
  expect(result).toEqual({ undo: { reverted: [], conflicts: ["XYZ-001"] }, actresses: [{ starId: "actor-B", name: "B", newVideoList: [] }] });
});

test("restoring an actual migration snapshot normalizes its source version without downgrading", async ({ page }) => {
  await injectUserscriptRuntime(page, { beforeUserscriptInjection: async hostPage => {
    await hostPage.evaluate(async () => {
      const storage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
      await storage.setItem("data_version", 1);
      await storage.setItem("car_list", [{ carNum: "abc123", url: "/v/old", status: "favorite" }]);
    });
  } });
  const result = await page.evaluate(async () => {
    const { state, storage, backup } = window.__jhsBrowserDiagnostics.detailServices;
    const entry = (await backup.getSnapshotList()).find(item => item.kind === "migration-snapshot" && item.targetDataVersion === 2);
    if (!entry) throw new Error("bootstrap did not create the migration snapshot");
    const snapshot = await backup.getSnapshot(entry.id);
    await state.patch("ABC-123", { watched: true });
    await backup.restoreSnapshot(snapshot.id);
    return { sourceVersion: snapshot.data.data_version, version: await storage.get("data_version"), record: await state.getState("ABC-123") };
  });
  expect(result).toMatchObject({ sourceVersion: 1, version: CURRENT_DATA_VERSION, record: { stateFlags: { favorite: true, watched: false } } });
});
