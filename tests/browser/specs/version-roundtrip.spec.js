import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const releaseCommit = "8e2e9b8baefe99b13125f559e83ac98dd08cd02d";
const devUserscriptPath = join(repoRoot, "dist", "dev", "JHS-7.0.dev.user.js");

test("6.5.1 → isolated 7.0 → 6.5.1 restores and continues using the same synthetic storage", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one shared IndexedDB context owns the version round trip");
  const releaseUserscript = execFileSync("git", ["show", `${releaseCommit}:JHS.user.js`], {
    cwd: repoRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  });
  expect(releaseUserscript).toMatch(/^\/\/ @version\s+6\.5\.1$/m);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await fulfillHostFixtures(context);
  const openRuntime = async ({ source, userscriptPath, version, preserveStorage = true }) => {
    const page = await context.newPage();
    await page.goto("https://javdb.com/search_advanced", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, {
      userscriptSource: source,
      userscriptPath,
      version,
      preserveStorage,
    });
    return page;
  };

  try {
    const releasePage = await openRuntime({ source: releaseUserscript, version: "6.5.1", preserveStorage: false });
    const seeded = await releasePage.evaluate(async () => {
      await window.storageManager.saveSettingItem("defaultQuickFilterTab", "favorite");
      await window.storageManager.saveCar({
        carNum: "ABC-123", url: "https://javdb.com/v/synthetic-abc-123", names: "synthetic release fixture", actionType: "favorite",
      });
      await window.storageManager.addFavoriteActressList([{ starId: "synthetic-release-star", name: "Synthetic Release Star" }]);
      await window.storageManager.forage.setItem("filter_keyword_title", ["BASELINE-KEYWORD"]);
      await window.credentialService.set("jhs_webdav_password", "synthetic-webdav-secret");

      const storage = window.storageManager.forage;
      const beforeCars = structuredClone(await window.storageManager.getCarList());
      const afterCars = structuredClone(beforeCars);
      const target = afterCars.find((item) => item.carNum === "ABC-123");
      target.stateFlags = { favorite: true, downloaded: false, watched: false, blocked: true };
      target.status = "filter";
      const beforeActivity = structuredClone(await storage.getItem("activity_log") || { entries: [] });
      const pendingActivity = {
        id: "synthetic-v651-interrupted", type: "synthetic-interruption", commitState: "pending",
        createdAt: "2026-09-25T00:00:00.000Z", changes: [],
      };
      const afterActivity = { ...beforeActivity, entries: [...beforeActivity.entries, pendingActivity] };
      const journal = {
        schema: 2, id: pendingActivity.id, state: "prepared", createdAt: pendingActivity.createdAt,
        touchedDomains: ["carList", "activity"],
        before: {
          carList: beforeCars,
          activity: beforeActivity,
        },
        after: {
          carList: afterCars,
          activity: afterActivity,
        },
      };
      await window.storageManager._setItemAndInvalidate("car_list", afterCars);
      await storage.setItem("activity_log", afterActivity);
      await storage.setItem("mutation_journal", journal);
      return { saved: await window.storageManager.getCar("ABC-123"), journalSchema: journal.schema };
    });
    expect(seeded).toMatchObject({ saved: { carNum: "ABC-123", stateFlags: { favorite: true } }, journalSchema: 2 });
    await releasePage.close();

    const devPage = await openRuntime({ userscriptPath: devUserscriptPath, version: "7.0-dev" });
    const recovered = await devPage.evaluate(async () => ({
      state: await window.stateService.getState("ABC-123"),
      journal: await window.storageManager.forage.getItem("mutation_journal"),
      dataVersion: await window.storageManager.getDataVersion(),
    }));
    expect(recovered.state?.stateFlags).toMatchObject({ favorite: true, blocked: false });
    expect(recovered.journal).toBeNull();
    expect(recovered.dataVersion).toBe(3);

    const snapshotId = await devPage.evaluate(async () => {
      await window.settingsService.set("defaultQuickFilterTab", "recent7d");
      await window.stateService.patch("XYZ-456", { downloaded: true }, {
        type: "synthetic-v7-roundtrip",
        record: { carNum: "XYZ-456", url: "https://javdb.com/v/synthetic-xyz-456", names: "synthetic dev fixture" },
      });
      await window.storageManager.addFavoriteActressList([{ starId: "synthetic-dev-star", name: "Synthetic Dev Star" }]);
      await window.credentialService.set("jhs_webdav_password", "synthetic-webdav-secret-updated");
      await window.storageManager.importData({
        data_version: 3,
        setting: { defaultQuickFilterTab: "all" },
        filter_keyword_title: ["SYNTHETIC-IMPORT"],
      });
      const snapshot = (await window.storageManager.getSnapshotList()).find((item) => item.source === "auto-import");
      const backup = await window.storageManager.getSnapshot(snapshot.id);
      if (backup.data.setting.defaultQuickFilterTab !== "recent7d"
        || !backup.data.car_list.some((item) => item.carNum === "XYZ-456")
        || !backup.data.favorite_actresses.some((item) => item.starId === "synthetic-dev-star")) {
        throw new Error("auto-import snapshot did not capture the complete pre-import state");
      }
      return snapshot.id;
    });
    expect(snapshotId).toBeTruthy();
    await devPage.close();

    const rollbackPage = await openRuntime({ source: releaseUserscript, version: "6.5.1" });
    const readBack = await rollbackPage.evaluate(async () => ({
      setting: await window.storageManager.getSetting("defaultQuickFilterTab"),
      releaseRecord: await window.storageManager.getCar("ABC-123"),
      devRecord: await window.storageManager.getCar("XYZ-456"),
      actresses: await window.storageManager.getFavoriteActressList(),
      titleKeywords: await window.storageManager.getTitleFilterKeyword(),
      credential: await window.credentialService.get("jhs_webdav_password"),
      credentialSchema: (await window.GM_getValue("jhs_webdav_password"))?.schema,
      dataVersion: await window.storageManager.getDataVersion(),
      journal: await window.storageManager.forage.getItem("mutation_journal"),
    }));

    expect(readBack.setting).toBe("all");
    expect(readBack.releaseRecord?.stateFlags).toMatchObject({ favorite: true, blocked: false });
    expect(readBack.devRecord?.stateFlags?.downloaded).toBe(true);
    expect(readBack.actresses.map((item) => item.starId)).toEqual(expect.arrayContaining(["synthetic-release-star", "synthetic-dev-star"]));
    expect(readBack.titleKeywords).toEqual(["SYNTHETIC-IMPORT"]);
    expect(readBack.credential).toBe("synthetic-webdav-secret-updated");
    expect(readBack.credentialSchema).toBe(2);
    expect(readBack.dataVersion).toBe(3);
    expect(readBack.journal).toBeNull();
    const continued = await rollbackPage.evaluate(async (restoreId) => {
      await window.storageManager.restoreSnapshot(restoreId);
      const restored = {
        setting: await window.storageManager.getSetting("defaultQuickFilterTab"),
        titleKeywords: await window.storageManager.getTitleFilterKeyword(),
        actresses: await window.storageManager.getFavoriteActressList(),
      };
      await window.storageManager.saveSettingItem("defaultQuickFilterTab", "favorite");
      await window.storageManager.saveCar({
        carNum: "BACK-789", url: "https://javdb.com/v/synthetic-back-789", names: "synthetic rollback fixture", actionType: "favorite",
      });
      await window.storageManager.addFavoriteActressList([{ starId: "synthetic-return-star", name: "Synthetic Return Star" }]);
      return {
        restored,
        setting: await window.storageManager.getSetting("defaultQuickFilterTab"),
        backRecord: await window.storageManager.getCar("BACK-789"),
        actresses: await window.storageManager.getFavoriteActressList(),
        credential: await window.credentialService.get("jhs_webdav_password"),
        dataVersion: await window.storageManager.getDataVersion(),
        journal: await window.storageManager.forage.getItem("mutation_journal"),
      };
    }, snapshotId);
    expect(continued.restored.setting).toBe("recent7d");
    expect(continued.restored.titleKeywords).toEqual(["BASELINE-KEYWORD"]);
    expect(continued.restored.actresses.map((item) => item.starId)).toEqual(expect.arrayContaining(["synthetic-release-star", "synthetic-dev-star"]));
    expect(continued.setting).toBe("favorite");
    expect(continued.backRecord?.stateFlags?.favorite).toBe(true);
    expect(continued.actresses.map((item) => item.starId)).toContain("synthetic-return-star");
    expect(continued.credential).toBe("synthetic-webdav-secret-updated");
    expect(continued.dataVersion).toBe(3);
    expect(continued.journal).toBeNull();
    await rollbackPage.close();
  } finally {
    await context.close();
  }
});

