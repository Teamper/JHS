import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

const keys = { blocked: { code: "KeyB" }, favorite: { code: "KeyF" }, downloaded: { code: "KeyD" }, watched: { code: "KeyW" } };
const defaults = { needClosePage: "no", enableLoadReview: "no", enableLoadRelatedList: "no", enableLoadOtherSite: "no", enableLoadScreenShot: "no", enableLoadPreviewVideo: "no", enableClog: "no" };
async function boot(page, context, url = "https://javdb.com/v/test-id", options = {}) {
    await fulfillHostFixtures(context);
    const body = await readFile(new URL("../fixtures/javdb-detail-interactions.html", import.meta.url), "utf8");
    await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body }));
    await page.goto(url);
    await injectUserscriptRuntime(page, { hostStyles: true, realFeedback: true, beforeUserscriptInjection: injectRealLayer, ...options, settingOverrides: { ...defaults, detailShortcuts: keys, ...options.settingOverrides } });
    await page.waitForFunction(() => !!window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
}
async function openFc2(page, carNum = "FC2-100") {
    await page.evaluate(carNum => window.unsafeWindow.pluginManager.getBean("Fc2Plugin").openFc2Dialog("fixture-id", carNum, "/v/fixture-id", { source: "fc2" }), carNum);
    const dialog = page.locator(".layui-layer").filter({ has: page.locator(".jhs-fc2-workspace") }).last();
    await expect(dialog.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "false");
    return page.locator(`[id="${await dialog.getAttribute("id")}"]`);
}
async function settings(page, panel = "shortcut-panel") {
    await page.evaluate(panel => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog(panel), panel);
    const dialog = page.locator(".layui-layer").filter({ has: page.locator("#saveBtn") });
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    return dialog;
}

