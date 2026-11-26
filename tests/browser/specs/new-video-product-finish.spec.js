import { expect, test } from "@playwright/test";
import { boot } from "../harness/ui-root-scenes.js";

for (const theme of ["light", "dark"]) {
    test(`new works compact controls leave room for browsing ${theme}`, async ({ page, context }, info) => {
        test.skip(!["mobile", "mobile-small", "mobile-landscape"].includes(info.project.name), "compact viewport acceptance");
        await boot(page, context, theme);
        await page.evaluate(() => window.__jhsBrowserDiagnostics.executeCommand("new-video.open"));
        const workspace = page.locator(".newVideoToolBox");
        await expect(workspace).toHaveAttribute("data-jhs-compact", "true");
        const contrast = await workspace.locator(".card-tag").first().evaluate(node => {
            const luminance = color => {
                const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
                return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
            };
            const style = getComputedStyle(node), foreground = luminance(style.color), background = luminance(style.backgroundColor);
            return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
        });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
        await workspace.locator("#nvViewList").click();
        await expect(workspace.locator("#nv-grid .nv-card")).toHaveCount(60);
        await expect(workspace.locator("#nv-filter-panel")).toBeHidden();
        await expect(workspace.locator("#jhs-task-status-list")).toBeHidden();
        await expect(workspace.locator(".jhs-new-video-toolbar__actions #checkNewVideo")).toBeVisible();
        const list = workspace.locator("#new-video-list-container"), minimum = info.project.name === "mobile" ? 360 : info.project.name === "mobile-small" ? 200 : 160;
        expect((await list.boundingBox()).height).toBeGreaterThanOrEqual(minimum);
        await workspace.locator(".nv-select").first().check();
        expect((await list.boundingBox()).height).toBeGreaterThanOrEqual(minimum);
        await workspace.locator(".jhs-new-video-batch__more summary").scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await expect(page.getByRole("tooltip")).toHaveCount(0);
        await page.screenshot({ path: info.outputPath(`new-works-selected-${theme}.png`) });
        const batch = workspace.locator(".jhs-new-video-batch__more summary");
        await batch.click();
        await expect(page.getByRole("menuitem", { name: "收藏", exact: true })).toBeVisible();
        await page.keyboard.press("Escape"); await expect(batch).toBeFocused();
        await workspace.locator("#nvFilterToggle").scrollIntoViewIfNeeded(); await workspace.locator("#nvFilterToggle").click();
        await expect(workspace.locator("#nv-filter-panel")).toBeVisible();
        await expect(workspace.getByRole("combobox", { name: "影片状态", exact: true })).toBeVisible();
        await expect(workspace.getByRole("combobox", { name: "新作决策", exact: true })).toBeVisible();
        await page.mouse.move(0, 0);
        await expect(page.getByRole("tooltip")).toHaveCount(0);
        await page.screenshot({ path: info.outputPath(`new-works-filters-${theme}.png`) });
        await workspace.locator("#nvFilterToggle").click();
        await workspace.locator("#nvWorkspaceMore").click();
        await expect(page.getByRole("menuitem", { name: "手动同步演员", exact: true })).toBeVisible();
        await expect(page.getByRole("tooltip")).toBeVisible();
        await page.keyboard.press("Escape"); await expect(page.getByRole("tooltip")).toHaveCount(0);
        await expect(workspace.locator("#nvWorkspaceMore")).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Escape"); await expect(workspace.locator("#nvWorkspaceMore")).toBeFocused();
        if (info.project.name === "mobile") {
            await workspace.locator("#nvWorkspaceMore").click();
            await expect(page.getByRole("menuitem", { name: "手动同步演员", exact: true })).toBeFocused();
            await page.setViewportSize({ width: 1280, height: 720 });
            await expect(page.locator("body > .jhs-owned-popover")).toHaveCount(0);
            await expect(workspace.locator("#checkFavoriteActress")).toBeFocused();
            await page.setViewportSize({ width: 320, height: 640 });
            await expect(page.getByRole("tooltip")).toHaveCount(0);
            const narrow = await workspace.evaluate(root => ({ width: root.clientWidth, scroll: root.scrollWidth }));
            expect(narrow.scroll).toBeLessThanOrEqual(narrow.width + 1);
            const compactBar = workspace.locator(".jhs-new-video-batch");
            const bar = await compactBar.evaluate(root => ({ width: root.clientWidth, scroll: root.scrollWidth }));
            expect(bar.scroll).toBeLessThanOrEqual(bar.width + 1);
            await page.setViewportSize({ width: 390, height: 844 });
        }
        await workspace.locator("#nvTaskToggle").click();
        await expect(workspace.locator("#jhs-task-status-list .jhs-task-status")).toHaveCount(3);
        await workspace.locator("#jhs-task-status-list .jhs-task-status").last().scrollIntoViewIfNeeded();
        await expect(workspace.locator("#jhs-task-status-list .jhs-task-status").last()).toBeInViewport();
        const bounds = await workspace.evaluate(root => ({ width: root.clientWidth, scroll: root.scrollWidth }));
        expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
    });
}

