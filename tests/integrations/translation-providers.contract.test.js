import {readFileSync} from "node:fs";
import {describe, expect, it, vi} from "vitest";
import {createTranslationProvidersAdapter, parseTranslationResponse} from "../../src/integrations/translation-providers/manifest.js";
import {DEFAULT_TRANSLATION_PROMPT, deepLCode, normalizeTranslationConfiguration, normalizeTranslationProfile, renderTranslationPrompt} from "../../src/core/translation-model.js";

const connection = (type, extra = {}) => normalizeTranslationProfile({id:"configured",name:"配置服务",type,model:"user-model",apiKey:"private-key",endpoint:"https://translation.example/api/token-path?access=private",enabled:true,...extra});
// Synthetic fixtures follow the documented non-streaming response envelopes.
const fixtures = JSON.parse(readFileSync(new URL("../fixtures/integrations/translation-providers/responses.json",import.meta.url),"utf8"));

describe("translation protocol requests and responses", () => {
    for (const [type, data] of Object.entries(fixtures)) it(`uses the ${type} protocol and configured model`, async () => {
        const request = vi.fn(async () => ({status:200,data})), adapter = createTranslationProvidersAdapter({request}), profile = connection(type);
        const scope = {}, beforeSend = vi.fn();
        const result = await adapter.translateDetailed("ABC-123 原文", {profile,prompt:DEFAULT_TRANSLATION_PROMPT,sourceLanguage:"ja",targetLanguage:"zh-CN",scope,beforeSend});
        expect(result.text).toBe("ABC-123 译文");
        const options = request.mock.calls[0][0], body = JSON.parse(options.body);
        expect(request.mock.calls[0][1]).toBe(scope);
        expect(options).toMatchObject({method:"POST",retryCount:0,beforeSend,url:profile.endpoint,urlPolicy:{expectedUrl:profile.endpoint}});
        expect(options.url).not.toContain("private-key");
        expect(options.requestOptions).toEqual({anonymous:true,redirect:"error"});
        if (!["deeplx","deepl"].includes(type)) expect(body.model || profile.model).toBe("user-model");
        if (["deepseek","custom-chat"].includes(type)) expect(body).toMatchObject({stream:false,messages:[{role:"system"},{role:"user",content:expect.stringContaining("ABC-123 原文")}]});
        if (["openai","custom-responses"].includes(type)) expect(body).toMatchObject({stream:false,input:[{role:"user",content:[{type:"input_text",text:expect.stringContaining("ABC-123 原文")}]}]});
        if (type === "custom-completions") expect(body.prompt).toContain("ABC-123 原文");
        if (type === "gemini") { expect(options.headers["x-goog-api-key"]).toBe("private-key"); expect(body.contents[0].parts[0].text).toContain("ABC-123 原文"); expect(profile.endpoint).toContain("/models/user-model:generateContent"); }
        if (type === "deepl") { expect(options.headers.Authorization).toBe("DeepL-Auth-Key private-key"); expect(body).toEqual({text:["ABC-123 原文"],source_lang:"JA",target_lang:"ZH-HANS",show_billed_characters:true}); }
        if (type === "deeplx") expect(body).toEqual({text:"ABC-123 原文",source_lang:"JA",target_lang:"ZH-HANS"});
        expect(JSON.stringify(result)).not.toContain("私有思考");
        expect(JSON.stringify(result)).not.toContain("secret");
    });

    it.each([
        [401, {}, "AUTH_REQUIRED"], [403, {}, "AUTH_REQUIRED"], [402, {}, "QUOTA_EXCEEDED"], [456, {}, "QUOTA_EXCEEDED"],
        [429, {}, "RATE_LIMITED"], [429,{error:{code:"insufficient_quota"}},"QUOTA_EXCEEDED"],
        [400,{error:{code:"content_policy_violation"}},"CONTENT_REJECTED"],
        [429,{error:{details:[{violations:[{quotaId:"GenerateRequestsPerDay"}]}]}},"QUOTA_EXCEEDED"],
        [500,{error:{message:"https://private.example/token-secret"}},"NETWORK_ERROR"],
    ])("classifies HTTP %s without exposing the response body", async (status,data,code) => {
        const adapter = createTranslationProvidersAdapter({request:async () => ({status,data})});
        const error = await adapter.translateDetailed("原文",{profile:connection("custom-chat"),prompt:DEFAULT_TRANSLATION_PROMPT,sourceLanguage:"ja",targetLanguage:"zh-CN"}).catch(error => error);
        expect(error.code).toBe(code);
        expect(JSON.stringify(error)).not.toContain("token-secret");
    });

    it.each([
        ["custom-chat",{choices:[{message:{refusal:"拒绝"}}]},"CONTENT_REJECTED"],
        ["deepseek",{choices:[{message:{role:"user",content:"错误"},finish_reason:"stop"}]},"INVALID_RESPONSE"],
        ["custom-chat",{choices:[{message:{content:"部分"},finish_reason:"length"}]},"TRUNCATED_RESULT"],
        ["custom-chat",{choices:[{message:{content:""},finish_reason:"stop"}]},"EMPTY_RESULT"],
        ["openai",{status:"completed",output:[{type:"message",role:"assistant",content:[{type:"refusal",refusal:"拒绝"}]}]},"CONTENT_REJECTED"],
        ["openai",{status:"incomplete",incomplete_details:{reason:"max_output_tokens"},output:[]},"TRUNCATED_RESULT"],
        ["openai",{status:"completed",output:[]},"EMPTY_RESULT"],
        ["gemini",{promptFeedback:{blockReason:"SAFETY"}},"CONTENT_REJECTED"],
        ["gemini",{candidates:[{finishReason:"MAX_TOKENS"}]},"TRUNCATED_RESULT"],
        ["gemini",{candidates:[]},"EMPTY_RESULT"], ["deeplx",{code:429},"RATE_LIMITED"],
        ["deeplx",{code:200,data:""},"EMPTY_RESULT"], ["deepl",{translations:[]},"EMPTY_RESULT"],
    ])("rejects %s refusal, truncation and empty results distinctly", (type,data,code) => {
        expect(() => parseTranslationResponse(data,type)).toThrow(expect.objectContaining({code}));
    });
});

