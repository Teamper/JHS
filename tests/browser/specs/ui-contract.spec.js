import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop-wide", "one owner for explicit viewport matrix"));
async function boot(page, context, url) {
    await fulfillHostFixtures(context);
    await page.goto(url);
    if (process.env.JHS_UI_BASELINE) {
        const original = page.addScriptTag.bind(page);
        page.addScriptTag = options => original(options.path?.endsWith("JHS.user.js") ? { path: process.env.JHS_UI_BASELINE } : options);
    }
    await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview:"no", enableLoadPreviewVideo:"no", needClosePage:"no" } });
    await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
}
test("detail state actions obey shared geometry across widths and themes", async ({ page, context }) => {
    await boot(page, context, "https://javdb.com/v/test-id");
    for (const width of [360,390,768,992,1248,1408]) for (const theme of ["light","dark"]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(theme => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("themeMode",theme), theme);
        const values = await page.locator("#filterBtn,#favoriteBtn,#hasDownBtn,#hasWatchBtn").evaluateAll(buttons => buttons.map(button => {
            const style=getComputedStyle(button), rect=button.getBoundingClientRect();
            return {height:rect.height,width:rect.width,radius:style.borderRadius,top:rect.top,left:rect.left,pressed:button.getAttribute("aria-pressed")};
        }));
        expect(values).toHaveLength(4);
        for(const item of values) { expect(item.height).toBe(width<768?44:36); expect(item.width).toBeGreaterThanOrEqual(80); expect(item.radius).toBe("8px"); expect(["true","false"]).toContain(item.pressed); }
        const groupWidth=await page.locator(".jhs-state-actions").first().evaluate(node=>node.getBoundingClientRect().width);
        if(groupWidth<480) { expect(values[0].top).toBe(values[1].top); expect(values[2].top).toBeGreaterThan(values[0].top); }
        expect(await page.locator("#enable-magnets-filter").getAttribute("class")).not.toContain("jhs-btn--watch");
    }
});
test("settings dialog clamps after resize and preserves keyboard close", async ({page,context}) => {
    await boot(page,context,"https://javdb.com/");
    await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
    const dialog=page.locator(".layui-layer");
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready","true");
    await page.setViewportSize({width:390,height:640});
    await expect.poll(async()=>(await dialog.boundingBox()).width).toBeLessThanOrEqual(374);
    await expect.poll(async()=>(await dialog.boundingBox()).height).toBeLessThanOrEqual(624);
    await expect(dialog.locator("#saveBtn")).toBeInViewport();
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
});
test("every settings category keeps visible controls inside its panel", async ({page,context}) => {
    await boot(page,context,"https://javdb.com/");
    await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
    const dialog=page.locator(".layui-layer");
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready","true");
    const panels=await dialog.locator(".side-menu-item[data-panel]").evaluateAll(nodes=>nodes.map(node=>node.getAttribute("data-panel")));
    for(const width of [390,1248]) {
        await page.setViewportSize({width,height:900});
        for(const panel of panels) {
            const tab=dialog.locator(`.side-menu-item[data-panel="${panel}"]`);
            if(!await tab.isVisible()) continue;
            await tab.click();
            const visible=dialog.locator(`#${panel}`);
            await expect(visible).toBeVisible();
            const size=await visible.evaluate(root=>({width:root.clientWidth,scroll:root.scrollWidth}));
            expect(size.scroll, `${panel} at ${width}`).toBeLessThanOrEqual(size.width+1);
        }
    }
});
test("history pagination stays inside the dialog after narrowing", async ({page,context}) => {
    await boot(page,context,"https://javdb.com/");
    await page.locator("#historyBtn").click();
    const dialog=page.locator(".jhs-dialog");
    const footer=dialog.locator(".tabulator-footer");
    await expect(footer).toBeVisible();
    for(const width of [1408,390,768]) {
        await page.setViewportSize({width,height:900});
        await expect.poll(async()=> {
            const bounds=await dialog.boundingBox(), pagination=await footer.boundingBox();
            return pagination.y+pagination.height <= bounds.y+bounds.height-1;
        }).toBe(true);
        await expect(footer.locator('[data-page="next"]')).toBeInViewport();
    }
});
