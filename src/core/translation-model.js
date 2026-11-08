// @ts-check
export const TRANSLATION_CONNECTIONS_KEY = "jhs_translation_connections_v1";
export const DEFAULT_TRANSLATION_PROMPT = "将以下内容从 {sourceLanguage} 翻译为 {targetLanguage}。仅返回译文，保留番号、人名等标识。\n{text}";
export const TRANSLATION_TYPES = Object.freeze([
    ["deepseek", "DeepSeek"], ["openai", "OpenAI Responses"], ["gemini", "Gemini"],
    ["custom-chat", "自定义 Chat Completions"], ["custom-completions", "自定义 Completions"],
    ["custom-responses", "自定义 Responses"], ["deeplx", "DeepLX"], ["deepl", "DeepL"],
]);
export const GOOGLE_TRANSLATION_PROFILE = Object.freeze({ id: "google", name: "Google", type: "google", enabled: true, model: "", apiKey: "", endpoint: "https://translate-pa.googleapis.com/v1/translate" });
/** @param {unknown} value */
export function normalizeTranslationPrompt(value) {
    if (typeof value !== "string" || !value.includes("{text}") || value.length > 16000 || value.includes("\0"))
        throw new TypeError("提示模板需包含 {text}，最多 16000 个字符");
    return value;
}
/** Only stable categories from a provider error reach UI copy. @param {unknown} error */
export function translationErrorLabel(error) {
    const labels = { AUTH_REQUIRED: "翻译服务鉴权失败", RATE_LIMITED: "翻译服务限流，请稍后重试", QUOTA_EXCEEDED: "翻译服务额度不足", CONTENT_REJECTED: "翻译服务拒绝了此内容", EMPTY_RESULT: "翻译服务返回空结果", TRUNCATED_RESULT: "翻译结果被截断，请重试", UNSUPPORTED: "翻译服务不可用，请检查配置", ABORTED: "翻译已取消" };
    return labels[ /** @type {keyof typeof labels} */( /** @type {any} */(error)?.code)] || "翻译失败，请重试";
}
/** Validate a full endpoint without exposing its path or query in an error. @param {unknown} value */
export function translationEndpoint(value) {
    const text = String(value || "").trim();
    if (!text || /[\\\x00-\x20\x7f]/.test(text))
        throw new TypeError("翻译服务地址无效");
    let url;
    try {
        url = new URL(text);
    }
    catch {
        throw new TypeError("请填写完整的翻译服务地址");
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash)
        throw new TypeError("翻译地址仅支持无身份字段和片段的 HTTP/HTTPS 地址");
    return url.href;
}
/** Connections, including token-bearing endpoints, live in one encrypted local record. @param {any} value */
export function normalizeTranslationProfile(value) {
    if (!value || !TRANSLATION_TYPES.some(([type]) => type === value.type))
        throw new TypeError("请选择支持的翻译协议");
    const id = String(value.id || ""), name = String(value.name || "").trim(), type = String(value.type);
    const model = String(value.model || "").trim(), apiKey = String(value.apiKey || "").trim();
    if (!/^[\w-]{1,80}$/.test(id) || id === "google" || !name || name.length > 100)
        throw new TypeError("翻译配置名称或标识无效");
    if (apiKey.length > 8192 || /[\x00-\x20\x7f]/.test(apiKey) || model.length > 200 || /[\x00-\x1f\x7f]/.test(model))
        throw new TypeError("模型或密钥格式无效");
    const llm = !["deeplx", "deepl"].includes(type);
    if (llm && !model)
        throw new TypeError("请填写模型名称");
    if (["deepseek", "openai", "gemini", "deepl"].includes(type) && !apiKey)
        throw new TypeError("请填写服务密钥");
    const variant = value.variant === "pro" ? "pro" : "free";
    const defaults = {
        deepseek: "https://api.deepseek.com/chat/completions", openai: "https://api.openai.com/v1/responses",
        gemini: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ""))}:generateContent`,
        deepl: `https://${variant === "pro" ? "api" : "api-free"}.deepl.com/v2/translate`,
    };
    if (type === "gemini" && !/^[\w.-]{1,200}$/.test(model.replace(/^models\//, "")))
        throw new TypeError("Gemini 模型标识无效");
    const endpoint = translationEndpoint(defaults[ /** @type {keyof typeof defaults} */(type)] || value.endpoint);
    return { id, name, type, model, apiKey, endpoint, variant, enabled: value.enabled === true };
}
/** @param {any} value */
export function normalizeTranslationConfiguration(value) {
    if (!value || value.schema !== 1 || !Array.isArray(value.profiles) || value.profiles.length > 20 || !Array.isArray(value.fallbacks))
        throw new TypeError("翻译连接格式无效，请重新保存");
    const profiles = value.profiles.map(normalizeTranslationProfile);
    if (new Set(profiles.map((/** @type {any} */ profile) => profile.id)).size !== profiles.length)
        throw new TypeError("翻译配置标识重复");
    const enabled = new Set(["google", ...profiles.filter((/** @type {any} */ profile) => profile.enabled).map((/** @type {any} */ profile) => profile.id)]);
    const primary = typeof value.primary === "string" ? value.primary : "", fallbacks = value.fallbacks.map(String);
    if (!enabled.has(primary) || fallbacks.some((/** @type {string} */ id) => !enabled.has(id) || id === primary) || new Set(fallbacks).size !== fallbacks.length)
        throw new TypeError("主服务和备用链只能选择已启用且互不重复的配置");
    return { schema: 1, profiles, primary, fallbacks };
}
/** Pure replacement also preserves braces in the input text. @param {string} template @param {string} text @param {string} sourceLanguage @param {string} targetLanguage */
export function renderTranslationPrompt(template, text, sourceLanguage, targetLanguage) {
    return template.replace(/\{(text|sourceLanguage|targetLanguage)\}/g, (_match, key) => ({ text, sourceLanguage, targetLanguage })[ /** @type {"text"|"sourceLanguage"|"targetLanguage"} */(key)]);
}
/** @param {string} value @param {boolean} [target] */
export function deepLCode(value, target = false) {
    const code = value.toUpperCase().replace(/_/g, "-");
    if (code === "AUTO")
        return "";
    if (/^ZH(?:-|$)/.test(code))
        return target ? /(?:TW|HK|HANT)$/.test(code) ? "ZH-HANT" : "ZH-HANS" : "ZH";
    return ["EN-US", "EN-GB", "PT-BR", "PT-PT"].includes(code) && target ? code : code.split("-")[0];
}
