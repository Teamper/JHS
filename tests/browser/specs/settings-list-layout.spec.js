import { clickSettingsCategory } from "../harness/settings-navigation.js";
import { test, expect } from "@playwright/test";
import { boot } from "../harness/ui-root-scenes.js";

for (const theme of ["light", "dark"]) test(`settings list keeps all destinations and switch semantics ${theme}`, async ({ page, context }) => {
    await boot(page, context, theme);
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
    const dialog = page.locator(".layui-layer").filter({ has: page.locator("#saveBtn") });
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
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
