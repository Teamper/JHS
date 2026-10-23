import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { isolatedDav, sharedUserscriptInstallation } from "../harness/sync-dav.js";

const service = (page, method = "check", ...args) => page.evaluate(({ method, args }) => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("autoBackup")[method](...args), { method, args });
async function openSettings(page) {
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("data-panel"));
    const dialog = page.locator(".layui-layer").filter({ has: page.locator("#webdavAutoVerifyBtn") });
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    await dialog.locator('.side-menu-item[data-panel="data-panel"]').click();
    return dialog;
}
async function configure(page, url) {
    await page.evaluate(url => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("webdav").saveProfile({ url, username: "synthetic", password: "synthetic-password" }), url);
    await expect.poll(async () => (await service(page, "getStatus")).lastSuccessAt, { timeout: 12000 }).toBeGreaterThan(0);
}
const carList = page => page.evaluate(() => window.storageManager.forage.getItem("car_list"));

test.beforeEach(async ({}, info) => { test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and compact sync coverage"); });

test("isolated DAV automatically converges across devices and sites, including preferences and deletions", async ({ page, context, browser }) => {
    const dav = await isolatedDav(), other = await browser.newContext({ viewport: page.viewportSize() });
    try {
        const installA = await sharedUserscriptInstallation(context, dav), installB = await sharedUserscriptInstallation(other, dav);
        await fulfillHostFixtures(context); await fulfillHostFixtures(other);
        await page.goto("https://javdb.com/");
        await injectUserscriptRuntime(page, { beforeUserscriptInjection: installA });
        await configure(page, dav.url);
        await page.evaluate(async () => {
            const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
            await settings.patch({ themeMode: "dark", containerColumns: 7 });
            await window.stateService.patch(["SYNC-101"], { favorite: true });
        });
        // Real 5-second debounce publishes while Settings is closed.
        await expect.poll(() => dav.requests.filter(request => request.method === "PUT").length, { timeout: 12000 }).toBeGreaterThan(1);
        const b = await other.newPage(); await b.goto("https://javdb.com/");
        await injectUserscriptRuntime(b, { settingOverrides: { containerColumns: 2 }, beforeUserscriptInjection: installB });
        await configure(b, dav.url);
        await expect.poll(async () => (await carList(b))?.[0]?.stateFlags.favorite).toBe(true);
        expect(await b.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().containerColumns)).toBe(2);
        await expect(b.locator("html")).toHaveAttribute("data-jhs-theme", "dark");
        const dialog = await openSettings(b); await dialog.locator('.side-menu-item[data-panel="browse-panel"]').click(); await dialog.locator("#waitCheckCount").fill("11");
        await page.evaluate(async () => {
            await window.stateService.patch(["SYNC-101"], { watched: true });
            await window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("waitCheckCount", "10");
        });
        await b.evaluate(() => window.stateService.patch(["SYNC-101"], { downloaded: true }));
        await Promise.all([service(page), service(b)]); await service(page); await service(b);
        expect((await carList(page))[0].stateFlags).toMatchObject({ favorite: true, downloaded: true, watched: true });
        expect((await carList(b))[0].stateFlags).toEqual((await carList(page))[0].stateFlags);
        await expect(dialog.locator("#waitCheckCount")).toHaveValue("11");
        await dialog.locator("#saveBtn").click();
        await service(b); await service(page);
        expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().waitCheckCount)).toBe("11");
        const bus = await context.newPage(); await bus.goto("https://www.javbus.com/");
        await injectUserscriptRuntime(bus, { beforeUserscriptInjection: installA });
        await expect.poll(async () => (await service(bus, "getStatus")).lastSuccessAt).toBeGreaterThan(0);
        expect((await carList(bus))[0].carNum).toBe("SYNC-101");
        await page.evaluate(() => window.stateService.remove(["SYNC-101"])); await service(page); await service(b); await service(bus);
        expect(await carList(b)).toEqual([]); expect(await carList(bus)).toEqual([]);
        const writes = dav.requests.filter(request => request.method === "PUT").length;
        await service(page); await service(b); await service(bus);
        expect(dav.requests.filter(request => request.method === "PUT")).toHaveLength(writes);
    } finally { await other.close(); await dav.close(); }
});

