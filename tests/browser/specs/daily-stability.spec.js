import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { boot, seed } from "../harness/ui-root-scenes.js";
import { injectRealLayer } from "../harness/real-layer.js";

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

async function showSourceHealth(workspace) {
    const toggle = workspace.locator("#nvTaskToggle");
    await expect(toggle).toBeVisible();
    if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    const panel = workspace.getByRole("region", { name: "来源不可用的演员" });
    await expect(panel).toBeVisible();
    const details = panel.locator(".jhs-source-health-details");
    if (!await details.evaluate(node => node.open)) await details.locator("summary").click();
    return panel;
}

for (const theme of ["light", "dark"]) test(`actor source exceptions expose a safe manual retry ${theme}`, async ({ page, context }, info) => {
    await boot(page, context, theme);
    await page.evaluate(async () => {
            await window.__jhsBrowserDiagnostics.activateFeature("new-video");
        const plugin = window.__jhsBrowserDiagnostics.features.newVideo;
        const baseActors = await window.stateService.getFavoriteActressList();
        const extra = [
            { ...baseActors[0], starId: "unavail-2", name: "善場まみ" },
            { ...baseActors[0], starId: "unavail-3", name: "池内遥" },
        ];
        const allActors = [...baseActors, ...extra.filter(item => !baseActors.some(existing => existing.starId === item.starId))];
        window.stateService.getFavoriteActressList = async () => allActors;
        for (const actor of [allActors[0], ...extra]) {
            plugin.getRuntimeService("sourceHealth").unavailable("https://javdb.com", { starId: actor.starId, name: actor.name });
        }
        (await window.__jhsBrowserDiagnostics.executeCommand("scheduler.service")).checkOneNewVideo = async actress => plugin.getRuntimeService("sourceHealth").clear("https://javdb.com", actress.starId);
        plugin.openDialog();
    });
    const workspace = page.locator(".newVideoToolBox");
    const exceptions = await showSourceHealth(workspace);
    await expect(exceptions).toContainText("来源不可用：3 位演员");
    await expect(exceptions).toContainText("24 小时后自动重查");
    const retries = exceptions.getByRole("button", { name: /^重试 / });
    await expect(retries).toHaveCount(3);
    const listBox = await workspace.locator("#jhs-task-status-list").boundingBox();
    const panelBox = await exceptions.boundingBox();
    expect(panelBox.width).toBeGreaterThanOrEqual(listBox.width - 2);
    const firstRetry = retries.first();
    await firstRetry.scrollIntoViewIfNeeded(); await expect(firstRetry).toBeVisible(); await firstRetry.focus();
    await expect(firstRetry).toBeFocused();
    const box = await firstRetry.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(info.project.use.viewport.width);
    expect(box.width).toBeLessThanOrEqual(120);
    await page.screenshot({ path: info.outputPath(`actor-exceptions-${theme}.png`) });
    for (let remaining = 2; remaining >= 0; remaining--) {
        await retries.first().click();
        await expect(retries).toHaveCount(remaining);
    }
    await expect(exceptions).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.activeElement?.matches("#nvTaskToggle, .jhs-new-video-view [role='tab'][aria-selected='true']"))).toBe(true);
    await expect(page.locator(":focus")).toBeVisible();
});

test("a closed actor retry cannot move focus in a later workspace", async ({ page, context }, info) => {
    test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "dialog replacement lifecycle");
    await boot(page, context, "light");
    await page.evaluate(async () => {
            await window.__jhsBrowserDiagnostics.activateFeature("new-video");
        const plugin = window.__jhsBrowserDiagnostics.features.newVideo, actors = await window.stateService.getFavoriteActressList();
        plugin.getRuntimeService("sourceHealth").unavailable("https://javdb.com", actors[0]);
        const run = plugin.runManualTask.bind(plugin);
        plugin.runManualTask = async (...args) => { try { return await run(...args); } finally { window.actorRetryFinished = true; } };
        (await window.__jhsBrowserDiagnostics.executeCommand("scheduler.service")).checkOneNewVideo = () => new Promise(resolve => { window.releaseActorRetry = resolve; });
        plugin.openDialog();
    });
    const root = page.locator(".newVideoToolBox");
    await (await showSourceHealth(root)).getByRole("button", { name: /^重试 / }).click();
    await expect.poll(() => page.evaluate(() => typeof window.releaseActorRetry)).toBe("function");
    await page.locator(".layui-layer-close").click();
    await expect(root).toHaveCount(0);
    await page.evaluate(() => window.__jhsBrowserDiagnostics.executeCommand("new-video.open"));
    await root.locator("#nvViewList").click();
    await root.locator("#nvSearch").focus();
    await expect(root.locator("#nvSearch")).toBeFocused();
    await page.evaluate(() => window.releaseActorRetry());
    await expect.poll(() => page.evaluate(() => window.actorRetryFinished)).toBe(true);
    await expect(root.locator("#nvSearch")).toBeFocused();
});

