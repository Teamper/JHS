import {test,expect} from "@playwright/test";
import {fulfillHostFixtures,injectUserscriptRuntime} from "../harness/runtime.js";

test("browsing new video fades only that card and fills the page without losing position",async({page,context},info)=>{
    test.skip(!["desktop-wide","mobile"].includes(info.project.name),"desktop and mobile scrolling owners");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page,{
        disabledPlugins:["TaskPlugin"],
        settingOverrides:{enableLoadReview:"no",autoRemoveNewVideoMarkAfterBrowse:"yes"}
    });
    await page.waitForFunction(()=>window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await page.waitForFunction(()=>window.unsafeWindow.pluginManager.getBean("NewVideoPlugin")?.nvEventUnsubscribe);
    await page.evaluate(async()=>{
        const storage=window.storageManager;
        await storage.forage.setItem(storage.favorite_actresses_key,[{
            starId:"fixture",name:"Fixture",actressType:"censored",
            newVideoList:Array.from({length:150},(_,index)=>({
                carNum:`ABC-${String(index+1).padStart(3,"0")}`,publishTime:"2026-09-09",title:"Fixture title",
                url:`https://javdb.com/v/nv-${index+1}`,
                coverUrl:"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            }))
        }]);
        storage._invalidateCache(storage.favorite_actresses_key);
        localStorage.setItem("jhs_newVideoViewMode","list");
        await window.unsafeWindow.pluginManager.getBean("NewVideoPlugin").openDialog();
    });
    await expect(page.locator("#nv-grid .nv-card")).toHaveCount(60);
    await page.locator("#nv-pagination-bar").getByRole("button",{name:"下一页",exact:true}).click();
    await expect(page.locator('#nv-grid .nv-card').first()).toHaveAttribute("data-car","ABC-061");
    const target=page.locator('.nv-card[data-car="ABC-090"] .nv-card__link');
    await page.locator('.nv-card[data-car="ABC-091"] .nv-select').check();
    await target.scrollIntoViewIfNeeded();
    const before=await page.evaluate(()=>{
        const container=document.querySelector("#new-video-list-container"),workspace=document.querySelector(".newVideoToolBox");
        const card=document.querySelector('.nv-card[data-car="ABC-091"]');
        window.nvRetainedNodes={grid:document.querySelector("#nv-grid"),card,image:card.querySelector("img")};
        const animate=window.jQuery.fn.animate;
        window.nvBrowseFades=0;
        window.jQuery.fn.animate=function(properties,...args){
            if(this.is('.nv-card[data-car="ABC-090"]') && properties.opacity===0) window.nvBrowseFades++;
            return animate.call(this,properties,...args);
        };
        return {list:container.scrollTop,workspace:workspace.scrollTop};
    });
    expect(Math.max(before.list,before.workspace)).toBeGreaterThan(0);
    const popupPromise=page.waitForEvent("popup");
    await target.click();
    const popup=await popupPromise;
    await popup.close();
    await expect(page.locator('.nv-card[data-car="ABC-090"]')).toHaveCount(0);
    await expect(page.locator("#nv-grid .nv-card")).toHaveCount(60);
    await expect(page.locator("#nv-grid .nv-card").last()).toHaveAttribute("data-car","ABC-121");
    await expect(page.locator('.nv-card[data-car="ABC-091"] .nv-select')).toBeChecked();
    await expect(page.locator("#nv-pagination-bar")).toContainText("第 2/3 页，共 149 条");
    await expect.poll(()=>page.evaluate(()=>{
        const container=document.querySelector("#new-video-list-container"),workspace=document.querySelector(".newVideoToolBox");
        return {list:container.scrollTop,workspace:workspace.scrollTop};
    })).toEqual(before);
    expect(await page.evaluate(()=>({
        grid:window.nvRetainedNodes.grid===document.querySelector("#nv-grid"),
        card:window.nvRetainedNodes.card===document.querySelector('.nv-card[data-car="ABC-091"]'),
        image:window.nvRetainedNodes.image===document.querySelector('.nv-card[data-car="ABC-091"] img'),
        page:window.unsafeWindow.pluginManager.getBean("NewVideoPlugin").nvCurrentPage,
        fades:window.nvBrowseFades
    }))).toEqual({grid:true,card:true,image:true,page:2,fades:1});
});

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
