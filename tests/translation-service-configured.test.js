import {afterEach,describe,expect,it,vi} from "vitest";
import {TranslationService} from "../src/services/translation-service.js";
import {LifecycleScope} from "../src/core/lifecycle-scope.js";
import {JhsError} from "../src/core/jhs-error.js";
import {DEFAULT_TRANSLATION_PROMPT,TRANSLATION_CONNECTIONS_KEY,normalizeTranslationConfiguration,normalizeTranslationProfile} from "../src/core/translation-model.js";

const owned=[];
afterEach(() => { for(const service of owned.splice(0)) service.dispose(); });
const profile = (id,extra={}) => normalizeTranslationProfile({id,name:id,type:"custom-chat",endpoint:`https://${id}.example/translate?token=private-address`,model:"configured-model",apiKey:"private-key",enabled:true,...extra});
function setup(config={schema:1,profiles:[],primary:"google",fallbacks:[]}, overrides={}) {
    let record={value:JSON.stringify(config),revision:"initial"};
    const credential=new EventTarget();
    credential.readEntry=vi.fn(async () => structuredClone(record));
    credential.set=vi.fn(async (_key,value) => {record={value,revision:crypto.randomUUID()};});
    const settings=new EventTarget(); settings.value={translationPrompt:DEFAULT_TRANSLATION_PROMPT};settings.snapshot=()=>settings.value;
    const records=new Map(),storage={get:vi.fn(async key=>records.get(key)),set:vi.fn(async (key,value)=>records.set(key,structuredClone(value))),remove:vi.fn(async key=>records.delete(key)),keys:vi.fn(async()=>[...records.keys()]),getLocal:vi.fn(()=>JSON.stringify({"ABC-123":"Google 旧缓存"})),removeLocal:vi.fn(),listenValue:vi.fn(),unlistenValue:vi.fn()};
    const google=vi.fn(async (_text,options)=>{await options.beforeSend?.();return "Google 译文";});
    const translateDetailed=vi.fn(async (_text,options)=>{await options.beforeSend?.();return {text:`${options.profile.id} 译文`,usage:{total_tokens:10}};});
    const integrations={list:()=>[{id:"google-translate"}],getAdapter:id=>id==="google-translate"?{translate:google}:{translateDetailed}};
    const budget={reserve:vi.fn(async()=>({granted:true})),dispose:vi.fn()},urlPolicy={setLocalOriginOwner:vi.fn()};
    const service=new TranslationService(integrations,storage,{credential,settings,budget,urlPolicy,...overrides});owned.push(service);
    return {service,credential,settings,records,storage,google,translateDetailed,budget,urlPolicy,setRecord:value=>{record=value;}};
}
const configured=(primary="first",fallbacks=[])=>({schema:1,profiles:[profile("first"),profile("second")],primary,fallbacks});

