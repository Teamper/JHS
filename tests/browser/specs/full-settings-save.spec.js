import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { boot } from "../harness/ui-root-scenes.js";
import { clickSettingsCategory } from "../harness/settings-navigation.js";

const snapshot = page => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot());
async function open(page, panel) {
    await page.evaluate(panel => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog(panel), panel);
    const dialog = page.locator(".layui-layer").filter({ has: page.locator("#saveBtn") });
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    return dialog;
}
for (const host of ["https://javdb.com/", "https://www.javbus.com/"]) for (const theme of ["light", "dark"]) {
    test(`full settings defer changes across all categories ${host} ${theme}`, async ({ page, context }, info) => {
        await boot(page, context, theme, { url: host });
        const dialog = await open(page), original = await snapshot(page);
        for (const category of ["appearance", "browse", "filtering", "tasks", "resources", "cloud", "data", "advanced"]) {
            await clickSettingsCategory(dialog.locator(`[data-panel="${category}-panel"]`));
            const panel = dialog.locator(`#${category}-panel`);
            await expect(panel).toBeVisible(); await expect(dialog.locator("#saveBtn")).toBeInViewport();
            expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
            const geometry = await panel.evaluate(node => ({ right: node.getBoundingClientRect().right, bodyRight: node.closest(".jhs-setting-body").getBoundingClientRect().right, contentWidth: node.querySelector(".jhs-setting-body-inner").getBoundingClientRect().width }));
            expect(Math.abs(geometry.right - geometry.bodyRight), "scroll region reaches the content area's right edge").toBeLessThanOrEqual(1);
            expect(geometry.contentWidth).toBeLessThanOrEqual(640);
        }
        await clickSettingsCategory(dialog.locator('[data-panel="appearance-panel"]'));
        if (host.includes("javdb") && ["desktop-wide", "mobile"].includes(info.project.name)) {
            const folder = fileURLToPath(new URL("../../../output/full-settings-delivery/", import.meta.url)); await mkdir(folder, { recursive: true });
            await page.screenshot({ path: resolve(folder, `${info.project.name}-${theme}.png`) });
        }
        const nextTheme = theme === "light" ? "dark" : "light";
        await page.evaluate(next => { window.$("#themeMode").val(next).trigger("change"); window.$("#containerColumns").val("8").trigger("input").trigger("change"); }, nextTheme);
        expect((await snapshot(page)).themeMode).toBe(original.themeMode);
        expect((await snapshot(page)).containerColumns).toBe(original.containerColumns);
        await expect(page.locator("html")).toHaveAttribute("data-jhs-theme", theme);
        await expect(dialog.locator("#settings-draft-status")).toContainText("未保存");
        await dialog.locator("#saveBtn").click();
        await expect.poll(async () => (await snapshot(page)).containerColumns).toBe(8);
        await expect.poll(async () => (await snapshot(page)).themeMode).toBe(nextTheme);
        await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-dirty-count", "0");
        await page.evaluate(theme => window.$("#themeMode").val(theme).trigger("change"), theme);
        await page.keyboard.press("Escape");
        const confirm = page.locator(".layui-layer-dialog").filter({ hasText: "放弃修改" });
        await expect(confirm).toBeVisible(); await confirm.getByText("放弃修改", { exact: true }).click();
        expect((await snapshot(page)).themeMode).toBe(nextTheme);
        await open(page); await expect(page.locator("#themeMode")).toHaveValue(nextTheme);
    });
}

test("saving keeps edits made during submission, including a return to the original value", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "one deterministic save queue");
    await boot(page, context, "light"); const dialog = await open(page);
    await page.evaluate(() => {
        window.$("#themeMode").val("dark").trigger("change"); window.$("#waitCheckCount").val("7").trigger("input");
        const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings"), original = settings.update.bind(settings);
        window.__saveCalls = 0;
        settings.update = mutator => { window.__saveCalls++; settings.update = original; return new Promise((resolve, reject) => { window.__finishSave = () => original(mutator).then(resolve, reject); }); };
    });
    await dialog.locator("#saveBtn").click(); await expect.poll(() => page.evaluate(() => Boolean(window.__finishSave))).toBe(true);
    await page.evaluate(() => { window.$("#themeMode").val("light").trigger("change"); window.$("#waitCheckCount").val("5").trigger("input"); });
    await dialog.locator("#saveBtn").dispatchEvent("click"); expect(await page.evaluate(() => window.__saveCalls)).toBe(1);
    await page.evaluate(() => window.__finishSave());
    await expect.poll(async () => (await snapshot(page)).themeMode).toBe("dark");
    expect((await snapshot(page)).waitCheckCount).toBe("7");
    await expect(dialog.locator("#themeMode")).toHaveValue("light"); await expect(dialog.locator("#waitCheckCount")).toHaveValue("5");
    await expect(dialog.locator("#settings-draft-status")).toContainText("2 项未保存");
    await dialog.locator("#saveBtn").click(); await expect.poll(async () => (await snapshot(page)).themeMode).toBe("light");
    expect((await snapshot(page)).waitCheckCount).toBe("5");
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-dirty-count", "0");
});