test("legacy blocked movies with equivalent numbers sync without losing their restore point", async ({ page, context, browser }) => {
    const dav = await isolatedDav(), other = await browser.newContext({ viewport: page.viewportSize() });
    try {
        const install = await sharedUserscriptInstallation(context, dav); await fulfillHostFixtures(context);
        await page.goto("https://javdb.com/"); await injectUserscriptRuntime(page, { beforeUserscriptInjection: install });
        const original = [
            { carNum: "ABC123", starId: "legacy-actor", names: "Old", remark: "preserve note", updateDate: "2026-10-20" },
            { carNum: "ABC-123", starId: "legacy-actor", names: "Latest", updateDate: "2026-10-22" },
        ];
        await page.evaluate(rows => window.storageManager.forage.setItem("blacklist_car_list", rows), original);
        await configure(page, dav.url);
        await expect.poll(async () => (await service(page, "getStatus")).busy, { timeout: 12000 }).toBe(false);
        const local = await page.evaluate(() => window.storageManager.forage.getItem("blacklist_car_list"));
        expect(local).toHaveLength(1); expect(local[0]).toMatchObject({ carNum: "ABC-123", names: "Latest", remark: "preserve note" });
        const snapshots = await page.evaluate(() => window.storageManager.forage.getItem("snapshots"));
        expect(snapshots.some(snapshot => JSON.stringify(snapshot.data.blacklist_car_list) === JSON.stringify(original))).toBe(true);
        expect((await service(page, "getStatus")).message).toBe("");
        const installOther = await sharedUserscriptInstallation(other, dav); await fulfillHostFixtures(other);
        const reader = await other.newPage(); await reader.goto("https://javdb.com/");
        await injectUserscriptRuntime(reader, { beforeUserscriptInjection: installOther }); await configure(reader, dav.url);
        expect(await reader.evaluate(() => window.storageManager.forage.getItem("blacklist_car_list"))).toEqual(local);
    } finally { await other.close(); await dav.close(); }
});

