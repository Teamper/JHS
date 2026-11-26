import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { mkdir, writeFile, readFile, cp } from "node:fs/promises";
import { isolatedDav } from "../harness/sync-dav.js";

const channel = process.argv.includes("--chrome") ? "chrome" : process.env.JHS_BROWSER_CHANNEL || "msedge";
const output = resolve(`output/extension-smoke/${channel}`);
const extensionPath = resolve(output, "extension");
await mkdir(output, { recursive: true });
await cp(resolve("dist/extension/dev"), extensionPath, { recursive: true });
const manifest = JSON.parse(await readFile(resolve(extensionPath, "manifest.json"), "utf8"));
manifest.host_permissions.push("http://127.0.0.1/*", "http://localhost/*");
await writeFile(resolve(extensionPath, "manifest.json"), JSON.stringify(manifest));
const server = createServer((request, response) => {
    if (request.url === "/redirect") { response.writeHead(302, { Location: "/bytes" }); response.end(); return; }
    if (request.url === "/headers") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(request.headers)); return; }
    if (request.url === "/large") { response.end("x".repeat(4096)); return; }
    if (request.url === "/missing") { response.writeHead(404, { "Content-Type": "text/html" }); response.end("<h1>missing</h1>"); return; }
    response.end(Buffer.from([0, 1, 2, 255]));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const dav = await isolatedDav();
