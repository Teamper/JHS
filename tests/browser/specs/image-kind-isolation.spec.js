import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fulfillHostFixtures,injectUserscriptRuntime} from '../harness/runtime.js';
import {injectRealLayer} from '../harness/real-layer.js';

const image=page=>page.locator('.viewer-canvas img');
const config=theme=>({hostStyles:true,realFeedback:true,beforeUserscriptInjection:injectRealLayer,settingOverrides:{themeMode:theme,enableLoadScreenShot:'no',enableLoadPreviewVideo:'no',enableLoadReview:'no',enableLoadRelated:'no',enableLoadOtherSite:'no',defaultQuickFilterTab:'all'}});
const svg=(width,height)=>`<svg xmlns="http://www.w3.org/2000/svg" font-family="Arial, Microsoft YaHei UI, sans-serif" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#59778f"/><rect width="${width}" height="80" fill="#24537a"/><rect y="${height-80}" width="${width}" height="80" fill="#426341"/><text x="20" y="50" fill="white" font-size="28">TOP</text><text x="20" y="${height-20}" fill="white" font-size="28">BOTTOM</text></svg>`;
async function routes(context){
 await fulfillHostFixtures(context);
 await context.route('https://images.example.test/**',route=>{
  const name=new URL(route.request().url()).pathname;
  const size=name.includes('sheet')?[906,1784]:name.includes('full-0')?[1280,3600]:[1280,720];
  return route.fulfill({contentType:'image/svg+xml',body:svg(...size)});
 });
}
async function boot(page,context,{theme='light',frame=false}={}){
 await routes(context);
 const html=await readFile(new URL('../fixtures/javdb-detail-native-media.html',import.meta.url),'utf8');
 await context.route('https://javdb.com/v/**',route=>route.fulfill({contentType:'text/html',body:html}));
 if(!frame){await page.goto('https://javdb.com/v/kind-fixture');await injectUserscriptRuntime(page,config(theme));return page;}
 await page.goto('https://javdb.com/');await injectUserscriptRuntime(page,config(theme));
 const navigation=page.waitForEvent('framenavigated',{predicate:f=>f.url().includes('/v/kind-fixture')});
 await page.evaluate(()=>window.utils.openPage('https://javdb.com/v/kind-fixture','ABC-123'));
 const detail=await navigation;await detail.waitForLoadState('domcontentloaded');await injectUserscriptRuntime(detail,config(theme));return detail;
}
async function insertSheet(detail,{url='https://images.example.test/sheet.svg',pending=false}={}){
 await detail.evaluate(({url,pending})=>{
  let tile=document.querySelector('.screen-container');
  if(!tile){tile=document.createElement('a');tile.className='tile-item screen-container';document.querySelector('.tile-wrapper').prepend(tile);}
  if(pending){tile.textContent='加载中…';return;}
  const button=document.createElement('button');button.type='button';button.className='jhs-screenshot-open';button.setAttribute('aria-label','查看缩略图');
  const image=document.createElement('img');image.src=url;image.alt='长缩略图';button.append(image);tile.replaceChildren(button);
 },{url,pending});
 if(!pending)await detail.locator('.screen-container img').evaluate(node=>node.decode());
}
async function expectSheet(page){
 await expect(page.locator('.jhs-image-viewer-count')).toHaveText('1 / 1');
 await expect(page.getByRole('button',{name:'下一张',exact:true})).toHaveCount(0);
 await expect.poll(()=>image(page).evaluate(n=>{const r=n.getBoundingClientRect();return Math.abs(r.width-innerWidth)<1&&Math.abs(r.top)<1;})).toBe(true);
 const before=await image(page).evaluate(n=>({url:n.src,width:n.getBoundingClientRect().width}));
 await page.mouse.move(before.width*.35,120);await page.mouse.wheel(0,-120);
 await expect.poll(()=>image(page).evaluate(n=>n.getBoundingClientRect().width)).toBeGreaterThan(before.width);
 await expect(image(page)).toHaveAttribute('src',before.url);await expect(page.locator('.jhs-image-viewer-count')).toHaveText('1 / 1');
 await page.keyboard.press('ArrowRight');await expect(image(page)).toHaveAttribute('src',before.url);
}

