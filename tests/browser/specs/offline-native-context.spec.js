import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({},info)=>test.skip(!["desktop-wide","mobile"].includes(info.project.name),"desktop and touch owners"));

for(const url of ["https://javdb.com/","https://www.javbus.com/"]) {
    test(`offline list context remains attached to the clicked card: ${url}`,async({page,context})=>{
        await fulfillHostFixtures(context);
        await page.goto(url);
        await injectUserscriptRuntime(page,{settingOverrides:{enableLoadReview:"no"}});
        await page.waitForFunction(()=>window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
        const result=await page.evaluate(()=>{
            const card=document.querySelector(".movie-list .item, .masonry > .item, .masonry > .movie-box");
            const button=document.createElement("button"); card.append(button);
            const info=window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin").getVideoInfo(window.jQuery(button));
            return {carNum:info.carNum,surface:info.surface};
        });
        expect(result).toMatchObject({carNum:"ABC-123",surface:"list-item"});
    });
}

for (const providerId of ["123","115"]) for (const surface of ["javdb-detail","javdb-iframe","javbus-detail"]) {
    test(`${providerId} native magnet click resolves owning movie on ${surface}`,async({page,context})=>{
        await fulfillHostFixtures(context);
        const html=await readFile(new URL("../fixtures/javdb-detail-interactions.html",import.meta.url),"utf8");
        await context.route("https://javdb.com/v/**",route=>route.fulfill({contentType:"text/html",body:html}));
        const busHtml=await readFile(new URL("../fixtures/javbus-detail.html",import.meta.url),"utf8");
        const busTable=busHtml.replace('<div id="magnet-table"><div class="item"><a href="magnet:?xt=urn:btih:0123456789012345678901234567890123456789">fixture magnet</a></div></div>', '<table id="magnet-table"><tbody><tr><td><a href="magnet:?xt=urn:btih:0123456789012345678901234567890123456789">fixture magnet</a></td><td>1GB</td><td>2026-09-09</td></tr></tbody></table>');
        await context.route("https://www.javbus.com/ABC-123",route=>route.fulfill({contentType:"text/html",body:busTable}));
        const settings={enableLoadReview:"no",enableLoadPreviewVideo:"no",needClosePage:"no"};
        await page.goto(surface==="javbus-detail"?"https://www.javbus.com/ABC-123":surface==="javdb-iframe"?"https://javdb.com/":"https://javdb.com/v/test-id");
        await injectUserscriptRuntime(page,{settingOverrides:settings});
        await page.waitForFunction(()=>window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
        let target=page;
        if(surface==="javdb-iframe") {
            const navigation=page.waitForEvent("framenavigated",{predicate:frame=>frame!==page.mainFrame()&&frame.url().includes("/v/")});
            await page.locator(".movie-list .video-title").click();
            target=await navigation;
            await injectUserscriptRuntime(target,{settingOverrides:settings});
            await target.waitForFunction(()=>window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
        }
        await target.evaluate(id=>{
            const plugin=window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin");
            window.offlineContextSubmits=[];
            window.offlineContextHistory=[];
            plugin.registry={getCandidates:async()=>[{provider:{id,name:id,isEnabled:async()=>true,submit:async(resource,info)=>window.offlineContextSubmits.push({resource,info})},availability:{authState:"ready"}}],updateAvailability(){}};
            plugin.getRuntimeService("state").appendOfflineHistory=async record=>window.offlineContextHistory.push(record);
        },providerId);
        const button=target.locator(".jhs-offline-native").first();
        await expect(button).toBeVisible();
        await button.click();
        await expect.poll(()=>target.evaluate(()=>window.offlineContextSubmits.length)).toBe(1);
        const result=await target.evaluate(()=>({submits:window.offlineContextSubmits,history:window.offlineContextHistory}));
        expect(result.submits[0].info.carNum).toBe("ABC-123");
        expect(result.submits[0].resource).toMatch(/^magnet:/);
        expect(result.history).toEqual([expect.objectContaining({providerId,carNum:"ABC-123",status:"submitted"})]);
    });
}
