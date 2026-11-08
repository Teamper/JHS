import {afterEach,expect,it,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {LifecycleScope} from '../src/core/lifecycle-scope.js';
import {JavDbHostAdapter} from '../src/platform/hosts/javdb-host-adapter.js';
import {ExternalBridgeTranslationController} from '../src/features/translation/translation-controller.js';
import {installVisibleLayout} from './helpers/visible-layout.js';

const markup='<main class="video-detail"><div class="tile-images tile-small"><a class="tile-item" href="/v/other"><img src="/cover.jpg"><div class="video-number">REC-123</div><div class="video-title" title="原提示"> 原始标题 </div></a></div></main>';
function setup(translate=vi.fn(async()=> '推荐译文'),enabled='yes') {
    const dom=new JSDOM(markup,{url:'https://javdb.com/v/test'});
    installVisibleLayout(dom.window);
    vi.stubGlobal('MutationObserver',dom.window.MutationObserver);
    const scope=new LifecycleScope('recommendation-test'),settings=new EventTarget();
    settings.value=enabled;settings.snapshot=()=>({translateTitle:settings.value});
    settings.set=value=>{settings.value=value;const event=new Event('settings.changed');event.detail={names:['translateTitle']};settings.dispatchEvent(event);};
    const controller=new ExternalBridgeTranslationController({document:dom.window.document,window:dom.window,route:'detail',hostAdapter:new JavDbHostAdapter(dom.window.document,dom.window.location),settings,translation:{translate},scope,diagnostics:{recordError:vi.fn()}});
    controller.start();return {dom,scope,settings,translate,controller,card:dom.window.document.querySelector('a'),title:dom.window.document.querySelector('.video-title')};
}
afterEach(()=>vi.unstubAllGlobals());
it('translates both initial and delayed recommendation cards, retaining source nodes, number and links, and restores exact text when disabled',async()=>{
    const {dom,scope,settings,translate,card,title}=setup();
    await vi.waitFor(()=>expect(title.textContent).toContain('推荐译文'));
    expect(translate).toHaveBeenCalledWith('原始标题',expect.objectContaining({cacheAlias:'REC-123',scope:expect.any(LifecycleScope),automatic:true}));
    expect(card.querySelector('.video-number').textContent).toBe('REC-123');expect(card.getAttribute('href')).toBe('/v/other');
    const next=card.cloneNode(true);next.querySelector('.video-title').textContent='迟到标题';next.querySelector('.video-number').textContent='REC-456';card.parentElement.append(next);
    await vi.waitFor(()=>expect(next.querySelector('.video-title').textContent).toContain('推荐译文'));
    settings.set('no');expect(title.textContent).toBe(' 原始标题 ');expect(title.title).toBe('原提示');expect(next.querySelector('.video-title').textContent).toBe('迟到标题');
    expect(card.querySelector('.video-title')).toBe(title);scope.dispose();dom.window.close();
});
it('makes no recommendation request when translation is off and ignores responses after disable, removal or disposal',async()=>{
    let resolve;const translate=vi.fn(()=>new Promise(done=>{resolve=done;}));
    const {dom,scope,settings,title}=setup(translate,'no');expect(translate).not.toHaveBeenCalled();
    settings.set('yes');await vi.waitFor(()=>expect(translate).toHaveBeenCalledOnce());settings.set('no');resolve('迟到译文');await new Promise(done=>setTimeout(done,0));expect(title.textContent).toBe(' 原始标题 ');
    settings.set('yes');await vi.waitFor(()=>expect(translate).toHaveBeenCalledTimes(2));title.parentElement.remove();resolve('已移除译文');await new Promise(done=>setTimeout(done,0));expect(title.textContent).toBe(' 原始标题 ');scope.dispose();dom.window.close();
});
