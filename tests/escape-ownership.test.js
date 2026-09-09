// @vitest-environment jsdom
import {afterEach,it,expect,vi} from "vitest";
import jquery from "jquery";
import {Utils} from "../src/core/utils.js";
afterEach(()=>{jquery(document).off(".globalLayerEsc");document.body.replaceChildren();Utils.instance=null;vi.unstubAllGlobals();});
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
it("a preview owned by a lower layer does not block closing the upper layer",()=>{
    const {utils}=mount();
    const overlay=document.createElement("div");overlay.className="fancybox-container fancybox-is-open";
    overlay.getClientRects=()=>[{width:100,height:100}];document.querySelector("#layui-layer1").append(overlay);
    const upper=document.createElement("div");upper.className="layui-layer";upper.id="layui-layer2";document.body.append(upper);utils.setupEscClose(2);
    upper.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));
    expect(document.querySelector("#layui-layer2")).toBeNull();
    expect(document.querySelector("#layui-layer1")).not.toBeNull();
});
