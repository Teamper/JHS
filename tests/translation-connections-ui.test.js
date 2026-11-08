import {afterEach,expect,it,vi} from "vitest";
import jquery from "jquery";
import {JSDOM} from "jsdom";
import {LifecycleScope} from "../src/core/lifecycle-scope.js";
import {createTranslationConnections} from "../src/ui/settings/translation-connections.js";
import {normalizeTranslationConfiguration} from "../src/core/translation-model.js";

const owned=[];afterEach(()=>{for(const item of owned.splice(0)){item.scope.dispose();item.dom.window.close();}});
function setup(overrides={}){
    const dom=new JSDOM("<body></body>",{url:"https://javdb.com/"}),scope=new LifecycleScope("translation-config-ui");owned.push({dom,scope});
    vi.stubGlobal("$",jquery(dom.window));
    vi.stubGlobal("document",dom.window.document);
    vi.stubGlobal("window",dom.window);
    const profile={id:"first",name:"配置服务",type:"custom-chat",endpoint:"https://example.test/private-path?token=private-endpoint",model:"configured-model",apiKey:"private-api-key",enabled:true};
    const onSave=vi.fn(async value=>({configuration:normalizeTranslationConfiguration(value),revision:"saved"}));
    const root=createTranslationConnections({document:dom.window.document,scope,state:{configuration:normalizeTranslationConfiguration({schema:1,profiles:[profile],primary:"first",fallbacks:[]}),revision:"initial"},preferences:{},onSave,onTest:vi.fn(),onPreferences:vi.fn(),onBudgetStatus:async()=>({revision:0,limits:{minute:30,day:200},minuteUsed:0,dayUsed:0}),onBudgetSave:vi.fn(),onBudgetOpen:vi.fn(),...overrides});
    dom.window.document.body.append(root);return{dom,scope,root,onSave};
}
const button=(root,text)=>[...root.querySelectorAll("button")].find(node=>node.textContent===text);

it("keeps connection secrets in password controls and preserves focus through asynchronous saves",async()=>{
    let release;const onSave=vi.fn(()=>new Promise(resolve=>{release=resolve;}));const {dom,root}=setup({onSave});
    expect(root.textContent).not.toContain("private-api-key");expect(root.textContent).not.toContain("private-endpoint");
    expect([...root.querySelectorAll('input[type="password"]')].map(input=>input.value)).toEqual(expect.arrayContaining(["private-api-key","https://example.test/private-path?token=private-endpoint"]));
    const save=button(root,"保存服务");save.focus();save.click();save.click();
    await vi.waitFor(()=>expect(onSave).toHaveBeenCalledOnce());expect(save.getAttribute("aria-disabled")).toBe("true");expect(dom.window.document.activeElement).toBe(save);
    release({revision:"saved"});await vi.waitFor(()=>expect(save.hasAttribute("aria-disabled")).toBe(false));
    expect(dom.window.document.activeElement).toBe(save);expect(root.textContent).toContain("服务配置已保存");
});

it("preserves explicit fallback order and disposes listeners for removed rows",async()=>{
    const {dom,scope,root,onSave}=setup();
    button(root,"添加备用服务").click();await vi.waitFor(()=>expect(root.querySelectorAll(".jhs-translation-fallback")).toHaveLength(1));
    root.querySelector(".jhs-translation-fallback select").value="google";
    const listeners=scope.listenerCount;
    const cleanups=scope.cleanups.size;
    button(root,"保存服务").click();await vi.waitFor(()=>expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toMatchObject({primary:"first",fallbacks:["google"]});
    button(root.querySelector(".jhs-translation-fallback"),"删除").click();await vi.waitFor(()=>expect(root.querySelectorAll(".jhs-translation-fallback")).toHaveLength(0));
    expect(scope.listenerCount).toBe(listeners);expect(dom.window.document.activeElement).toBe(root.querySelector("fieldset:nth-of-type(2) .jhs-select-trigger"));
    expect(scope.cleanups.size).toBe(cleanups-1);
});
