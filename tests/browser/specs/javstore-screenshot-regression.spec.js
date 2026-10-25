import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, info) => test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and mobile screenshot pipeline"));

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