for(const theme of ['light','dark'])for(const frame of [false,true])test(`late sheet stays outside photographs ${frame?'iframe':'direct'} ${theme}`,async({page,context},info)=>{
 const detail=await boot(page,context,{theme,frame});await insertSheet(detail,{pending:true});
 await detail.locator('.tile-item:not(.screen-container)').first().click();
 await expect(page.locator('.jhs-image-viewer-count')).toHaveText('1 / 6');
 // Even this tall native photograph must contain and browse, rather than use sheet zoom.
 await expect.poll(()=>image(page).evaluate(n=>n.getBoundingClientRect().bottom<=n.closest('.viewer-container').querySelector('.viewer-footer').getBoundingClientRect().top+1)).toBe(true);
 for(let index=1;index<6;index++){
  await image(page).hover();await page.waitForTimeout(200);await page.mouse.wheel(0,120);
  await expect(page.locator('.jhs-image-viewer-count')).toHaveText(`${index+1} / 6`);
 }
 await insertSheet(detail);await expect(page.locator('.jhs-image-viewer-count')).toHaveText('6 / 6');
 await expect(page.locator('.jhs-image-viewer-source img')).toHaveCount(6);
 await image(page).hover();await page.waitForTimeout(200);await page.mouse.wheel(0,120);await expect(page.locator('.jhs-image-viewer-count')).toHaveText('6 / 6');
 await page.keyboard.press('Escape');const trigger=detail.getByRole('button',{name:'查看缩略图',exact:true});await trigger.click();
 await expectSheet(page);
 await page.getByRole('button',{name:'按宽度显示',exact:true}).click();
 await expect(page.locator('.viewer-tooltip')).toBeHidden();
 const folder=resolve(process.env.JHS_IMAGE_KIND_REVIEW_DIR||'../../output/image-kind-review',info.project.name);await mkdir(folder,{recursive:true});await page.screenshot({path:resolve(folder,`isolated-sheet-${frame?'iframe':'direct'}-${theme}.png`),animations:'disabled'});
 if(process.env.JHS_VISUAL_REGRESSION==='1'){
  await expect(page).toHaveScreenshot(`isolated-sheet-${frame?'iframe':'direct'}-${theme}.png`,{maxDiffPixelRatio:.01});
 }
 await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await expect(page.locator('.jhs-image-viewer-source')).toHaveCount(0);
 if(frame){await page.keyboard.press('Escape');await expect(page.locator('.layui-layer')).toHaveCount(0);}
 await expect.poll(()=>page.locator('body').evaluate(n=>n.style.overflow)).toBe('');
});

for(const [width,height] of [[906,1784],[1000,1999],[1280,20000]])test(`typed contact sheet fits width and zooms at ${width}x${height}`,async({page,context})=>{
 const detail=await boot(page,context);await context.route('https://images.example.test/typed.svg',r=>r.fulfill({contentType:'image/svg+xml',body:svg(width,height)}));
 await insertSheet(detail,{url:'https://images.example.test/typed.svg'});await detail.getByRole('button',{name:'查看缩略图',exact:true}).click();await expectSheet(page);
 const before=await image(page).boundingBox();await page.mouse.move(80,180);await page.mouse.down();await page.mouse.move(80,60,{steps:8});await page.mouse.up();
 await expect.poll(()=>image(page).evaluate(n=>n.getBoundingClientRect().top)).toBeLessThan(before.y-80);
 await expect(page.locator('.viewer-container')).toHaveCount(1);await page.keyboard.press('Escape');
});

test('contact sheet source removal and failure retry release the preview owner',async({page,context})=>{
 const detail=await boot(page,context);let attempts=0;
 await context.route('https://images.example.test/retry-sheet.svg',r=>++attempts===1?r.abort():r.fulfill({contentType:'image/svg+xml',body:svg(906,1784)}));
 await insertSheet(detail);await detail.getByRole('button',{name:'查看缩略图',exact:true}).click();
 await page.keyboard.press('Escape');
 await detail.evaluate(()=>window.showImageViewer('https://images.example.test/retry-sheet.svg','缩略图',{imageKind:'contact-sheet',owner:document.querySelector('.screen-container'),trigger:document.querySelector('.jhs-screenshot-open')}));
 await expect(page.getByRole('button',{name:'重试图片',exact:true})).toBeVisible();await page.getByRole('button',{name:'重试图片',exact:true}).click();await expectSheet(page);
 await detail.locator('.screen-container').evaluate(n=>n.remove());await expect(page.locator('.viewer-container')).toHaveCount(0);expect(await page.locator('body').evaluate(n=>n.style.overflow)).toBe('');
});