test("zero requests without credentials, saved connection auto joins, pause and reopen preserve progress", async ({ page, context }) => {
    const dav = await isolatedDav();
    try {
        const install = await sharedUserscriptInstallation(context, dav); await fulfillHostFixtures(context);
        await page.goto("https://javdb.com/"); await injectUserscriptRuntime(page, { beforeUserscriptInjection: install });
        await service(page); expect(dav.requests).toHaveLength(0);
        const dialog = await openSettings(page);
        await expect(dialog.locator("#webDavAutoBackupEnabled")).toHaveCount(0);
        await expect(dialog.locator("#webDavSyncKeepCount")).toHaveValue("5");
        await expect(dialog.locator("#webDavSyncHistoryDays")).toHaveValue("7");
        await dialog.locator("#webDavUrl").fill(dav.url); await dialog.locator("#webDavUsername").fill("synthetic"); await dialog.locator("#webDavPassword").fill("synthetic-password");
        await dialog.locator("#saveBtn").click();
        await page.getByRole("button", { name: "授权", exact: true }).click();
        await expect.poll(() => page.evaluate(() => !!window.GM_getValue("jhs_webdav_shared_profile_v1", null))).toBe(true);
        await expect.poll(async () => (await service(page, "getStatus")).lastSuccessAt, { timeout: 12000 }).toBeGreaterThan(0);
        await service(page, "pause", true); const count = dav.requests.length;
        await page.evaluate(() => window.stateService.patch(["SYNC-2"], { favorite: true })); await service(page);
        expect(dav.requests).toHaveLength(count);
        await service(page, "pause", false); await service(page);
        await expect.poll(async () => (await service(page, "getStatus")).pendingChanges, { timeout: 12000 }).toBe(0);
        const writes = dav.requests.filter(request => request.method === "PUT").length;
        await page.reload(); await injectUserscriptRuntime(page, { preserveStorage: true, beforeUserscriptInjection: install });
        await service(page);
        expect(dav.requests.filter(request => request.method === "PUT")).toHaveLength(writes);
        expect((await carList(page))[0].carNum).toBe("SYNC-2");
        const stateBefore = await page.evaluate(() => window.storageManager.forage.getItem("jhs_webdav_sync_state_v1"));
        await service(page, "pause", true);
        const writesBeforeRestore = dav.requests.filter(request => request.method === "PUT").length;
        const recovery = await openSettings(page);
        await recovery.locator("summary").filter({ hasText: "历史恢复" }).click();
        await recovery.locator("#webdavSyncHistoryBtn").click();
        const chooser = recovery.getByRole("combobox", { name: "选择恢复版本" });
        await expect(chooser).toContainText("版本"); await chooser.click();
        await page.getByRole("option", { name: /版本 1$/ }).click();
        await recovery.locator("#webdavSyncRestorePreferences").uncheck();
        await recovery.locator("#webdavSyncRestoreBtn").click();
        await page.locator(".layui-layer-btn").getByRole("button", { name: "恢复", exact: true }).click();
        await expect.poll(async () => (await carList(page)).length).toBe(0);
        await service(page);
        expect((await service(page, "getStatus")).paused).toBe(true);
        expect(dav.requests.filter(request => request.method === "PUT")).toHaveLength(writesBeforeRestore);
        await service(page, "pause", false);
        await expect.poll(async () => (await service(page, "getStatus")).pendingChanges, { timeout: 10000 }).toBe(0);
        const stateAfter = await page.evaluate(() => window.storageManager.forage.getItem("jhs_webdav_sync_state_v1"));
        expect(stateAfter.replicaId).toBe(stateBefore.replicaId); expect(stateAfter.seq).toBeGreaterThan(stateBefore.seq);
    } finally { await dav.close(); }
});

test("same-origin tabs share scheduled polling while another tab can publish local changes", async ({ page, context }) => {
    const dav = await isolatedDav();
    try {
        const install = await sharedUserscriptInstallation(context, dav); await fulfillHostFixtures(context);
        await page.goto("https://javdb.com/"); await injectUserscriptRuntime(page, { beforeUserscriptInjection: install });
        await configure(page, dav.url); await service(page, "cancel");
        const other = await context.newPage(); await other.goto("https://javdb.com/");
        await injectUserscriptRuntime(other, { preserveStorage: true, beforeUserscriptInjection: install });
        await service(other, "cancel");
        const requests = dav.requests.length;
        for (const tab of [page, other, page, other]) await service(tab, "check", { scheduled: true });
        expect(dav.requests).toHaveLength(requests);
        await page.evaluate(() => window.stateService.patch(["MULTITAB-1"], { favorite: true }));
        await service(other, "check", { scheduled: true });
        await expect.poll(() => dav.requests.filter(request => request.method === "PUT").length, { timeout: 12000 }).toBeGreaterThan(1);
        await expect.poll(async () => (await Promise.all([service(page, "getStatus"), service(other, "getStatus")])).every(status => !status.busy)).toBe(true);
        expect((await carList(other))[0].stateFlags.favorite).toBe(true);
        const after = dav.requests.length;
        await service(page, "check", { scheduled: true }); expect(dav.requests).toHaveLength(after);
    } finally { await dav.close(); }
});

