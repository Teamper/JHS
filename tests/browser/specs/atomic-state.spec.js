import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("native state transaction abort preserves data, receipts and retry semantics", async ({ context, page }, info) => {
    test.skip(info.project.name !== "desktop-wide");
    await fulfillHostFixtures(context); await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { settingOverrides: { autoPage: "no", enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" } });
    const result = await page.evaluate(async () => {
        const state = window.stateService, f = window.storageManager.forage;
        const keys = ["car_list", "activity_log", "jhs_webdav_sync_pending_v1", "jhs_webdav_auto_backup_state_v1"];
        const before = await Promise.all(keys.map(key => f.getItem(key)));
        const original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function(value, key) {
            if (key === "activity_log") throw new DOMException("injected quota failure", "QuotaExceededError");
            return original.call(this, value, key);
        };
        let failed = false;
        try { await state.toggle("TX-123", "favorite"); } catch { failed = true; }
        finally { IDBObjectStore.prototype.put = original; }
        const after = await Promise.all(keys.map(key => f.getItem(key)));
        const retried = await state.toggle("TX-123", "favorite");
        return { failed, atomic: JSON.stringify(before) === JSON.stringify(after), favorite: (await state.getState("TX-123")).stateFlags.favorite, transactionId: retried.transactionId, journal: await f.getItem("mutation_journal") };
    });
    expect(result).toMatchObject({ failed: true, atomic: true, favorite: true, journal: null });
    expect(result.transactionId).toBeTruthy();
});
