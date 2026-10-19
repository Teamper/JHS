import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

const settings = theme => ({ hostStyles:true, realFeedback:true, beforeUserscriptInjection:injectRealLayer,
    settingOverrides:{themeMode:theme,enableLoadScreenShot:"no",enableLoadPreviewVideo:"no",enableLoadReview:"no",enableLoadRelated:"no",enableLoadOtherSite:"no"} });
async function boot(page, context, { theme = "light", frame = false } = {}) {
    await fulfillHostFixtures(context);
    await context.route("https://images.example.test/**", route => {
        const name = new URL(route.request().url()).pathname;
        const height = name === "/full-0.svg" ? 3600 : name.includes("thumb") ? 80 : 720;
        return route.fulfill({contentType:"image/svg+xml",body:`<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, Microsoft YaHei UI, sans-serif" width="1280" height="${height}"><rect width="1280" height="${height}" fill="#59778f"/><path d="M0 0h1280v140H0z" fill="#24537a"/><path d="M0 ${height-140}h1280v140H0z" fill="#426341"/><text x="40" y="90" font-size="48" fill="white">TOP · 全图</text><text x="40" y="${height-50}" font-size="48" fill="white">BOTTOM · 底部</text></svg>`});
    });
    const originalHtml = await readFile(new URL("../fixtures/javdb-detail-native-media.html", import.meta.url), "utf8");
    const html = originalHtml.replace('<select data-action="change->magnet-sort#sort">', '<span class="select is-small" id="native-sort-wrapper"><select data-action="change->magnet-sort#sort">').replace('</select>', '</select></span>');
    await context.route("https://javdb.com/v/**", route => route.fulfill({contentType:"text/html",body:html}));
    if (!frame) {
        await page.goto("https://javdb.com/v/viewer-fixture");
        await injectUserscriptRuntime(page, settings(theme));
        return page;
    }
    await page.goto("https://javdb.com/"); await injectUserscriptRuntime(page, settings(theme));
    const navigation = page.waitForEvent("framenavigated", {predicate: frame => frame.url().includes("/v/viewer-fixture")});
    await page.evaluate(() => window.utils.openPage("https://javdb.com/v/viewer-fixture", "ABC-123"));
    const detail = await navigation; await detail.waitForLoadState("domcontentloaded");
    await injectUserscriptRuntime(detail, settings(theme));
    return detail;
}
const image = page => page.locator(".viewer-canvas img");
async function expectLongDefault(page) {
    await expect.poll(() => image(page).evaluate(node => {
        const rect=node.getBoundingClientRect();return Math.abs(rect.width-innerWidth)<1 && Math.abs(rect.top)<1 && node.naturalHeight/node.naturalWidth>=2;
    })).toBe(true);
}
async function openFirst(detail, page) {
    // Keep the untyped public API's geometric fallback covered separately from typed native photos.
    await detail.evaluate(() => {
        const anchors=[...document.querySelectorAll('.tile-item[href]')], trigger=anchors[0];
        window.showImageViewer(trigger.querySelector('img'),'',{images:anchors.map(a=>({url:a.href,alt:a.querySelector('img').alt})),owner:trigger,trigger});
    });
    await expect(page.locator(".viewer-container")).toHaveCount(1);
    await expect(image(page)).toHaveAttribute("src", "https://images.example.test/full-0.svg");
    await expectLongDefault(page);
}

