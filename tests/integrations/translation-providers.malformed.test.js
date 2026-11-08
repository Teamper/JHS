import {expect,it} from "vitest";
import {createTranslationProvidersAdapter,parseTranslationResponse} from "../../src/integrations/translation-providers/manifest.js";

it.each([
    ["custom-chat",{choices:{0:{message:{content:"误取结果"}}}}],
    ["custom-completions",{choices:[{text:123}]}],
    ["openai",{status:"completed",output:[{type:"message",role:"assistant",content:[{type:"output_text",text:123}]}]}],
    ["gemini",{candidates:[{finishReason:"STOP",content:{parts:"invalid"}}]}],
    ["deeplx",{code:200,data:{text:"invalid"}}],
    ["deepl",{translations:{0:{text:"invalid"}}}],
])("rejects malformed %s responses with a stable error category",(protocol,data) => {
    expect(() => parseTranslationResponse(data,protocol)).toThrow(expect.objectContaining({code:"INVALID_RESPONSE"}));
});
it("rejects an HTML error page without exposing its contents",async () => {
    const adapter=createTranslationProvidersAdapter({request:async () => ({status:200,data:"<html>private-token</html>"})});
    const error=await adapter.translateDetailed("原文",{profile:{id:"draft",type:"custom-chat",endpoint:"https://example.test/",model:"m",apiKey:""},prompt:"{text}",sourceLanguage:"ja",targetLanguage:"zh-CN"}).catch(error=>error);
    expect(error.code).toBe("INVALID_RESPONSE");expect(JSON.stringify(error)).not.toContain("private-token");
});