test("unavailable actor source panel supports profile inspection, rebind search, and local removal", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "source health recovery workflow");
    await page.clock.setFixedTime(new Date("2026-10-04T08:00:00Z"));
    await fulfillHostFixtures(context);
    await context.route("https://javdb.com/page/**", route => route.fulfill({ contentType: "text/html", body: '<div class="movie-list"></div>' }));
    await context.route("https://images.example.test/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#63768c"/></svg>' }));
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, {
        hostStyles: true,
        realFeedback: true,
        settingOverrides: { themeMode: "light", enableCheckNewVideo: "yes", defaultQuickFilterTab: "all" },
        beforeUserscriptInjection: async currentPage => {
            await injectRealLayer(currentPage);
            await seed(currentPage);
            await currentPage.evaluate(async () => {
                const forage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
                const list = await forage.getItem("favorite_actresses") || [];
                list.push({ starId: "missing-actor", name: "已下架演员", allName: ["下架别名"], actressType: "censored", avatar: "https://images.example.test/ui-cover.svg", newVideoList: [{ carNum: "NV-888", title: "保留旧作", publishTime: "2026-10-05" }] });
                await forage.setItem("favorite_actresses", list);
                const original = window.GM_xmlhttpRequest;
                window.GM_xmlhttpRequest = options => {
                    const url = new URL(options.url);
                    if (url.hostname === "javdb.com" && url.pathname === "/search") {
                        const html = '<div id="actors"><div class="actor-box"><a title="测试演员, 新别名" href="/actors/merged-actor"><img src="https://images.example.test/ui-cover.svg"><span class="info">有碼</span></a></div></div>';
                        queueMicrotask(() => options.onload?.({ status: 200, finalUrl: options.url, responseText: html, responseHeaders: "content-type: text/html" }));
                        return { abort() {} };
                    }
                    if (url.hostname === "javdb.com" && url.pathname === "/actors/merged-actor") {
                        const html = '<div id="videos"><div class="item"><a class="box" href="/v/nv-999"><img src="https://images.example.test/ui-cover.svg"><div class="video-title"><strong>NV-999</strong> 合并后新作品</div><div class="meta">2026-10-08</div></a></div></div>';
                        queueMicrotask(() => options.onload?.({ status: 200, finalUrl: options.url, responseText: html, responseHeaders: "content-type: text/html" }));
                        return { abort() {} };
                    }
                    return original(options);
                };
            });
        },
    });
    await page.waitForFunction(() => Boolean(window.__jhsBrowserDiagnostics?.bootstrapPhases?.["first-ready"] && typeof window.__jhsBrowserDiagnostics.features.newVideo?.getRuntimeService === "function"));
    await page.evaluate(async () => {
            await window.__jhsBrowserDiagnostics.activateFeature("new-video");
        const plugin = window.__jhsBrowserDiagnostics.features.newVideo, actors = await window.stateService.getFavoriteActressList();
        const health = plugin.getRuntimeService("sourceHealth");
        health.unavailable("https://javdb.com", actors[0]);
        health.unavailable("https://javdb.com", actors[1]);
        plugin.openDialog();
    });
    const root = page.locator(".newVideoToolBox");
    await expect(root).toBeVisible();
    const healthPanel = await showSourceHealth(root);
    await expect(healthPanel).toContainText("来源不可用：2 位演员");
    await expect(healthPanel.locator('a[href="https://javdb.com/actors/ui-actor?t=d"]')).toBeVisible();
    await healthPanel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("source-health-actions.png") });

    await root.locator('[data-source-rebind="ui-actor"]').click();
    const rebindDialog = page.locator(".jhs-rebind-dialog");
    await expect(rebindDialog).toBeVisible();
    const chooseBtn = rebindDialog.locator('[data-candidate-id="merged-actor"]');
    await expect(chooseBtn).toBeVisible();
    await page.screenshot({ path: info.outputPath("actor-rebind-dialog.png") });
    await chooseBtn.click();
    await expect(rebindDialog).toHaveCount(0);
    await expect(healthPanel).toContainText("来源不可用：1 位演员");

    await root.locator('[data-source-remove="missing-actor"]').click();
    await page.getByRole("button", { name: "移除记录" }).click();
    await expect(healthPanel).toHaveCount(0);
    const saved = await page.evaluate(() => window.stateService.getFavoriteActressList());
    expect(saved.map(a => a.starId)).toEqual(["merged-actor"]);
});
