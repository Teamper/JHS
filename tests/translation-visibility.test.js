import {afterEach,expect,it,vi} from "vitest";
import {JSDOM} from "jsdom";
import {LifecycleScope} from "../src/core/lifecycle-scope.js";
import {ExternalBridgeTranslationController} from "../src/features/translation/translation-controller.js";
import {installVisibleLayout} from "./helpers/visible-layout.js";

const owned=[];
afterEach(()=>{for(const {scope,dom} of owned.splice(0)){scope.dispose();dom.window.close();}vi.unstubAllGlobals();});
function setup(translate=vi.fn(async text=>({text:`译文 ${text}`,source:{name:"配置模型"},usage:{total_tokens:2},cacheHit:false}))){
    const dom=new JSDOM('<body><div class="movie-list"><article class="item" id="visible"><a><div class="video-title"><strong>ABC-123</strong> 原题</div></a></article><article class="item" id="later"><a><div class="video-title"><strong>DEF-456</strong> 后续原题</div></a></article></div></body>',{url:"https://javdb.com/"});
    installVisibleLayout(dom.window);dom.window.isListPage=true;
    const visible=dom.window.document.querySelector("#visible"),later=dom.window.document.querySelector("#later");
    let laterTop=2000;later.getBoundingClientRect=()=>new dom.window.DOMRect(10,laterTop,200,30);
    let callback,disconnect=vi.fn();
    dom.window.IntersectionObserver=class{constructor(run){callback=run;}observe(){}unobserve(){}disconnect(){disconnect();}};
    const settings=new EventTarget();settings.snapshot=()=>({translateTitle:"yes"});
    const privacy=new EventTarget();privacy.masked=false;privacy.targets=()=>["title"];
    const translation=new EventTarget();translation.translateDetailed=translate;
    const scope=new LifecycleScope("visible-translation");owned.push({scope,dom});
    const controller=new ExternalBridgeTranslationController({document:dom.window.document,window:dom.window,route:"list",hostAdapter:{site:"javdb",getListSelectors:()=>({itemSelector:".movie-list .item"})},listPage:null,settings,privacy,translation,styles:{},diagnostics:{recordError:vi.fn()},scope});
    controller.start();
    return {dom,scope,controller,visible,later,settings,privacy,translation,translate,disconnect,enterLater(){laterTop=10;callback([{target:later,isIntersecting:true}]);}};
}

it("schedules visible cards, starts later cards after intersection, and shows only the translated title",async()=>{
    const state=setup();
    await vi.waitFor(()=>expect(state.visible.getAttribute("data-jhs-translation-key")).toBe("ABC-123"));
    expect(state.translate).toHaveBeenCalledOnce();expect(state.later.textContent).not.toContain("译文");
    expect(state.visible.querySelector(".jhs-translation-meta")).toBeNull();
    expect(state.visible.textContent).toContain("译文");
    state.enterLater();await vi.waitFor(()=>expect(state.later.textContent).toContain("译文"));
    expect(state.translate).toHaveBeenCalledTimes(2);
    expect(state.translate.mock.calls[1][1]).toMatchObject({automatic:true,canDispatch:expect.any(Function)});
    state.scope.dispose();expect(state.disconnect).toHaveBeenCalledOnce();
});

it("cancels automatic consumers on masking and suppresses late results until reveal",async()=>{
    let release;const translate=vi.fn(()=>new Promise(resolve=>{release=resolve;}));const state=setup(translate);
    await vi.waitFor(()=>expect(translate).toHaveBeenCalledOnce());
    const consumer=translate.mock.calls[0][1].scope;
    state.privacy.masked=true;state.privacy.dispatchEvent(new Event("privacy.changed"));
    expect(consumer.signal.aborted).toBe(true);expect(translate.mock.calls[0][1].canDispatch()).toBe(false);
    release({text:"迟到译文",source:{name:"模型"},usage:{},cacheHit:false});await new Promise(resolve=>setTimeout(resolve));
    expect(state.visible.textContent).toContain("原题");expect(state.visible.textContent).not.toContain("迟到译文");
    expect(translate).toHaveBeenCalledOnce();
    state.privacy.masked=false;state.privacy.dispatchEvent(new Event("privacy.changed"));
    await vi.waitFor(()=>expect(translate).toHaveBeenCalledTimes(2));
    release({text:"恢复译文",source:{name:"模型"},usage:{},cacheHit:false});
    await vi.waitFor(()=>expect(state.visible.textContent).toContain("恢复译文"));
});

it("retranslates original titles on configuration changes and blocks hidden-page dispatch",async()=>{
    const state=setup();await vi.waitFor(()=>expect(state.visible.textContent).toContain("译文"));
    state.translation.dispatchEvent(new Event("translation.changed"));
    await vi.waitFor(()=>expect(state.translate).toHaveBeenCalledTimes(2));
    expect(state.translate.mock.calls[1][0]).toBe("原题");
    Object.defineProperty(state.dom.window.document,"visibilityState",{configurable:true,get:()=>"hidden"});
    state.dom.window.document.dispatchEvent(new state.dom.window.Event("visibilitychange"));
    expect(state.translate.mock.calls[1][1].canDispatch()).toBe(false);
    expect(state.visible.textContent).not.toContain("译文");
    expect(state.translate).toHaveBeenCalledTimes(2);
});
it("uses the hidden original text with its visible native heading as the presentation target",async()=>{
    const dom=new JSDOM('<body><h1><strong class="current-title">宿主译名</strong><span class="origin-title" style="display:none">日本語の原題</span></h1></body>',{url:"https://javdb.com/v/movie"});
    installVisibleLayout(dom.window);const scope=new LifecycleScope("native-original-title");owned.push({scope,dom});
    const settings=new EventTarget();settings.snapshot=()=>({translateTitle:"yes"});
    const translate=vi.fn(async()=>"配置服务译文");
    const controller=new ExternalBridgeTranslationController({document:dom.window.document,window:dom.window,route:"detail",hostAdapter:{readMovieRef:()=>({carNum:"ABC-123"})},listPage:null,settings,translation:{translate},styles:{},diagnostics:{recordError:vi.fn()},scope});
    controller.start();await vi.waitFor(()=>expect(dom.window.document.querySelector(".translated-title")?.textContent).toBe("配置服务译文"));
    expect(translate).toHaveBeenCalledWith("日本語の原題",expect.objectContaining({automatic:true}));
    expect(dom.window.document.querySelector(".current-title").nextElementSibling.className).toBe("translated-title");
    expect(dom.window.document.querySelector(".origin-title").textContent).toBe("日本語の原題");
});