test('list screenshot uses contact-sheet zoom for the real sub-2 dimensions',async({page,context})=>{
 await routes(context);await page.goto('https://javdb.com/');await page.locator('.tags').evaluateAll(nodes=>nodes.forEach(n=>n.style.removeProperty('display')));await injectUserscriptRuntime(page,{...config('dark'),settingOverrides:{...config('dark').settingOverrides,enableScreenSvg:'yes'}});
 await page.evaluate(()=>{window.unsafeWindow.pluginManager.getBean('CoverButtonPlugin').screenshot.resolve=async()=>({url:'https://images.example.test/sheet.svg'});});
 const trigger=page.locator('.screenSvg').first();await trigger.click();await expectSheet(page);await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
});

for(const source of ['fc2','123av'])test(`${source} photographs and contact sheet have separate sequences`,async({page,context})=>{
 await routes(context);await page.goto('https://javdb.com/search_advanced?type=3');await injectUserscriptRuntime(page,config('dark'));
 await page.evaluate(source=>{
  const fc2=window.unsafeWindow.pluginManager.getBean('Fc2Plugin'),get=fc2.getRuntimeService.bind(fc2);
  const movie=get('movie');movie.detail=async()=>({title:'Gallery fixture',carNum:'FC2-4959150',imageUrls:['https://images.example.test/full-0.svg','https://images.example.test/1.svg']});movie.images=async()=>[{url:'https://images.example.test/full-0.svg'},{url:'https://images.example.test/1.svg'}];movie.people=async()=>({actors:[]});movie.resolve=async()=>({movieId:'fixture-id'});
  fc2.fetchAndRenderNativeMagnets=async()=>{};fc2.configureJavDbWantButton=async()=>{};
  fc2.getRuntimeService=name=>name==='screenshot'?{isEnabled:()=>true,getScreenshotSettings:()=>({mode:'auto'}),getEnabledProviders:()=>[{id:'javstore'}],resolve:async()=>[{url:'https://images.example.test/sheet.svg'}]}:get(name);
  window.unsafeWindow.settingsService.set('enableLoadScreenShot','yes');fc2.openFc2Dialog('fixture-id','FC2-4959150','https://javdb.com/v/fc2-fixture',{source});
 },source);
 const photo=page.getByRole('button',{name:'查看剧照 2',exact:true}),sheet=page.getByRole('button',{name:'查看缩略图大图',exact:true});await expect(sheet).toBeVisible();
 await photo.click();await expect(page.locator('.jhs-image-viewer-count')).toHaveText('2 / 2');await expect(page.locator('.jhs-image-viewer-source img')).toHaveCount(2);
 await page.keyboard.press('ArrowRight');await expect(page.locator('.jhs-image-viewer-count')).toHaveText('2 / 2');await page.keyboard.press('Escape');
 await sheet.click();await expectSheet(page);await page.keyboard.press('Escape');await expect(sheet).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('.layui-layer')).toHaveCount(0);await expect.poll(()=>page.locator('body').evaluate(n=>n.style.overflow)).toBe('');
});

for(const frame of [false,true])test(`detail screenshot retry stays at the current position ${frame?'iframe':'direct'}`,async({page,context})=>{
 const detail=await boot(page,context,{frame});
 await detail.evaluate(async()=>{
  const screenshot=window.unsafeWindow.pluginManager.getBean('Fc2Plugin').getRuntimeService('screenshot');
  window.__sheetAttempts=0;
  screenshot.resolve=()=>{window.__sheetAttempts++;return window.__sheetAttempts===1?Promise.resolve(null):new Promise((resolve,reject)=>{window.__finishSheet=resolve;window.__failSheet=reject;});};
  const gallery=document.querySelector('.columns.preview'),space=document.createElement('div');space.style.height='1800px';gallery.before(space);const after=space.cloneNode();after.style.height='1400px';gallery.after(after);
  await window.unsafeWindow.settingsService.set('enableLoadScreenShot','yes');
 });
 const tile=detail.locator('.screen-container'),retry=tile.locator('button.retry-link');await expect(retry).toHaveText('重试');await retry.scrollIntoViewIfNeeded();await retry.hover();
 const box=await retry.boundingBox(),before=await detail.evaluate(()=>({y:scrollY,hash:location.hash}));await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 await expect(tile.getByRole('status')).toHaveText('正在重试…');await expect(retry).toHaveText('重试中…');await expect(retry).toBeFocused();await expect(tile).toHaveAttribute('aria-busy','true');
 await page.keyboard.press('Enter');expect(await detail.evaluate(()=>window.__sheetAttempts)).toBe(2);
 expect(await detail.evaluate(()=>({y:scrollY,hash:location.hash}))).toEqual(before);
 await detail.evaluate(()=>window.__finishSheet(null));await expect(tile.getByRole('status')).toHaveText('暂无缩略图');await expect(tile.getByRole('button',{name:'重试',exact:true})).toBeFocused();
 await tile.getByRole('button',{name:'重试',exact:true}).click();await detail.evaluate(()=>window.__failSheet(new Error('offline')));await expect(tile.getByRole('status')).toHaveText('缩略图加载失败');
 await tile.getByRole('button',{name:'重试',exact:true}).click();await detail.evaluate(()=>window.__finishSheet([{url:'https://images.example.test/sheet.svg'}]));
 const open=tile.getByRole('button',{name:'查看缩略图',exact:true});await expect(open).toBeVisible();await expect(open).toBeFocused();expect(await detail.evaluate(()=>location.hash)).toBe(before.hash);
 await open.click();await expectSheet(page);await page.keyboard.press('Escape');await expect(open).toBeFocused();
});

