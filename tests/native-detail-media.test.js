import {afterEach,describe,expect,it,vi} from "vitest";
import jqueryFactory from "jquery";
import {applyLayoutFromSettings} from "../src/services/layout-settings-service.js";
import {JSDOM} from "jsdom";
import {LifecycleScope} from "../src/core/lifecycle-scope.js";
import {JavDbHostAdapter} from "../src/platform/hosts/javdb-host-adapter.js";
import {JavBusHostAdapter} from "../src/platform/hosts/javbus-host-adapter.js";
import {NativeDetailMediaController} from "../src/features/detail/native-detail-media-controller.js";
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
afterEach(()=>vi.unstubAllGlobals());
function setup(content='', ui) {
 const dom=new JSDOM(`<main class="video-detail"><section class="columns preview">${content}</section><section class="recommendations"><div class="movie-list"><div class="item"><a href="/v/other"><div class="cover"><img src="/cover.jpg"></div><div class="video-title">原推荐标题</div></a></div></div></section></main>`,{url:'https://javdb.com/v/test'});
 vi.stubGlobal('MutationObserver',dom.window.MutationObserver);
 const scope=new LifecycleScope('test'),host=new JavDbHostAdapter(dom.window.document,dom.window.location),controller=new NativeDetailMediaController({hostAdapter:host,scope,ui});controller.start();return {dom,scope,host,controller,doc:dom.window.document};
}
const gallery='<div class="preview-images"><div class="tile-images"><div class="tile-wrapper"><a class="tile-item" href="/full.jpg" data-action="click->gallery#show"><img src="/thumb.jpg" loading="lazy"></a></div></div></div>';
describe('native media boundaries',()=>{
 it('leaves a late contact sheet to its own listener and excludes it from ordinary photo sequences',async()=>{
  const openImageViewer=vi.fn(), {doc,dom,host,scope}=setup(gallery,{openImageViewer});
  const first=doc.querySelector('.tile-item');first.querySelector('img').click();
  expect(openImageViewer.mock.calls[0][1].imageKind).toBe('photo');
  const sheet=doc.createElement('a');sheet.className='tile-item screen-container';sheet.innerHTML='<img src="/sheet.jpg" alt="缩略图">';
  first.before(sheet);await tick();
  const ownClick=vi.fn();sheet.addEventListener('click',ownClick);
  sheet.querySelector('img').click();
  expect(ownClick).toHaveBeenCalledOnce();expect(openImageViewer).toHaveBeenCalledTimes(1);
  expect(host.getDetailImageSequence().map(entry=>entry.url)).toEqual(['https://javdb.com/full.jpg']);
  first.querySelector('img').click();expect(openImageViewer.mock.calls[1][1].images).toEqual([{url:'https://javdb.com/full.jpg',alt:''}]);
  scope.dispose();dom.window.close();
 });
 it('excludes JavBus contact-sheet buttons from its native photograph sequence',()=>{
  const dom=new JSDOM('<div class="container"><div class="row movie"></div><div id="sample-waterfall"><a class="sample-box" href="/full.jpg"><img src="/thumb.jpg"></a><div class="sample-box screen-container"><button class="jhs-screenshot-open"><img src="/sheet.jpg"></button></div></div></div>',{url:'https://www.javbus.com/ABC-123'});
  const host=new JavBusHostAdapter(dom.window.document,dom.window.location);
  expect(host.getDetailImageSequence().map(entry=>entry.url)).toEqual(['https://www.javbus.com/full.jpg']);dom.window.close();
 });
 it('passes mapped JavBus URLs only to the Viewer and retains host image links, modified clicks and contact sheets',()=>{
  const original='https://www.prestige-av.com/images/corner/goods/ABC/1.jpg?large=1#image';
  const dom=new JSDOM(`<div class="container"><div class="row movie"></div><div id="sample-waterfall"><a class="sample-box" href="${original}"><img src="/thumb.jpg"></a><a class="sample-box screen-container" href="${original}"><img src="/sheet.jpg"></a></div></div>`,{url:'https://www.javbus.com/ABC-123'});
  const scope=new LifecycleScope('javbus-media'),host=new JavBusHostAdapter(dom.window.document,dom.window.location),openImageViewer=vi.fn();
  new NativeDetailMediaController({hostAdapter:host,scope,ui:{openImageViewer}}).start();
  const anchor=dom.window.document.querySelector('a'),image=anchor.querySelector('img'),hostClick=vi.fn();anchor.addEventListener('click',hostClick);
  image.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
  expect(openImageViewer.mock.calls[0][1].images).toEqual([{url:'https://image.mgstage.com/images/ABC/1.jpg?large=1#image',alt:''}]);
  expect(anchor.getAttribute('href')).toBe(original);expect(image.getAttribute('src')).toBe('/thumb.jpg');expect(hostClick).not.toHaveBeenCalled();
  for(const options of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}]) image.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true,...options}));
  expect(hostClick).toHaveBeenCalledTimes(5);
  const sheet=dom.window.document.querySelector('.screen-container'),sheetClick=vi.fn();sheet.addEventListener('click',sheetClick);sheet.querySelector('img').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));
  expect(sheetClick).toHaveBeenCalledOnce();expect(openImageViewer).toHaveBeenCalledOnce();expect(host.getDetailImageSequence()).toHaveLength(1);
  scope.dispose();dom.window.close();
 });
 it('takes over unmodified image clicks using full URLs while retaining host links and modified clicks',()=>{
  const openImageViewer=vi.fn();const {doc,dom,scope}=setup(gallery.replace('</div></div></div>','<a class="preview-video-container" href="#preview-video"><img src="/video.jpg"></a><a href="/v/metadata-not-yet-loaded"><img src="/movie.jpg"></a></div></div></div>'),{openImageViewer});
  const image=doc.querySelector('.tile-item img'),anchor=image.parentElement,hostClick=vi.fn();anchor.addEventListener('click',hostClick);
  image.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
  expect(openImageViewer).toHaveBeenCalledTimes(1);
  const [source,options]=openImageViewer.mock.calls[0];
  expect(source===image).toBe(true);expect(options.images).toEqual([{url:'https://javdb.com/full.jpg',alt:''}]);expect(options.initialViewIndex).toBe(0);expect(options.trigger===anchor).toBe(true);expect(options.owner===anchor).toBe(true);
  expect(hostClick).not.toHaveBeenCalled();expect(anchor.getAttribute('href')).toBe('/full.jpg');expect(image.getAttribute('src')).toBe('/thumb.jpg');
  for(const options of [{ctrlKey:true},{metaKey:true},{button:1}]) image.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true,...options}));
  expect(openImageViewer).toHaveBeenCalledTimes(1);expect(hostClick).toHaveBeenCalledTimes(3);
  doc.querySelector('.preview-video-container').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));
  doc.querySelector('.recommendations a').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));
  expect(openImageViewer).toHaveBeenCalledTimes(1);scope.dispose();dom.window.close();
 });
 it('separates real JavDB movie tiles from screenshot tiles and preserves their information',async()=>{
  const {doc,host,scope,dom}=setup(gallery);
  const panel=doc.createElement('section');panel.className='message video-panel';
  panel.innerHTML='<div class="message-header">TA(们)还出演过</div><div class="message-body"><div class="tile-images tile-small"><a class="tile-item" href="/v/native"><img src="/thumb.jpg" loading="lazy"><div class="video-number">REC-123</div><div class="video-title">宿主影片名称</div></a></div></div>';
  doc.querySelector('main').append(panel);await tick();
  const list=panel.querySelector('.tile-images'),card=list.querySelector('a'),number=card.querySelector('.video-number'),title=card.querySelector('.video-title');
  expect(host.getDetailGalleryBoundaries()).toHaveLength(1);expect(host.getDetailRecommendationBoundaries()).toHaveLength(2);
  expect(list.hasAttribute('data-jhs-native-recommendations')).toBe(true);expect(list.hasAttribute('data-jhs-native-gallery')).toBe(false);expect(card.hasAttribute('data-jhs-gallery-item')).toBe(false);
  expect(card.querySelector('.video-number')).toBe(number);expect(number.textContent).toBe('REC-123');expect(card.querySelector('.video-title')).toBe(title);expect(title.textContent).toBe('宿主影片名称');expect(card.getAttribute('href')).toBe('/v/native');
  const replacement=list.cloneNode(true);list.replaceWith(replacement);await tick();expect(replacement.hasAttribute('data-jhs-native-recommendations')).toBe(true);expect(replacement.querySelector('[data-jhs-gallery-item]')).toBeNull();
  scope.dispose();expect(doc.querySelectorAll('[data-jhs-native-recommendations],[data-jhs-gallery-item]')).toHaveLength(0);dom.window.close();
 });
 it('releases gallery markers and listeners when delayed movie metadata identifies a recommendation',async()=>{
  const {doc,host,scope,controller,dom}=setup('<div class="tile-images"><a class="tile-item" href="/v/late"><img src="/thumb.jpg"></a></div>');
  const list=doc.querySelector('.tile-images'),card=list.querySelector('a');expect(list.hasAttribute('data-jhs-native-gallery')).toBe(true);
  card.insertAdjacentHTML('beforeend','<div class="video-number">LATE-123</div><div class="video-title">延迟影片名称</div>');await tick();
  expect(host.getDetailGalleryBoundaries()).toHaveLength(0);expect(controller.galleries.size).toBe(0);expect(list.hasAttribute('data-jhs-native-gallery')).toBe(false);expect(card.hasAttribute('data-jhs-gallery-item')).toBe(false);expect(list.hasAttribute('data-jhs-native-recommendations')).toBe(true);expect(list.querySelector('.jhs-native-gallery-state')).toBeNull();
  scope.dispose();expect(controller.scope.snapshot().observers).toBe(0);expect(controller.scope.snapshot().listeners).toBe(0);dom.window.close();
 });
 it('preserves nested anchors, image attributes and native events; releases all observers',()=>{
  const {doc,host,scope,controller,dom}=setup(gallery);const anchor=doc.querySelector('.tile-item'),handler=vi.fn();anchor.addEventListener('click',handler);anchor.dispatchEvent(new dom.window.Event('click'));
  expect(handler).toHaveBeenCalledOnce();expect(anchor.getAttribute('href')).toBe('/full.jpg');expect(anchor.dataset.action).toBe('click->gallery#show');expect(anchor.querySelector('img').loading??anchor.querySelector('img').getAttribute('loading')).toBe('lazy');
  expect(host.getDetailGalleryBoundaries()).toHaveLength(1);expect(host.locateNativeGallery()).toBe(doc.querySelector('.tile-images'));expect(doc.querySelector('[data-jhs-gallery-wrapper]')).toBe(doc.querySelector('.tile-wrapper'));expect(doc.querySelectorAll('[data-jhs-gallery-item]')).toHaveLength(1);expect(host.locateListRoot()).toBeNull();expect(host.getListLayoutContainer()).toBeNull();expect(doc.querySelector('.movie-list').hasAttribute('data-jhs-native-recommendations')).toBe(true);
  scope.dispose();expect(controller.scope.snapshot().observers).toBe(0);expect(controller.scope.snapshot().listeners).toBe(0);expect(doc.querySelectorAll('[data-jhs-gallery-item],[data-jhs-native-recommendations]')).toHaveLength(0);expect(anchor.isConnected).toBe(true);dom.window.close();
 });
 it('adapts delayed nested insertion and replacement, and transitions failed images back to loaded',async()=>{
  const {doc,controller,scope,dom}=setup();doc.querySelector('.preview').insertAdjacentHTML('beforeend',gallery);await tick();expect(doc.querySelectorAll('[data-jhs-gallery-item]')).toHaveLength(1);
  const old=doc.querySelector('.preview-images');old.replaceWith(old.cloneNode(true));await tick();const image=doc.querySelector('.tile-item img');Object.defineProperties(image,{complete:{value:true,configurable:true},naturalWidth:{value:0,configurable:true}});image.dispatchEvent(new dom.window.Event('error'));expect(doc.querySelector('.jhs-native-gallery-state').textContent).toContain('加载失败');Object.defineProperty(image,'naturalWidth',{value:120});image.dispatchEvent(new dom.window.Event('load'));expect(doc.querySelector('.jhs-native-gallery-state')).toBeNull();expect(controller.galleries.size).toBe(1);scope.dispose();dom.window.close();
 });
 it('preserves both recommendation structures and inherits saved columns on late insertion',async()=>{
  const {doc,scope,dom,host}=setup(gallery);vi.stubGlobal('$',jqueryFactory(dom.window));vi.stubGlobal('window',dom.window);
  const first=doc.querySelector('.recommendations .item'),title=first.querySelector('.video-title'),image=first.querySelector('img');
  const nativeText=title.textContent,link=first.querySelector('a');const click=vi.fn();link.addEventListener('click',click);
  await applyLayoutFromSettings({containerColumns:4,enableVerticalModel:'no'},{hostAdapter:host,mobile:false});
  const second=doc.createElement('section');second.className='suggestions';second.innerHTML='<div class="movie-list"><div class="item"><a href="/v/sibling"><div class="cover"><img src="/sibling.jpg"></div></a><div class="video-title"><strong>REC-2</strong> 原有影片名称与很长的别名</div><div class="meta">2026-09-08</div><div class="score">4.2 · 100 人评价</div></div></div>';
  doc.querySelector('main').after(second);await tick();
  expect(doc.querySelectorAll('[data-jhs-native-recommendations]')).toHaveLength(2);
  expect(doc.querySelector('.recommendations .video-title')).toBe(title);expect(title.textContent).toBe(nativeText);expect(doc.querySelector('.recommendations img')).toBe(image);expect(link.getAttribute('href')).toBe('/v/other');
  link.dispatchEvent(new dom.window.Event('click'));expect(click).toHaveBeenCalledOnce();
  expect(second.querySelector('strong').textContent).toBe('REC-2');expect(second.querySelector('.meta').textContent).toBe('2026-09-08');expect(second.querySelector('.score').textContent).toContain('100');
  expect(second.querySelector('.movie-list').style.getPropertyValue('--jhs-recommendation-columns')).toBe('4');
  second.querySelector('.movie-list').replaceWith(second.querySelector('.movie-list').cloneNode(true));await tick();
  expect(second.querySelector('[data-jhs-native-recommendations]')).not.toBeNull();
  expect(doc.querySelector('main').style.getPropertyValue('--jhs-recommendation-columns')).toBe('4');
  await applyLayoutFromSettings({containerColumns:4,enableVerticalModel:'no'},{hostAdapter:host,mobile:true});expect(doc.querySelector('main').style.getPropertyValue('--jhs-recommendation-columns')).toBe('2');expect(second.querySelector('.movie-list').style.getPropertyValue('--jhs-recommendation-columns')).toBe('2');
  expect(doc.querySelector('[data-jhs-primary-list]')).toBeNull();scope.dispose();dom.window.close();
 });
 it('gives an empty gallery a bounded textual state',()=>{const {doc,scope,dom}=setup('<div class="tile-images"></div>');expect(doc.querySelector('.jhs-native-gallery-state').textContent).toBe('暂无图集');scope.dispose();dom.window.close();});
});
