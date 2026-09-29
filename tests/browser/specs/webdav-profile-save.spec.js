import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop-wide", "one browser profile proves the settings save path"));

test("saving the WebDAV password keeps it available after reopening settings and listing backups", async ({ context, page }) => {
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(async () => {
    const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin");
    const webdav = plugin.getRuntimeService("webdav");
    await webdav.settings.update(draft => {
      draft.webDavUrl = "https://dav.example.test/dav";
      draft.webDavUsername = "fixture-user";
      draft.trustedLocalOrigins = ["https://dav.example.test"];
    });
    window.__webdavListCalls = 0;
    webdav.createClient = () => ({ getBackupList: async () => { window.__webdavListCalls++; return []; } });
    plugin.openSettingDialog();
  });
  let dialog = page.locator(".layui-layer").filter({ has: page.locator("#webdavBackupListBtn") });
  await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await dialog.locator('.side-menu-item[data-panel="backup-panel"]').click();
  await dialog.locator("#webDavPassword").fill("synthetic-webdav-password");
  await dialog.locator("#saveBtn").click();
  await expect.poll(() => page.evaluate(async () => {
    const webdav = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("webdav");
    return Boolean((await webdav.getProfile()).password);
  })).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
  dialog = page.locator(".layui-layer").filter({ has: page.locator("#webdavBackupListBtn") });
  await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await dialog.locator('.side-menu-item[data-panel="backup-panel"]').click();
  await expect(dialog.locator("#webDavPassword")).toHaveValue(/\S/);
  await dialog.locator("#webdavBackupListBtn").click();
  await expect.poll(() => page.evaluate(() => window.__webdavListCalls)).toBe(1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { preserveStorage: true });
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
  dialog = page.locator(".layui-layer").filter({ has: page.locator("#webdavBackupListBtn") });
  await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await dialog.locator('.side-menu-item[data-panel="backup-panel"]').click();
  await expect(dialog.locator("#webDavPassword")).toHaveValue(/\S/);
});

test("an autofilled WebDAV password is saved even without a change event", async ({ context, page }) => {
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(async () => {
    const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin");
    const webdav = plugin.getRuntimeService("webdav");
    await webdav.settings.update(draft => {
      draft.webDavUrl = "https://dav.example.test/dav";
      draft.webDavUsername = "fixture-user";
      draft.trustedLocalOrigins = ["https://dav.example.test"];
    });
    plugin.openSettingDialog();
  });
  const dialog = page.locator(".layui-layer").filter({ has: page.locator("#webdavBackupListBtn") });
  await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await dialog.locator('.side-menu-item[data-panel="backup-panel"]').click();
  await dialog.locator("#webDavPassword").evaluate(input => { input.value = "synthetic-autofilled-password"; });
  await expect(dialog.locator("#webDavPassword")).toHaveValue("synthetic-autofilled-password");
  expect(await page.evaluate(() => {
    const root = window.jQuery(".layui-layer").filter((_, element) => Boolean(element.querySelector("#webdavBackupListBtn")));
    return root.data("jhsDirtyManualKeys")?.size;
  })).toBe(0);
  await dialog.locator("#saveBtn").click();
  await expect.poll(() => page.evaluate(async () => {
    const webdav = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("webdav");
    return Boolean((await webdav.getProfile()).password);
  })).toBe(true);
});
