import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

async function installDav(page) {
    await page.evaluate(() => {
        const original = window.GM_xmlhttpRequest;
        window.__autoDavRequests = [];
        window.GM_xmlhttpRequest = options => {
            const url = new URL(options.url);
            if (url.hostname !== "dav.example.test") return original(options);
            const method = options.method, name = decodeURIComponent(url.pathname.split("/").pop());
            window.__autoDavRequests.push({ method, name });
            let aborted = false;
            queueMicrotask(() => {
                if (aborted) return;
                let files = JSON.parse(localStorage.getItem("__auto_dav_files") || '["manual.json","auto_01234567-1234-1234-1234-012345678901_20200101T000000000Z_01234567-1234-1234-1234-012345678901.json"]');
                if (method === "PUT") files.push(name);
                if (method === "DELETE") files = files.filter(item => item !== name);
                localStorage.setItem("__auto_dav_files", JSON.stringify(files));
                const body = `<d:multistatus xmlns:d="DAV:">${files.map(file => `<d:response><d:href>/dav/JHS-%E6%95%B0%E6%8D%AE%E5%A4%87%E4%BB%BD/${encodeURIComponent(file)}</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontentlength>100</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join("")}</d:multistatus>`;
                options.onload({ status: method === "MKCOL" ? 405 : method === "PROPFIND" ? 207 : 201, responseText: method === "PROPFIND" ? body : "", finalUrl: options.url });
            });
            return { abort() { aborted = true; } };
        };
    });
}

async function boot(page, context, options = {}) {
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { ...options, beforeUserscriptInjection: installDav });
}
async function openSettings(page) {
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("data-panel"));
    const dialog = page.locator(".layui-layer").filter({ has: page.locator("#webdavAutoVerifyBtn") });
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    await dialog.locator('.side-menu-item[data-panel="data-panel"]').click();
    return dialog;
}
const status = page => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("autoBackup").getStatus());
const uploads = page => page.evaluate(() => window.__autoDavRequests.filter(request => request.method === "PUT").length);

test.beforeEach(async ({}, info) => { test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and compact settings coverage"); });

test("automatic WebDAV backup is opt-in, counts actual changes and retains only its own files", async ({ page, context }) => {
    await boot(page, context);
    await page.evaluate(async () => {
        const webdav = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("webdav");
        await webdav.saveProfile({ url: "https://dav.example.test/dav", username: "synthetic-user", password: "synthetic-password" }, draft => { draft.trustedLocalOrigins = ["https://dav.example.test"]; });
    });
    const dialog = await openSettings(page);
    await expect(dialog.locator("#webDavAutoBackupEnabled")).not.toBeChecked();
    await expect(dialog.locator("#jhs-auto-backup-options")).toBeHidden();
    expect(await uploads(page)).toBe(0);
    await dialog.locator("#webDavAutoBackupEnabled").check();
    await dialog.locator("#webDavAutoBackupChangeCount").fill("2");
    await dialog.locator("#webDavAutoBackupMinutes").fill("1");
    await dialog.locator("#webDavAutoBackupKeepCount").fill("2");
    await dialog.locator("#saveBtn").click();
    await expect.poll(async () => (await status(page)).enabled).toBe(true);
    expect(await uploads(page)).toBe(1);
    await expect(dialog.locator("#jhs-auto-backup-status")).toContainText("上次成功");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.evaluate(() => window.stateService.patch(["AUTO-101", "AUTO-102"], { favorite: true }));
    await expect.poll(() => uploads(page)).toBe(2);
    await expect.poll(async () => (await status(page)).pendingChanges).toBe(0);
    await page.evaluate(() => window.stateService.patch(["AUTO-101", "AUTO-102"], { favorite: true }));
    expect((await status(page)).pendingChanges).toBe(0);
    await page.evaluate(() => window.stateService.patch(["AUTO-101", "AUTO-102"], { watched: true }));
    await expect.poll(() => uploads(page)).toBe(3);
    await expect.poll(() => page.evaluate(() => window.__autoDavRequests.filter(request => request.method === "DELETE").length)).toBe(1);
    const files = await page.evaluate(() => JSON.parse(localStorage.getItem("__auto_dav_files")));
    expect(files).toContain("manual.json");
    expect(files.some(name => name.startsWith("auto_01234567-1234-1234-1234-012345678901_"))).toBe(true);
    expect(files).toHaveLength(4);
});

test("minute backup catches up once on reopening and stops after disabling", async ({ page, context }) => {
    await page.clock.setFixedTime(new Date("2026-10-21T08:00:00Z"));
    await boot(page, context);
    await page.evaluate(async () => {
        const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin"), webdav = plugin.getRuntimeService("webdav"), settings = plugin.getRuntimeService("settings");
        await webdav.saveProfile({ url: "https://dav.example.test/dav", username: "synthetic-user", password: "synthetic-password" }, draft => { draft.trustedLocalOrigins = ["https://dav.example.test"]; });
        await settings.patch({ webDavAutoBackupOnChanges: "no", webDavAutoBackupMinutes: 1 });
        await plugin.getRuntimeService("autoBackup").enable();
    });
    await page.clock.setFixedTime(new Date("2026-10-21T12:00:00Z"));
    await page.reload();
    await injectUserscriptRuntime(page, { preserveStorage: true, beforeUserscriptInjection: installDav });
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("autoBackup").check());
    await expect.poll(() => uploads(page)).toBe(1);
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("autoBackup").check());
    expect(await uploads(page)).toBe(1);
    const dialog = await openSettings(page);
    await dialog.locator("#webDavAutoBackupEnabled").uncheck();
    await dialog.locator("#saveBtn").click();
    await expect.poll(async () => (await status(page)).enabled).toBe(false);
    await page.clock.setFixedTime(new Date("2026-10-21T13:00:00Z"));
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("autoBackup").check());
    expect(await uploads(page)).toBe(1);
});

test("empty WebDAV configuration sends no automatic requests and a failed first verification stays off", async ({ page, context }) => {
    await boot(page, context);
    const dialog = await openSettings(page);
    await dialog.locator("#webDavAutoBackupEnabled").check();
    await dialog.locator("#saveBtn").click();
    await expect(dialog.locator("#webDavAutoBackupEnabled")).not.toBeChecked();
    await expect(dialog.locator("#jhs-auto-backup-status")).toContainText("失败");
    expect(await uploads(page)).toBe(0);
    expect((await status(page)).enabled).toBe(false);
    expect(await page.evaluate(() => window.__autoDavRequests.length)).toBe(0);
});

for (const theme of ["light", "dark"]) test(`自动备份布局 ${theme}`, async ({ page, context }, info) => {
    test.skip(process.env.JHS_VISUAL_REGRESSION !== "1", "visual gate uses the pinned Chromium");
    await page.clock.setFixedTime(new Date("2026-10-21T08:00:00Z"));
    await boot(page, context, { hostStyles: true, settingOverrides: { themeMode: theme } });
    const dialog = await openSettings(page);
    await dialog.locator("#webDavAutoBackupEnabled").check();
    for (const id of ["webDavAutoBackupChangeCount", "webDavAutoBackupMinutes", "webDavAutoBackupKeepCount"]) {
        const field = dialog.locator(`#${id}`);
        await field.scrollIntoViewIfNeeded();
        await expect(field).toBeInViewport();
        const label = await field.evaluate(input => document.querySelector(`label[for="${input.id}"]`)?.textContent);
        expect(label).toBeTruthy();
    }
    const keep = dialog.locator("#webDavAutoBackupKeepCount");
    await keep.focus(); await page.keyboard.press("ArrowUp");
    await expect(keep).toHaveValue("11");
    await page.keyboard.press("Tab");
    await expect(dialog.locator("#webdavAutoVerifyBtn")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await dialog.screenshot({ path: info.outputPath(`auto-backup-${theme}.png`), animations: "disabled" });
    await expect(dialog).toHaveScreenshot(`auto-backup-${theme}.png`, { maxDiffPixelRatio: 0.02 });
});
