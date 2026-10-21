import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

async function boot(page, context, theme = "light") {
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { hostStyles: true, realFeedback: true,
        settingOverrides: { themeMode: theme, mobileMode: "auto", autoPage: "no", defaultQuickFilterTab: "all", enablePreviewVideo: "no", enableLoadOtherSite: "no", enableLoadReview: "no" },
        beforeUserscriptInjection: async page => {
            await injectRealLayer(page);
            // The startup fixture collapses its tag area; expose the host card action surface.
            await page.evaluate(() => document.querySelectorAll(".movie-list .tags").forEach(node => { node.style.display = "flex"; }));
        },
    });
    await expect(page.locator(".copySvg .jhs-card-menu-trigger").first()).toBeVisible();
}

for (const theme of ["light", "dark"]) {
    test(`closed FAB has no invisible keyboard actions ${theme}`, async ({ page, context }, info) => {
        test.skip(info.project.name !== "mobile", "compact keyboard and touch surface");
        await boot(page, context, theme);
        const fab = page.locator("#jhs-fab"), menu = page.locator("#jhs-fab-menu");
        await expect(menu).toHaveAttribute("inert", "");
        await fab.focus(); await page.keyboard.press("Shift+Tab");
        expect(await page.evaluate(() => !!document.activeElement.closest("#jhs-fab-menu"))).toBe(false);
        await fab.tap(); await expect(menu).not.toHaveAttribute("inert", "");
        await expect(menu.locator(".jhs-fab-menu-item").first()).toBeFocused();
        await page.keyboard.press("Tab"); await expect(menu).toHaveAttribute("inert", "");
        await fab.tap();
        await expect(menu.locator(".jhs-fab-menu-item").first()).toBeFocused();
        if (await page.getByRole("tooltip").count()) {
            await page.keyboard.press("Escape"); await expect(page.getByRole("tooltip")).toHaveCount(0);
        }
        await page.keyboard.press("Escape"); await expect(fab).toBeFocused();
        await expect(menu).toHaveAttribute("inert", "");
        await page.keyboard.press("Shift+Tab");
        expect(await page.evaluate(() => !!document.activeElement.closest("#jhs-fab-menu"))).toBe(false);
    });

    test(`card actions restore their anchor before confirmation ${theme}`, async ({ page, context }, info) => {
        test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and compact card action focus");
        await boot(page, context, theme);
        await page.evaluate(() => { window.unsafeWindow.pluginManager.getBean("CoverButtonPlugin").clipboard.copyText = async () => true; });
        const copy = page.locator(".copySvg .jhs-card-menu-trigger").first();
        await copy.click(); await page.locator(".jhs-owned-popover .carNumSvg").press("Enter");
        await expect(copy).toBeFocused();
        const handle = page.locator(".handleSvg .jhs-card-menu-trigger").first();
        await handle.click(); await page.locator(".jhs-owned-popover .filterBtn").press("Enter");
        const confirmation = page.locator(".layui-layer-dialog");
        await expect(confirmation).toBeVisible();
        await expect(confirmation.locator(".layui-layer-btn0")).toBeFocused();
        await confirmation.locator(".layui-layer-btn0").click();
        await expect(confirmation).toHaveCount(0); await expect(handle).toBeFocused();
    });
}

test("late mobile sort preserves a newly opened filter", async ({ page, context }, info) => {
    test.skip(info.project.name !== "mobile", "compact sorting lifecycle");
    await boot(page, context);
    await page.evaluate(() => {
        const buttons = window.unsafeWindow.pluginManager.getBean("ListPageButtonPlugin"), original = buttons.selectSortMethod.bind(buttons);
        buttons.selectSortMethod = value => new Promise((resolve, reject) => { window.__finishMenuSort = () => original(value).then(resolve, reject); });
    });
    const fab = page.locator("#jhs-fab");
    await fab.tap(); await page.locator('[data-action="sort"]').tap();
    await page.locator('[data-jhs-sort="date"]').tap(); await expect(fab).toHaveAttribute("aria-expanded", "false");
    await fab.tap(); await page.locator('[data-action="quickFilter"]').tap();
    const selected = page.locator('.jhs-mobile-filter-option[aria-checked="true"]');
    await expect(selected).toBeFocused(); await page.evaluate(() => window.__finishMenuSort());
    await expect(page.locator('[data-action="sort"]')).toHaveText("排序：时间");
    await expect(selected).toBeFocused(); await expect(fab).toHaveAttribute("aria-expanded", "true");
});

test("cover disablement cancels a pending actor action before state submission", async ({ page, context }, info) => {
    test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "cover contribution cancellation");
    await boot(page, context);
    await page.evaluate(() => {
        const manager = window.unsafeWindow.pluginManager, list = manager.getBean("ListPagePlugin").delegate, cover = manager.getBean("CoverButtonPlugin");
        window.__coverPatchCount = 0;
        const patch = cover.state.patch.bind(cover.state);
        cover.state.patch = (...args) => { window.__coverPatchCount++; return patch(...args); };
        list.parseActressName = (_url, scope) => new Promise(resolve => { window.__coverActorScope = scope; window.__finishCoverActor = () => resolve("Fixture Actor"); });
    });
    await page.locator(".handleSvg .jhs-card-menu-trigger").first().click();
    await page.locator(".jhs-owned-popover .favoriteBtn").click();
    await page.waitForFunction(() => typeof window.__finishCoverActor === "function");
    expect(await page.evaluate(() => {
        const cover = window.unsafeWindow.pluginManager.getBean("CoverButtonPlugin");
        const owned = window.__coverActorScope === cover.scope;
        cover.scope.dispose(); window.__finishCoverActor(); return owned;
    })).toBe(true);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(await page.evaluate(() => window.__coverPatchCount)).toBe(0);
    await expect(page.locator(".toastify").filter({ hasText: /已更新影片状态|状态更新失败/ })).toHaveCount(0);
});
