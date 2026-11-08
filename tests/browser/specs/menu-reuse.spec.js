import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fulfillHostFixtures,injectUserscriptRuntime} from '../harness/runtime.js';
import {injectRealLayer} from '../harness/real-layer.js';

async function boot(page,context,theme,mobileMode='off'){
 await fulfillHostFixtures(context);await page.goto('https://javdb.com/');
 await injectUserscriptRuntime(page,{hostStyles:true,realFeedback:true,settingOverrides:{themeMode:theme,mobileMode,autoPage:'no',enableLoadPreviewVideo:'no',enableLoadOtherSite:'no',enableLoadReview:'no',defaultQuickFilterTab:'all'},beforeUserscriptInjection:async page=>{
  await injectRealLayer(page);await page.evaluate(()=>{const nav=document.querySelector('#navbar-menu-user');nav.style.cssText='display:flex;justify-content:flex-end';nav.className='main-nav';const search=document.createElement('div');search.className='navbar-search';search.style.display='none';document.body.append(search);});
 }});
 const compact=await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean('SettingPlugin').getRuntimeService('profile').current()==='compact');
 await expect(page.locator(compact?'#jhs-fab':'#sort-toggle-btn')).toBeVisible();return compact;
}
async function capture(page,info,name){
 const mobileMenu=page.locator('.jhs-mobile-filter-menu:visible,.jhs-mobile-sort-menu:visible');
 if(await mobileMenu.count()){
  await expect(mobileMenu.locator('button').first()).toBeFocused();
  await mobileMenu.evaluate(node=>{node.scrollTop=0;node.closest('.jhs-fab-menu').scrollTop=0;});
  await expect.poll(()=>mobileMenu.evaluate(node=>node.closest('.jhs-fab-menu').scrollTop)).toBe(0);
 }
 const folder=resolve('../../output/ui-menu-reuse/after',info.project.name);await mkdir(folder,{recursive:true});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:resolve(folder,name+'.png'),animations:'disabled'});
 if(process.env.JHS_VISUAL_REGRESSION==='1')await expect.soft(page).toHaveScreenshot('menu-reuse-'+name+'.png',{maxDiffPixelRatio:.02});
}
async function closePortal(page){
 if(await page.getByRole('tooltip').count()){await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);}
 await page.keyboard.press('Escape');await expect(page.locator('.jhs-owned-popover')).toHaveCount(0);
}
for(const theme of ['light','dark']){
 test(`menus close mutually and preserve callbacks ${theme}`,async({page,context},info)=>{
  const compact=await boot(page,context,theme,'auto');
  if(compact){await page.locator('#jhs-fab').click();const filter=page.locator('#jhs-fab-menu [data-action="quickFilter"]'),sort=page.locator('#jhs-fab-menu [data-action="sort"]');await filter.click();await expect(page.locator('.jhs-mobile-filter-menu')).toBeVisible();await capture(page,info,'mobile-filter-'+theme);await expect(page.locator('.jhs-mobile-filter-option')).toHaveCount(11);await expect(page.locator('.jhs-mobile-filter-option[data-jhs-filter="undownloaded"]')).toHaveText('全部未下载');await page.keyboard.press('End');const last=page.locator('.jhs-mobile-filter-option[data-jhs-filter="recent7d"]');await expect(last).toBeFocused();await expect(last).toBeInViewport({ratio:1});await page.keyboard.press('Home');await expect(page.locator('.jhs-mobile-filter-option').first()).toBeFocused();await page.keyboard.press('Escape');await expect(filter).toBeFocused();await sort.click();await expect(page.locator('.jhs-mobile-filter-menu')).toBeHidden();await expect(page.locator('.jhs-mobile-sort-menu')).toBeVisible();await capture(page,info,'mobile-sort-'+theme);await page.locator('.jhs-mobile-sort-option[data-jhs-sort="default"]').click();await expect(page.locator('.jhs-mobile-sort-menu')).toBeHidden();await expect(page.locator('.jhs-owned-popover')).toHaveCount(0);return;}
  const activate=async control=>{if(info.project.use.hasTouch){await control.focus();await control.press('Enter');}else await control.click();};
  const sort=page.locator('#sort-toggle-btn'),batch=page.locator('[aria-controls="jhs-commandbar-batch-menu"]'),filter=page.locator('.jhs-quick-filter__toggle');
  for(const [first,next] of [[sort,batch],[batch,sort],[filter,batch],[page.locator('[aria-controls="jhs-commandbar-more-menu"]'),sort]]){
   await activate(first);await expect(first).toHaveAttribute('aria-expanded','true');await activate(next);
   await expect(first).toHaveAttribute('aria-expanded','false');await expect(next).toHaveAttribute('aria-expanded','true');await expect(page.locator('.jhs-owned-popover')).toHaveCount(1);
   if(await page.getByRole('tooltip').count()){await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);await expect(next).toHaveAttribute('aria-expanded','true');}
   await page.keyboard.press('Escape');await expect(next).toBeFocused();await expect(page.locator('.jhs-owned-popover')).toHaveCount(0);
  }
  await filter.click();await page.locator('.jhs-filter-option[data-jhs-filter="recent7d"]').click();await expect(filter).toContainText('最近 7 天');await expect(page.locator('.jhs-owned-popover')).toHaveCount(0);
  await sort.click();await page.keyboard.press('End');await expect(page.locator('[data-sort-method]').last()).toBeFocused();await page.keyboard.press('Home');await expect(page.locator('[data-sort-method]').first()).toBeFocused();await page.keyboard.press('ArrowDown');await expect(page.locator('[data-sort-method]').nth(1)).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.locator('.jhs-owned-popover')).toHaveCount(0);
  await sort.click();await page.locator('#setting-btn').click();await expect(page.locator('.jhs-owned-popover')).toHaveCount(0);await expect(page.locator('#saveBtn')).toHaveAttribute('data-jhs-settings-ready','true');await page.keyboard.press('Escape');await expect(page.locator('.layui-layer')).toHaveCount(0);
  await sort.click();await capture(page,info,'sort-'+theme);await batch.click();await capture(page,info,'batch-'+theme);await closePortal(page);
  const calls=await page.evaluate(()=>{const source=document.querySelector('#favoriteAllVideo');window.__batchHits=0;source.addEventListener('click',()=>window.__batchHits++);return source.id;});await batch.click();await page.locator('#'+calls).click();expect(await page.evaluate(()=>window.__batchHits)).toBe(1);await page.keyboard.press('Escape');
 });
 test(`quick settings bridges real pointer gap, scroll and select ${theme}`,async({page,context},info)=>{
  test.skip(info.project.use.hasTouch,'hover interaction is desktop only');await boot(page,context,theme);
  const button=page.locator('#setting-btn'),panel=page.locator('.simple-setting');await button.hover();await expect(panel).toBeVisible();
  await expect(panel.locator('.simple-setting__scroll')).toHaveCSS('overscroll-behavior','contain');
  const binding=await panel.evaluate(node=>{window.__quickBinding=window.$(node).data('jhsQuickSettingBinding');return !!window.__quickBinding;});expect(binding).toBe(true);
  const panelElement=await panel.elementHandle();
  expect(panelElement).not.toBeNull();
  const anchor=await button.boundingBox();
  await page.mouse.move(anchor.x+anchor.width/2,anchor.y+anchor.height+2);
  const bridge=await panelElement.evaluate(async node=>{
   await new Promise(resolve=>setTimeout(resolve,100));
   const rect=node.getBoundingClientRect();
   return {visible:rect.width>0&&rect.height>0&&getComputedStyle(node).visibility==='visible',x:rect.x+rect.width/2,y:rect.y+10};
  });
  await page.mouse.move(bridge.x,bridge.y);
  expect(bridge.visible).toBe(true);
  await page.waitForTimeout(220);await expect(panel).toBeVisible();
  await page.mouse.wheel(0,300);await expect(panel).toBeVisible();await panel.locator('.simple-setting__scroll').evaluate(node=>node.scrollTop=0);
  // Exercise a real JhsSelect child without adding a product setting to the quick form.
  await panel.evaluate(node=>{const source=document.createElement('select');source.className='jhs-select-source';source.setAttribute('aria-label','浮层交互测试');for(const label of ['默认','其他选项'])source.add(new Option(label,label));node.querySelector('.simple-setting__scroll').prepend(source);window.unsafeWindow.pluginManager.getBean('SettingPlugin').domUi.enhanceSelect(source);});
  const select=panel.locator('.jhs-select-trigger').first();await select.click();await expect(page.locator('.jhs-owned-popover')).toHaveCount(1);await page.locator('.jhs-owned-popover').hover();await page.waitForTimeout(230);await expect(panel).toBeVisible();await page.keyboard.press('Escape');await expect(select).toBeFocused();await expect(panel).toBeVisible();await panel.locator('.simple-setting__scroll').evaluate(node=>node.scrollTop=0);await expect.poll(()=>panel.locator('.simple-setting__scroll').evaluate(node=>node.scrollTop)).toBe(0);await select.click();await capture(page,info,'quick-select-'+theme);await page.keyboard.press('Escape');await page.keyboard.press('Escape');await expect(panel).toBeHidden();await expect(button).toBeFocused();
  await button.hover();await expect(panel).toBeVisible();await panel.locator('input').first().focus();await page.mouse.move(4,200);await page.waitForTimeout(230);await expect(panel).toBeVisible();
  await page.locator('.jhs-quick-filter__toggle').click();await expect(panel).toBeHidden();await page.keyboard.press('Escape');await button.hover();await expect(panel).toBeVisible();expect(await panel.evaluate(node=>window.$(node).data('jhsQuickSettingBinding')===window.__quickBinding)).toBe(true);
  await button.click();await expect(panel).toBeHidden();await expect(page.locator('#saveBtn')).toHaveAttribute('data-jhs-settings-ready','true');await page.keyboard.press('Escape');
 });
 test(`toolbar unmount closes its portal before returning controls ${theme}`,async({page,context},info)=>{
  test.skip(info.project.name!=='desktop-wide','one project covers lifecycle');await boot(page,context,theme);await page.locator('[aria-controls="jhs-commandbar-batch-menu"]').click();
  await page.evaluate(async()=>{await window.unsafeWindow.pluginManager.getBean('SettingPlugin').getRuntimeService('settings').set('mobileMode','on');});await expect(page.locator('.jhs-owned-popover')).toHaveCount(0);await expect(page.locator('#jhs-page-commandbar')).toHaveCount(0);
  await page.evaluate(async()=>{await window.unsafeWindow.pluginManager.getBean('SettingPlugin').getRuntimeService('settings').set('mobileMode','off');});await expect(page.locator('#jhs-page-commandbar')).toHaveCount(1);await expect(page.locator('#favoriteAllVideo')).toHaveCount(1);
 });
}