test("external updates merge clean fields, preserve dirty fields and resource drafts", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "one deterministic external writer");
    await boot(page, context, "light"); const dialog = await open(page);
    await page.evaluate(async () => {
        window.$("#themeMode").val("dark").trigger("change"); window.$("#waitCheckCount").val("7").trigger("input");
        await window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").patch({ themeMode: "auto", waitCheckCount: "9", containerColumns: 6, httpTimeout: 8000, magnetTagRules: JSON.stringify([{ id: "external", name: "外部规则", type: "contains", pattern: "fixture", weight: 1 }]) });
    });
    await expect(dialog.locator("#themeMode")).toHaveValue("dark"); await expect(dialog.locator("#waitCheckCount")).toHaveValue("7");
    await expect(dialog.locator("#containerColumns")).toHaveValue("6"); await expect(dialog.locator("#httpTimeout")).toHaveValue("8000");
    await clickSettingsCategory(dialog.locator('[data-panel="resources-panel"]'));
    await expect(dialog.locator("#magnet-tag-rule-list")).toContainText("外部规则");
    await dialog.locator("#add-magnet-tag-rule").click();
    const editor = page.locator(".layui-layer").filter({ has: page.locator(".jhs-rule-form") });
    await editor.locator('[name="name"]').fill("本地规则"); await editor.locator('[name="pattern"]').fill("local");
    await editor.getByText("保存", { exact: true }).click(); await expect(editor).toHaveCount(0);
    expect((await snapshot(page)).magnetTagRules).not.toContain("本地规则");
    await dialog.locator("#saveBtn").click();
    await expect.poll(async () => (await snapshot(page)).magnetTagRules).toContain("本地规则");
    const saved = await snapshot(page); expect(saved.magnetTagRules).toContain("外部规则"); expect(saved.httpTimeout).toBe(8000); expect(saved.themeMode).toBe("dark"); expect(saved.waitCheckCount).toBe("7");
});

test("resource JSON and pending keywords save together; partial failure keeps only failed edits", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "one deterministic partial failure");
    await boot(page, context, "light"); const dialog = await open(page);
    await page.evaluate(() => { window.$("#themeMode").val("dark").trigger("change"); window.$("#advanced-resource-json").prop("readonly", false).val("{bad JSON").trigger("input"); });
    await dialog.locator("#saveBtn").click(); await expect(dialog.locator("#advanced-resource-json")).toHaveAttribute("aria-invalid", "true");
    expect((await snapshot(page)).themeMode).toBe("light");
    await page.evaluate(() => {
        const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin");
        window.$("#advanced-resource-json").prop("readonly", false).val(JSON.stringify({ magnetTagRules: [{ id: "json", name: "JSON规则", type: "contains", pattern: "fixture", weight: 1 }] })).trigger("input");
        window.$("#reviewKeywordContainer .keyword-input").val("评论关键词").trigger("input"); window.$("#filterKeywordContainer .keyword-input").val("标题关键词").trigger("input");
        window.__keywordWrites = 0; window.__originalKeywordSave = plugin.legacyStorage.saveTitleFilterKeyword.bind(plugin.legacyStorage);
        plugin.legacyStorage.saveTitleFilterKeyword = async () => { window.__keywordWrites++; throw new Error("fixture keyword save failure"); };
    });
    await dialog.locator("#saveBtn").click(); await expect.poll(() => page.evaluate(() => window.__keywordWrites)).toBe(1);
    await expect(dialog.locator("#saveBtn")).not.toHaveAttribute("aria-busy", "true");
    expect((await snapshot(page)).magnetTagRules).toContain("JSON规则");
    await expect(dialog.locator("#settings-draft-status")).toContainText("1 项未保存");
    await expect(page.locator(".toastify").filter({ hasText: "部分设置保存失败" })).toBeVisible();
    await page.evaluate(() => { const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin"); plugin.legacyStorage.saveTitleFilterKeyword = window.__originalKeywordSave; });
    await dialog.locator("#saveBtn").click(); await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-dirty-count", "0");
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
});
