import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("Chrome settings backup keeps WebDAV's 10-second deadline and records safe stage timings", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one Chrome viewport covers the settings backup flow");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { httpTimeout: 5_000 } });
  await page.evaluate(async () => {
    const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin");
    const webdav = plugin.getRuntimeService("webdav");
    await webdav.settings.update((draft) => {
      draft.webDavUrl = "https://dav.example.test/dav";
      draft.webDavUsername = "fixture-user";
      draft.trustedLocalOrigins = ["https://dav.example.test"];
    });
    const originalGet = webdav.credential.get.bind(webdav.credential);
    webdav.credential.get = (key) => key === "jhs_webdav_password" ? Promise.resolve("fixture-password") : originalGet(key);
    window.__webdavRequests = [];
    const originalRequest = webdav.http.port.requestImplementation;
    webdav.http.port.requestImplementation = (options) => {
      if (new URL(options.url).origin !== "https://dav.example.test") return originalRequest(options);
      window.__webdavRequests.push({ method: options.method, timeoutMs: options.timeout, bytes: typeof options.data === "string" ? options.data.length : 0 });
      const timer = setTimeout(() => options.onload({ status: options.method === "MKCOL" ? 405 : 201, responseText: "", finalUrl: options.url }), options.method === "PUT" ? 75 : 10);
      return { abort() { clearTimeout(timer); options.onabort?.(); } };
    };
    window.__webdavStages = [];
    for (const method of ["log", "warn"]) {
      const original = window.clog[method].bind(window.clog);
      window.clog[method] = (...args) => {
        if (args[0] === "[WebDAV备份]") window.__webdavStages.push(args[1]);
        return original(...args);
      };
    }
    plugin.openSettingDialog();
  });
  const dialog = page.locator(".layui-layer").filter({ has: page.locator("#webdavBackupBtn") });
  await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await dialog.locator('.side-menu-item[data-panel="backup-panel"]').click();
  await dialog.locator("#webdavBackupBtn").click();
  await expect.poll(() => page.evaluate(() => window.__webdavStages.some((stage) => stage.stage === "合计" && stage.result === "success"))).toBe(true);
  const result = await page.evaluate(() => ({ requests: window.__webdavRequests, stages: window.__webdavStages, loading: Boolean(document.querySelector(".loading-container")) }));
  expect(result.requests.map(({ method, timeoutMs }) => ({ method, timeoutMs }))).toEqual([
    { method: "MKCOL", timeoutMs: 10_000 }, { method: "PUT", timeoutMs: 10_000 },
  ]);
  expect(result.requests[1].bytes).toBeGreaterThan(0);
  expect(result.stages.map((stage) => stage.stage)).toEqual(["读取凭据", "导出数据", "加密", "建目录", "上传", "合计"]);
  const upload = result.stages.find((stage) => stage.stage === "上传");
  expect(upload).toMatchObject({ result: "success", bytes: result.requests[1].bytes, timeoutMs: 10_000 });
  expect(upload.durationMs).toBeGreaterThanOrEqual(50);
  expect(JSON.stringify(result)).not.toMatch(/fixture-password|fixture-user|dav\.example\.test/);
  expect(result.loading).toBe(false);
});

test("WebDAV delete confirmation renders an external filename as text on desktop and mobile", async ({ context, page }, testInfo) => {
  test.skip(!["desktop-wide", "mobile"].includes(testInfo.project.name), "desktop table and mobile cards own this HTML-rendering check");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const fileName = '<img src="data:," onerror="document.documentElement.dataset.webdavExecuted=String(1)"> <b>backup</b> &.json';
  await page.evaluate((name) => {
    const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin");
    const webdav = plugin.getRuntimeService("webdav");
    webdav.getProfile = async () => ({ url: "https://dav.example.test/dav", username: "fixture-user", password: "fixture-password" });
    webdav.createClient = () => ({ getBackupList: async () => [{ name, size: 12, createTime: "2026-09-28", fileId: "synthetic-file" }] });
    plugin.openSettingDialog();
  }, fileName);
  const settings = page.locator(".layui-layer").filter({ has: page.locator("#webdavBackupListBtn") });
  await expect(settings.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await settings.locator('.side-menu-item[data-panel="backup-panel"]').click();
  await settings.locator("#webdavBackupListBtn").click();
  const deleteButton = testInfo.project.name === "mobile" ? page.locator(".jhs-backup-btn-danger") : page.locator(".backup-delete");
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();
  const confirmation = page.locator(".layui-layer-dialog-content");
  await expect(confirmation).toContainText(fileName);
  await expect(confirmation.locator("img,b")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dataset.webdavExecuted)).toBeUndefined();
  await page.locator(".layui-layer-btn1").last().click();
});
