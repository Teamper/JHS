import {test,expect} from "@playwright/test";
import {fulfillHostFixtures,injectUserscriptRuntime} from "../harness/runtime.js";

test("new video pagination remains reachable without scrolling through sixty cards",async({page,context},info)=>{
    test.skip(info.project.name!=="desktop-wide","explicit viewport matrix owner");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page,{settingOverrides:{enableLoadReview:"no"}});
    await page.waitForFunction(()=>window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await page.evaluate(()=>{
        const plugin=window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
        plugin.getNewVideoFlatList=async()=>Array.from({length:75},(_,i)=>({carNum:`ABC-${i+100}`,actressName:"Fixture",publishTime:"2026-09-09",title:"Fixture title"}));
        plugin.hydrateVisibleCovers=async()=>{};
    });
    await page.locator("#newVideoBtn").click();
    await page.locator("#nvViewList").click();
    await expect(page.locator("#nv-grid .nv-card")).toHaveCount(60);
    for(const width of [1248,390,360]) {
        await page.setViewportSize({width,height:844});
        await expect(page.locator("#nv-pagination-bar")).toBeInViewport({ratio:1});
        await expect.poll(async()=>(await page.locator("#new-video-list-container").boundingBox()).height).toBeGreaterThanOrEqual(150);
    }
    await page.locator('#nv-pagination-bar').getByRole("button",{name:"下一页",exact:true}).click();
    await expect(page.locator("#nv-grid .nv-card")).toHaveCount(15);
    await page.setViewportSize({width:360,height:640});
    await expect.poll(async()=>(await page.locator("#new-video-list-container").boundingBox()).height).toBeGreaterThanOrEqual(150);
    await page.locator("#nv-pagination-bar").scrollIntoViewIfNeeded();
    await expect(page.locator("#nv-pagination-bar")).toBeInViewport({ratio:1});
    await page.locator("#nvViewActress").click();
    await expect(page.locator("#nv-pagination-bar")).not.toBeVisible();
    await page.locator("#nvViewList").click();
    await expect(page.locator("#nv-pagination-bar")).toHaveCount(1);
    await page.evaluate(()=>{
        const plugin=window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
        plugin.getRuntimeService("state").getNewVideoDecisions=()=>new Promise(resolve=>window.finishNvReload=()=>resolve({}));
    });
    await page.locator("#reLoad").click();
    await expect(page.locator("#nv-pagination-bar")).toHaveCount(0);
    await page.waitForFunction(()=>typeof window.finishNvReload==="function");
    await page.evaluate(()=>window.finishNvReload());
    await expect(page.locator("#nv-pagination-bar")).toHaveCount(1);
});
