import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, info) => test.skip(!["desktop-wide", "mobile", "mobile-small", "mobile-landscape"].includes(info.project.name), "viewer ownership has desktop and touch coverage"));

async function openFixture(page, context) {
    await fulfillHostFixtures(context);
    await context.route("https://images.example.test/**", route => {
        const sheet = route.request().url().endsWith("sheet.svg");
        return route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${sheet ? 3600 : 720}"><rect width="1280" height="${sheet ? 3600 : 720}" fill="#678"/></svg>` });
    });
    await page.goto("https://javdb.com/advanced_search?type=3");
    const add = page.addScriptTag.bind(page);
    page.addScriptTag = async options => {
        if (options.path?.endsWith("JHS.user.js")) {
            await add({ path: fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js", import.meta.url)) });
            await add({ path: fileURLToPath(new URL("../fixtures/viewer-runtime/viewer-1.11.1.min.js", import.meta.url)) });
        }
        return add(options);
    };
    await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview: "no", enableLoadRelated: "no", enableLoadScreenShot: "yes", enableLoadOtherSite: "no" } });
    await page.addStyleTag({ path: fileURLToPath(new URL("../fixtures/viewer-runtime/viewer-1.11.1.min.css", import.meta.url)) });
    await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await page.evaluate(() => {
        const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin"), get = fc2.getRuntimeService.bind(fc2);
        fc2.resolveMovieIdForRecord = async () => "fixture-id";
        fc2.resolveFc2Source = async () => "fc2";
        fc2.fetchAndRenderNativeMagnets = async () => {};
        fc2.configureJavDbWantButton = async () => {};
        fc2.getRuntimeService = name => {
            if (name === "movie") return new Proxy(get(name), { get(target, key) { return key === "detail" ? async () => ({title:"Gallery fixture", carNum:"FC2-4959150", imageUrls:["https://images.example.test/1.svg", "https://images.example.test/2.svg"]}) : target[key]; } });
            if (name === "screenshot") return {isEnabled:()=>true, getScreenshotSettings:()=>({mode:"auto"}), getEnabledProviders:()=>[{id:"javstore"}], resolve:async()=>[{url:"https://images.example.test/sheet.svg"}]};
            return get(name);
        };
    });
    await openDetail(page);
}
async function openDetail(page) {
    await page.locator('.movie-list a[data-jhs-fc2-primary="true"]').click();
    await expect(page.getByRole("button", {name:"查看剧照 2", exact:true})).toBeVisible();
    await expect(page.getByRole("button", {name:"查看缩略图大图", exact:true})).toBeVisible();
    await page.waitForFunction(() => document.querySelector(".layui-layer").getAnimations().every(animation => animation.playState !== "running"));
}

async function expectImageFits(page) {
    await expect.poll(() => page.locator(".viewer-canvas img").evaluate(image => {
        const rect = image.getBoundingClientRect(), viewer = image.closest(".viewer-container"), bounds = viewer.getBoundingClientRect(), footer = viewer.querySelector(".viewer-footer").getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.left >= bounds.left && rect.right <= bounds.right + 1 && rect.top >= bounds.top && rect.bottom <= footer.top + 1;
    })).toBe(true);
}

for (const reducedMotion of ["no-preference", "reduce"]) {
    test(`FC2 zoom controls and reset work with motion ${reducedMotion}`, async ({page,context}, testInfo) => {
        await page.emulateMedia({reducedMotion});
        await openFixture(page,context);
        await page.getByRole("button",{name:"查看剧照 2",exact:true}).click();
        await expectImageFits(page);
        const image = page.locator(".viewer-canvas img"), viewer = page.locator(".viewer-container");
        const width = () => image.evaluate(node => node.getBoundingClientRect().width);
        const initialWidth = await width();
        const activate = control => testInfo.project.use.hasTouch ? control.tap() : control.click();
        await activate(viewer.getByRole("button",{name:"放大图片",exact:true}));
        await expect.poll(width).toBeGreaterThan(initialWidth * 1.05);
        await activate(viewer.getByRole("button",{name:"缩小图片",exact:true}));
        await expect.poll(width).toBeCloseTo(initialWidth, 0);
        await activate(viewer.getByRole("button",{name:"放大图片",exact:true}));
        await expect.poll(width).toBeGreaterThan(initialWidth * 1.05);
        await activate(viewer.getByRole("button",{name:"适应窗口",exact:true}));
        await expect.poll(width).toBeCloseTo(initialWidth, 0);
        await expect(viewer.locator(".jhs-image-viewer-count")).toHaveText("2 / 3");
        await expectImageFits(page);
        await activate(viewer.getByRole("button",{name:"下一张",exact:true}));
        await expect(viewer.locator(".jhs-image-viewer-count")).toHaveText("3 / 3");
        await expectImageFits(page);
        const sheetWidth = await width();
        await activate(viewer.getByRole("button",{name:"放大图片",exact:true}));
        await expect.poll(width).toBeGreaterThan(sheetWidth * 1.05);
    });
}

