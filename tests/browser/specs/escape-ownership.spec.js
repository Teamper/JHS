import {test,expect} from "@playwright/test";
import {fileURLToPath} from "node:url";
import {fulfillHostFixtures,injectUserscriptRuntime} from "../harness/runtime.js";
test.beforeEach(({},info)=>test.skip(info.project.name!=="desktop-wide","one owner for real Layer keyboard regression"));
test("settings dropdown consumes first Escape and restores focus before parent closes",async({page,context})=>{
    await fulfillHostFixtures(context);await page.goto("https://javdb.com/");
    const add=page.addScriptTag.bind(page);
    page.addScriptTag=async options=>{
        if(options.path?.endsWith(".user.js"))await add({path:fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js",import.meta.url))});
        return add(options);
    };
    await injectUserscriptRuntime(page);
    await page.waitForFunction(()=>window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
    await expect(page.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready","true");
    await page.locator('[data-panel="base-panel"]').click();
    const trigger=page.locator("#base-panel .jhs-select-trigger").first();
    await trigger.click();
    await page.locator("#base-panel .jhs-select-menu.is-open .jhs-select-option").first().press("Escape");
    await page.waitForTimeout(600);
    await expect(page.locator(".layui-layer")).toHaveCount(1);
    await expect(trigger).toHaveAttribute("aria-expanded","false");
    await expect(trigger).toBeFocused();
    await trigger.press("Escape");
    await expect(page.locator(".layui-layer")).toHaveCount(0);
});

test("Escape in a navigated detail iframe closes its owning layer",async({page,context})=>{
    await fulfillHostFixtures(context);await page.goto("https://javdb.com/v/test-id");
    await injectUserscriptRuntime(page);
    const detailNavigation=page.waitForEvent("framenavigated",{predicate:frame=>frame.url().includes("jhs-esc-frame=1")});
    await page.evaluate(()=>window.utils.openPage("https://javdb.com/v/test-id?jhs-esc-frame=1","ABC-1"));
    const detailFrame=await detailNavigation;
    await detailFrame.waitForLoadState("domcontentloaded");
    await detailFrame.locator("body").press("Escape");
    await expect(page.locator(".layui-layer")).toHaveCount(0);
});