for (const theme of ["light", "dark"]) {
    test(`unified long-image controls, focus and full URLs ${theme}`, async ({page,context}, info) => {
        const detail=await boot(page,context,{theme}); await openFirst(detail,page);
        const viewer=page.locator(".viewer-container");
        expect(await viewer.boundingBox()).toEqual({x:0,y:0,width:info.project.use.viewport.width,height:info.project.use.viewport.height});
        await expect(viewer).toHaveAttribute("aria-modal","true");
        await expect(viewer).not.toHaveAttribute("aria-labelledby");
        for(const label of ["放大图片","缩小图片","完整显示","按宽度显示","原尺寸","关闭图片","上一张","下一张"]) {
            const button=viewer.getByRole("button",{name:label,exact:true}),box=await button.boundingBox();
            expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.x+box.width).toBeLessThanOrEqual(info.project.use.viewport.width);
            expect(box.y+box.height).toBeLessThanOrEqual(info.project.use.viewport.height);
        }
        const countBox=await viewer.locator(".jhs-image-viewer-count").boundingBox();expect(countBox.height).toBeGreaterThan(10);expect(countBox.y+countBox.height).toBeLessThanOrEqual(info.project.use.viewport.height);
        await page.keyboard.press("Shift+Tab");await expect(viewer.getByRole("button",{name:"原尺寸",exact:true})).toBeFocused();
        await page.keyboard.press("Tab");await expect(viewer.getByRole("button",{name:"关闭图片",exact:true})).toBeFocused();
        const folder=resolve("../../output/unified-viewer-review",info.project.name);await mkdir(folder,{recursive:true});
        await page.screenshot({path:resolve(folder,`long-${theme}.png`),animations:"disabled"});
        if(process.env.JHS_VISUAL_REGRESSION==="1") await expect(page).toHaveScreenshot(`unified-viewer-long-${theme}.png`,{maxDiffPixelRatio:.01});
        await viewer.getByRole("button",{name:"完整显示",exact:true}).click();
        await expect.poll(() => image(page).evaluate(node => node.getBoundingClientRect().bottom <= node.closest(".viewer-container").querySelector(".viewer-footer").getBoundingClientRect().top+1)).toBe(true);
        await viewer.getByRole("button",{name:"按宽度显示",exact:true}).click();await expectLongDefault(page);
        await viewer.getByRole("button",{name:"原尺寸",exact:true}).click();
        await expect.poll(() => image(page).evaluate(node=>node.getBoundingClientRect().width)).toBe(1280);
        await page.keyboard.press("ArrowRight");await expect(image(page)).toHaveAttribute("src","https://images.example.test/full-1.svg");
        await expect.poll(() => image(page).evaluate(node=>node.getBoundingClientRect().bottom <= node.closest(".viewer-container").querySelector(".viewer-footer").getBoundingClientRect().top+1)).toBe(true);
        await page.keyboard.press("ArrowLeft");await expectLongDefault(page);
        await page.keyboard.press("Escape");await expect(viewer).toHaveCount(0);
        await expect(detail.locator(".tile-item").first()).toBeFocused();
        expect(await page.locator("body").evaluate(node=>node.style.overflow)).toBe("");
    });
}

test("wheel keeps the pointer anchor; repeated left drags reach the sheet bottom without closing or switching", async ({page,context}) => {
    const detail=await boot(page,context); await openFirst(detail,page);
    const before=await image(page).boundingBox(), point={x:Math.min(180,before.width/2),y:150};
    await page.mouse.move(point.x,point.y);await page.mouse.wheel(0,-120);
    await expect.poll(()=>image(page).evaluate(node=>node.getBoundingClientRect().width)).toBeGreaterThan(before.width*1.05);
    const after=await image(page).boundingBox();
    expect(after.x+(point.x-before.x)*after.width/before.width).toBeCloseTo(point.x,0);
    expect(after.y+(point.y-before.y)*after.height/before.height).toBeCloseTo(point.y,0);
    for(let i=0;i<12;i++) {
        const rect=await image(page).boundingBox(), bottom=await page.locator(".viewer-footer").evaluate(node=>node.getBoundingClientRect().top);
        const remaining=rect.y+rect.height-bottom;if(remaining<=1)break;
        const start=bottom-30, distance=Math.min(remaining,start-90);
        await page.mouse.move(page.viewportSize().width/2,start);await page.mouse.down();
        await page.mouse.move(page.viewportSize().width/2,start-distance,{steps:6});await page.mouse.up();
    }
    const rect=await image(page).boundingBox(), bottom=await page.locator(".viewer-footer").evaluate(node=>node.getBoundingClientRect().top);
    expect(rect.y+rect.height).toBeLessThanOrEqual(bottom+1);expect(rect.y+rect.height).toBeGreaterThan(100);
    await expect(image(page)).toHaveAttribute("src","https://images.example.test/full-0.svg");
    await expect(page.locator(".jhs-image-viewer-count")).toHaveText("1 / 6");
    const camera=await image(page).boundingBox();await page.setViewportSize({width:700,height:700});
    await expect.poll(()=>image(page).boundingBox()).toEqual(camera);
});

