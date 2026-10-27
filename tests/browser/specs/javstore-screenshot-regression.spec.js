import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, info) => test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and mobile screenshot pipeline"));

const fc2Url = "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2";
const screenshotSettings = {enableLoadScreenShot:"yes",enableLoadPreviewVideo:"no",enableLoadReview:"no",enableLoadRelatedList:"no",enableLoadOtherSite:"no",needClosePage:"no"};
const setScreenshotSettings = (page, patch) => page.evaluate(patch => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").patch(patch), patch);

for (const theme of ["light", "dark"]) test(`FC2 image failure retries fresh HTML and retains keyboard focus ${theme}`, async ({page,context}) => {
  await fulfillHostFixtures(context);
  await context.route("https://img.javstore.net/FC2-123-fresh.jpg", route => route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1800"><rect width="900" height="1800" fill="#466b86"/></svg>'}));
  await page.goto(fc2Url);
  await injectUserscriptRuntime(page, {hostStyles:true,realFeedback:true,settingOverrides:{...screenshotSettings,themeMode:theme},beforeUserscriptInjection:hostPage=>hostPage.evaluate(()=>{
    const original = window.GM_xmlhttpRequest;
    window.__screenshotRequests = [];
    window.GM_xmlhttpRequest = options => {
      if(new URL(options.url).hostname !== "javstore.net") return original(options);
      window.__screenshotRequests.push(options.url);
      const body = options.url.includes("/search?") ? '<main><a href="/FC2-123-pn.html">FC2-123</a></main>' : `<main><a href="https://img.javstore.net/FC2-123-${window.__screenshotRequests.length > 2 ? "fresh" : "missing"}.jpg">CLICK HERE!</a></main>`;
      const timer=setTimeout(()=>options.onload?.({status:200,response:body,responseText:body,finalUrl:options.url}),100);
      return {abort(){clearTimeout(timer);options.onabort?.();}};
    };
  })});
  const panel=page.locator('[data-jhs-role="screenshot"]'), retry=panel.getByRole("button",{name:"重试",exact:true});
  await expect(panel).toContainText("缩略图加载失败");
  await retry.focus(); await page.keyboard.press("Enter");
  await expect(panel.getByRole("button",{name:"重试中…",exact:true})).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel.locator("img")).toHaveAttribute("src","https://img.javstore.net/FC2-123-fresh.jpg");
  await expect(panel.getByRole("button",{name:"查看缩略图大图"})).toBeFocused();
  await expect.poll(()=>panel.locator("img").evaluate(node=>node.naturalHeight)).toBe(1800);
  expect(await page.evaluate(()=>window.__screenshotRequests.length)).toBe(4);
  await setScreenshotSettings(page,{screenshotMode:"manual"});
  await expect(panel.getByRole("tab",{name:"JavStore"})).toBeVisible();
  await setScreenshotSettings(page,{screenshotProviders:[{id:"javstore",enabled:false}]});
  await expect(panel.getByRole("tab")).toHaveCount(0);
  await setScreenshotSettings(page,{screenshotProviders:[],screenshotMode:"auto"});
  await expect(panel.locator("img")).toHaveAttribute("src","https://img.javstore.net/FC2-123-fresh.jpg");
  expect(await page.evaluate(()=>window.__screenshotRequests.length)).toBe(4);
});

for (const action of ["close", "disable", "manual"]) test(`FC2 screenshot cancels its network consumer on ${action}`, async ({page,context}) => {
  await fulfillHostFixtures(context); await page.goto(fc2Url);
  await injectUserscriptRuntime(page,{settingOverrides:screenshotSettings,beforeUserscriptInjection:hostPage=>hostPage.evaluate(()=>{
    const original=window.GM_xmlhttpRequest;
    window.__screenshotRequests=[]; window.__screenshotAborts=0;
    window.GM_xmlhttpRequest=options=>{
      if(new URL(options.url).hostname !== "javstore.net") return original(options);
      window.__screenshotRequests.push(options.url);
      window.__finishScreenshot=()=>options.onload?.({status:200,response:'<a href="/FC2-123-pn.html">FC2-123</a>',responseText:'<a href="/FC2-123-pn.html">FC2-123</a>',finalUrl:options.url});
      return {abort(){window.__screenshotAborts++;options.onabort?.();}};
    };
  })});
  await expect.poll(()=>page.evaluate(()=>window.__screenshotRequests.length)).toBe(1);
  if(action === "close") await page.evaluate(()=>window.$('.jhs-fc2-workspace').data('jhsFc2Context').destroy());
  else await setScreenshotSettings(page,action === "disable" ? {enableLoadScreenShot:"no"} : {screenshotMode:"manual"});
  await expect.poll(()=>page.evaluate(()=>window.__screenshotAborts)).toBe(1);
  await page.evaluate(()=>window.__finishScreenshot());
  await expect(page.locator('[data-jhs-role="screenshot"] img')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__screenshotRequests.length)).toBe(1);
});

