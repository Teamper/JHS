// @vitest-environment jsdom
import {it,expect,vi,afterEach} from "vitest";
import jquery from "jquery";
import {UnifiedOfflineController} from "../src/features/external-bridge/unified-offline-controller.js";
import {LifecycleScope} from "../src/core/lifecycle-scope.js";
afterEach(()=>{document.body.replaceChildren();vi.unstubAllGlobals();});
it.each(["disabled","disposed","removed","success"])("checks the actual 123 submission boundary after token read: %s",async mode=>{
    vi.stubGlobal("$",jquery);vi.stubGlobal("show",{ok:vi.fn(),error:vi.fn()});vi.stubGlobal("clog",{error:vi.fn()});
    vi.stubGlobal("utils",{getOwningLayerIndex:()=>null,q:vi.fn()});
    document.body.innerHTML='<button>离线</button>';
    const scope=new LifecycleScope("submit-boundary"),settings={enable123Offline:true};
    let release,started;
    const token=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve),submit=vi.fn(async()=>{}),history=vi.fn(async()=>{});
    const plugin=new UnifiedOfflineController({
        document,window,route:"detail",site:"javdb",hostAdapter:{site:"javdb",locateListItems:()=>[],readMovieRef:()=>({carNum:"ABC-123"})},
        offline:{submitWithIntegration:submit,getIntegrationHomeUrl:()=>"https://pan.example/"},dialog:{},state:{appendOfflineHistory:history},settings:{snapshot:()=>settings},
        styles:{register:vi.fn(()=>()=>{})},events:{on:()=>()=>{}},pan123Credential:{getStoredToken:()=>{started();return token;}},
        ui:{jquery,confirm:vi.fn(),closePage:vi.fn()},notifications:{ok:vi.fn(),error:vi.fn()},diagnostics:{recordError:vi.fn()},scope,
    });
    plugin.lifecycleScope=scope;plugin.registerProviders(scope);plugin.BUTTON_COOLDOWN_MS=0;
    const provider=plugin.registry.providers.get("123");
    plugin.registry.getCandidates=async()=>[{provider,availability:{authState:"ready"}}];
    plugin.getVideoInfo=()=>({carNum:"ABC-123"});
    const button=jquery("button"),pending=plugin.submitResource({},"magnet:?xt=mock",button,{carNum:"ABC-123"},{preferredProviderId:"123"});
    await ready;
    if(mode==="disabled")settings.enable123Offline=false;
    if(mode==="disposed")scope.dispose();
    if(mode==="removed")button.remove();
    release("mock-token");await pending;
    expect(submit).toHaveBeenCalledTimes(mode==="success"?1:0);
    expect(history).toHaveBeenCalledTimes(mode==="success"?1:0);
    if(mode!=="success")expect(button.hasClass("loading")).toBe(false);
    scope.dispose();
});