test.describe("详情鉴定快捷键", () => {
    test.beforeEach(async ({}, info) => { test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "桌面及窄屏覆盖键盘与详情作用域"); });

    for (const url of ["https://javdb.com/v/test-id", "https://www.javbus.com/ABC-123", "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-100&url=%2Fv%2Ffixture-id&source=fc2"]) {
        test(`普通及 FC2 页面复用四状态操作 ${url}`, async ({ page, context }) => {
            await boot(page, context, url);
            for (const [key, id] of [["f", "favoriteBtn"], ["d", "hasDownBtn"], ["w", "hasWatchBtn"]]) {
                await expect(page.locator(`#${id}`)).toHaveAttribute("aria-pressed", "false");
                await page.keyboard.press(key);
                await expect(page.locator(`#${id}`)).toHaveAttribute("aria-pressed", "true");
            }
            await page.keyboard.press("b");
            const confirmation = page.locator(".layui-layer-dialog").filter({ hasText: "屏蔽「" });
            await expect(confirmation).toBeVisible();
            await page.keyboard.press("f");
            await expect(page.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "true");
            await confirmation.getByText("屏蔽", { exact: true }).click();
            await expect(page.locator("#filterBtn")).toHaveAttribute("aria-pressed", "true");
        });
    }

    test("默认留空；录制、冲突、退出、清除及独立停用入口", async ({ page, context }) => {
        await boot(page, context, undefined, { settingOverrides: { detailShortcuts: {} } });
        await expect(page.locator("#favoriteBtn kbd")).toHaveCount(0);
        const dialog = await settings(page);
        const input = dialog.locator('[data-shortcut-action="favorite"]');
        await input.focus(); await page.keyboard.press("Alt+f");
        await expect(input).toHaveValue("Alt+F");
        const blocked = dialog.locator('[data-shortcut-action="blocked"]');
        await blocked.focus(); await page.keyboard.press("Alt+f");
        await expect(dialog.locator('[data-shortcut-status="blocked"]')).toContainText("已被");
        await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
        await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
        await expect(page.locator("#favoriteBtn kbd")).toHaveText("Alt+F");
        await page.keyboard.press("Alt+f"); await expect(page.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "true");
        const reopened = await settings(page);
        await reopened.locator('[data-shortcut-clear="favorite"]').click();
        await expect(reopened.locator('[data-shortcut-action="favorite"]')).toHaveValue("");
        await reopened.locator('[data-shortcut-manage]').click();
        await reopened.locator('.pm-toggle[data-plugin="DetailShortcutPlugin"]').uncheck();
        await reopened.locator('[data-panel="browse-panel"]').click();
        await expect(reopened.locator('[data-shortcut-disabled]')).toBeVisible();
        await expect(reopened.locator('[data-shortcut-action="favorite"]')).toBeDisabled();
    });

    test("JavBus 视频预览和输入不会消费空格鉴定键", async ({ page, context }) => {
        await boot(page, context, "https://www.javbus.com/ABC-123", { settingOverrides: { enableLoadPreviewVideo: "yes", detailShortcuts: { favorite: { code: "Space" } } } });
        await page.evaluate(() => {
            document.querySelector("#sample-waterfall").style.display = "";
            localStorage.setItem("jhs_dmm_video", JSON.stringify({ "ABC-123": { hhb: "https://example.test/fixture.mp4", time: Date.now() } }));
            HTMLMediaElement.prototype.play = async function () {};
            HTMLMediaElement.prototype.pause = function () {};
        });
        await page.locator(".preview-video-container").click();
        await expect(page.locator("#bus-preview-modal")).toBeVisible();
        await page.locator("#bus-preview-modal video").focus();
        await page.keyboard.press("Space");
        await expect(page.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "false");
        await page.keyboard.press("Escape");
        await expect(page.locator("#bus-preview-modal")).toHaveCount(0);
        await page.evaluate(() => { document.activeElement.blur(); });
        await page.keyboard.press("Space");
        await expect(page.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "true");
    });

    test("FC2 多层详情只鉴定顶层，关闭重开及设置遮罩不残留监听", async ({ page, context }) => {
        await boot(page, context, "https://javdb.com/");
        await page.keyboard.press("f");
        const lower = await openFc2(page), upper = await openFc2(page, "FC2-200");
        await page.keyboard.press("f");
        await expect(upper.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "true");
        await expect(lower.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "false");
        const config = await settings(page);
        await page.keyboard.press("w");
        await expect(upper.locator("#hasWatchBtn")).toHaveAttribute("aria-pressed", "false");
        await config.locator(".layui-layer-close").click();
        await expect(config).toHaveCount(0);
        await upper.locator(".layui-layer-close").click();
        await expect(upper).toHaveCount(0);
        await page.keyboard.press("f");
        await expect(lower.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "true");
        await lower.locator(".layui-layer-close").click();
        await expect(lower).toHaveCount(0);
        const reopened = await openFc2(page, "FC2-300");
        await page.keyboard.press("f");
        await expect(reopened.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "true");
    });

    test("独立关闭后普通及列表上的 FC2 均不挂载快捷键", async ({ page, context }) => {
        await boot(page, context, undefined, { disabledPlugins: ["detail.shortcuts"] });
        await page.keyboard.press("f");
        await expect(page.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "false");
        await expect(page.locator("#favoriteBtn kbd")).toHaveCount(0);
        await boot(page, context, "https://javdb.com/", { disabledPlugins: ["detail.shortcuts"] });
        const dialog = await openFc2(page);
        await page.keyboard.press("f");
        await expect(dialog.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "false");
        await expect(dialog.locator("kbd")).toHaveCount(0);
    });

    test("FC2 图片 Viewer 优先消费键盘，关闭后恢复详情鉴定", async ({ page, context }) => {
        await boot(page, context, "https://javdb.com/");
        await context.route("https://images.example.test/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="#63768c"/></svg>' }));
        await page.evaluate(() => {
            const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin"), get = fc2.getRuntimeService.bind(fc2);
            fc2.fetchAndRenderNativeMagnets = async () => {};
            fc2.configureJavDbWantButton = async () => {};
            fc2.getRuntimeService = name => name === "movie" ? new Proxy(get(name), { get(target, key) { return key === "detail" ? async () => ({ title: "Gallery fixture", carNum: "FC2-100", imageUrls: ["https://images.example.test/1.svg"] }) : target[key]; } }) : get(name);
        });
        const dialog = await openFc2(page);
        await dialog.getByRole("button", { name: "查看剧照 1", exact: true }).click();
        await expect(page.locator(".viewer-container.viewer-in")).toBeVisible();
        await page.keyboard.press("f");
        await expect(dialog.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "false");
        await page.keyboard.press("Escape");
        await expect(page.locator(".viewer-container")).toHaveCount(0);
        await page.keyboard.press("f");
        await expect(dialog.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "true");
    });

    test("普通详情 iframe 自动聚焦一次并保留精确自动关页", async ({ page, context }) => {
        await boot(page, context, "https://javdb.com/");
        const navigation = page.waitForEvent("framenavigated", { predicate: frame => frame.url().includes("/v/test-id") });
        await page.evaluate(() => window.utils.openPage("https://javdb.com/v/test-id", "ABC-123"));
        const frame = await navigation;
        await frame.waitForLoadState("domcontentloaded");
        await injectUserscriptRuntime(frame, { hostStyles: true, realFeedback: true, beforeUserscriptInjection: injectRealLayer, settingOverrides: { ...defaults, needClosePage: "yes", detailShortcuts: keys } });
        await expect(page.locator(".layui-layer iframe")).toBeFocused();
        await page.keyboard.press("f");
        await expect(page.locator(".layui-layer iframe")).toHaveCount(0);
    });

    for (const theme of ["light", "dark"]) test(`鉴定快捷键布局 ${theme}`, async ({ page, context }, info) => {
        test.skip(process.env.JHS_VISUAL_REGRESSION !== "1", "独立视觉门禁实际审图");
        await page.clock.setFixedTime(new Date("2026-10-17T08:00:00Z"));
        await boot(page, context, undefined, { settingOverrides: { themeMode: theme, detailShortcuts: { favorite: { code: "KeyF", ctrl: true, alt: true, shift: true, meta: true } } } });
        const dialog = await settings(page);
        const section = dialog.locator("#detail-shortcut-settings");
        await expect(section.locator(".jhs-shortcut-fields").first()).toHaveCSS("display", "grid");
        await section.scrollIntoViewIfNeeded();
        for (const action of ["blocked", "favorite", "downloaded", "watched"]) {
            const input = section.locator(`[data-shortcut-action="${action}"]`);
            await input.scrollIntoViewIfNeeded();
            await expect(input).toBeInViewport();
        }
        await section.locator('[data-shortcut-action="favorite"]').focus();
        await dialog.screenshot({ path: info.outputPath(`detail-shortcuts-${theme}.png`), animations: "disabled" });
        await expect.soft(dialog).toHaveScreenshot(`detail-shortcuts-${theme}.png`, { maxDiffPixelRatio: .02 });
        const fields = await section.locator("input,button").evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, overflow: node.scrollWidth > node.clientWidth + 2 })));
        expect(fields.every(field => field.width > 0)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await dialog.locator(".layui-layer-close").click();
        expect(await page.locator("#favoriteBtn").evaluate(button => button.scrollWidth <= button.clientWidth + 1)).toBe(true);
        await page.locator("[data-jhs-detail-actions]").screenshot({ path: info.outputPath(`detail-shortcut-hints-${theme}.png`), animations: "disabled" });
        await expect.soft(page.locator("[data-jhs-detail-actions]")).toHaveScreenshot(`detail-shortcut-hints-${theme}.png`, { maxDiffPixelRatio: .02 });
    });
});
