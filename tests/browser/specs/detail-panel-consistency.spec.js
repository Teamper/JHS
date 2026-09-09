import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("list iframe panels share inset, surface and typography without losing controls", async ({page,context}, info) => {
  test.skip(info.project.name !== "desktop-wide", "explicit viewport matrix owner");
  await fulfillHostFixtures(context);
  const fixture = await readFile(new URL("../fixtures/javdb-detail-panels.html", import.meta.url), "utf8");
  await context.route("https://javdb.com/v/**", route => route.fulfill({contentType:"text/html",body:fixture}));
  await page.goto("https://javdb.com/");
  const options = {settingOverrides:{enableLoadReview:"no",enableLoadRelated:"no",enableMagnetsFilter:"no",enableLoadPreviewVideo:"no"}};
  await injectUserscriptRuntime(page, options);
  await page.waitForFunction(()=>window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
  const navigation = page.waitForEvent("framenavigated", {predicate:frame=>frame !== page.mainFrame() && frame.url().includes("/v/")});
  await page.locator(".movie-list .video-title").click();
  const frame = await navigation;
  await injectUserscriptRuntime(frame, options);
  await frame.waitForFunction(()=>window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
  await frame.evaluate(()=>{
    const manager=window.unsafeWindow.pluginManager;
    manager.getBean("ReviewPlugin").getRuntimeService("review").list=async()=>[{author:"Fixture reviewer",content:"评论正文与长链接 "+"long-name-".repeat(30),createdAt:"2026-09-09",likes:3}];
    manager.getBean("RelatedPlugin").getRuntimeService("related").list=async()=>[{id:"fixture",name:"相关清单长标题".repeat(12),movieCount:123,collectionCount:45,viewCount:678,createdAt:"2026-09-09"}];
    window.originalMagnetNodes=[...document.querySelectorAll("#magnets-content .item")];
  });
  await frame.locator(".jhs-review-toggle").click();
  await frame.locator(".jhs-related-toggle").click();
  await expect(frame.locator(".jhs-review-item")).toHaveCount(1);
  await expect(frame.locator(".jhs-related-item")).toHaveCount(1);
  for(const width of [360,390,768,992,1248,1408]) for(const theme of ["light","dark"]) {
    await page.setViewportSize({width,height:900});
    await frame.evaluate(theme=>window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("themeMode",theme),theme);
    const geometry=await frame.evaluate(()=>{
      const selectors=[".message.video-panel","[data-jhs-slot=reviews]","[data-jhs-slot=related]"];
      return selectors.map(selector=>{
        const node=document.querySelector(selector),s=getComputedStyle(node),r=node.getBoundingClientRect();
        const content=node.querySelector("#magnets-content,.jhs-panel-header"),c=content.getBoundingClientRect();
        return {left:r.left,right:r.right,inset:c.left-r.left,radius:s.borderRadius,bg:s.backgroundColor,overflow:node.scrollWidth-node.clientWidth};
      });
    });
    for(const panel of geometry) {
      expect(panel.inset, `${width}/${theme}: panels must not touch edges`).toBeGreaterThanOrEqual(16);
      expect(panel.radius).toBe("12px");
      expect(panel.bg).toBe(geometry[0].bg);
      expect(Math.abs(panel.left-geometry[0].left)).toBeLessThanOrEqual(1);
      expect(Math.abs(panel.right-geometry[0].right)).toBeLessThanOrEqual(1);
      expect(panel.overflow).toBeLessThanOrEqual(1);
    }
    const titles=await frame.locator(".jhs-panel-header h3").evaluateAll(nodes=>nodes.map(n=>({size:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight})));
    for(const title of titles) {expect(title.size).toBe("16px");expect(title.weight).toBe("600");}
  }
  await page.setViewportSize({width:1248,height:900});
  await frame.locator(".jhs-review-toggle").click();
  await expect(frame.locator(".jhs-review-container")).toBeHidden();
  await frame.locator(".jhs-review-toggle").click();
  await expect(frame.locator(".jhs-review-item")).toBeVisible();
  await frame.locator(".jhs-related-toggle").click();
  await expect(frame.locator(".jhs-related-container")).toBeHidden();
  await frame.locator(".jhs-related-toggle").click();
  await expect(frame.locator(".jhs-related-title")).toHaveAttribute("href","/lists/fixture");
  expect(await frame.evaluate(()=>window.originalMagnetNodes.every(n=>n.isConnected && n.querySelector(".copy-to-clipboard")))).toBe(true);
  await frame.locator(".jhs-detail-post-resource").screenshot({path:fileURLToPath(new URL("../../../output/playwright/detail-panels-after.png", import.meta.url))});
});