test("actor editor labels and delayed avatar search belong to the editor", async ({ page, context }, info) => {
    test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "one desktop and one compact lifecycle acceptance");
    await boot(page, context, "light");
    await page.evaluate(() => window.__jhsBrowserDiagnostics.executeCommand("new-video.open"));
    await page.locator(".actress-card__menu > button").first().click();
    await page.getByRole("menuitem", { name: "编辑资料", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "编辑演员：测试演员", exact: true });
    await expect(editor.getByRole("textbox", { name: "主名称", exact: true })).toHaveValue("测试演员");
    await expect(editor.getByRole("textbox", { name: "备注", exact: true })).toBeVisible();
    await expect(editor.getByRole("combobox", { name: "演员类别", exact: true })).toBeVisible();
    await page.evaluate(async () => {
            await window.__jhsBrowserDiagnostics.activateFeature("new-video");
        const plugin = window.__jhsBrowserDiagnostics.features.newVideo;
        plugin.avatarSources = [{ id: "fixture-avatar", name: "Fixture" }, { id: "fixture-backup", name: "备用 Fixture" }];
        plugin.getRuntimeService("actressInfo").searchAvatars = async () => ["https://images.example.test/chosen-avatar.svg"];
    });
    await editor.getByRole("button", { name: "选择 CDN 源", exact: true }).click();
    const sourceDialog = page.getByRole("dialog", { name: /选择.*来源/ });
    await sourceDialog.getByRole("radio", { name: "备用 Fixture", exact: true }).check();
    await sourceDialog.getByRole("button", { name: "选择", exact: true }).click();
    await expect(sourceDialog).toHaveCount(0);
    await expect(page.locator(".layui-layer")).toHaveCount(2);
    await editor.getByRole("button", { name: "搜索头像", exact: true }).click();
    const candidates = page.getByRole("dialog", { name: "选择演员头像（1 张）", exact: true });
    await candidates.getByRole("button", { name: "选择第 1 张头像", exact: true }).click();
    await expect(candidates).toHaveCount(0);
    await expect(page.locator(".layui-layer")).toHaveCount(2);
    await expect(editor.getByRole("textbox", { name: "头像链接", exact: true })).toHaveValue("https://images.example.test/chosen-avatar.svg");
    await editor.getByRole("button", { name: "搜索头像", exact: true }).click();
    await expect(candidates).toBeVisible();
    await page.evaluate(() => window.__jhsBrowserDiagnostics.features.newVideo.closeActressEditor());
    await expect(page.locator(".layui-layer")).toHaveCount(1);
    await expect(page.locator(".layer-anim-close")).toHaveCount(0);
    await page.locator(".actress-card__menu > button").first().click();
    await page.getByRole("menuitem", { name: "编辑资料", exact: true }).click();
    await expect(editor).toBeVisible();
    await page.evaluate(async () => {
            await window.__jhsBrowserDiagnostics.activateFeature("new-video");
        const plugin = window.__jhsBrowserDiagnostics.features.newVideo;
        plugin.getRuntimeService("actressInfo").searchAvatars = () => new Promise(resolve => window.finishAvatarSearch = () => resolve(["https://images.example.test/late-avatar.svg"]));
    });
    await editor.getByRole("button", { name: "搜索头像", exact: true }).click();
    await page.waitForFunction(() => typeof window.finishAvatarSearch === "function");
    await page.evaluate(async () => {
            await window.__jhsBrowserDiagnostics.activateFeature("new-video");
        const plugin = window.__jhsBrowserDiagnostics.features.newVideo;
        plugin.getRuntimeService("dialog").close(plugin.editor.id); window.finishAvatarSearch();
    });
    await expect(editor).toHaveCount(0);
    await expect(page.locator(".layui-layer")).toHaveCount(1);
    await expect(page.locator("#gfriends-image-list-container")).toHaveCount(0);
    await expect(page.locator(".newVideoToolBox")).toBeVisible();
});
