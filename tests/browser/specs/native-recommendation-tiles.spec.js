import {test,expect} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fulfillHostFixtures,injectUserscriptRuntime} from '../harness/runtime.js';
import {injectRealLayer} from '../harness/real-layer.js';

const mode=process.env.JHS_TILE_BUILD || 'current';
const root=resolve('../../output/ui-live-tiles');
const hostCss=fileURLToPath(new URL('../fixtures/javdb-app-11569924.css',import.meta.url));
const liveThemeCss=new URL('../fixtures/javdb-recommendation-theme-overrides.css',import.meta.url);
async function fulfillNativeCss(context){
 const body=await readFile(hostCss,'utf8')+'\n'+await readFile(liveThemeCss,'utf8');
 await context.route('https://javdb.com/packs/css/app-11569924.css',route=>route.fulfill({contentType:'text/css',body}));
}
async function nativeHtml(theme){
 return (await readFile(new URL('../fixtures/javdb-detail-native-tiles.html',import.meta.url),'utf8')).replace('<html lang="zh-CN"',`<html data-theme="${theme}" lang="zh-CN"`);
}
const options=theme=>({
 hostStyles:false,realFeedback:true,
 ...(mode==='before'?{userscriptPath:resolve(root,'before.user.js')}:mode==='reference'?{userscriptPath:resolve('../../output/ui-reference-651/JHS-6.5.1.reference.user.js')}:{}),
 settingOverrides:{themeMode:theme,enableLoadScreenShot:'no',enableLoadPreviewVideo:'no',enableLoadReview:'no',enableLoadOtherSite:'no',enableLoadRelatedList:'no'},
 beforeUserscriptInjection:injectRealLayer
});

for(const path of ['direct','iframe'])test(`recommendation title replacement and detail scrollbar ${path}`,async({page,context})=>{
 await fulfillHostFixtures(context);
 await fulfillNativeCss(context);
 const html=await nativeHtml('dark');
 await context.route('https://javdb.com/v/**',route=>route.fulfill({contentType:'text/html',body:html}));
 const config={...options('dark'),nativeTranslation:'推荐标题译文',settingOverrides:{...options('dark').settingOverrides,translateTitle:'yes'}};
 let frame=page;
 if(path==='direct'){await page.goto('https://javdb.com/v/native-tiles');await injectUserscriptRuntime(page,config);}
 else{await page.goto('https://javdb.com/');await injectUserscriptRuntime(page,options('dark'));const navigation=page.waitForEvent('framenavigated',{predicate:f=>f.url().includes('/v/native-tiles')});await page.evaluate(()=>window.utils.openPage('https://javdb.com/v/native-tiles','ABC-123'));frame=await navigation;await frame.waitForLoadState('domcontentloaded');await injectUserscriptRuntime(frame,config);}
 const lists=frame.locator('.tile-small');await expect(lists).toHaveCount(2);
 for(const [index,list] of (await lists.all()).entries()){
  await expect(list.locator('.video-title').first()).toHaveText('推荐标题译文');
  await expect(list.locator('.video-number').first()).toHaveText(index===0?'REC-101':'MORE-101');
  await expect(list.locator('a').first()).toHaveAttribute('href',index===0?'/v/rec-1':'/v/more-1');
 }
 await expect(frame.locator('html')).toHaveClass(/jhs-scrollbar/);
 expect(await frame.locator('html').evaluate(node=>getComputedStyle(node).scrollbarColor)).not.toBe('auto');
 const htmlBefore=await lists.first().locator('.video-title').first().evaluate(node=>({node:node.tagName,number:node.previousElementSibling.textContent}));
 await frame.evaluate(()=>window.unsafeWindow.settingsService.set('translateTitle','no'));
 for(const list of await lists.all())await expect(list.locator('.video-title').first()).toHaveText('保留的宿主影片名称 1');
 expect(htmlBefore).toEqual({node:'DIV',number:'REC-101'});
 await frame.evaluate(()=>{const list=document.querySelector('.tile-small'),card=list.firstElementChild.cloneNode(true);card.querySelector('.video-number').textContent='NEW-789';card.querySelector('.video-title').textContent='动态推荐标题';list.append(card);});
 await frame.evaluate(()=>window.unsafeWindow.settingsService.set('translateTitle','yes'));
 await expect(lists.first().locator('.video-title').last()).toHaveText('推荐标题译文');
 if(path==='iframe'){await page.keyboard.press('Escape');await expect(page.locator('.layui-layer')).toHaveCount(0);}
});

