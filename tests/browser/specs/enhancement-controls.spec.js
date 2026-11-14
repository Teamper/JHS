import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";
import { openDetailEnhancements, enterMovieSelection } from "../harness/enhancement-navigation.js";

async function boot(page, context, detail = false, overrides = {}) {
    await fulfillHostFixtures(context);
    const html = await readFile(new URL("../fixtures/javdb-detail-interactions.html", import.meta.url), "utf8");
    await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body: html }));
    await page.goto(detail ? "https://javdb.com/v/test-id" : "https://javdb.com/");
    await injectUserscriptRuntime(page, { hostStyles: true, realFeedback: true, beforeUserscriptInjection: injectRealLayer, settingOverrides: {
        defaultQuickFilterTab: "all", autoPage: "no", translateTitle: "no", enableLoadScreenShot: "no", enableLoadPreviewVideo: "no", enableLoadReview: "no", enableLoadOtherSite: "no", ...overrides,
    } });
}

test("selection is opt-in and disabled owners disappear from its operations", async ({page, context}) => {
    await boot(page, context);
    await expect(page.locator(".jhs-movie-selection,.jhs-movie-choice")).toHaveCount(0);
    await enterMovieSelection(page);
    await expect(page.getByRole("checkbox", {name: "选择 ABC-123", exact: true})).toBeVisible();
    await page.getByRole("checkbox", {name: "选择 ABC-123", exact: true}).check();
    await expect(page.getByRole("button", {name: "批量评分", exact: true})).toBeEnabled();
    await page.evaluate(() => window.settingsService.set("disabledPlugins", '["personal-ratings","translation-tools","movie-lists"]'));
    await expect(page.getByRole("button", {name: "批量评分", exact: true})).toBeHidden();
    await expect(page.getByRole("button", {name: "批量翻译", exact: true})).toBeHidden();
    await expect(page.getByRole("button", {name: "管理清单与恢复", exact: true})).toBeHidden();
    await page.getByRole("button", {name: "退出选择", exact: true}).click();
    await expect(page.locator(".jhs-movie-choice,.jhs-movie-selection")).toHaveCount(0);
});

for (const theme of ["light", "dark"]) test(`independent switches close current consumers and preserves independent settings ${theme}`, async ({page,context}, info) => {
    await boot(page,context,true,{themeMode:theme});
    await expect(page.locator(".jhs-personal-rating-entry")).toBeVisible();
    expect(await page.locator(".jhs-personal-rating-entry").evaluate(node => Boolean(node.closest("details")))).toBe(false);
    await openDetailEnhancements(page);
    await expect(page.locator(".jhs-translation-entry")).toBeVisible();
    await expect(page.locator(".jhs-personal-rating-entry")).toContainText("未评分");
    await page.locator(".jhs-translation-entry").click();
    await expect(page.locator(".jhs-translation-workspace")).toBeVisible();
    await page.evaluate(()=>window.settingsService.set("disabledPlugins",'["translation-tools","personal-ratings"]'));
    await expect(page.locator(".jhs-translation-workspace,.jhs-translation-entry,.jhs-personal-rating-entry")).toHaveCount(0);
    await page.evaluate(()=>window.settingsService.patch({enhancementsEnabled:true,disabledPlugins:'["translation-tools"]'}));
    await expect(page.locator(".jhs-personal-rating-entry")).toHaveCount(1);
    await expect(page.locator(".jhs-translation-entry")).toHaveCount(0);
    await page.evaluate(()=>window.settingsService.set("disabledPlugins","[]"));
    await expect(page.locator(".jhs-translation-entry")).toHaveCount(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth+1)).toBe(true);
    await expect(page.locator(".layui-layer")).toHaveCount(0);
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({animations:"disabled",path:info.outputPath(`restored-detail-${theme}.png`)});
});

