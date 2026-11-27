import { clickSettingsCategory } from "../harness/settings-navigation.js";
import { test, expect } from "@playwright/test";
import { boot } from "../harness/ui-root-scenes.js";

for (const theme of ["light", "dark"]) test(`settings list keeps all destinations and switch semantics ${theme}`, async ({ page, context }) => {
    await boot(page, context, theme);
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
    const dialog = page.locator(".layui-layer").filter({ has: page.locator("#saveBtn") });
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    await expect(dialog.locator("#discardSettingsBtn")).toBeHidden();
    const geometry = await dialog.locator(".jhs-setting-layout").evaluate(layout => {
        const box = selector => layout.querySelector(selector).getBoundingClientRect();
        const search = box(".jhs-settings-search"), field = box("#jhs-settings-search");
        const sidebar = box(".jhs-mobile-sidebar"), category = box(".jhs-settings-mobile-category"), main = box(".jhs-setting-main");
        const title = box(".content-panel.active .jhs-setting-group-title"), reset = box(".content-panel.active .jhs-reset-setting-group");
        return {
            inputFits: field.left >= search.left && field.right <= search.right,
            searchAligned: sidebar.width
                ? search.left === sidebar.left && search.right === sidebar.right && search.top === main.top && search.bottom === sidebar.top
                : search.bottom <= category.top && category.bottom <= main.top && search.width === main.width,
            headerCenterGap: Math.abs(title.top + title.height / 2 - reset.top - reset.height / 2),
        };
    });
    expect(geometry).toMatchObject({ inputFits: true, searchAligned: true });
    expect(geometry.headerCenterGap).toBeLessThanOrEqual(1);
    const nav = dialog.locator(".side-menu-item"); await expect(nav).toHaveCount(8);
    for (let i = 0; i < 8; i++) {
        await clickSettingsCategory(nav.nth(i)); await expect(nav.nth(i)).toHaveAttribute("aria-current", "page");
        const panel = dialog.locator(".content-panel.active"); await expect(panel).toBeVisible();
        expect(await panel.evaluate(n => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
        const row = panel.locator(".jhs-setting-row").first();
        if (await row.count()) await expect(row).toHaveCSS("border-bottom-width", "0px");
    }
    await clickSettingsCategory(dialog.locator('[data-panel="tasks-panel"]'));
    const toggle = dialog.locator("#enableCheckBlacklist"); await toggle.scrollIntoViewIfNeeded();
    const initial = await toggle.isChecked(); await toggle.setChecked(!initial);
    await expect(dialog.locator("#settings-draft-status")).toContainText("1 项未保存");
    await dialog.locator("#saveBtn").click();
    await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().enableCheckBlacklist)).toBe(initial ? "no" : "yes");
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-dirty-count", "0");
    await clickSettingsCategory(dialog.locator('[data-panel="advanced-panel"]'));
    const logging = dialog.locator("#enableClog"); await logging.scrollIntoViewIfNeeded();
    const wasLogging = await logging.isChecked();
    const originalLogging = await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().enableClog);
    await logging.setChecked(!wasLogging);
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().enableClog)).toBe(originalLogging);
    await dialog.locator("#saveBtn").click();
    await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().enableClog)).toBe(wasLogging ? "no" : "yes");
});

test("invalid settings show the exact validation error in a save toast", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "one project covers validation and persistence");
    await boot(page, context, "light");
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("appearance-panel"));
    const dialog = page.locator(".layui-layer").filter({ has: page.locator("#saveBtn") });
    const save = dialog.locator("#saveBtn"), color = dialog.locator("#highlightedTagColor");
    await expect(save).toHaveAttribute("data-jhs-settings-ready", "true");
    const readSaved = () => page.evaluate(() => window.__jhsBrowserDiagnostics.detailServices.settings.snapshot().highlightedTagColor);
    const saved = await readSaved();
    await color.evaluate(input => { input.type = "text"; });
    await color.fill("invalid-color");
    await expect(save).toHaveAttribute("data-jhs-dirty-count", "1");
    await save.click();
    await expect(page.locator(".toastify")).toContainText("同步设置“高亮边框颜色”(highlightedTagColor)无效：类型、可选值或取值范围不符合要求");
    await expect(save).toHaveAttribute("data-jhs-dirty-count", "1");
    expect(await readSaved()).toBe(saved);
});


test("settings search finds other groups and discarded drafts restore the saved controls", async ({ page, context }, info) => {
    test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and compact settings coverage");
    await boot(page, context, "light");
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("appearance-panel"));
    const dialog = page.locator(".layui-layer").filter({ has: page.locator("#saveBtn") });
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    const search = dialog.getByRole("searchbox", { name: "搜索设置" });
    await search.fill("评论条数");
    await expect(dialog.locator("#appearance-panel")).toBeHidden();
    await expect(dialog.locator("#browse-panel")).toBeVisible();
    await expect(dialog.locator(".jhs-setting-row").filter({ hasText: "评论条数" })).toBeVisible();
    await search.clear();
    await expect(dialog.locator("#appearance-panel")).toBeVisible();
    await expect(dialog.locator("#browse-panel")).toBeHidden();

    await clickSettingsCategory(dialog.locator('[data-panel="tasks-panel"]'));
    const toggle = dialog.locator("#enableCheckBlacklist");
    const original = await toggle.isChecked();
    await toggle.setChecked(!original);
    await expect(dialog.locator('[data-panel="tasks-panel"]')).toHaveAttribute("data-jhs-dirty", "");
    await dialog.getByRole("button", { name: "放弃更改" }).click();
    await expect(toggle).toBeChecked({ checked: original });
    await expect(dialog.getByRole("button", { name: "放弃更改" })).toBeHidden();
    await expect(dialog.locator('[data-panel="tasks-panel"]')).not.toHaveAttribute("data-jhs-dirty");
});