test('ordinary photo wheel browses without wrapping, and blank canvas closes while image clicks and drags keep preview open', async ({page,context}) => {
    const detail=await boot(page,context);await detail.locator('.tile-item').first().click();
    await expect(page.getByRole('button',{name:'上一张',exact:true})).toBeDisabled();
    await page.keyboard.press('ArrowLeft');await expect(image(page)).toHaveAttribute('src','https://images.example.test/full-0.svg');
    await page.keyboard.press('ArrowRight');await expect(image(page)).toHaveAttribute('src','https://images.example.test/full-1.svg');
    await image(page).click();await expect(page.locator('.viewer-container')).toHaveCount(1);
    const initial=await image(page).boundingBox();await page.mouse.move(initial.x+initial.width/2,initial.y+initial.height/2);
    await page.mouse.wheel(0,120);await expect(image(page)).toHaveAttribute('src','https://images.example.test/full-2.svg');
    expect((await image(page).boundingBox()).width).toBeCloseTo(initial.width,0);
    for(let i=0;i<4;i++)await page.keyboard.press('ArrowRight');
    await expect(page.locator('.jhs-image-viewer-count')).toHaveText('6 / 6');
    await expect(page.getByRole('button',{name:'下一张',exact:true})).toBeDisabled();
    await page.mouse.wheel(0,120);await expect(page.locator('.jhs-image-viewer-count')).toHaveText('6 / 6');
    await page.keyboard.press('ArrowLeft');await expect(page.locator('.jhs-image-viewer-count')).toHaveText('5 / 6');
    // Move the photo away from the canvas centre, then release on blank space.
    const photo=await image(page).boundingBox();const x=photo.x+photo.width/2,y=photo.y+photo.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,Math.max(30,y-160),{steps:6});await page.mouse.up();
    await expect(page.locator('.viewer-container')).toHaveCount(1);
    const rect=await image(page).boundingBox(), canvas=await page.locator('.viewer-canvas').boundingBox();
    const blankY=rect.y>10?5:Math.min(canvas.height-8,rect.y+rect.height+8);
    await page.mouse.click(canvas.width/2,blankY);await expect(page.locator('.viewer-container')).toHaveCount(0);
    await expect(detail.locator('.tile-item').first()).toBeFocused();
});

test("touch drag and two-finger pinch pan and zoom without switching", async ({page,context},info) => {
    test.skip(!info.project.use.hasTouch,"touch projects");
    const detail=await boot(page,context);await openFirst(detail,page);
    const cdp=await context.newCDPSession(page), width=await image(page).evaluate(node=>node.getBoundingClientRect().width);
    const points=[{id:1,x:80,y:180},{id:2,x:180,y:180}];
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:points});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{...points[0],x:50},{...points[1],x:210}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await expect.poll(()=>image(page).evaluate(node=>node.getBoundingClientRect().width)).toBeGreaterThan(width*1.2);
    const top=await image(page).evaluate(node=>node.getBoundingClientRect().top);
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{id:1,x:150,y:220}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{id:1,x:150,y:100}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await expect.poll(()=>image(page).evaluate(node=>node.getBoundingClientRect().top)).toBeLessThan(top-50);
    await expect(image(page)).toHaveAttribute("src","https://images.example.test/full-0.svg");
    await expect(page.locator(".jhs-image-viewer-count")).toHaveText("1 / 6");await cdp.detach();
});