test("new capabilities are manageable and configuration is reachable while disabled", async ({page,context}) => {
    await boot(page,context,false,{enhancementsEnabled:false,disabledPlugins:"[]"});
    await expect(page.locator(".jhs-movie-selection,.jhs-movie-choice")).toHaveCount(0);
    await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("advanced-panel"));
    for (const id of ["privacy","movie-selection","personal-ratings","subtitle-workspace","translation-tools","movie-lists","media-library","subtitle115-upload"]) await expect(page.locator(`.pm-toggle[data-plugin="${id}"]`)).toHaveCount(1);
    const privacySwitch = page.locator('.pm-toggle[data-plugin="privacy"]');
    await privacySwitch.focus();
    await privacySwitch.press("Space");
    await expect(privacySwitch).not.toBeChecked();
    await expect(privacySwitch).toBeFocused();
    await privacySwitch.press("Space");
    await expect(privacySwitch).toBeChecked();
    await expect(privacySwitch).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#saveBtn")).toHaveCount(0);
    await page.evaluate(()=>document.dispatchEvent(new CustomEvent("click",{bubbles:true})));
    await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("resources-panel"));
    await expect(page.locator(".jhs-translation-settings")).toBeVisible();
    await expect(page.locator(".jhs-translation-settings")).not.toContainText("预算");
    await expect(page.getByRole("button",{name:"打开预算协调页",exact:true})).toHaveCount(0);
});

test("saved switches synchronize across tabs and rapid changes settle at the latest choice", async ({page,context},info) => {
    test.skip(info.project.name !== "desktop-wide", "same-origin cross-tab scenario");
    await boot(page,context,true);
    const other=await context.newPage();
    await boot(other,context,true);
    await expect(other.locator(".jhs-translation-entry")).toHaveCount(1);
    await page.evaluate(()=>window.settingsService.set("disabledPlugins",'["translation-tools","personal-ratings"]'));
    await expect(other.locator(".jhs-translation-entry")).toHaveCount(0);
    await page.evaluate(async()=>{
        await window.settingsService.set("disabledPlugins","[]");
        await window.settingsService.set("disabledPlugins",'["translation-tools","personal-ratings"]');
        await window.settingsService.set("disabledPlugins","[]");
    });
    await expect(page.locator(".jhs-translation-entry")).toHaveCount(1);
    await expect(other.locator(".jhs-translation-entry")).toHaveCount(1);
    await expect(page.locator(".jhs-detail-extra-actions")).toHaveCount(1);
    await expect(other.locator(".jhs-detail-extra-actions")).toHaveCount(1);
});


test("full settings keep switch changes in the draft and a failed save leaves runtime enabled", async ({page, context}) => {
    await boot(page, context, true);
    await expect(page.locator(".jhs-translation-entry")).toHaveCount(1);
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("advanced-panel"));
    const master = page.locator('.pm-toggle[data-plugin="translation-tools"]');
    await expect(page.locator("#saveBtn")).toBeEnabled();
    await expect(master).toBeVisible();
    expect(await master.evaluate(node => node.closest(".content-panel")?.id)).toBe("advanced-panel");
    await master.uncheck();
    await expect(page.locator(".jhs-translation-entry")).toHaveCount(1);
    await page.evaluate(() => {
        const storage = window.settingsService.storage, set = storage.set.bind(storage);
        storage.set = async (key, value) => {
            if (key === "setting") { storage.set = set; throw new Error("fixture persistence failure"); }
            return set(key, value);
        };
    });
    await page.locator("#saveBtn").click();
    await expect(page.getByText("设置保存失败", {exact:true})).toBeVisible();
    expect(await page.evaluate(() => !JSON.parse(window.settingsService.snapshot().disabledPlugins || "[]").includes("translation-tools"))).toBe(true);
    await expect(page.locator(".jhs-translation-entry")).toHaveCount(1);
    await expect(master).not.toBeChecked();
    await page.locator("#saveBtn").click();
    await expect(page.locator(".jhs-translation-entry")).toHaveCount(0);
    expect(await page.evaluate(() => !JSON.parse(window.settingsService.snapshot().disabledPlugins || "[]").includes("translation-tools"))).toBe(false);
});

