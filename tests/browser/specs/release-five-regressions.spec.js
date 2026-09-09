import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop-wide", "cross-tab and fault probes have one deterministic owner"));
async function boot(page, settings = {}, url = "https://javdb.com/v/test-id?jhsCarNum=ABC-123") {
    await page.goto(url);
    await injectUserscriptRuntime(page, {settingOverrides:{enableLoadReview:"no",enableLoadRelated:"no",enableLoadPreviewVideo:"no",...settings}});
    await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
}
test("review keyword confirmation treats external text as text with the real Layer runtime", async ({page,context}) => {
    await fulfillHostFixtures(context); await boot(page);
    await page.addScriptTag({path:fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js", import.meta.url))});
    const text = '<img src="data:," onerror="document.documentElement.dataset.auditExecuted=String(1)"> \' & <b>keyword</b>';
    await page.evaluate(text => { window.unsafeWindow.pluginManager.getBean("ReviewPlugin").getRuntimeService("review").list = async () => [{author:"Audit",content:text,createdAt:"2026-09-09"}]; }, text);
    await page.locator(".jhs-review-toggle").click();
    const body=page.locator(".jhs-review-content");await expect(body).toHaveText(text);
    await body.evaluate(node => {const range=document.createRange();range.selectNodeContents(node);getSelection().removeAllRanges();getSelection().addRange(range);});
    await body.click({button:"right"});
    const dialog=page.locator(".layui-layer-dialog");await expect(dialog).toBeVisible();
    await expect(dialog.locator("img,b")).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.dataset.auditExecuted)).toBeUndefined();
    await expect(dialog).toContainText(text);
    await dialog.locator(".layui-layer-btn1").click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(async () => (await window.unsafeWindow.pluginManager.getBean("ReviewPlugin").getRuntimeService("storage").get("filter_keyword_review")) ?? [])).not.toContain(text);
    await body.click({button:"right"});await page.locator(".layui-layer-dialog .layui-layer-btn0").click();
    await expect.poll(()=>page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("ReviewPlugin").getRuntimeService("storage").get("filter_keyword_review"))).toContain(text);
});
test("cloud OFF controls persist booleans and exclude both providers", async ({page,context}) => {
    await fulfillHostFixtures(context);await boot(page,{enable123Offline:true,enable115Offline:true});
    await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
    await expect(page.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready","true");
    await page.locator('.side-menu-item[data-panel="cloud-services-panel"]').click();
    await page.locator("#enable123Offline").uncheck();await page.locator("#enable115Offline").uncheck();
    const result=await page.evaluate(async()=>{
        const plugin=window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin"),settings=plugin.getRuntimeService("settings");await settings.waitForIdle();
        plugin.registry.providers.get("123").getAvailability=async()=>({available:true,authState:"ready"});
        return {values:[settings.snapshot().enable123Offline,settings.snapshot().enable115Offline],ids:(await plugin.registry.getCandidates("magnet:?xt=urn:btih:fixture",{force:true})).map(c=>c.provider.id)};
    });
    expect(result).toEqual({values:[false,false],ids:[]});
    await page.keyboard.press("Escape");
    await expect(page.locator("#enable123Offline")).toHaveCount(0);
    await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
    await expect(page.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready","true");
    await page.locator('.side-menu-item[data-panel="cloud-services-panel"]').click();
    await expect(page.locator("#enable123Offline")).not.toBeChecked();
    await expect(page.locator("#enable115Offline")).not.toBeChecked();
});
test("115 OFF legacy value never matches a detail with a valid movie identity", async ({page,context}) => {
    await fulfillHostFixtures(context);await boot(page,{enable115Match:"no"});
    expect(await page.evaluate(()=>window.__jhsBrowserDiagnostics.requests.filter(r=>new URL(r.url).hostname.endsWith("115.com")))).toEqual([]);
    await expect(page.locator(".jhs-115-match")).toHaveCount(0);
});
test("115 matching retry stays on the list", async ({page,context}) => {
    await fulfillHostFixtures(context);await boot(page,{enable115Match:true},"https://javdb.com/");
    await page.locator(".jhs-115-list-match").click();
    await expect(page.locator(".jhs-115-list-match")).toBeVisible();
    expect(page.url()).toBe("https://javdb.com/");await expect(page.locator("iframe")).toHaveCount(0);
});
test("115 matching cancels late detail results and restarts once", async ({page,context}) => {
    await fulfillHostFixtures(context);await boot(page,{enable115Match:false});
    await page.evaluate(()=>{
        window.matchRequests=[];
        const plugin=window.unsafeWindow.pluginManager.getBean("OneOneFiveMatchPlugin");
        plugin.getRuntimeService("offline").searchFiles=(_id,_query,{scope})=>new Promise(resolve=>window.matchRequests.push({scope,resolve}));
        window.matchSettings=plugin.getRuntimeService("settings");
        return window.matchSettings.set("enable115Match",true);
    });
    await expect.poll(()=>page.evaluate(()=>window.matchRequests.length)).toBe(1);
    await page.evaluate(()=>window.matchSettings.set("enable115Match",false));
    expect(await page.evaluate(()=>window.matchRequests[0].scope.signal.aborted)).toBe(true);
    await page.evaluate(()=>window.matchRequests[0].resolve([{name:"late result"}]));
    await expect(page.locator(".jhs-115-match")).toHaveCount(0);
    await page.evaluate(()=>window.matchSettings.set("enable115Match",true));
    await expect.poll(()=>page.evaluate(()=>window.matchRequests.length)).toBe(2);
    await page.evaluate(()=>window.matchRequests[1].resolve([]));
    await expect(page.locator(".jhs-115-match")).toHaveText("115匹配：未匹配 重试");
});

for(const count of [0,1,2]) test(`115 ${count} matches isolate their card action`, async ({page,context})=>{
    await fulfillHostFixtures(context);await boot(page,{enable115Match:false},"https://javdb.com/");
    await page.evaluate(async count=>{
        const plugin=window.unsafeWindow.pluginManager.getBean("OneOneFiveMatchPlugin"),offline=plugin.getRuntimeService("offline");
        window.matchCalls=0;window.playLinks=[];
        window.open=url=>window.playLinks.push(url);
        offline.searchFiles=async()=>{window.matchCalls++;return Array.from({length:count},(_,id)=>({name:`result ${id}`,fileId:String(id)}));};
        offline.getPlayUrl=(_id,match)=>`https://115.com/?fixture=${match.fileId}`;
        await plugin.getRuntimeService("settings").set("enable115Match",true);
    },count);
    await page.locator(".jhs-115-list-match").click();
    if(count===0) await expect.poll(()=>page.evaluate(()=>window.matchCalls)).toBe(2);
    if(count===1) expect(await page.evaluate(()=>window.playLinks)).toEqual(["https://115.com/?fixture=0"]);
    if(count===2) await expect(page.locator('.layui-layer a[href^="https://115.com/"]')).toHaveCount(2);
    expect(page.url()).toBe("https://javdb.com/");await expect(page.locator("iframe")).toHaveCount(0);
});

test("provider disabled while choosing cannot submit", async ({page,context})=>{
    await fulfillHostFixtures(context);await boot(page,{enable115Offline:true});
    const result=await page.evaluate(async()=>{
        const plugin=window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin"),provider=plugin.registry.providers.get("115");let submissions=0;
        provider.submit=async()=>{submissions++;};
        plugin.chooseCandidate=async(_event,candidates)=>{await plugin.getRuntimeService("settings").set("enable115Offline",false);return candidates.find(c=>c.provider.id==="115");};
        const button=$("<button>离线</button>").appendTo("body");
        await plugin.submitResource({},"magnet:?xt=urn:btih:fixture",button,{carNum:"ABC-123"});
        return {submissions,busy:button.hasClass("loading"),text:button.text()};
    });
    expect(result).toEqual({submissions:0,busy:false,text:"离线"});
});

test("123 disabled during token decryption never dispatches a cloud request", async ({page,context})=>{
    await fulfillHostFixtures(context);await boot(page,{enable123Offline:true});
    await page.evaluate(()=>{
        const plugin=window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin");
        const bridge=window.unsafeWindow.pluginManager.getBean("OneTwoThreeOfflinePlugin");
        window.tokenBoundaryCalls=0;
        bridge.getStoredToken=()=>new Promise(resolve=>window.releaseBoundaryToken=resolve);
        plugin.getRuntimeService("offline").submitWithIntegration=async()=>{window.tokenBoundaryCalls++;};
        const provider=plugin.registry.providers.get("123");
        plugin.registry.getCandidates=async()=>[{provider,availability:{authState:"ready"}}];
        const button=$("<button id=token-boundary-button>离线</button>").appendTo("body");
        window.tokenBoundaryTask=plugin.submitResource({},"magnet:?xt=fixture",button,{carNum:"ABC-123"},{preferredProviderId:"123"});
    });
    await expect.poll(()=>page.evaluate(()=>typeof window.releaseBoundaryToken)).toBe("function");
    await page.evaluate(async()=>{
        await window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin").getRuntimeService("settings").set("enable123Offline",false);
        window.releaseBoundaryToken("mock-token");await window.tokenBoundaryTask;
    });
    expect(await page.evaluate(()=>window.tokenBoundaryCalls)).toBe(0);
    await expect(page.locator("#token-boundary-button")).toHaveText("离线");
    await expect(page.locator("#token-boundary-button")).not.toHaveAttribute("aria-busy","true");
});
