import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, info) => test.skip(info.project.name === "firefox-controls", "Chromium viewer matrix"));

async function openFixture(page, context) {
    await fulfillHostFixtures(context);
    await context.route("https://images.example.test/**", route => {
        const sheet = route.request().url().endsWith("sheet.svg");
        return route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${sheet ? 3600 : 720}"><rect width="1280" height="${sheet ? 3600 : 720}" fill="#678"/></svg>` });
    });
    await page.goto("https://javdb.com/search_advanced?type=3");
    const add = page.addScriptTag.bind(page);
    page.addScriptTag = async options => {
        if (options.path?.endsWith(".user.js")) {
            await add({ path: fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js", import.meta.url)) });
            await add({ path: fileURLToPath(new URL("../fixtures/viewer-runtime/viewer-1.11.1.min.js", import.meta.url)) });
        }
        return add(options);
    };
    await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview: "no", enableLoadRelated: "no", enableLoadScreenShot: "yes", enableLoadOtherSite: "no" } });
    await page.addStyleTag({ path: fileURLToPath(new URL("../fixtures/viewer-runtime/viewer-1.11.1.min.css", import.meta.url)) });
    await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await page.evaluate(() => {
        const fc2 = window.__jhsBrowserDiagnostics.features["detail.fc2-owned"], get = fc2.getRuntimeService.bind(fc2);
        fc2.resolveMovieIdForRecord = async () => "fixture-id";
        fc2.resolveFc2Source = async () => "fc2";
        fc2.fetchAndRenderNativeMagnets = async () => {};
        fc2.configureJavDbWantButton = async () => {};
        fc2.getRuntimeService = name => {
            if (name === "movie") return new Proxy(get(name), { get(target, key) { return key === "detail" ? async () => ({title:"Gallery fixture", carNum:"FC2-4959150", imageUrls:["https://images.example.test/1.svg", "https://images.example.test/2.svg"]}) : target[key]; } });
            if (name === "screenshot") {
                const url = "https://images.example.test/sheet.svg";
                return {
                    isEnabled: () => true,
                    getScreenshotSettings: () => ({ mode: "auto" }),
                    getEnabledProviders: () => [{ id: "javstore" }],
                    resolve: async () => [{ url }],
                    resolvePreview: async (_movie, { loadImage }) => ({ url, match: "confirmed", image: await loadImage(url) }),
                };
            }
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

async function expectLongImage(page) {
    await expect.poll(() => page.locator(".viewer-canvas img").evaluate(image => {
        const rect = image.getBoundingClientRect(), bounds = image.closest(".viewer-container").getBoundingClientRect();
        return Math.abs(rect.width-bounds.width) < 1 && Math.abs(rect.top-bounds.top) < 1;
    })).toBe(true);
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
        await activate(viewer.getByRole("button",{name:"完整显示",exact:true}));
        await expect.poll(width).toBeCloseTo(initialWidth, 0);
        await expect(viewer.locator(".jhs-image-viewer-count")).toHaveText("2 / 2");
        await expectImageFits(page);
        await expect(viewer.getByRole("button",{name:"下一张",exact:true})).toBeDisabled();
        await activate(viewer.getByRole("button",{name:"关闭图片",exact:true}));
        await activate(page.getByRole("button",{name:"查看缩略图大图",exact:true}));
        await expect(viewer.locator(".jhs-image-viewer-count")).toHaveText("1 / 1");
        await expectLongImage(page);
        const sheetWidth = await width();
        await activate(viewer.getByRole("button",{name:"放大图片",exact:true}));
        await expect.poll(width).toBeGreaterThan(sheetWidth * 1.05);
    });
}

test("FC2 images cover the browser viewport and expose touch sized side navigation", async ({page,context}, testInfo) => {
    await openFixture(page,context);
    await page.getByRole("button",{name:"查看剧照 2",exact:true}).click();
    const viewer = page.locator(".viewer-container");
    const activate = control => testInfo.project.use.hasTouch ? control.tap() : control.click();
    await expect(viewer).toBeVisible();
    await expect(viewer.locator("xpath=ancestor::*[contains(@class,'layui-layer-content')]")).toHaveCount(0);
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
    await expect(viewer.getByRole("button",{name:"下一张",exact:true})).toBeDisabled();
    await activate(viewer.getByRole("button",{name:"上一张",exact:true}));
    await expect(page.locator(".viewer-canvas img")).toHaveAttribute("src","https://images.example.test/1.svg");
    await activate(viewer.getByRole("button",{name:"关闭图片",exact:true}));
    await expect(viewer).toHaveCount(0);
    await expect(page.getByRole("button",{name:"查看剧照 2",exact:true})).toBeFocused();
    await expect(page.locator(".jhs-fc2-workspace")).not.toHaveAttribute("inert");
});

test("FC2 fitted photos swipe both ways and enlarged photos pan on touch", async ({ page, context }, info) => {
    test.skip(info.project.name !== "mobile", "390px touch viewport");
    await page.route(/^https:\/\/images\.example\.test\/[12]\.svg$/, route => {
        const color = route.request().url().endsWith("/2.svg") ? "#426341" : "#59778f";
        return route.fulfill({
            contentType: "image/svg+xml",
            body: `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="420"><rect width="760" height="420" fill="${color}"/></svg>`,
        });
    });
    await openFixture(page, context);
    await page.getByRole("button", { name: "查看剧照 1", exact: true }).tap();
    await expectImageFits(page);
    const viewer = page.locator(".viewer-container");
    const image = viewer.locator(".viewer-canvas img");
    const count = viewer.locator(".jhs-image-viewer-count");
    await expect(count).toHaveText("1 / 2");
    await expect.poll(() => image.evaluate(node => ({ natural: node.naturalWidth, displayed: Math.round(node.getBoundingClientRect().width) })))
        .toEqual({ natural: 760, displayed: 390 });

    const cdp = await context.newCDPSession(page);
    const canvas = await viewer.locator(".viewer-canvas").boundingBox();
    const point = (position, id = 1) => ({ id, x: canvas.x + canvas.width * position, y: canvas.y + canvas.height / 2 });
    const touch = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
    async function swipe(direction) {
        const start = direction === "left" ? .8 : .2;
        await touch("touchStart", [point(start)]);
        await touch("touchMove", [point(.5)]);
        await touch("touchMove", [point(1 - start)]);
        await touch("touchEnd", []);
    }

    await swipe("left");
    await expect(image).toHaveAttribute("src", "https://images.example.test/2.svg");
    await expect(count).toHaveText("2 / 2");
    await page.screenshot({ path: info.outputPath("fc2-touch-second-photo.png") });
    await swipe("left");
    await expect(count).toHaveText("2 / 2");
    await swipe("right");
    await expect(image).toHaveAttribute("src", "https://images.example.test/1.svg");
    await swipe("right");
    await expect(count).toHaveText("1 / 2");

    await touch("touchStart", [point(.38), point(.62, 2)]);
    await touch("touchMove", [point(.25), point(.75, 2)]);
    await touch("touchEnd", []);
    await expect.poll(() => image.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(420);
    const left = await image.evaluate(node => node.getBoundingClientRect().left);
    await swipe("left");
    await expect.poll(() => image.evaluate(node => node.getBoundingClientRect().left)).toBeLessThan(left - 10);
    await expect(count).toHaveText("1 / 2");
    await cdp.detach();
});

test("FC2 wheel zooms without switching and preserves camera across resize", async ({page,context}) => {
    await openFixture(page,context);
    await page.getByRole("button",{name:"查看缩略图大图",exact:true}).click();
    await expectLongImage(page);
    const image = page.locator(".viewer-canvas img");
    const initial = await image.boundingBox();
    await page.mouse.move(initial.x + 100, 180);
    await page.mouse.wheel(0,-120);
    await expect.poll(() => image.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(initial.width * 1.05);
    await expect(image).toHaveAttribute("src","https://images.example.test/sheet.svg");
    const camera = await image.boundingBox();
    await page.setViewportSize({width:360,height:640});
    await expect.poll(() => image.boundingBox()).toEqual(camera);
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