test('typed contact sheet loading after close cannot reopen the viewer',async({page,context})=>{
 const detail=await boot(page,context);let finish;const requested=new Promise(resolve=>{finish=resolve;});let started;
 const loading=new Promise(resolve=>{started=resolve;});await context.route('https://images.example.test/slow-sheet.svg',async route=>{started();await requested;await route.fulfill({contentType:'image/svg+xml',body:svg(906,1784)});});
 await insertSheet(detail);const trigger=detail.getByRole('button',{name:'查看缩略图',exact:true});
 await detail.evaluate(()=>window.showImageViewer('https://images.example.test/slow-sheet.svg','缩略图',{imageKind:'contact-sheet',owner:document.querySelector('.screen-container'),trigger:document.querySelector('.jhs-screenshot-open')}));
 await loading;await expect(page.locator('.viewer-container')).toBeVisible();await page.keyboard.press('Escape');finish();
 await expect(page.locator('.viewer-container,.jhs-image-viewer-source')).toHaveCount(0);await expect(trigger).toBeFocused();await expect.poll(()=>page.locator('body').evaluate(n=>n.style.overflow)).toBe('');
});

test('JavBus native photos exclude the separately opened sub-2 contact sheet',async({page,context})=>{
 await routes(context);await page.goto('https://www.javbus.com/ABC-123');
 await page.locator('#sample-waterfall').evaluate(root=>{root.style.display='flex';root.style.flexWrap='wrap';root.style.gap='8px';for(let i=0;i<2;i++){const anchor=document.createElement('a');anchor.className='sample-box';anchor.href=`https://images.example.test/full-${i}.svg`;const image=document.createElement('img');image.src=`https://images.example.test/thumb-${i}.svg`;image.width=144;image.height=96;anchor.append(image);root.append(anchor);}const tile=document.createElement('div');tile.className='sample-box screen-container jhs-layout-b5c4e4f7';tile.style.width='144px';const button=document.createElement('button');button.className='jhs-screenshot-open';button.type='button';button.setAttribute('aria-label','查看缩略图');const image=document.createElement('img');image.src='https://images.example.test/sheet.svg';button.append(image);tile.append(button);root.append(tile);});
 await injectUserscriptRuntime(page,config('dark'));await page.locator('a.sample-box').first().click();await expect(page.locator('.jhs-image-viewer-count')).toHaveText('1 / 2');
 await image(page).hover();await page.mouse.wheel(0,120);await expect(page.locator('.jhs-image-viewer-count')).toHaveText('2 / 2');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'查看缩略图',exact:true}).click();await expectSheet(page);
});

test('sub-2 contact sheet supports touch pinch and drag without photo navigation',async({page,context},info)=>{
 test.skip(!info.project.use.hasTouch,'touch projects');const detail=await boot(page,context);await insertSheet(detail);await detail.getByRole('button',{name:'查看缩略图',exact:true}).tap();
 await expect(page.locator('.jhs-image-viewer-count')).toHaveText('1 / 1');const width=await image(page).evaluate(n=>n.getBoundingClientRect().width),cdp=await context.newCDPSession(page);
 const points=[{id:1,x:80,y:180},{id:2,x:180,y:180}];await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...points[0],x:50},{...points[1],x:210}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>image(page).evaluate(n=>n.getBoundingClientRect().width)).toBeGreaterThan(width*1.2);const top=await image(page).evaluate(n=>n.getBoundingClientRect().top);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:150,y:220}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:150,y:100}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>image(page).evaluate(n=>n.getBoundingClientRect().top)).toBeLessThan(top-50);await expect(image(page)).toHaveAttribute('src','https://images.example.test/sheet.svg');await expect(page.locator('.jhs-image-viewer-count')).toHaveText('1 / 1');await cdp.detach();
});
