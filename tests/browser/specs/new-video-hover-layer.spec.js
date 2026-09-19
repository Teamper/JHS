import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop-wide", "real hover needs a mouse viewport"));
async function boot(page, context) {
    await fulfillHostFixtures(context);
    await context.route("https://images.example.test/**", route => route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#678"/></svg>'}));
    await page.goto("https://javdb.com/");
    const add=page.addScriptTag.bind(page);
    page.addScriptTag=async options=>{
        if(options.path?.endsWith("JHS.user.js")) {
            await add({path:fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js",import.meta.url))});
            await add({path:fileURLToPath(new URL("../fixtures/viewer-runtime/viewer-1.11.1.min.js",import.meta.url))});
        }
        return add(options);
    };
    await injectUserscriptRuntime(page,{settingOverrides:{enableLoadReview:"no"}});
    await page.addStyleTag({path:fileURLToPath(new URL("../fixtures/viewer-runtime/viewer-1.11.1.min.css",import.meta.url))});
    await page.waitForFunction(()=>window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await page.evaluate(()=>{
        const plugin=window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
        window.localStorage.setItem("jhs_newVideoViewMode","list");
        plugin.reloadNewVideoWorkspaceData=async function(){
            this.nvFlatListCache=[{carNum:"ABC-001",title:"Hover fixture",actressName:"Fixture",coverUrl:"https://images.example.test/cover.svg",flags:{},decisionState:"pending"}];
            this.nvJavDbUrl="https://javdb.com";
            this.nvRenderPage(this.nvRenderGeneration);
        };
    });
    await page.locator("#newVideoBtn").click();
    for(let i=0;i<4;i++) {await page.locator(".layui-layer-close").click(); await expect(page.locator(".layui-layer")).toHaveCount(0);await page.locator("#newVideoBtn").click();}
    await expect(page.locator(".nv-cover-img")).toBeVisible();
}
async function hover(page) {
    await page.locator(".nv-cover-img").hover();
    await expect(page.locator(".image-hover-preview.active img")).toBeVisible();
}

test("new work hover covers its high-index owner without clipping and cleans up on close",async({page,context})=>{
    await boot(page,context);await hover(page);
    const order=await page.evaluate(()=>{
        const preview=document.querySelector(".image-hover-preview.active"),owner=document.querySelector(".newVideoToolBox").closest(".layui-layer"),r=preview.getBoundingClientRect();
        return {preview:+getComputedStyle(preview).zIndex,owner:+getComputedStyle(owner).zIndex,stack:document.elementsFromPoint(r.x+r.width/2,r.y+r.height/2).map(e=>e.className),right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight};
    });
    expect(order.preview).toBeGreaterThan(order.owner);
    expect(order.right).toBeLessThanOrEqual(order.width);
    expect(order.bottom).toBeLessThanOrEqual(order.height);
    await page.locator(".layui-layer-close").click();
    await expect(page.locator(".image-hover-preview")).toHaveCount(0);
});

test("new work hover yields to nested settings without waiting for mouseout",async({page,context})=>{
    await boot(page,context);await hover(page);
    await page.locator("#toSetting").dispatchEvent("click");
    await expect(page.locator(".layui-layer")).toHaveCount(2);
    await expect(page.locator(".image-hover-preview.active")).toHaveCount(0);
});

for(const overlay of ["viewer","loading"])test(`new work hover yields to ${overlay} and can be opened again`,async({page,context})=>{
    await boot(page,context);await hover(page);
    await page.evaluate(overlay=>{
        if(overlay==="viewer")window.showImageViewer(document.querySelector(".nv-cover-img"));
        else window.fixtureLoading=window.loading();
    },overlay);
    await expect(page.locator(".image-hover-preview.active")).toHaveCount(0);
    if(overlay==="viewer") {await page.keyboard.press("Escape");await expect(page.locator(".viewer-container")).toHaveCount(0);}
    else await page.evaluate(()=>window.fixtureLoading.close());
    await page.mouse.move(10,10);await hover(page);
});