test("same-origin iframe uses the outer viewer and source teardown releases nested locks", async ({page,context}) => {
    const detail=await boot(page,context,{frame:true});await openFirst(detail,page);
    await expect(detail.locator(".viewer-container")).toHaveCount(0);
    await page.keyboard.press("Escape");await expect(page.locator(".viewer-container")).toHaveCount(0);
    await expect(detail.locator(".tile-item").first()).toBeFocused();
    await openFirst(detail,page);
    await page.locator(".layui-layer-close").dispatchEvent("click");
    await expect(page.locator(".viewer-container,.layui-layer")).toHaveCount(0);
    expect(await page.locator("body").evaluate(node=>node.style.overflow)).toBe("");
});

test("single image, failed load and retry retain reachable controls and focus", async ({page,context}) => {
    await boot(page,context);let fail=true;
    await context.route("https://images.example.test/retry.svg",route=>fail?route.fulfill({status:503,body:"unavailable"}):route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="300"/>'}));
    await page.evaluate(()=>{const trigger=document.createElement("button");trigger.id="single-image";trigger.className="jhs-btn jhs-btn--secondary jhs-ui";trigger.textContent="单图";document.querySelector("main").prepend(trigger);trigger.addEventListener("click",()=>window.showImageViewer("https://images.example.test/retry.svg","单图",{owner:trigger,trigger}));});
    await page.locator("#single-image").click();
    await expect(page.locator(".jhs-image-viewer-status")).toContainText("图片加载失败");
    await expect(page.getByRole("button",{name:"下一张",exact:true})).toHaveCount(0);
    fail=false;await page.getByRole("button",{name:"重试图片",exact:true}).click();
    await expect(page.locator(".jhs-image-viewer-status")).toBeHidden();
    await expect.poll(()=>image(page).evaluate(node=>node.getBoundingClientRect().width)).toBeGreaterThan(0);
    await page.getByRole("button",{name:"关闭图片",exact:true}).click();
    await expect(page.locator("#single-image")).toBeFocused();
    await page.locator("#single-image").click();await expect(page.locator(".viewer-container")).toBeVisible();
    await page.locator("#single-image").evaluate(node=>node.remove());await expect(page.locator(".viewer-container")).toHaveCount(0);
    expect(await page.locator("body").evaluate(node=>node.style.overflow)).toBe("");
});

test("enhanced JavDB sort has one arrow and retains its native change event after host replacement", async ({page,context}) => {
    const detail=await boot(page,context);
    const wrapper=detail.locator("#native-sort-wrapper");
    await expect(wrapper.locator(".jhs-select-trigger svg")).toHaveCount(1);
    expect(await wrapper.evaluate(node=>getComputedStyle(node,"::after").display)).toBe("none");
    await detail.evaluate(()=>{window.__sortSource=document.querySelector('#native-sort-wrapper select');window.__sortChanges=0;window.__sortSource.addEventListener('change',()=>window.__sortChanges++);});
    await wrapper.getByRole("combobox").click();await detail.getByRole("option",{name:"日期排序",exact:true}).click();
    expect(await detail.evaluate(()=>({changes:window.__sortChanges,same:window.__sortSource===document.querySelector('#native-sort-wrapper select'),value:window.__sortSource.value}))).toEqual({changes:1,same:true,value:"1"});
    await detail.evaluate(()=>{
        const old=document.querySelector('#native-sort-wrapper'),fresh=document.createElement('span');fresh.className='select is-small';fresh.id=old.id;
        fresh.innerHTML='<select data-action="change->magnet-sort#sort"><option value="0">默认排序</option><option value="1">日期排序</option></select>';old.replaceWith(fresh);
        const untouched=document.createElement('span');untouched.id='untouched-select';untouched.className='select';untouched.innerHTML='<select><option>宿主选择</option></select>';document.body.append(untouched);
    });
    await expect(wrapper.locator(".jhs-select-control")).toHaveCount(1);
    await expect(wrapper.locator(".jhs-select-trigger svg")).toHaveCount(1);
    expect(await wrapper.evaluate(node=>getComputedStyle(node,"::after").display)).toBe("none");
    expect(await detail.locator('#untouched-select').evaluate(node=>getComputedStyle(node,"::after").display)).not.toBe("none");
});

test("a missing parent viewer uses the same viewer inside the current detail document", async ({page,context}) => {
    const detail=await boot(page,context,{frame:true});await page.evaluate(()=>{window.showImageViewer=undefined;});
    await detail.locator('.tile-item').first().click();await expect(detail.locator('.viewer-container')).toHaveCount(1);
    await expect(page.locator('.viewer-container')).toHaveCount(0);
    await expect.poll(()=>detail.locator('.viewer-canvas img').evaluate(node=>node.getBoundingClientRect().bottom<=node.closest('.viewer-container').querySelector('.viewer-footer').getBoundingClientRect().top+1)).toBe(true);
    await detail.getByRole('button',{name:'关闭图片',exact:true}).click();await expect(detail.locator('.viewer-container')).toHaveCount(0);
    await expect(detail.locator('.tile-item').first()).toBeFocused();
});

test("cross-origin JavBus detail keeps full-image viewing in its current document", async ({page,context}) => {
    await boot(page,context);
    const navigation=page.waitForEvent('framenavigated',{predicate:frame=>frame.url().includes('www.javbus.com/ABC-123')});
    await page.evaluate(()=>{const iframe=document.createElement('iframe');iframe.src='https://www.javbus.com/ABC-123';iframe.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:9999999;background:white';document.body.append(iframe);});
    const detail=await navigation;await detail.waitForLoadState('domcontentloaded');
    await detail.evaluate(()=>{const gallery=document.querySelector('#sample-waterfall');gallery.style.display='block';const a=document.createElement('a');a.className='sample-box';a.href='https://images.example.test/full-0.svg';const image=document.createElement('img');image.src='https://images.example.test/thumb-0.svg';image.alt='JavBus 剧照';a.append(image);gallery.append(a);});
    await injectUserscriptRuntime(detail,settings('dark'));
    await detail.locator('a.sample-box').click();await expect(detail.locator('.viewer-container')).toHaveCount(1);
    await expect(detail.locator('.viewer-canvas img')).toHaveAttribute('src','https://images.example.test/full-0.svg');
    await expect.poll(()=>detail.locator('.viewer-canvas img').evaluate(node=>node.getBoundingClientRect().bottom<=node.closest('.viewer-container').querySelector('.viewer-footer').getBoundingClientRect().top+1)).toBe(true);await expect(page.locator('.viewer-container')).toHaveCount(0);
    await detail.getByRole('button',{name:'关闭图片',exact:true}).click();await expect(detail.locator('a.sample-box')).toBeFocused();
    expect(await detail.locator('body').evaluate(node=>node.style.overflow)).toBe('');
});

test("closing during a slow image load discards its late completion", async ({page,context}) => {
    await boot(page,context);let release,requested=false,delivered=false;
    const gate=new Promise(resolve=>{release=resolve;});
    await context.route('https://images.example.test/slow.svg',async route=>{requested=true;await gate;await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="20000"/>'});delivered=true;});
    await page.evaluate(()=>window.showImageViewer('https://images.example.test/slow.svg','超长图'));
    await expect(page.locator('.viewer-container')).toBeVisible();await expect.poll(()=>requested).toBe(true);
    await page.keyboard.press('Escape');await expect(page.locator('.viewer-container')).toHaveCount(0);
    release();await expect.poll(()=>delivered).toBe(true);await expect(page.locator('.viewer-container')).toHaveCount(0);
    expect(await page.locator('body').evaluate(node=>node.style.overflow)).toBe('');
    await page.evaluate(()=>window.showImageViewer('https://images.example.test/slow.svg','超长图'));
    await expectLongDefault(page);await page.keyboard.press('PageDown');
    await expect.poll(()=>image(page).evaluate(node=>node.getBoundingClientRect().top)).toBeLessThan(-100);
    await page.keyboard.press('Escape');
});
