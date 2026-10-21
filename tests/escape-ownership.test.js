// @vitest-environment jsdom
import {afterEach,it,expect,vi} from "vitest";
import jquery from "jquery";
import {Utils} from "../src/core/utils.js";
afterEach(()=>{jquery(document).off(".globalLayerEsc .afterOwner");document.body.replaceChildren();Utils.instance=null;vi.unstubAllGlobals();});
function mount() {
    vi.stubGlobal("$",jquery);vi.stubGlobal("clog",{warn:vi.fn()});
    document.body.innerHTML='<div class="layui-layer" id="layui-layer1"><iframe id="layui-layer-iframe1"></iframe></div>';
    const utils=new Utils();
    vi.stubGlobal("layer",{close:id=>{document.getElementById(`layui-layer${id}`)?.remove();utils.releaseEscClose(id);}});
    utils.setupEscClose(1);
    return {utils,frame:document.querySelector("iframe").contentDocument};
}
it("respects an Escape event already consumed by a child",()=>{
    const {utils}=mount(),event=jquery.Event("keydown",{key:"Escape"});event.preventDefault();
    utils._handleGlobalEscKey(event);
    expect(document.querySelector("#layui-layer1")).not.toBeNull();
});
it.each(["fancybox-is-open","fancybox-is-closing"])("keeps the parent while iframe preview is %s",state=>{
    const {frame}=mount();
    frame.body.innerHTML=`<div class="fancybox-container ${state}"><button>preview</button></div>`;
    const overlay=frame.querySelector("div");
    overlay.getClientRects=()=>[{width:100,height:100}];
    frame.querySelector("button").dispatchEvent(new frame.defaultView.KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));
    expect(document.querySelector("#layui-layer1")).not.toBeNull();
    overlay.remove();
    frame.body.dispatchEvent(new frame.defaultView.KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));
    expect(document.querySelector("#layui-layer1")).toBeNull();
});
it("a hidden preview container does not swallow parent Escape",()=>{
    const {frame}=mount();frame.body.innerHTML='<div class="fancybox-container" style="display:none"></div>';
    frame.body.dispatchEvent(new frame.defaultView.KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));
    expect(document.querySelector("#layui-layer1")).toBeNull();
});
it("rebinds Escape after the iframe document is replaced and cleans up on close",()=>{
    const {utils,frame:initialDocument}=mount();
    const iframe=document.querySelector("iframe"),loadedDocument=document.implementation.createHTMLDocument("Loaded detail");
    Object.defineProperty(iframe,"contentDocument",{configurable:true,value:loadedDocument});
    iframe.dispatchEvent(new Event("load"));

    initialDocument.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));
    expect(document.querySelector("#layui-layer1")).not.toBeNull();
    loadedDocument.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));

    expect(document.querySelector("#layui-layer1")).toBeNull();
    expect(utils.iframeEscBindings.size).toBe(0);
    expect(iframe.hasAttribute("data-esc-bound")).toBe(false);
});
it("a preview owned by a lower layer does not block closing the upper layer",()=>{
    const {utils}=mount();
    const overlay=document.createElement("div");overlay.className="fancybox-container fancybox-is-open";
    overlay.getClientRects=()=>[{width:100,height:100}];document.querySelector("#layui-layer1").append(overlay);
    const upper=document.createElement("div");upper.className="layui-layer";upper.id="layui-layer2";document.body.append(upper);utils.setupEscClose(2);
    upper.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));
    expect(document.querySelector("#layui-layer2")).toBeNull();
    expect(document.querySelector("#layui-layer1")).not.toBeNull();
});

it("leaves Escape from a visible child Layer to the iframe runtime",()=>{
    const {frame}=mount();
    frame.body.innerHTML='<div class="layui-layer"><button>字幕预览</button></div>';
    frame.querySelector(".layui-layer").getClientRects=()=>[{width:100,height:100}];
    frame.querySelector("button").dispatchEvent(new frame.defaultView.KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));
    expect(document.querySelector("#layui-layer1")).not.toBeNull();
    frame.querySelector(".layui-layer").remove();
    frame.body.dispatchEvent(new frame.defaultView.KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));
    expect(document.querySelector("#layui-layer1")).toBeNull();
});

it("consumes a local Layer Escape before later document listeners",()=>{
    mount(); const later=vi.fn(); jquery(document).on("keydown.afterOwner",later);
    const event=new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}); document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); expect(later).not.toHaveBeenCalled(); jquery(document).off(".afterOwner");
});

it("does not close a Layer while the source document has native fullscreen media",()=>{
    const {frame}=mount(); const video=frame.createElement("video"); frame.body.append(video);
    Object.defineProperty(frame,"fullscreenElement",{configurable:true,value:video});
    const event=new frame.defaultView.KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}); video.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false); expect(document.querySelector("#layui-layer1")).not.toBeNull();
});