test("legacy contributions can be disabled and remounted without duplicated controls", async ({page, context}) => {
    await boot(page, context);
    await expect(page.locator("#historyBtn")).toHaveCount(1);
    const compact = await page.locator("#jhs-fab").isVisible();
    if (compact) await expect(page.locator('#jhs-fab-menu [data-action="history"]')).toHaveCount(1);
    await page.evaluate(() => window.settingsService.set("disabledPlugins", '["library.history"]'));
    await expect(page.locator("#historyBtn")).toHaveCount(0);
    if (compact) await expect(page.locator('#jhs-fab-menu [data-action="history"]')).toHaveCount(0);
    await page.evaluate(() => window.settingsService.set("disabledPlugins", "[]"));
    await expect(page.locator("#historyBtn")).toHaveCount(1);
    await page.evaluate(async () => {
        await window.stateService.setPersonalRating("ABC-123",4);
        await window.unsafeWindow.pluginManager.getBean("HistoryPlugin").openHistory();
    });
    const history = page.locator(".jhs-history-dialog");
    await expect(history.locator(".tabulator-row")).toHaveCount(1);
    await history.locator('.tabulator-row input[type="checkbox"]').check();
    await expect(history.getByRole("button",{name:"批量评分",exact:true})).toBeVisible();
    await expect(history.getByRole("button",{name:"管理清单",exact:true})).toBeVisible();
    await page.evaluate(() => window.settingsService.set("disabledPlugins", '["personal-ratings","movie-lists"]'));
    await expect(page.locator('#dataType option[value="rated"]')).toHaveCount(0);
    await expect(page.locator('#historySort option[value^="personalRating:"]')).toHaveCount(0);
    await expect(page.getByRole("button",{name:"批量评分",exact:true})).toBeHidden();
    await expect(page.getByRole("button",{name:"管理清单",exact:true})).toBeHidden();
});

test("imported false strings disable page capabilities while leaving settings available", async ({page,context}) => {
    await boot(page,context,true,{enhancementsEnabled:"no",enableSubtitle115Upload:"no"});
    await expect(page.locator(".jhs-translation-entry,.jhs-personal-rating-entry")).toHaveCount(2);
    await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("advanced-panel"));
    await expect(page.locator('.pm-toggle[data-plugin="subtitle115-upload"]')).not.toBeChecked();
    await expect(page.locator("#saveBtn")).toBeEnabled();
});

test("optional legacy actions follow their owner switches and selection depends on list controls", async ({page,context}) => {
    await boot(page,context);
    await expect(page.locator("#newVideoBtn")).toHaveCount(1);
    await page.evaluate(()=>window.settingsService.set("disabledPlugins", '["discovery.new-video","library.blacklist"]'));
    await expect(page.locator("#newVideoBtn,#blacklistBtn")).toHaveCount(0);
    await page.evaluate(()=>window.settingsService.set("disabledPlugins", "[]"));
    await expect(page.locator("#newVideoBtn")).toHaveCount(1);
    await expect(page.locator("#blacklistBtn")).toHaveCount(1);
    await enterMovieSelection(page);
    await page.getByRole("checkbox",{name:"选择 ABC-123",exact:true}).check();
    await page.evaluate(()=>window.settingsService.set("disabledPlugins", '["list.actions"]'));
    await expect(page.locator(".jhs-movie-selection,.jhs-movie-choice")).toHaveCount(0);
    await page.evaluate(()=>window.settingsService.set("disabledPlugins", "[]"));
    await enterMovieSelection(page);
    await expect(page.getByRole("checkbox",{name:"选择 ABC-123",exact:true})).toBeChecked();
});

for (const theme of ["light", "dark"]) test(`independent upload preference scrolls with its settings panel ${theme}`, async ({page,context}) => {
    await boot(page,context,false,{themeMode:theme});
    await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("cloud-panel"));
    const dialog=page.locator(".jhs-setting-layout");
    await expect(dialog.locator('[data-jhs-setting="enhancementsEnabled"]')).toBeHidden();
    const upload=dialog.locator('[data-jhs-setting="enableSubtitle115Upload"] input');
    await upload.focus();
    await expect(upload).toBeFocused();
    await expect.poll(() => dialog.evaluate(root => root.closest(".layui-layer").getAnimations({subtree:true}).filter(animation => animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity).length)).toBe(0);
    const bounds=await upload.evaluate(node=>{const rect=node.getBoundingClientRect(),panel=node.closest(".content-panel").getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,panelTop:panel.top,panelBottom:panel.bottom};});
    expect(bounds.top).toBeGreaterThanOrEqual(bounds.panelTop);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.panelBottom);
    await expect(page.locator("#saveBtn")).toBeInViewport();
});