test("an upload keeps newer changes pending after another tab misses the network lock", async ({ page, context, browser }) => {
    test.setTimeout(45000);
    const dav = await isolatedDav(), device = await browser.newContext({ viewport: page.viewportSize() });
    let held, uploading;
    try {
        const install = await sharedUserscriptInstallation(context, dav); await fulfillHostFixtures(context);
        await page.goto("https://javdb.com/"); await injectUserscriptRuntime(page, { beforeUserscriptInjection: install });
        await configure(page, dav.url);
        const other = await context.newPage(); await other.goto("https://javdb.com/");
        await injectUserscriptRuntime(other, { preserveStorage: true, beforeUserscriptInjection: install });
        await service(other);
        await expect.poll(async () => (await service(page, "getStatus")).busy).toBe(false);
        const writes = dav.requests.filter(request => request.method === "PUT").length;
        held = dav.holdNextPut();
        await page.bringToFront();
        await page.evaluate(() => window.stateService.patch(["SYNC-103"], { favorite: true }));
        uploading = service(page);
        // The unconfirmed snapshot is already fixed before the next local edit.
        await expect.poll(async () => ({ puts: dav.requests.filter(request => request.method === "PUT").length, status: await service(page, "getStatus") }), { timeout: 12000 }).toMatchObject({ puts: writes + 1 });
        await held.received;
        await other.bringToFront();
        const changedAt = await other.evaluate(async () => {
            await window.stateService.patch(["SYNC-103"], { watched: true });
            return Date.now();
        });
        await expect.poll(() => other.evaluate(async changedAt => {
            const status = await window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("autoBackup").getStatus();
            const now = Date.now();
            return { retryScheduled: now >= changedAt + 5000 && !status.busy && status.nextDueAt > now && status.nextDueAt <= now + 1500, status };
        }, changedAt), { timeout: 8500 }).toMatchObject({ retryScheduled: true });
        expect(dav.requests.filter(request => request.method === "PUT")).toHaveLength(writes + 1);
        const pending = await other.evaluate(() => window.storageManager.forage.getItem("jhs_webdav_sync_state_v1"));
        expect(pending.localRevision).toBeGreaterThan(pending.pending.coveredRevision);
        held.release();
        await uploading;
        await expect.poll(async () => (await service(other, "getStatus")).pendingChanges, { timeout: 12000 }).toBe(0);
        expect(dav.requests.filter(request => request.method === "PUT")).toHaveLength(writes + 2);

        const installDevice = await sharedUserscriptInstallation(device, dav); await fulfillHostFixtures(device);
        const reader = await device.newPage(); await reader.goto("https://javdb.com/");
        await injectUserscriptRuntime(reader, { beforeUserscriptInjection: installDevice }); await configure(reader, dav.url);
        expect((await carList(reader))[0].stateFlags).toMatchObject({ favorite: true, watched: true });
    } finally { held?.release(); await uploading?.catch(() => {}); await device.close(); await dav.close(); }
});

for (const theme of ["light", "dark"]) test(`多端同步布局 ${theme}`, async ({ page, context }, info) => {
    test.skip(process.env.JHS_VISUAL_REGRESSION !== "1", "visual gate uses pinned Chromium");
    await page.clock.setFixedTime(new Date("2026-10-22T08:00:00Z"));
    await fulfillHostFixtures(context); await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { hostStyles: true, settingOverrides: { themeMode: theme } });
    const dialog = await openSettings(page);
    await service(page); await expect.poll(async () => (await service(page, "getStatus")).busy).toBe(false);
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("autoBackup").cancel());
    await dialog.locator("#webDavSyncKeepCount").evaluate(input => input.closest("details").open = true);
    const keep = dialog.locator("#webDavSyncKeepCount"); await keep.scrollIntoViewIfNeeded(); await keep.focus();
    await page.keyboard.press("ArrowUp"); await expect(keep).toHaveValue("6");
    await page.keyboard.press("Tab"); await expect(dialog.locator("#webDavSyncHistoryDays")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(dialog.locator("#jhs-auto-backup-status")).toContainText("尚未接入同步");
    await dialog.screenshot({ path: info.outputPath(`auto-backup-${theme}.png`), animations: "disabled" });
    await expect(dialog).toHaveScreenshot(`auto-backup-${theme}.png`, { maxDiffPixelRatio: 0.02 });
});
