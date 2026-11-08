import {it,expect,vi} from "vitest";
import {TranslationService} from "../src/services/translation-service.js";
it.each(["google","deepseek","deepl","deeplx"])("%s sends requests without Web Locks or a budget ledger",async(type)=>{
 const profile={id:"test",name:"test",type,enabled:true,model:"test-model",apiKey:"test-key",endpoint:"https://test.example/translate"};
 const config={schema:1,profiles:type==="google"?[]:[profile],primary:type==="google"?"google":"test",fallbacks:[]};
 const storage={get:vi.fn(async key=>{if(key.includes("budget"))throw Error("corrupt retired ledger");}),keys:async()=>[],set:vi.fn(),getLocal:()=>"{}"};
 const translate=vi.fn(async(_text,options)=>{await options.beforeSend?.();return "translated";});
 const providers={translateDetailed:async(text,options)=>({text:await translate(text,options),usage:{}})};
 const service=new TranslationService({list:()=>[{id:"google-translate"}],getAdapter:id=>id==="google-translate"?{translate}:providers},storage,{credential:Object.assign(new EventTarget(),{readEntry:async()=>({value:JSON.stringify(config),revision:"one"})})});
 try {for(let index=0;index<205;index++)expect(await service.translate(`title-${index}`)).toBe("translated");expect(translate).toHaveBeenCalledTimes(205);expect(storage.get.mock.calls.every(([key])=>!key.includes("budget"))).toBe(true);}finally{service.dispose();}
});
