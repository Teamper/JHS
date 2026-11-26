import {test,expect} from "@playwright/test";
import {readFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {fulfillHostFixtures,injectUserscriptRuntime} from "../harness/runtime.js";
import {injectRealLayer} from "../harness/real-layer.js";

for(const theme of ['light','dark']) test(`native resources survive delayed controller replacement ${theme}`,async({page,context},info)=>{
  await fulfillHostFixtures(context);
  const html=await readFile(new URL('../fixtures/javdb-detail-interactions.html',import.meta.url),'utf8');
  await context.route('https://javdb.com/v/**',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.goto('https://javdb.com/v/test-id');
  await page.evaluate(()=>{
    const controller=document.querySelector('[data-controller="magnet-sort"]');
    controller.setAttribute('data-controller','fixture-extra magnet-sort');
    const root=document.querySelector('#magnets-content'), row=root.firstElementChild;
    for(let i=0;i<3;i++)root.append(row.cloneNode(true));
    const gallery=document.createElement('div');gallery.className='tile-images';
    for(let i=0;i<4;i++){const image=document.createElement('img');image.src='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="80"%3E%3Crect width="120" height="80" fill="%2363768c"/%3E%3C/svg%3E';gallery.append(image);}
    document.querySelector('main').append(gallery);
    window.__delayedResource=controller;controller.remove();
  });
  await injectUserscriptRuntime(page,{hostStyles:true,realFeedback:true,beforeUserscriptInjection:injectRealLayer,settingOverrides:{themeMode:theme,enableLoadPreviewVideo:'no',enableLoadReview:'no',enableLoadOtherSite:'no',enableMagnetsFilter:'no'}});
  await page.evaluate(()=>document.querySelector('.video-panel').append(window.__delayedResource));
  await expect(page.locator('[data-jhs-magnet-row]')).toHaveCount(4);
  const summary=page.locator('.video-meta-panel'); await expect(summary).toHaveCSS('color',await page.evaluate(()=>getComputedStyle(document.body).color));
  const color=await page.locator('[data-jhs-magnet-row]').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor));expect(new Set(color).size).toBe(1);
  await page.evaluate(()=>{const old=document.querySelector('#magnets-content');old.replaceWith(old.cloneNode(true));window.__copies=0;document.querySelectorAll('.copy-to-clipboard').forEach(node=>node.addEventListener('click',()=>window.__copies++));});
  await expect(page.locator('.jhs-offline-native')).toHaveCount(4);
  await page.locator('.copy-to-clipboard').first().click();expect(await page.evaluate(()=>window.__copies)).toBe(1);
  const bad=await page.locator('[data-jhs-magnet-row]').evaluateAll(nodes=>nodes.filter(node=>node.scrollWidth>node.clientWidth+1).length);expect(bad).toBe(0);
  await page.locator('[data-jhs-magnet-row]').first().scrollIntoViewIfNeeded();
  const folder=resolve('../../output/ui-root-fix',info.project.name);await mkdir(folder,{recursive:true});await page.screenshot({path:resolve(folder,`detail-resources-${theme}.png`)});
  const gallery=page.locator('.tile-images'); await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveCSS('gap','8px'); await expect(gallery).toHaveCSS('padding','12px');
  await page.screenshot({path:resolve(folder,`detail-gallery-${theme}.png`)});
});

test('card long screenshot mounts the real Viewer and releases its temporary host',async({page,context})=>{
  await fulfillHostFixtures(context);await page.goto('https://javdb.com/');await page.locator('.tags').evaluateAll(nodes=>nodes.forEach(node=>node.style.removeProperty('display')));
  await injectUserscriptRuntime(page,{hostStyles:true,realFeedback:true,beforeUserscriptInjection:injectRealLayer,settingOverrides:{enableLoadReview:'no',enableLoadOtherSite:'no',enableScreenSvg:'yes',defaultQuickFilterTab:'all'}});
  await page.evaluate(()=>{
    const capability=window.__jhsBrowserDiagnostics.features["detail.cover-state-actions"];
    if(!capability)throw new Error('cover capability missing');
    const screenshot=capability.screenshot;
    screenshot.resolve=async()=>({url:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="900"/%3E'});
  });
  const trigger=page.locator('.screenSvg').first();await trigger.click();
  await expect(page.locator('.viewer-container.viewer-in')).toBeVisible();await expect(page.locator('.temporary-container')).toHaveCount(1);
  await page.keyboard.press('Escape');await expect(page.locator('.viewer-container')).toHaveCount(0);await expect(page.locator('.temporary-container')).toHaveCount(0);await expect(trigger).toBeFocused();
});