describe("translation configuration", () => {
    it("defaults to Google with an explicit empty fallback chain", () => {
        expect(normalizeTranslationConfiguration({schema:1,profiles:[],primary:"google",fallbacks:[]})).toEqual({schema:1,profiles:[],primary:"google",fallbacks:[]});
        expect(() => normalizeTranslationConfiguration({schema:2,profiles:[],fallbacks:[]})).toThrow();
        expect(() => normalizeTranslationConfiguration({schema:1,profiles:[],primary:"missing",fallbacks:[]})).toThrow();
    });
    it("rejects disabled, repeated and primary entries in the fallback chain", () => {
        const profile = connection("deepseek");
        for (const fallbacks of [["configured","configured"],["google"],["missing"]]) expect(() => normalizeTranslationConfiguration({schema:1,profiles:[profile],primary:"google",fallbacks})).toThrow();
        expect(() => normalizeTranslationConfiguration({schema:1,profiles:[{...profile,enabled:false}],primary:"google",fallbacks:["configured"]})).toThrow();
    });
    it("keeps full custom endpoints, supports DeepL variants and requires explicit models", () => {
        expect(connection("custom-responses").endpoint).toBe("https://translation.example/api/token-path?access=private");
        expect(connection("deepl",{variant:"pro"}).endpoint).toBe("https://api.deepl.com/v2/translate");
        expect(() => connection("openai",{model:""})).toThrow("模型");
        expect(() => connection("gemini",{model:"../other"})).toThrow("模型");
        for (const endpoint of ["javascript:alert(1)","https://user:secret@example.test/v1","https://example.test/v1#token","https://example.test/\\evil"]) expect(() => connection("deeplx",{endpoint})).toThrow();
    });
    it("renders pure text templates without substituting input placeholders again", () => {
        expect(renderTranslationPrompt("{targetLanguage} {text}","ABC-123 {sourceLanguage}","ja","zh-CN")).toBe("zh-CN ABC-123 {sourceLanguage}");
        expect(deepLCode("zh-TW",true)).toBe("ZH-HANT");
        expect(deepLCode("zh-TW")).toBe("ZH");
        expect(deepLCode("auto")).toBe("");
    });
});
