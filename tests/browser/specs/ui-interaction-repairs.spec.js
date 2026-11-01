import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

test.beforeEach(({}, info) => test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and touch owners"));
async function boot(page, context, { detail = false, actor = false, keywords = false } = {}) {
    await fulfillHostFixtures(context);
    if (detail) {
        const body = await readFile(new URL("../fixtures/javdb-detail-interactions.html", import.meta.url), "utf8");
        await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body }));
    }
    if (actor) {
        const body = (await readFile(new URL("../fixtures/javdb-list.html", import.meta.url), "utf8")).replace('<nav class="main-tabs"></nav>', '<nav class="main-tabs"></nav><div class="toolbar"></div><div class="actor-section-name">Fixture Actor</div>');
        await context.route("https://javdb.com/actors/**", route => route.fulfill({ contentType: "text/html", body }));
    }
    await page.goto(detail ? "https://javdb.com/v/test-id" : actor ? "https://javdb.com/actors/fixture" : "https://javdb.com/");
    await injectUserscriptRuntime(page, { hostStyles: true, realFeedback: true, beforeUserscriptInjection: async page => {
        await injectRealLayer(page);
        if (keywords) await page.evaluate(async () => {
            const f = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
            await f.setItem("filter_keyword_title", ["Fixture"]);
        });
    }, settingOverrides: { defaultQuickFilterTab: "all", needClosePage: "no", enableLoadReview: "no", enableLoadPreviewVideo: "no", enableClog: "yes" } });
    await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
}
const settings = (page, key, value) => page.evaluate(({ key, value }) => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set(key, value), { key, value });

for (const theme of ["light", "dark"]) test(`state selection stays clear without decorative checks ${theme}`, async ({ page, context }) => {
    await boot(page, context, { detail: true }); await settings(page, "themeMode", theme); await page.waitForTimeout(180);
    const button = page.locator("#favoriteBtn");
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button.locator('[data-jhs-icon="circle-check"]')).toHaveCount(0);
    await expect(page.locator("#hasDownBtn")).toHaveText("已下载");
    await expect(page.locator("#hasWatchBtn")).toHaveText("已观看");
    const before = await button.boundingBox();
    await button.focus(); await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toHaveCSS("border-top-style", "solid");
    await button.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
    const background = await button.evaluate(node => getComputedStyle(node).backgroundColor);
    await button.hover(); await expect(button).toHaveCSS("background-color", background);
    expect((await button.boundingBox()).width).toBe(before.width);
    await settings(page, "mobileMode", "on"); await page.locator("#jhs-fab").click();
    const favorite = page.locator('#jhs-fab-menu [data-action="fav"]');
    await expect(favorite).toHaveAttribute("aria-pressed", "true");
    await expect(favorite.locator('[data-jhs-icon="circle-check"]')).toHaveCount(0);
    await page.keyboard.press("Escape"); await page.locator("#jhs-fab").click();
    await expect(favorite).toHaveAttribute("aria-pressed", "true");
});

test("compact actions and long progress keep the FAB and submenu reachable", async ({ page, context }) => {
    await boot(page, context, { actor: true }); await settings(page, "mobileMode", "on");
    await page.locator("#jhs-fab").click(); await expect(page.locator('[data-action="batch"]')).toBeVisible();
    await expect(page.locator('[data-page-action="blacklist-add"]')).toBeVisible();
    await page.locator('[data-action="batch"]').click();
    await expect(page.locator('.jhs-mobile-batch-menu [data-page-action="batch-block"]')).toBeVisible();
    await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
    await page.evaluate(() => {
        const list = window.unsafeWindow.pluginManager.getBean("ListPagePlugin");
        const p = list.listBatchController.ui.beginProgress({ cancelRequested: false });
        list.listBatchController.ui.setProgress(p, "正在处理较长的批量进度：匹配 200 项，已更新 100 项，已跳过番号不可靠的影片");
    });
    for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport); await page.waitForTimeout(100);
        const fab = page.locator("#jhs-fab"), progress = page.locator("#jhs-batch-progress");
        const a = await fab.boundingBox(), b = await progress.boundingBox(); expect(b.y + b.height).toBeLessThanOrEqual(a.y);
        await fab.click(); await page.locator('[data-action="batch"]').click();
        const menu = await page.locator(".jhs-fab-menu").boundingBox(); expect(menu.y + menu.height).toBeLessThanOrEqual(b.y);
        await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
    }
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin").listBatchController.ui.dispose());
    expect(await page.locator("html").evaluate(node => node.style.getPropertyValue("--jhs-batch-clearance"))).toBe("");
    await page.locator("#jhs-fab").click(); await page.locator('[data-action="logger"]').click(); await expect(page.locator(".console-logger-window")).toBeVisible();
});

test("rule reasons are a touch and keyboard action outside the host link", async ({ page, context }) => {
    await boot(page, context, { keywords: true }); const trigger = page.getByRole("button", { name: "ABC-123 的屏蔽原因" });
    await expect(trigger).toBeVisible(); expect(await trigger.evaluate(node => !!node.closest("a"))).toBe(false);
    const url = page.url(); await trigger.click(); const popover = page.getByRole("dialog", { name: "ABC-123 的屏蔽原因" });
    await expect(popover).toContainText("关键词屏蔽：Fixture"); expect(page.url()).toBe(url);
    await page.keyboard.press("Escape"); await expect(popover).toHaveCount(0); await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter"); await expect(popover).toBeVisible();
    await trigger.evaluate(node => node.closest(".item").remove()); await expect(popover).toHaveCount(0);
});

test("manual settings revert and close confirmation preserve drafts", async ({ page, context }) => {
    await boot(page, context); await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("browse-panel"));
    const dialog = page.locator(".layui-layer").filter({ has: page.locator("#saveBtn") }); await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    const field = dialog.locator("#waitCheckCount"); await field.scrollIntoViewIfNeeded(); const original = await field.inputValue();
    await field.fill(String(Number(original) + 1)); await expect(dialog.locator("#settings-draft-status")).toContainText("1 项未保存");
    await field.fill(original); await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-dirty-count", "0");
    await field.fill(String(Number(original) + 2)); await page.keyboard.press("Escape");
    const confirm = page.locator(".layui-layer-dialog").filter({ hasText: "放弃修改？" }); await expect(confirm).toBeVisible();
    await confirm.getByText("继续编辑", { exact: true }).click(); await expect(confirm).toHaveCount(0); await expect(field).toHaveValue(String(Number(original) + 2));
    await dialog.locator(".layui-layer-close").click(); await expect(confirm).toBeVisible();
    await confirm.getByText("放弃修改", { exact: true }).click(); await expect(dialog).toHaveCount(0);
});