const profile = resolve(output, `profile-${Date.now()}`);
const browserOptions = {
    channel, headless: true, timeout: 20000,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--enable-unsafe-extension-debugging"],
    viewport: { width: 1440, height: 950 },
};
console.log("Launching installed browser");
const context = await chromium.launchPersistentContext(profile, browserOptions);
try {
    const page = context.pages()[0];
    const session = await context.browser().newBrowserCDPSession();
    console.log("Loading extension");
    const loaded = await session.send("Extensions.loadUnpacked", { path: extensionPath });
    const id = loaded.id;
    console.log(JSON.stringify(await session.send("Extensions.getExtensions")));
    const errors = [];
    context.on("page", tab => tab.on("pageerror", error => errors.push(error.message)));
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`chrome-extension://${id}/manager.html`);
    await page.waitForFunction(() => !!globalThis.__jhsExtensionContext || !!document.querySelector("#jhs-bootstrap-error"), { timeout: 30000 });
    assert.equal(await page.evaluate(() => !!globalThis.__jhsExtensionContext), true, "manager initialized");
    const call = (method, args = []) => page.evaluate(async ({ method, args }) => {
        const response = await chrome.runtime.sendMessage({ channel: "jhs-extension-v1", target: "background", id: crypto.randomUUID(), method, args });
        if (!response.ok) throw Object.assign(new Error(response.error.message), response.error);
        return response.value;
    }, { method, args });
    await Promise.all([call("state.patch", [["ABC-123"], { favorite: true }]), call("state.patch", [["DEF-456"], { downloaded: true }])]);
    assert.equal((await call("state.getCarList")).length, 2, "concurrent mutations preserved");
    await page.evaluate(() => globalThis.__jhsExtensionContext.services.settings.patch({ themeMode: "dark", enableCheckNewVideo: "no", enableCheckBlacklist: "no", enableCheckFavoriteActress: "no" }));
    assert.equal((await call("settings.read")).themeMode, "dark");
    await assert.rejects(call("settings.commit", [{ themeMode: { before: "light", exists: true, value: "auto" } }]), /其他页面修改/);
    await call("credential.set", ["jhs_extension_fixture_credential", "fixture-secret"]);
    assert.equal(await call("credential.get", ["jhs_extension_fixture_credential"]), "fixture-secret");
    await page.evaluate(async () => {
        const { keywordRules } = globalThis.__jhsExtensionContext.services;
        await keywordRules.saveTitleKeywords(["fixture title"]);
        await keywordRules.addReviewKeyword("fixture review");
    });
    assert.deepEqual(await call("keywords.getTitleKeywords"), ["fixture title"]);
    assert.deepEqual(await call("keywords.getReviewKeywords"), ["fixture review"]);
    const backup = await call("backup.exportData");
    assert.deepEqual(backup.filter_keyword_title, ["fixture title"]);
    assert.deepEqual(backup.filter_keyword_review, ["fixture review"]);
    assert.ok(!JSON.stringify(backup).includes("fixture-secret"), "portable backup excludes credentials");
    await assert.rejects(call("backup.importData", [{ ...backup, data_version: 999999 }]), /版本/);
    assert.equal((await call("state.getCarList")).length, 2, "future import preserved existing data");
    await call("backup.createSnapshot", ["fixture migration", "import"]);
    await call("backup.importData", [backup]);
    await call("receipts.restore", ["jhs_offline_receipt_v1:fixture", null]);
    await call("receipts.write", ["jhs_offline_receipt_v1:fixture", "pending", { attemptId: "one" }, null]);
    await assert.rejects(call("receipts.write", ["jhs_offline_receipt_v1:fixture", "pending", { attemptId: "two" }, null]), /其他页面/);
    const request = (path, options = {}) => call("http.request", [{ url: `${origin}${path}`, urlPolicy: { trustClass: "user-local", expectedOrigin: origin }, ...options }]);
    assert.deepEqual((await request("/bytes", { responseType: "arraybuffer" })).response.value, [0, 1, 2, 255]);
    const redirect = await request("/redirect", { redirect: "manual" });
    assert.equal(redirect.status, 302);
    assert.match(redirect.responseHeaders, /location: \/bytes/i);
    assert.equal((await request("/redirect")).status, 200);
    assert.equal((await request("/missing", { responseType: "json" })).status, 404, "non-JSON error response preserves HTTP status");
    await assert.rejects(request("/large", { maxResponseBytes: 64 }), /大小上限/);
    const headers = JSON.parse((await request("/headers", { headers: { Referer: "https://yun.123pan.com/", Origin: "https://yun.123pan.com" } })).responseText);
    assert.equal(headers.referer, "https://yun.123pan.com/");
    assert.equal(headers.origin, "https://yun.123pan.com");
    await page.evaluate(async url => {
        const services = globalThis.__jhsExtensionContext.services;
        await services.settings.set("trustedLocalOrigins", [new URL(url).origin]);
        await services.webdav.saveProfile({ url, username: "synthetic", password: "synthetic-password" });
    }, dav.url);
    await call("sync.check");
    await expect.poll(async () => (await call("sync.getStatus")).lastSuccessAt, { message: "isolated DAV sync completed", timeout: 10_000 }).toBeGreaterThan(0);
    assert.ok(dav.files.size > 0, "DAV received encrypted replica snapshot");
    await call("sync.pause", [true]);
    await page.reload();
    await page.waitForFunction(() => !!globalThis.__jhsExtensionContext);
    await page.getByRole("button", { name: "打开鉴定记录", exact: true }).click();
    await page.waitForSelector(".jhs-ext-inline-dialog[data-jhs-inline-title='鉴定记录']", { timeout: 10000 });
    assert.equal(await page.locator("body > .layui-layer").count(), 0, "history mounts inline without floating layui-layer");
    assert.ok(!(await page.locator("#status").innerText()), "history command completed");
    await page.reload();
    await page.waitForFunction(() => !!globalThis.__jhsExtensionContext);
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.waitForSelector(".jhs-ext-inline-dialog[data-jhs-inline-title='设置']", { timeout: 10000 });
    await page.waitForTimeout(300);
    assert.equal(await page.locator("body > .layui-layer").count(), 0, "settings mounts inline without floating layui-layer");
    assert.ok(!(await page.locator("#status").innerText()), "settings command completed");
    await page.screenshot({ path: resolve(output, "manager-settings.png"), fullPage: true });
    await page.reload();
    await page.waitForFunction(() => !!globalThis.__jhsExtensionContext);
    await page.evaluate(() => chrome.offscreen.closeDocument());
    assert.equal((await call("state.getCarList")).length, 2, "offscreen restart preserved data");
    assert.equal((await call("receipts.read", ["jhs_offline_receipt_v1:fixture", 86400000])).state, "pending", "unknown submission remains pending after restart");
    assert.equal(await call("credential.get", ["jhs_extension_fixture_credential"]), "fixture-secret", "offscreen restart preserved credential");
    const cloud = await call("tasks.offline", [true]);
    assert.equal(cloud.one115.enabled, false);
    assert.equal(cloud.pan123.needsLogin, true);
    assert.equal(cloud.pan123.reason, "请登录 123 云盘");
    const workerSession = await context.newCDPSession(page);
    await workerSession.send("ServiceWorker.enable");
    await workerSession.send("ServiceWorker.stopAllWorkers");
    assert.equal((await call("state.getCarList")).length, 2, "service worker restart preserved data");
    await page.reload();
    await page.waitForFunction(() => !!globalThis.__jhsExtensionContext);
    for (const name of ["新作", "演员与黑名单", "后台任务", "数据统计"]) {
        await page.getByRole("button", { name, exact: true }).click();
        if (name === "新作") {
            await page.waitForSelector(".jhs-ext-inline-dialog .newVideoToolBox", { timeout: 10000 });
            assert.equal(await page.locator("body > .layui-layer").count(), 0, "new-video mounts inline without floating layui-layer");
            await page.locator("#checkNewVideo").click();
            await page.waitForFunction(async () => {
                const result = await chrome.runtime.sendMessage({ channel: "jhs-extension-v1", target: "background", id: crypto.randomUUID(), method: "scan.snapshot", args: [] });
                return !!result.value?.states?.newVideo?.completedAt;
            });
        }
        await page.waitForTimeout(200);
        assert.equal(await page.locator("#status").innerText(), "", `${name} command completed`);
        await page.reload();
        await page.waitForFunction(() => !!globalThis.__jhsExtensionContext);
    }
    await page.getByLabel("番号直达").fill("ABC-123");
    await page.getByRole("button", { name: "直达详情", exact: true }).click();
    await page.waitForSelector(".jhs-ext-drawer", { timeout: 10000 });
    assert.equal(await page.locator(".jhs-ext-drawer__code").innerText(), "ABC-123", "movie detail drawer opened");
    await page.screenshot({ path: resolve(output, "manager-drawer.png"), fullPage: true });
    await page.locator(".jhs-ext-drawer").getByRole("button", { name: "关闭", exact: true }).click();
    await page.emulateMedia({ colorScheme: "light" });
    await page.evaluate(() => globalThis.__jhsExtensionContext.services.settings.set("themeMode", "light"));
    await page.waitForTimeout(250);
    await page.screenshot({ path: resolve(output, "manager-light.png"), fullPage: true });
    await page.evaluate(() => globalThis.__jhsExtensionContext.services.settings.set("themeMode", "dark"));
    await page.waitForTimeout(250);
    for (const [host, fixture] of [["javdb.com", "javdb-detail.html"], ["www.javbus.com", "javbus-detail.html"]]) {
        const tab = await context.newPage();
        await tab.route(`https://${host}/**`, async route => route.fulfill({ contentType: "text/html", body: await readFile(resolve(`tests/browser/fixtures/${fixture}`), "utf8") }));
        await tab.goto(`https://${host}/v/fixture`);
        await tab.waitForFunction(() => document.documentElement.getAttribute("data-jhs-extension-ready") === "true", null, { timeout: 20000 });
        await tab.screenshot({ path: resolve(output, `${host}.png`), fullPage: true });
        if (host === "javdb.com") {
            await tab.evaluate(() => {
                const frame = document.createElement("iframe");
                frame.src = "/v/child-fixture";
                document.body.append(frame);
            });
            const child = await tab.waitForEvent("framenavigated", frame => frame.url().endsWith("/v/child-fixture"));
            await child.waitForFunction(() => document.documentElement.getAttribute("data-jhs-extension-ready") === "true");
        }
        await tab.close();
    }
    await page.screenshot({ path: resolve(output, "manager.png"), fullPage: true });
    const panel = await context.newPage();
    await panel.setViewportSize({ width: 380, height: 850 });
    await panel.goto(`chrome-extension://${id}/sidepanel.html`);
    await panel.waitForFunction(() => !!globalThis.__jhsExtensionContext);
    const movieTab = await context.newPage();
    await movieTab.route("https://javdb.com/**", async route => route.fulfill({ contentType: "text/html", body: await readFile(resolve("tests/browser/fixtures/javdb-detail.html"), "utf8") }));
    await movieTab.goto("https://javdb.com/v/panel-fixture");
    await movieTab.waitForFunction(() => document.documentElement.hasAttribute("data-jhs-extension-ready"));
    await movieTab.bringToFront();
    await panel.waitForFunction(() => document.querySelector("h1")?.textContent === "ABC-123");
    assert.equal(await panel.getByRole("button", { name: "收藏", exact: true }).getAttribute("aria-pressed"), "true", "side panel reads current movie state");
    await panel.getByRole("button", { name: "收藏", exact: true }).evaluate(node => node.click());
    await panel.waitForFunction(() => [...document.querySelectorAll("button")].find(node => node.textContent === "收藏")?.getAttribute("aria-pressed") === "false");
    assert.equal((await call("state.getState", ["ABC-123"])).stateFlags.favorite, false, "side panel updates shared state");
    await panel.screenshot({ path: resolve(output, "sidepanel-current.png"), fullPage: true });
    await movieTab.close();
    const listTab = await context.newPage();
    await listTab.route("https://javdb.com/**", async route => route.fulfill({ contentType: "text/html", body: await readFile(resolve("tests/browser/fixtures/javdb-list.html"), "utf8") }));
    await listTab.goto("https://javdb.com/list-fixture");
    await listTab.waitForFunction(() => document.documentElement.hasAttribute("data-jhs-extension-ready"));
    await listTab.bringToFront();
    await panel.getByRole("button", { name: "当前作品", exact: true }).evaluate(node => node.click());
    await panel.waitForFunction(() => document.querySelector("h1")?.textContent === "本页影片汇总");
    assert.equal(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "list side panel fits viewport");
    await panel.screenshot({ path: resolve(output, "sidepanel-list.png"), fullPage: true });
    await listTab.close();
    await panel.getByRole("button", { name: "任务", exact: true }).evaluate(node => node.click());
    await panel.waitForTimeout(200);
    assert.equal(await panel.locator("#status").innerText(), "");
    assert.equal(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "side panel fits viewport");
    await panel.screenshot({ path: resolve(output, "sidepanel.png"), fullPage: true });
    await panel.close();
    assert.deepEqual(errors, [], "extension pages have no uncaught errors");
    const text = await page.locator("body").innerText();
    const browserVersion = context.browser().version();
    await context.close();
    const restarted = await chromium.launchPersistentContext(profile, browserOptions);
    try {
        const restartSession = await restarted.browser().newBrowserCDPSession();
        const reloaded = await restartSession.send("Extensions.loadUnpacked", { path: extensionPath });
        assert.equal(reloaded.id, id, "development extension keeps its identity");
        const restartPage = restarted.pages()[0];
        await restartPage.goto(`chrome-extension://${id}/manager.html`);
        await restartPage.waitForFunction(() => !!globalThis.__jhsExtensionContext);
        const persisted = await restartPage.evaluate(async () => {
            const response = await chrome.runtime.sendMessage({ channel: "jhs-extension-v1", target: "background", id: crypto.randomUUID(), method: "state.getCarList", args: [] });
            const receipt = await chrome.runtime.sendMessage({ channel: "jhs-extension-v1", target: "background", id: crypto.randomUUID(), method: "receipts.read", args: ["jhs_offline_receipt_v1:fixture", 86400000] });
            return { records: response.value, receipt: receipt.value };
        });
        assert.equal(persisted.records.length, 2, "browser restart preserved extension identity and database");
        assert.equal(persisted.receipt.state, "pending", "browser restart preserves uncertain submission receipt");
    } finally { await restarted.close(); }
    const report = { id, channel, browserVersion, browserRestart: true, checkedAt: new Date().toISOString(), text, errors };
    await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
} finally { await context.close(); await dav.close(); await new Promise(resolve => server.close(resolve)); }