describe("configured translation orchestration",()=>{
    it("hydrates the first request without presenting it as a user configuration switch",async()=>{
        const {service}=setup(configured());const changed=vi.fn();service.addEventListener("translation.changed",changed);
        expect(await service.translate("首次原文")).toBe("first 译文");expect(changed).not.toHaveBeenCalled();
        await service.reloadConfiguration();expect(changed).toHaveBeenCalledOnce();
    });
    it("returns source, cache and usage while preserving the string API, with cache hits free",async()=>{
        const {service,budget,translateDetailed}=setup(configured());
        const result=await service.translateDetailed("原文");
        expect(result).toMatchObject({text:"first 译文",source:{id:"first",protocol:"custom-chat",model:"configured-model"},cacheHit:false,usage:{total_tokens:10}});
        expect(await service.translate("原文")).toBe("first 译文");
        expect(await service.translateDetailed("原文")).toMatchObject({cacheHit:true,source:{id:"first"}});
        expect(translateDetailed).toHaveBeenCalledOnce();expect(budget.reserve).not.toHaveBeenCalled();
        await service.persistNow();
    });
    it("isolates profile, protocol, endpoint, key, model, prompt and language fingerprints",async()=>{
        const {service,settings,translateDetailed,setRecord,records}=setup(configured());
        await service.translate("原文");
        for(const extra of [{model:"other-model"},{endpoint:"https://first.example/another?token=private"},{apiKey:"other-key"},{type:"custom-responses"}]){
            setRecord({revision:crypto.randomUUID(),value:JSON.stringify({...configured(),profiles:[profile("first",extra),profile("second")]})});
            await service.reloadConfiguration();await service.translate("原文");
        }
        settings.value={translationPrompt:"{text} -> {targetLanguage}"};
        await service.translate("原文");await service.translate("原文",{targetLanguage:"en"});
        expect(translateDetailed).toHaveBeenCalledTimes(7);
        await service.persistNow();
        const serialized=JSON.stringify([...records]);
        expect(serialized).not.toContain("private-address");expect(serialized).not.toContain("other-key");
    });
    it("uses only the explicit fallback order, once per profile, and reports the actual successful source",async()=>{
        const {service,translateDetailed,google}=setup(configured("first",["second"]));
        translateDetailed.mockImplementation(async(_text,options)=>{if(options.profile.id==="first")throw new JhsError("RATE_LIMITED","限流");return {text:"备用译文",usage:{total_tokens:8}};});
        expect(await service.translateDetailed("原文")).toMatchObject({text:"备用译文",source:{id:"second"},attempts:[{source:"first",code:"RATE_LIMITED"}]});
        expect(translateDetailed.mock.calls.map(call=>call[1].profile.id)).toEqual(["first","second"]);expect(google).not.toHaveBeenCalled();
    });
    it("never implicitly falls back to Google or mistakes its legacy cache for another provider",async()=>{
        const {service,translateDetailed,google}=setup(configured());
        translateDetailed.mockRejectedValue(new JhsError("AUTH_REQUIRED","鉴权失败"));
        await expect(service.translate("原文",{cacheAlias:"ABC-123"})).rejects.toMatchObject({code:"AUTH_REQUIRED"});
        expect(google).not.toHaveBeenCalled();expect(translateDetailed).toHaveBeenCalledOnce();
    });
    it("preserves a shared request when one consumer closes and cancels after the final consumer leaves",async()=>{
        const {service,translateDetailed}=setup(configured());let release;
        translateDetailed.mockImplementation((_text,options)=>new Promise((resolve,reject)=>{release=resolve;options.scope.signal.addEventListener("abort",()=>reject(new JhsError("ABORTED","已取消")),{once:true});}));
        const first=new LifecycleScope("first"),second=new LifecycleScope("second");
        const one=service.translate("共享",{scope:first}),two=service.translate("共享",{scope:second});
        await vi.waitFor(()=>expect(translateDetailed).toHaveBeenCalledOnce());
        first.dispose();await expect(one).rejects.toMatchObject({code:"ABORTED"});
        expect(translateDetailed.mock.calls[0][1].scope.disposed).toBe(false);
        release({text:"共享译文",usage:{}});await expect(two).resolves.toBe("共享译文");
        const third=new LifecycleScope("third"),three=service.translate("取消",{scope:third});
        await vi.waitFor(()=>expect(translateDetailed).toHaveBeenCalledTimes(2));third.dispose();
        await expect(three).rejects.toMatchObject({code:"ABORTED"});
        expect(translateDetailed.mock.calls[1][1].scope.disposed).toBe(true);
    });
    it("bounds concurrency, removes canceled queued work and stops active work on disable",async()=>{
        const {service,translateDetailed}=setup(configured());const releases=[];
        translateDetailed.mockImplementation((_text,options)=>new Promise((resolve,reject)=>{releases.push(()=>resolve({text:"译文",usage:{}}));options.scope.signal.addEventListener("abort",()=>reject(new JhsError("ABORTED","已取消")),{once:true});}));
        const scope=new LifecycleScope("queued");
        const requests=[service.translate("one"),service.translate("two")];
        await vi.waitFor(()=>expect(translateDetailed).toHaveBeenCalledTimes(2));
        requests.push(service.translate("three",{scope}));
        const settled=Promise.allSettled(requests);
        await vi.waitFor(()=>expect(service.queue).toHaveLength(1));
        scope.dispose();releases.forEach(release=>release());
        expect((await settled).map(result=>result.status)).toEqual(["fulfilled","fulfilled","rejected"]);
        const active=service.translate("active");await vi.waitFor(()=>expect(translateDetailed).toHaveBeenCalledTimes(3));service.setEnabled(false);
        await expect(active).rejects.toMatchObject({code:"ABORTED"});
        await expect(service.translate("cached")).rejects.toMatchObject({code:"ABORTED"});
    });
    it("cancels old configurations and recovers from a later credential reload",async()=>{
        const {service,credential,setRecord,translateDetailed}=setup(configured());
        setRecord({revision:"future",value:JSON.stringify({schema:2,profiles:[]})});
        await expect(service.reloadConfiguration()).rejects.toMatchObject({code:"UNSUPPORTED"});
        await expect(service.translate("原文")).rejects.toMatchObject({code:"UNSUPPORTED"});
        setRecord({revision:"recovered",value:JSON.stringify(configured("second"))});
        await service.reloadConfiguration();expect(await service.translate("原文")).toBe("second 译文");
        const state=await service.getConfiguration();await service.saveConfiguration(configured(),state.revision);
        expect(credential.set).toHaveBeenCalledWith(TRANSLATION_CONNECTIONS_KEY,JSON.stringify(normalizeTranslationConfiguration(configured())));
        expect(translateDetailed).toHaveBeenCalledOnce();
    });
    it("ignores obsolete budgets even when they reject every request",async()=>{
        const {service,budget,translateDetailed}=setup(configured("first",["second"]));
        budget.reserve.mockRejectedValue(new JhsError("BUDGET_EXCEEDED","obsolete"));
        for(let index=0;index<205;index++) expect(await service.translate(`title-${index}`,{automatic:true})).toBe("first 译文");
        expect(translateDetailed).toHaveBeenCalledTimes(205);
        expect(budget.reserve).not.toHaveBeenCalled();
    });
    it("uses temporary exact-origin grants for uncached connection tests and revokes them on error",async()=>{
        const {service,urlPolicy,budget,translateDetailed}=setup();const scope=new LifecycleScope("connection-test");
        expect(await service.testConnection(profile("draft"),scope)).toMatchObject({source:{id:"draft"},cacheHit:false});
        expect(budget.reserve).not.toHaveBeenCalled();
        expect(urlPolicy.setLocalOriginOwner).toHaveBeenCalledWith(expect.stringMatching(/^translation-test:/),["https://draft.example"]);
        expect(urlPolicy.setLocalOriginOwner.mock.calls.at(-1)[1]).toEqual([]);
        translateDetailed.mockRejectedValue(new JhsError("AUTH_REQUIRED","鉴权失败"));
        await expect(service.testConnection(profile("draft"),scope)).rejects.toMatchObject({code:"AUTH_REQUIRED"});
        expect(urlPolicy.setLocalOriginOwner.mock.calls.at(-1)[1]).toEqual([]);
        expect(service.memoryCache.size).toBe(0);scope.dispose();
    });
});