for (const movie of [
  { name: "public JavStore article IDs", carNum: "IPZZ-479", fixture: "search-article-ids.html", imageUrl: "https://img.javstore.net/images/2025/02/13/MOSAIC-ARCHIVE-ipzz-479_s.jpg", article: "/455954-reducing-mosaic-ipzz479-fixture-pn.html" },
  { name: "DMM maker prefixes", carNum: "NHDTC-262", fixture: "search-dmm-prefix.html", imageUrl: "https://img2.javstore.net/images/2026/10/23/NHDTC-262.1080p_s.jpg", article: "/594423-[FHD/SD]-NHDTC-262-Fixture-pn.html" },
]) for (const theme of ["light", "dark"]) {
  test(`${movie.name} preserve the screenshot pipeline ${theme}`, async ({ page, context }, info) => {
    await fulfillHostFixtures(context);
    const hostHtml = (await readFile(new URL("../fixtures/javdb-detail-native-media.html", import.meta.url), "utf8")).replaceAll("ABC-123", movie.carNum);
    const searchHtml = await readFile(new URL(`../../fixtures/integrations/javstore/${movie.fixture}`, import.meta.url), "utf8");
    const imageUrl = movie.imageUrl;
    await context.route("https://javdb.com/v/**", route => route.fulfill({contentType:"text/html; charset=utf-8",body:hostHtml}));
    const image = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1800"><rect width="900" height="1800" fill="#466b86"/><rect x="20" y="20" width="860" height="120" fill="#acc8da"/></svg>';
    await context.route("https://images.example.test/**", route => route.fulfill({contentType:"image/svg+xml",body:image}));
    await context.route(imageUrl, route => route.fulfill({contentType:"image/svg+xml",body:image}));
    await page.goto("https://javdb.com/v/screenshot-article-id");
    await injectUserscriptRuntime(page, {
      hostStyles:true,realFeedback:true,
      settingOverrides:{themeMode:theme,enableLoadScreenShot:"yes",enableLoadPreviewVideo:"no",enableLoadReview:"no",enableLoadRelatedList:"no",enableLoadOtherSite:"no",needClosePage:"no"},
      beforeUserscriptInjection:hostPage => hostPage.evaluate(({searchHtml,imageUrl})=>{
        const original = window.GM_xmlhttpRequest;
        window.__screenshotArticleRequests = [];
        window.GM_xmlhttpRequest = options => {
          const url = new URL(options.url);
          if (url.hostname !== "javstore.net") return original(options);
          window.__screenshotArticleRequests.push(url.pathname);
          let aborted = false;
          queueMicrotask(()=>{
            if (aborted) return;
            const body = url.pathname === "/search" ? searchHtml : `<main><a href="${imageUrl}">CLICK HERE!</a></main>`;
            options.onload?.({status:200,response:body,responseText:body,finalUrl:url.href,responseHeaders:"content-type: text/html; charset=utf-8"});
          });
          return {abort(){aborted=true;options.onabort?.();}};
        };
      },{searchHtml,imageUrl}),
    });
    const tile = page.locator(".screen-container");
    const trigger = tile.getByRole("button",{name:"查看缩略图",exact:true});
    await expect(trigger).toBeVisible();
    await expect(tile.locator("img")).toHaveAttribute("src",imageUrl);
    await expect.poll(()=>tile.locator("img").evaluate(node=>node.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(()=>window.__screenshotArticleRequests)).toEqual(["/search",movie.article]);
    await trigger.click();
    await expect(page.locator(".viewer-canvas img")).toHaveAttribute("src",imageUrl);
    await expect(page.locator(".viewer-container")).toBeVisible();
    const folder = resolve("../../output/screenshot-regression");
    await mkdir(folder,{recursive:true});
    await page.screenshot({path:resolve(folder,`javstore-${movie.carNum}-${theme}-${info.project.name}.png`),animations:"disabled"});
    await page.keyboard.press("Escape");
    await expect(page.locator(".viewer-container")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}
