// @ts-check

import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { JhsError } from "../../core/jhs-error.js";

const IMGUR_UPLOAD_URL = "https://api.imgur.com/3/image";
const IMGUR_CLIENT_ID = "d70305e7c3ac5c6";
const URL_POLICY = Object.freeze({ trustClass: "builtin-public", hosts: ["imgur.com", "google.com", "yandex.ru"] });
const TARGETS = Object.freeze([
    Object.freeze({ id: "google-legacy", name: "Google旧版", urlTemplate: "https://www.google.com/searchbyimage?image_url={imageUrl}&client=firefox-b-d", iconUrl: "https://www.google.com/favicon.ico" }),
    Object.freeze({ id: "google-lens", name: "Google", urlTemplate: "https://lens.google.com/uploadbyurl?url={imageUrl}", iconUrl: "https://www.google.com/favicon.ico" }),
    Object.freeze({ id: "yandex", name: "Yandex", urlTemplate: "https://yandex.ru/images/search?rpt=imageview&url={imageUrl}", iconUrl: "https://yandex.ru/favicon.ico" }),
]);

/** @param {unknown} payload */
export function parseImgurUpload(payload) {
    let value = payload;
    if (typeof value === "string") {
        try { value = JSON.parse(value); }
        catch (cause) { throw new JhsError("INVALID_RESPONSE", "Imgur 返回了无效 JSON", { source: "image-search", cause }); }
    }
    const result = /** @type {any} */ (value);
    if (result?.success && typeof result?.data?.link === "string" && /^https:\/\//i.test(result.data.link)) return result.data.link;
    throw new JhsError("INVALID_RESPONSE", String(result?.data?.error || "Imgur 上传响应无效"), { source: "image-search" });
}

/** @param {string} dataUrl */
export function dataUrlToFormData(dataUrl) {
    const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
    if (!match) throw new JhsError("INVALID_RESPONSE", "无效的 Base64 图片数据", { source: "image-search" });
    const binary = atob(match[2].replace(/\s/g, "")), bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const form = new FormData();
    form.append("image", new Blob([bytes], { type: match[1] }), "jhs-image");
    return form;
}

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createImageSearchAdapter(http) {
    return Object.freeze({
        contracts: ["ImageUrl", "ImageSearchTarget"],
        /** @param {string} dataUrl @param {{scope?: any}} [options] */
        async upload(dataUrl, options = {}) {
            const response = await http.request({
                providerId: "image-search", method: "POST", url: IMGUR_UPLOAD_URL, body: dataUrlToFormData(dataUrl),
                headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` }, responseType: "json", cacheScope: "none", urlPolicy: URL_POLICY,
            }, options.scope);
            return parseImgurUpload(response.data);
        },
        /** @param {string} imageUrl */
        createTargets(imageUrl) {
            const encoded = encodeURIComponent(imageUrl);
            return Object.freeze(TARGETS.map((target) => Object.freeze({ id: target.id, name: target.name, url: target.urlTemplate.replace("{imageUrl}", encoded), iconUrl: target.iconUrl })));
        },
    });
}

export default defineIntegration({
    id: "image-search", trustClass: "builtin-public", hosts: ["imgur.com", "google.com", "yandex.ru"],
    capabilities: ["image.upload", "image.search-targets"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createImageSearchAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "image.upload": "none", "image.search-targets": "none" }, quality: "silver",
});
