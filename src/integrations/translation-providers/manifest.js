// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { JhsError } from "../../core/jhs-error.js";
import { deepLCode, renderTranslationPrompt } from "../../core/translation-model.js";
const INSTRUCTION = "仅返回译文，保留番号、人名等标识，不添加解释。";
const ERRORS = Object.freeze({
    AUTH_REQUIRED: "翻译服务鉴权失败", RATE_LIMITED: "翻译服务限流", QUOTA_EXCEEDED: "翻译服务额度不足",
    CONTENT_REJECTED: "翻译服务拒绝了此内容", EMPTY_RESULT: "翻译服务返回空结果", TRUNCATED_RESULT: "翻译结果被截断",
    INVALID_RESPONSE: "翻译服务响应无效", NETWORK_ERROR: "翻译服务请求失败",
});
/** Provider error bodies never enter diagnostics or user-facing messages. @param {string} code */
function failure(code) { return new JhsError(code, ERRORS[ /** @type {keyof typeof ERRORS} */(code)] || ERRORS.INVALID_RESPONSE, { source: "translation-providers" }); }
/** @param {number} status @param {any} data */
function assertResponse(status, data) {
    const code = String(data?.error?.code || data?.error?.type || "").toLowerCase();
    const details = Array.isArray(data?.error?.details) ? data.error.details : [];
    const dailyQuota = details.some((/** @type {any} */ detail) => Array.isArray(detail?.violations) && detail.violations.some((/** @type {any} */ violation) => /perday|daily/i.test(String(violation?.quotaId || ""))));
    if ([402, 456].includes(status) || /quota|insufficient|balance|billing/.test(code) || dailyQuota)
        throw failure("QUOTA_EXCEEDED");
    if (/content[_-]?(?:filter|policy)|safety|moderation[_-]?blocked/.test(code))
        throw failure("CONTENT_REJECTED");
    if ([401, 403].includes(status))
        throw failure("AUTH_REQUIRED");
    if (status === 429)
        throw failure("RATE_LIMITED");
    if (status >= 400 || data?.error)
        throw failure("NETWORK_ERROR");
    if (!data || typeof data !== "object" || Array.isArray(data))
        throw failure("INVALID_RESPONSE");
}
/** Pick numeric usage fields only. @param {any} value @param {string[]} keys */
function usage(value, keys) {
    return Object.fromEntries(keys.filter(key => typeof value?.[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0).map(key => [key, value[key]]));
}
/** @param {any} data @param {string} protocol */
export function parseTranslationResponse(data, protocol) {
    let text = "", used = {};
    if (["deepseek", "custom-chat", "custom-completions"].includes(protocol)) {
        if (!Array.isArray(data?.choices))
            throw failure("INVALID_RESPONSE");
        const choice = data?.choices?.[0], message = choice?.message;
        if (message?.role && message.role !== "assistant" || protocol === "deepseek" && message && message.role !== "assistant")
            throw failure("INVALID_RESPONSE");
        if (message?.refusal || choice?.finish_reason === "content_filter")
            throw failure("CONTENT_REJECTED");
        if (choice?.finish_reason === "length")
            throw failure("TRUNCATED_RESULT");
        if (choice?.finish_reason != null && choice.finish_reason !== "stop")
            throw failure("INVALID_RESPONSE");
        if (protocol === "custom-completions")
            text = choice?.text;
        else
            text = Array.isArray(message?.content) ? message.content.filter((/** @type {any} */ part) => part?.type === "text" && typeof part.text === "string").map((/** @type {any} */ part) => part.text).join("") : message?.content;
        used = usage(data?.usage, ["prompt_tokens", "completion_tokens", "total_tokens"]);
    }
    else if (["openai", "custom-responses"].includes(protocol)) {
        const output = Array.isArray(data?.output) ? data.output : [];
        const parts = output.filter((/** @type {any} */ item) => item?.type === "message" && item.role === "assistant").flatMap((/** @type {any} */ item) => Array.isArray(item.content) ? item.content : []);
        if (parts.some((/** @type {any} */ part) => part?.type === "refusal") || data?.incomplete_details?.reason === "content_filter")
            throw failure("CONTENT_REJECTED");
        if (data?.status === "incomplete" || output.some((/** @type {any} */ item) => item?.type === "message" && item.status === "incomplete"))
            throw failure("TRUNCATED_RESULT");
        if (data?.status !== "completed")
            throw failure("INVALID_RESPONSE");
        if (parts.some((/** @type {any} */ part) => part?.type === "output_text" && typeof part.text !== "string"))
            throw failure("INVALID_RESPONSE");
        text = parts.filter((/** @type {any} */ part) => part?.type === "output_text" && typeof part.text === "string").map((/** @type {any} */ part) => part.text).join("");
        used = usage(data?.usage, ["input_tokens", "output_tokens", "total_tokens"]);
    }
    else if (protocol === "gemini") {
        const candidate = data?.candidates?.[0], reason = candidate?.finishReason;
        if (data?.promptFeedback?.blockReason && data.promptFeedback.blockReason !== "BLOCK_REASON_UNSPECIFIED" || ["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"].includes(reason))
            throw failure("CONTENT_REJECTED");
        if (!candidate)
            throw failure("EMPTY_RESULT");
        if (reason === "MAX_TOKENS")
            throw failure("TRUNCATED_RESULT");
        if (reason !== "STOP")
            throw failure("INVALID_RESPONSE");
        if (!Array.isArray(candidate?.content?.parts))
            throw failure("INVALID_RESPONSE");
        text = (candidate?.content?.parts || []).filter((/** @type {any} */ part) => !part.thought && typeof part.text === "string").map((/** @type {any} */ part) => part.text).join("");
        used = usage(data?.usageMetadata, ["promptTokenCount", "candidatesTokenCount", "totalTokenCount", "thoughtsTokenCount"]);
    }
    else if (protocol === "deeplx") {
        assertResponse(Number(data?.code), data);
        if (data?.code !== 200)
            throw failure("INVALID_RESPONSE");
        text = data.data;
    }
    else if (protocol === "deepl") {
        if (!Array.isArray(data?.translations))
            throw failure("INVALID_RESPONSE");
        text = data?.translations?.[0]?.text;
        used = usage(data?.translations?.[0], ["billed_characters"]);
    }
    else
        throw failure("INVALID_RESPONSE");
    if (text != null && typeof text !== "string")
        throw failure("INVALID_RESPONSE");
    if (typeof text !== "string" || !text.trim())
        throw failure("EMPTY_RESULT");
    return { text: text.trim(), usage: used };
}
/** Requests are non-streaming and make no implicit provider retries. @param {any} http */
export function createTranslationProvidersAdapter(http) {
    return Object.freeze({
        contracts: ["Translation"],
        /** @param {string} text @param {{profile:any, prompt:string, sourceLanguage:string, targetLanguage:string, scope?:any, beforeSend?:()=>Promise<any>}} options */
        async translateDetailed(text, options) {
            const { profile, sourceLanguage, targetLanguage } = options;
            const prompt = renderTranslationPrompt(options.prompt, text, sourceLanguage, targetLanguage);
            const headers = /** @type {Record<string,string>} */ ({ "Content-Type": "application/json" });
            let body;
            if (["deepseek", "custom-chat"].includes(profile.type))
                body = { model: profile.model, stream: false, messages: [{ role: "system", content: INSTRUCTION }, { role: "user", content: prompt }] };
            else if (["openai", "custom-responses"].includes(profile.type))
                body = { model: profile.model, stream: false, instructions: INSTRUCTION, input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }] };
            else if (profile.type === "custom-completions")
                body = { model: profile.model, stream: false, prompt };
            else if (profile.type === "gemini")
                body = { systemInstruction: { parts: [{ text: INSTRUCTION }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { candidateCount: 1 } };
            else if (profile.type === "deeplx")
                body = { text, source_lang: deepLCode(sourceLanguage) || "AUTO", target_lang: deepLCode(targetLanguage, true) };
            else if (profile.type === "deepl")
                body = { text: [text], target_lang: deepLCode(targetLanguage, true), ...(deepLCode(sourceLanguage) ? { source_lang: deepLCode(sourceLanguage) } : {}), show_billed_characters: true };
            else
                throw failure("INVALID_RESPONSE");
            if (profile.apiKey) {
                if (profile.type === "gemini")
                    headers["x-goog-api-key"] = profile.apiKey;
                else
                    headers.Authorization = `${profile.type === "deepl" ? "DeepL-Auth-Key" : "Bearer"} ${profile.apiKey}`;
            }
            const url = new URL(profile.endpoint);
            const response = await http.request({
                providerId: "translation-providers", capability: "text.translate", method: "POST", url: url.href, headers,
                body: JSON.stringify(body), responseType: "json", retryCount: 0, timeout: 30000,
                requestOptions: { anonymous: true, redirect: "error" }, beforeSend: options.beforeSend,
                acceptableStatuses: [400, 401, 402, 403, 404, 408, 413, 422, 429, 456, 500, 502, 503, 504],
                urlPolicy: { trustClass: "user-local", expectedOrigin: url.origin, expectedUrl: url.href },
            }, options.scope);
            assertResponse(Number(response.status), response.data);
            return parseTranslationResponse(response.data, profile.type);
        },
        /** @param {string} text @param {any} options */
        async translate(text, options) { return (await this.translateDetailed(text, options)).text; },
    });
}
export default defineIntegration({
    id: "translation-providers", trustClass: "user-local", hosts: [], capabilities: ["text.translate"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ deps) => ({ http: deps[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createTranslationProvidersAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "text.translate": "none" }, quality: "silver",
});