test("FC2 images fit inside their detail dialog and expose touch sized side navigation", async ({page,context}, testInfo) => {
    await openFixture(page,context);
    await page.getByRole("button",{name:"查看剧照 2",exact:true}).click();
    const viewer = page.locator(".viewer-container");
    const activate = control => testInfo.project.use.hasTouch ? control.tap() : control.click();
    await expect(viewer).toBeVisible();
    await expect(viewer.locator("xpath=ancestor::*[contains(@class,'layui-layer-content')]")).toHaveCount(1);
    await expect(page.locator(".jhs-image-viewer-host")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(viewer).toHaveCSS("background-color", "rgba(0, 0, 0, 0.5)");
    await expectImageFits(page);
    for (const name of ["上一张", "下一张", "关闭图片"]) {
        const button = viewer.getByRole("button",{name,exact:true});
        await expect(button).toBeVisible();
        const size = await button.boundingBox();
        expect(size.width).toBeGreaterThanOrEqual(44);
        expect(size.height).toBeGreaterThanOrEqual(44);
    }
    if (testInfo.project.name === "mobile") await page.screenshot({path:testInfo.outputPath("fc2-preview-fit.png")});
    await activate(viewer.getByRole("button",{name:"下一张",exact:true}));
    await expect(page.locator(".viewer-canvas img")).toHaveAttribute("src","https://images.example.test/sheet.svg");
    await expectImageFits(page);
    await activate(viewer.getByRole("button",{name:"上一张",exact:true}));
    await expect(page.locator(".viewer-canvas img")).toHaveAttribute("src","https://images.example.test/2.svg");
    await activate(viewer.getByRole("button",{name:"关闭图片",exact:true}));
    await expect(viewer).toHaveCount(0);
    await expect(page.getByRole("button",{name:"查看剧照 2",exact:true})).toBeFocused();
    await expect(page.locator(".jhs-fc2-workspace")).not.toHaveAttribute("inert");
});

test("FC2 wheel changes image and screenshot shares the gallery across resize", async ({page,context}) => {
    await openFixture(page,context);
    await page.getByRole("button",{name:"查看缩略图大图",exact:true}).click();
    await expectImageFits(page);
    const canvas = page.locator(".viewer-canvas");
    await canvas.hover();
    await page.mouse.wheel(0,-120);
    await expect(page.locator(".viewer-canvas img")).toHaveAttribute("src","https://images.example.test/2.svg");
    await expectImageFits(page);
    await page.setViewportSize({width:360,height:640});
    await expectImageFits(page);
    const bounds = await page.locator(".viewer-container").boundingBox();
    expect(bounds.width).toBeLessThanOrEqual(360);
    expect(bounds.height).toBeLessThanOrEqual(640);
    await page.keyboard.press("Escape");
    await expect(page.locator(".viewer-container,.jhs-image-viewer-host")).toHaveCount(0);
});

test("FC2 viewer stays above a repeatedly opened real Layer and Escape closes in order", async ({page,context}) => {
    await openFixture(page,context);
    for (let i=0;i<6;i++) { await page.locator(".layui-layer-close").click(); await expect(page.locator(".layui-layer")).toHaveCount(0); await openDetail(page); }
    await page.getByRole("button",{name:"查看剧照 2",exact:true}).click();
    await expect(page.locator(".viewer-container.viewer-in")).toHaveCount(1);
    const order = await page.evaluate(() => ({viewer:+getComputedStyle(document.querySelector(".viewer-container")).zIndex, layer:+getComputedStyle(document.querySelector(".layui-layer")).zIndex, top:document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest(".viewer-container") !== null}));
    expect(order.viewer).toBeGreaterThan(order.layer);
    expect(order.top).toBe(true);
    await expect(page.locator(".viewer-canvas img")).toHaveAttribute("src","https://images.example.test/2.svg");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".viewer-canvas img")).toHaveAttribute("src","https://images.example.test/1.svg");
    await page.keyboard.press("Escape");
    await expect(page.locator(".viewer-container")).toHaveCount(0);
    await expect(page.locator(".layui-layer")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".layui-layer")).toHaveCount(0);
});

test("FC2 screenshot and gallery entries replace one another without stale viewers", async ({page,context}) => {
    await openFixture(page,context);
    await page.getByRole("button",{name:"查看缩略图大图",exact:true}).click();
    await expect(page.locator(".viewer-container.viewer-in")).toHaveCount(1);
    // Exercise a queued second entry even when its source is covered by the active overlay.
    await page.getByRole("button",{name:"查看剧照 2",exact:true}).dispatchEvent("click");
    await expect(page.locator(".viewer-container")).toHaveCount(1);
    await expect(page.locator(".viewer-canvas img")).toHaveAttribute("src","https://images.example.test/2.svg");
    await page.getByRole("button", {name:"关闭图片",exact:true}).click();
    await expect(page.locator(".viewer-container")).toHaveCount(0);
    await page.getByRole("button",{name:"查看缩略图大图",exact:true}).click();
    await expect(page.locator(".viewer-container")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".layui-layer")).toHaveCount(1);
});

test("FC2 closing its owner during image display removes the viewer and permits reopening", async ({page,context}) => {
    await openFixture(page,context);
    await page.getByRole("button",{name:"查看剧照 1",exact:true}).click();
    await expect(page.locator(".viewer-container.viewer-in")).toHaveCount(1);
    await page.locator(".layui-layer-close").dispatchEvent("click");
    await expect(page.locator(".layui-layer")).toHaveCount(0);
    await expect(page.locator(".viewer-container")).toHaveCount(0);
    await openDetail(page);
    await page.getByRole("button",{name:"查看剧照 1",exact:true}).click();
    await expect(page.locator(".viewer-container.viewer-in")).toHaveCount(1);
});
