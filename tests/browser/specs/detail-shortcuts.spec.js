import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { readFile } from "node:fs/promises";

for (const [site, url] of [["JavDB", "https://javdb.com/v/test-id"], ["JavBus", "https://www.javbus.com/ABP-123"]]) {
    test(`${site} 录制快捷键后按钮显示并触发鉴定`, async ({ context, page }, testInfo) => {
        test.skip(testInfo.project.name !== "desktop-wide", "桌面键盘交互");
        await fulfillHostFixtures(context);
        if (site === "JavDB") {
            const body = await readFile(new URL("../fixtures/javdb-detail-interactions.html", import.meta.url), "utf8");
            await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body }));
        }
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await injectUserscriptRuntime(page, { settingOverrides: { needClosePage: "no" } });
        await expect(page.locator("#favoriteBtn")).toBeEnabled();
        await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("shortcut-panel"));
        const input = page.locator('[data-shortcut-action="favorite"]');
        await expect(input).toBeVisible();
        await input.focus();
        await page.keyboard.press("Alt+f");
        await expect(input).toHaveValue("Alt+F");
        await page.keyboard.press("Escape");
        await expect(input).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(input).toHaveCount(0);
        await expect(page.locator("#favoriteBtn kbd")).toHaveText("Alt+F");
        await page.keyboard.press("Alt+f");
        await expect(page.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "true");
        await page.keyboard.press("Alt+f");
        await expect(page.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "false");
    });
}

test("独立关闭快捷键插件后不注册监听及键位提示", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide", "桌面插件开关");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, { disabledPlugins: ["detail.shortcuts"], settingOverrides: { needClosePage: "no", detailShortcuts: { favorite: { code: "KeyF" } } } });
    await expect(page.locator("#favoriteBtn")).toBeVisible();
    await expect(page.locator("#favoriteBtn kbd")).toHaveCount(0);
    await page.keyboard.press("f");
    await expect(page.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("DetailShortcutPlugin"))).toBe(false);
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("shortcut-panel"));
    await expect(page.locator('[data-panel="shortcut-panel"]')).toBeHidden();
    await expect(page.locator("#base-panel")).toBeVisible();
});

test("禁用插件立即隐藏快捷键 tab，重新启用后恢复入口", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide", "桌面插件开关");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/v/test-id");
    await injectUserscriptRuntime(page);
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("plugin-mgmt-panel"));
    await page.locator('[data-panel="plugin-mgmt-panel"]').click();
    const tab = page.locator('[data-panel="shortcut-panel"]');
    await expect(tab).toBeVisible();
    const toggle = page.locator('.pm-toggle[data-plugin="DetailShortcutPlugin"]');
    await toggle.uncheck();
    await expect(tab).toBeHidden();
    await toggle.check();
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(page.locator('[data-shortcut-action="favorite"]')).toBeVisible();
});

test("隐藏祖先中的 dialog 不阻断详情快捷键", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide", "桌面键盘交互");
    await fulfillHostFixtures(context);
    const body = await readFile(new URL("../fixtures/javdb-detail-interactions.html", import.meta.url), "utf8");
    await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body }));
    await page.goto("https://javdb.com/v/test-id");
    await injectUserscriptRuntime(page, { settingOverrides: { needClosePage: "no", detailShortcuts: { favorite: { code: "KeyF" } } } });
    await expect(page.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "false");
    await page.evaluate(() => {
        const wrapper = document.createElement("div");
        wrapper.style.display = "none";
        wrapper.innerHTML = '<div role="dialog"></div>';
        document.body.append(wrapper);
    });
    await page.keyboard.press("f");
    await expect(page.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "true");
});

for (const enabled of [true, false]) test(`从列表打开详情，自动聚焦随快捷键插件启用：${enabled}`, async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide", "桌面键盘焦点");
    await fulfillHostFixtures(context);
    const body = await readFile(new URL("../fixtures/javdb-detail-interactions.html", import.meta.url), "utf8");
    await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body }));
    const settingOverrides = { needClosePage: "no", detailShortcuts: { favorite: { code: "KeyF" } } };
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { settingOverrides });
    await page.evaluate(() => {
        window.__listShortcutCount = 0;
        document.addEventListener("keydown", event => { if (event.code === "KeyF") window.__listShortcutCount++; });
    });
    await expect.poll(() => page.evaluate(() => Boolean(window.unsafeWindow.pluginManager.getBean("ListPagePlugin")))).toBe(true);
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin").openMovieDetail(window.$(".movie-list .item")));
    const frameElement = page.locator(".layui-layer iframe");
    const frame = await (await frameElement.elementHandle()).contentFrame();
    await frame.waitForLoadState("domcontentloaded");
    await injectUserscriptRuntime(frame, { settingOverrides, disabledPlugins: enabled ? [] : ["detail.shortcuts"] });
    await expect(frame.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "false");
    if (!enabled) {
        await expect(frameElement).not.toBeFocused();
        return;
    }
    await expect(frameElement).toBeFocused();
    await page.keyboard.press("f");
    await expect(frame.locator("#favoriteBtn")).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => window.__listShortcutCount)).toBe(0);
});
