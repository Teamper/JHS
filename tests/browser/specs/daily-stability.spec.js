import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { boot } from "../harness/ui-root-scenes.js";

for (const theme of ["light", "dark"]) test(`ordinary detail screenshot policy responds to live settings ${theme}`, async ({ page, context }, info) => {
    await fulfillHostFixtures(context);
    const html = await readFile(new URL("../fixtures/javdb-detail-native-media.html", import.meta.url), "utf8");
    await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body: html }));
    await context.route("https://images.example.test/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#63768c"/></svg>' }));
    await page.goto("https://javdb.com/v/test-id");
    await injectUserscriptRuntime(page, { hostStyles: true, settingOverrides: { themeMode: theme, screenshotMode: "manual", enableLoadScreenShot: "yes", enableLoadReview: "no", enableLoadRelatedList: "no" }, beforeUserscriptInjection: async page => page.evaluate(() => {
        const original = GM_xmlhttpRequest;
        window.screenshotPolicyCalls = 0; window.screenshotPolicyAborts = 0;
        window.GM_xmlhttpRequest = options => {
            if (new URL(options.url).hostname !== "javstore.net") return original(options);
            window.screenshotPolicyCalls++;
            return { abort() { window.screenshotPolicyAborts++; options.onabort?.(); } };
        };
    }) });
    const panel = page.locator(".screen-container");
    await expect(panel.getByRole("tab", { name: "JavStore", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.screenshotPolicyCalls)).toBe(0);
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`screenshot-manual-${theme}.png`) });
    await panel.getByRole("tab", { name: "JavStore", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => window.screenshotPolicyCalls)).toBe(1);
    await page.evaluate(() => window.settingsService.patch({ screenshotProviders: JSON.stringify([{ id: "javstore", enabled: false }]) }));
    await expect(panel).toContainText("暂无可用截图来源");
    await expect.poll(() => page.evaluate(() => window.screenshotPolicyAborts)).toBe(1);
    await page.evaluate(() => window.settingsService.patch({ enableLoadScreenShot: "no" }));
    await expect(panel).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`screenshot-policy-${theme}.png`) });
});

for (const theme of ["light", "dark"]) test(`actor source exceptions expose a safe manual retry ${theme}`, async ({ page, context }, info) => {
    await boot(page, context, theme);
    await page.evaluate(async () => {
        const plugin = window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
        const actors = await window.storageManager.getFavoriteActressList();
        plugin.getRuntimeService("sourceHealth").unavailable("https://javdb.com", { starId: actors[0].starId, name: actors[0].name });
        window.unsafeWindow.pluginManager.getBean("TaskPlugin").checkOneNewVideo = async actress => plugin.getRuntimeService("sourceHealth").clear("https://javdb.com", actress.starId);
        plugin.openDialog();
    });
    const workspace = page.locator(".newVideoToolBox");
    if (await workspace.locator("#nvTaskToggle").isVisible()) await workspace.locator("#nvTaskToggle").click();
    const exceptions = workspace.getByRole("region", { name: "来源不可用的演员" });
    await expect(exceptions).toContainText("24 小时后自动重查");
    const retry = exceptions.getByRole("button", { name: /^重试 / });
    await retry.scrollIntoViewIfNeeded(); await expect(retry).toBeVisible(); await retry.focus();
    await expect(retry).toBeFocused();
    const box = await retry.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(info.project.use.viewport.width);
    await page.screenshot({ path: info.outputPath(`actor-exceptions-${theme}.png`) });
    await retry.click();
    await expect(exceptions).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.activeElement?.matches("#nvTaskToggle, .jhs-new-video-view [role='tab'][aria-selected='true']"))).toBe(true);
    await expect(page.locator(":focus")).toBeVisible();
});

test("a closed actor retry cannot move focus in a later workspace", async ({ page, context }, info) => {
    test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "dialog replacement lifecycle");
    await boot(page, context, "light");
    await page.evaluate(async () => {
        const plugin = window.unsafeWindow.pluginManager.getBean("NewVideoPlugin"), actors = await window.storageManager.getFavoriteActressList();
        plugin.getRuntimeService("sourceHealth").unavailable("https://javdb.com", actors[0]);
        const run = plugin.runManualTask.bind(plugin);
        plugin.runManualTask = async (...args) => { try { return await run(...args); } finally { window.actorRetryFinished = true; } };
        window.unsafeWindow.pluginManager.getBean("TaskPlugin").checkOneNewVideo = () => new Promise(resolve => { window.releaseActorRetry = resolve; });
        plugin.openDialog();
    });
    const root = page.locator(".newVideoToolBox");
    if (await root.locator("#nvTaskToggle").isVisible()) await root.locator("#nvTaskToggle").click();
    await root.getByRole("button", { name: /^重试 / }).click();
    await expect.poll(() => page.evaluate(() => typeof window.releaseActorRetry)).toBe("function");
    await page.locator(".layui-layer-close").click();
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("NewVideoPlugin").openDialog());
    await root.locator("#nvViewList").click();
    await root.locator("#nvSearch").focus();
    await expect(root.locator("#nvSearch")).toBeFocused();
    await page.evaluate(() => window.releaseActorRetry());
    await expect.poll(() => page.evaluate(() => window.actorRetryFinished)).toBe(true);
    await expect(root.locator("#nvSearch")).toBeFocused();
});