test("6.5.1 recovers a 7.0 journal interrupted after the car-list write", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one shared IndexedDB context owns the interrupted transaction");
  const releaseUserscript = execFileSync("git", ["show", `${releaseCommit}:JHS.user.js`], {
    cwd: repoRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await fulfillHostFixtures(context);
  try {
    const devPage = await context.newPage();
    await devPage.goto("https://javdb.com/search_advanced", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(devPage, { userscriptPath: devUserscriptPath, version: "7.0-dev", preserveStorage: false });
    await devPage.evaluate(async () => {
      await window.storageManager.saveCar({
        carNum: "REC-123", url: "https://javdb.com/v/synthetic-rec-123", names: "synthetic recovery fixture", actionType: "hasDown",
      });
      const forage = window.storageManager.forage;
      const persist = forage.setItem.bind(forage);
      forage.setItem = (key, value) => {
        if (key === "activity_log" && value?.entries?.some((entry) => entry.type === "interrupted-v7")) {
          window.__jhsCrashProbe = "paused-after-car-list";
          return new Promise(() => {});
        }
        return persist(key, value);
      };
      void window.stateService.patch("REC-123", { favorite: true }, { type: "interrupted-v7" });
    });
    await devPage.waitForFunction(() => window.__jhsCrashProbe === "paused-after-car-list");
    const interrupted = await devPage.evaluate(async () => ({
      journal: await window.storageManager.forage.getItem("mutation_journal"),
      car: await window.storageManager.forage.getItem("car_list"),
    }));
    expect(interrupted.journal).toMatchObject({ schema: 2, state: "prepared", touchedDomains: ["carList", "actresses", "decisions", "activity"] });
    expect(interrupted.car.find((item) => item.carNum === "REC-123")?.stateFlags).toMatchObject({ downloaded: true, favorite: true });
    await devPage.close();

    const releasePage = await context.newPage();
    await releasePage.goto("https://javdb.com/search_advanced", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(releasePage, { userscriptSource: releaseUserscript, version: "6.5.1", preserveStorage: true });
    const recovered = await releasePage.evaluate(async () => ({
      car: await window.storageManager.getCar("REC-123"),
      journal: await window.storageManager.forage.getItem("mutation_journal"),
      activity: await window.storageManager.forage.getItem("activity_log"),
      conflicts: await window.storageManager.forage.getItem("mutation_journal_conflicts"),
    }));
    expect(recovered.car?.stateFlags).toMatchObject({ downloaded: true, favorite: false });
    expect(recovered.journal).toBeNull();
    expect(recovered.activity?.entries?.some((entry) => entry.type === "interrupted-v7")).toBe(false);
    expect(recovered.conflicts ?? []).toEqual([]);
    await releasePage.evaluate(() => window.stateService.patch("REC-123", { watched: true }, { type: "post-rollback-v651" }));
    const continued = await releasePage.evaluate(async () => ({
      car: await window.storageManager.getCar("REC-123"),
      journal: await window.storageManager.forage.getItem("mutation_journal"),
    }));
    expect(continued.car?.stateFlags).toMatchObject({ downloaded: true, favorite: false, watched: true });
    expect(continued.journal).toBeNull();
    await releasePage.close();
  } finally {
    await context.close();
  }
});
