import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { encryptPortableBackup } from "../../../src/core/credential-crypto.js";

for (const broken of [false, true]) {
  test(`WebDAV redirect ${broken ? "failure closes loading" : "decrypts into a read-only restore preview"}`, async ({ context, page }, info) => {
    test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop table and mobile card preview coverage");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page);
    const snapshot = await page.evaluate(() => window.storageManager.exportData());
    const encrypted = await encryptPortableBackup(JSON.stringify(snapshot));
    await page.evaluate(async ({ encrypted, broken }) => {
      const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin"), webdav = plugin.getRuntimeService("webdav");
      await webdav.settings.update(draft => { draft.webDavUrl = "https://dav.example.test/dav"; draft.webDavUsername = "fixture-user"; draft.trustedLocalOrigins = ["https://dav.example.test"]; });
      await webdav.saveProfile({ password: "fixture-password" });
      window.__previewProbe = { imports: 0, errors: [], diagnostics: [], downloads: [] };
      const logError = plugin.logger.error.bind(plugin.logger);
      plugin.logger.error = (...args) => { window.__previewProbe.diagnostics.push(args.map(value => value instanceof Error ? value.message : String(value)).join(" ")); logError(...args); };
      window.storageManager.importData = async () => { window.__previewProbe.imports++; throw new Error("Preview must not import"); };
      window.show.error = message => window.__previewProbe.errors.push(message);
      const original = webdav.http.port.requestImplementation;
      webdav.http.port.requestImplementation = options => {
        const origin = new URL(options.url).origin;
        if (!["https://dav.example.test", "https://cdn.example.test"].includes(origin)) return original(options);
        let response;
        if (options.method === "MKCOL") response = { status: 405, responseText: "" };
        else if (options.method === "PROPFIND") response = { status: 207, responseText: '<d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/JHS/</d:href><d:propstat><d:prop><d:getcontentlength>0</d:getcontentlength></d:prop></d:propstat></d:response><d:response><d:href>/dav/JHS/backup.json</d:href><d:propstat><d:prop><d:displayname>backup.json</d:displayname><d:getcontentlength>100</d:getcontentlength></d:prop></d:propstat></d:response></d:multistatus>' };
        else {
          window.__previewProbe.downloads.push({ origin, headers: Object.keys(options.headers), anonymous: options.anonymous, redirect: options.redirect });
          response = origin === "https://dav.example.test" ? { status: 301, responseHeaders: broken ? "" : "Location: https://cdn.example.test/backup" } : { status: 200, responseText: encrypted };
        }
        let aborted = false;
        queueMicrotask(() => { if (!aborted) options.onload({ finalUrl: options.url, ...response }); });
        return { abort() { aborted = true; options.onabort?.(); } };
      };
      plugin.openSettingDialog();
    }, { encrypted, broken });
    const settings = page.locator(".layui-layer").filter({ has: page.locator("#webdavBackupListBtn") });
    await expect(settings.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    await settings.locator('.side-menu-item[data-panel="data-panel"]').click();
    await settings.locator("#webdavBackupListBtn").click();
    const restore = info.project.name === "mobile" ? page.locator('.jhs-backup-btn[data-action="import"]') : page.locator(".backup-import");
    await restore.click();
    if (broken) {
      await expect.poll(() => page.evaluate(() => window.__previewProbe.errors.join(" "))).toContain("备份预览失败，请检查文件");
      await expect.poll(() => page.evaluate(() => window.__previewProbe.diagnostics.join(" "))).toContain("Location");
      expect(await page.evaluate(() => window.__previewProbe.errors.join(" "))).not.toContain("Location");
    }
    else {
      await expect(page.locator(".layui-layer .jhs-summary-grid")).toBeVisible();
      await expect(page.locator(".layui-layer .jhs-warning-note")).toContainText("导入将覆盖当前数据");
    }
    await expect(page.locator(".loading-container")).toHaveCount(0);
    const result = await page.evaluate(() => window.__previewProbe);
    expect(result.imports).toBe(0);
    expect(result.downloads).toHaveLength(broken ? 1 : 2);
    if (!broken) expect(result.downloads[1]).toEqual({ origin: "https://cdn.example.test", headers: ["Accept"], anonymous: true, redirect: "manual" });
  });
}

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
    await webdav.saveProfile({ password: "fixture-password" });
    window.__webdavRequests = [];
    const originalRequest = webdav.http.port.requestImplementation;
    webdav.http.port.requestImplementation = (options) => {
      if (new URL(options.url).origin !== "https://dav.example.test") return originalRequest(options);
      if (decodeURIComponent(new URL(options.url).pathname).split("/").includes("JHS-数据备份")) window.__webdavRequests.push({ method: options.method, timeoutMs: options.timeout, bytes: typeof options.data === "string" ? options.data.length : 0 });
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
  await dialog.locator('.side-menu-item[data-panel="data-panel"]').click();
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
  await settings.locator('.side-menu-item[data-panel="data-panel"]').click();
  await settings.locator("#webdavBackupListBtn").click();
  const deleteButton = testInfo.project.name === "mobile" ? page.locator(".jhs-backup-btn-danger") : page.locator(".backup-delete");
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();
  const confirmation = page.locator(".layui-layer-dialog-content");
  await expect(confirmation).toContainText(fileName);
  await expect(confirmation.locator("img,b")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dataset.webdavExecuted)).toBeUndefined();
  await page.locator(".layui-layer-btn").getByText("取消", { exact: true }).last().click();
});