for(const theme of ['light','dark'])for(const path of ['direct','iframe'])test(`real native recommendation tiles ${path} ${theme}`,async({page,context},info)=>{
 await fulfillHostFixtures(context);
 await fulfillNativeCss(context);
 const html=await nativeHtml(theme);
 await context.route('https://javdb.com/v/**',route=>route.fulfill({contentType:'text/html',body:html}));
 await context.route('https://images.example.test/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, Microsoft YaHei UI, sans-serif" width="200" height="300"><rect width="200" height="300" fill="#63768c"/><text x="12" y="45" fill="white" font-size="20">HOST COVER</text></svg>'}));
 let frame=page;
 if(path==='direct'){await page.goto('https://javdb.com/v/native-tiles');await injectUserscriptRuntime(page,options(theme));}
 else {await page.goto('https://javdb.com/');await injectUserscriptRuntime(page,options(theme));const navigation=page.waitForEvent('framenavigated',{predicate:f=>f.url().includes('/v/native-tiles')});await page.evaluate(()=>window.utils.openPage('https://javdb.com/v/native-tiles','ABC-123'));frame=await navigation;await frame.waitForLoadState('domcontentloaded');await injectUserscriptRuntime(frame,options(theme));}
 await frame.locator('.tile-images img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
 const lists=frame.locator('.tile-images.tile-small');await expect(lists).toHaveCount(2);
 if(mode==='current'){
  const headers=await frame.evaluate(()=>{
   const background=node=>{while(node){const color=getComputedStyle(node).backgroundColor;if(color!=='rgba(0, 0, 0, 0)'&&color!=='transparent')return color;node=node.parentElement;}return ''};
   const reference=document.querySelector('[data-jhs-panel="reviews"] .jhs-panel-header h3');
   const describe=node=>{const style=getComputedStyle(node);return {background:background(node),color:style.color,font:style.fontFamily,size:style.fontSize,weight:style.fontWeight,lineHeight:style.lineHeight}};
   return {reference:describe(reference),headings:[...document.querySelectorAll('[data-jhs-recommendation-panel] .jhs-panel-header')].map(describe)};
  });
  expect(headers.headings).toHaveLength(2);for(const heading of headers.headings)expect(heading).toEqual(headers.reference);
 }
 const measures=[];
 const folder=resolve(root,mode,info.project.name);await mkdir(folder,{recursive:true});
 for(let index=0;index<2;index++){
  const list=lists.nth(index);await list.scrollIntoViewIfNeeded();
  const metrics=await list.evaluate(node=>{const bounds=e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}};return {gallery:node.hasAttribute('data-jhs-native-gallery'),columns:getComputedStyle(node).gridTemplateColumns.split(' ').length,gap:getComputedStyle(node).gap,cards:[...node.querySelectorAll('a.tile-item')].map(card=>{const number=card.querySelector('.video-number'),title=card.querySelector('.video-title'),r=card.getBoundingClientRect();return {gallery:card.hasAttribute('data-jhs-gallery-item'),href:card.getAttribute('href'),number:number.textContent,title:title.textContent,card:bounds(card),image:bounds(card.querySelector('img')),numberBox:bounds(number),titleBox:bounds(title),clipped:number.getBoundingClientRect().bottom>r.bottom+1||title.getBoundingClientRect().bottom>r.bottom+1,overflow:getComputedStyle(card).overflow}})}});
  measures.push(metrics);
  await expect(list.locator('.video-number')).toHaveCount(9);await expect(list.locator('.video-title')).toHaveCount(9);
  if(mode==='before'){expect(metrics.gallery).toBe(true);expect(metrics.cards.every(card=>card.clipped)).toBe(true);}
  else {expect(metrics.gallery).toBe(false);expect(metrics.cards.every(card=>!card.gallery&&!card.clipped)).toBe(true);expect(metrics.cards.every(card=>card.number&&card.title&&card.card.height>card.image.height)).toBe(true);if(mode==='current'){await expect(list).toHaveAttribute('data-jhs-native-recommendations','true');expect(metrics.columns).toBe(info.project.name.startsWith('mobile')?2:5);}}
  await list.locator('a.tile-item').first().evaluate(card=>(card.closest('[data-jhs-recommendation-panel]') || card).scrollIntoView({block:'start'}));
  const imageName=`native-tiles-${index}-${path}-${theme}.png`;await page.screenshot({path:resolve(folder,imageName),animations:'disabled'});
  if(mode==='current'&&process.env.JHS_VISUAL_REGRESSION==='1')await expect.soft(page).toHaveScreenshot(imageName,{maxDiffPixelRatio:.02});
 }
 await writeFile(resolve(folder,`metrics-${path}-${theme}.json`),JSON.stringify(measures,null,2));
 if(mode==='current'){
  await expect(frame.locator('.preview-images')).toHaveAttribute('data-jhs-native-gallery','true');
  await expect(frame.locator('.preview-images [data-jhs-gallery-item]')).toHaveCount(4);
  await frame.evaluate(()=>{const list=document.querySelector('.tile-small');const next=list.cloneNode(true);list.replaceWith(next);});
  await expect(frame.locator('.tile-small').first()).toHaveAttribute('data-jhs-native-recommendations','true');await expect(frame.locator('.tile-small [data-jhs-gallery-item]')).toHaveCount(0);
 }
 if(path==='iframe'){await page.keyboard.press('Escape');await expect(page.locator('.layui-layer')).toHaveCount(0);}
});
