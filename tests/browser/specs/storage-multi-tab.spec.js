import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("coordinates concurrent state writes across tabs sharing IndexedDB", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one desktop project owns shared IndexedDB concurrency timing");

  const context = await browser.newContext({ viewport: testInfo.project.use.viewport, serviceWorkers: "block" });
  try {
    await fulfillHostFixtures(context);
    const pages = await Promise.all([context.newPage(), context.newPage()]);
    await Promise.all(pages.map(async (page) => {
      await page.goto("https://javdb.com/v/multi-tab-fixture", { waitUntil: "domcontentloaded" });
      await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview: "no" } });
    }));

    const lockSupport = await pages[0].evaluate(() => typeof navigator.locks?.request === "function");
    expect(lockSupport, "Edge must provide the cross-tab Web Locks API used by StorageMutationCoordinator").toBe(true);
    await expect.poll(() => pages[0].evaluate(() => window.storageManager.getDataVersion())).toBe(3);
    await expect.poll(() => pages[1].evaluate(() => window.storageManager.getDataVersion())).toBe(3);

    const results = await Promise.all(pages.map((page, index) => page.evaluate(async (record) => window.stateService.patch(
      record.carNum,
      { favorite: true },
      { type: "multi-tab-fixture", record },
    ), {
      carNum: `TAB-${index + 1}`,
      url: `/v/tab-${index + 1}`,
      names: `Synthetic tab ${index + 1}`,
    })));
    expect(results.map((result) => result.changed)).toEqual([["TAB-1"], ["TAB-2"]]);

    const persisted = await pages[1].evaluate(async () => ({
      cars: await window.storageManager.forage.getItem("car_list"),
      journal: await window.storageManager.forage.getItem("mutation_journal"),
      conflicts: await window.storageManager.forage.getItem("mutation_journal_conflicts"),
    }));
    expect(persisted.cars).toEqual(expect.arrayContaining([
      expect.objectContaining({ carNum: "TAB-1", stateFlags: expect.objectContaining({ favorite: true }) }),
      expect.objectContaining({ carNum: "TAB-2", stateFlags: expect.objectContaining({ favorite: true }) }),
    ]));
    expect(persisted.journal).toBeNull();
    expect(persisted.conflicts ?? []).toEqual([]);
  } finally {
    await context.close();
  }
});
