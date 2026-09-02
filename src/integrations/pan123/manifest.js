// @ts-check

import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { JhsError } from "../../core/jhs-error.js";

const URL_POLICY = Object.freeze({ trustClass: "builtin-public", hosts: ["123pan.com"] });

/** @typedef {{id: string | number, size: number}} Pan123File */
/** @typedef {{id: string | number, files: readonly Pan123File[]}} Pan123ResolvedResource */
/** @typedef {{token?: string, scope?: import("../../core/lifecycle-scope.js").LifecycleScope}} Pan123Context */

/** @param {string} value */
export function crc32(value) {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let entry = index;
        for (let bit = 0; bit < 8; bit += 1) entry = entry & 1 ? 0xedb88320 ^ entry >>> 1 : entry >>> 1;
        table[index] = entry;
    }
    let result = 0xffffffff;
    for (let index = 0; index < value.length; index += 1) result = table[(result ^ value.charCodeAt(index)) & 0xff] ^ result >>> 8;
    return (result ^ 0xffffffff) >>> 0;
}

function secureNonce() {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] % 10_000_000;
}

/** @param {string} input @param {{now?: Date, nonce?: number}} [options] */
export function signPan123Url(input, options = {}) {
    const alphabet = ["a", "d", "e", "f", "g", "h", "l", "m", "y", "i", "j", "n", "o", "p", "k", "q", "r", "s", "t", "u", "b", "c", "v", "w", "s", "z"];
    const nonce = options.nonce ?? secureNonce(), current = options.now ?? new Date(), chinaTime = new Date(current.getTime() + 60_000 * current.getTimezoneOffset() + 28_800_000);
    const dateKey = `${chinaTime.getFullYear()}${String(chinaTime.getMonth() + 1).padStart(2, "0")}${String(chinaTime.getDate()).padStart(2, "0")}${String(chinaTime.getHours()).padStart(2, "0")}${String(chinaTime.getMinutes()).padStart(2, "0")}`;
    const encodedDate = [...dateKey].map((digit) => alphabet[Number(digit)]).join(""), pathKey = crc32(encodedDate), timestamp = Math.floor(chinaTime.getTime() / 1000);
    const url = new URL(input), signature = crc32(`${timestamp}|${nonce}|${url.pathname}|web|3|${pathKey}`);
    url.searchParams.set(String(pathKey), `${timestamp}-${nonce}-${signature}`);
    return url.href;
}

/** @param {unknown} value */
function parsePayload(value) {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); }
    catch (cause) { throw new JhsError("PARSE_ERROR", "123 云盘响应不是有效 JSON", { source: "pan123", cause }); }
}

/** @param {any} payload @param {string} action */
function assertSuccess(payload, action) {
    if (!payload || typeof payload !== "object") throw new JhsError("INVALID_RESPONSE", `123 云盘${action}响应无效`, { source: "pan123" });
    if (payload.code === 0) return payload;
    const message = String(payload.message || payload.msg || `${action}失败`);
    if (/token is expired|unauthorized|登录|授权/i.test(message)) throw new JhsError("AUTH_REQUIRED", message, { source: "pan123" });
    throw new JhsError("INVALID_RESPONSE", message, { source: "pan123" });
}

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http @param {{now?: () => Date, nonce?: () => number, getTimeout?: () => number}} [runtime] */
export function createPan123Adapter(http, runtime = {}) {
    /** @param {string} path @param {unknown} body @param {string} token @param {import("../../core/lifecycle-scope.js").LifecycleScope | undefined} scope @param {string} capability */
    const request = async (path, body, token, scope, capability) => {
        const url = signPan123Url(`https://yun.123pan.com${path}`, { now: runtime.now?.(), nonce: runtime.nonce?.() });
        return http.request({
            providerId: "pan123", capability, method: "POST", url, body: JSON.stringify(body), responseType: "json", timeout: runtime.getTimeout?.() ?? 5000,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "App-Version": "3", platform: "web", Origin: "https://yun.123pan.com", Referer: "https://yun.123pan.com/" },
            urlPolicy: URL_POLICY,
        }, scope);
    };
    return Object.freeze({
        contracts: ["OfflineResolvedResource", "OfflineSubmission"],
        homeUrl: "https://yun.123pan.com",
        /** @param {string} resource @param {Pan123Context} [context] */
        async resolve(resource, context = {}) {
            const { token, scope } = context;
            if (!token) throw new JhsError("AUTH_REQUIRED", "尚未同步 123 授权", { source: "pan123" });
            const response = await request("/b/api/v2/offline_download/task/resolve", { urls: resource }, token, scope, "offline.resolve"), payload = assertSuccess(parsePayload(response.data), "解析"), item = payload.data?.list?.[0];
            if (!item?.id || !Array.isArray(item.files)) throw new JhsError("INVALID_RESPONSE", "123 云盘解析结果缺少资源文件", { source: "pan123" });
            return /** @type {Pan123ResolvedResource} */ (Object.freeze({ id: item.id, files: Object.freeze(item.files.map((/** @type {any} */ file) => Object.freeze({ id: file.id, size: Number(file.size || 0) }))) }));
        },
        /** @param {Pan123ResolvedResource} resource @param {Pan123Context} [context] */
        async submitResolved(resource, context = {}) {
            const { token, scope } = context;
            if (!token) throw new JhsError("AUTH_REQUIRED", "尚未同步 123 授权", { source: "pan123" });
            if (!resource?.id || !Array.isArray(resource.files) || resource.files.length === 0) throw new JhsError("INVALID_RESPONSE", "没有可建立离线的文件", { source: "pan123" });
            const fileIds = resource.files.map((file) => file.id), totalSize = resource.files.reduce((sum, file) => sum + Number(file.size || 0), 0);
            const response = await request("/b/api/v2/offline_download/task/submit", { resource_list: [{ resource_id: resource.id, select_file_id: fileIds }] }, token, scope, "offline.submit");
            assertSuccess(parsePayload(response.data), "提交");
            return Object.freeze({ fileCount: fileIds.length, totalSize });
        },
        /** @param {string} resource @param {Pan123Context} [context] */
        async submit(resource, context = {}) {
            const resolved = await this.resolve(resource, context);
            return this.submitResolved(resolved, context);
        },
    });
}

export default defineIntegration({
    id: "pan123", trustClass: "builtin-public", hosts: ["123pan.com"], capabilities: ["offline.resolve", "offline.submit"], requires: [SERVICE.http, SERVICE.settings],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http], settings: dependencies[SERVICE.settings] }),
    createAdapter: (/** @type {any} */ client) => createPan123Adapter(client.http, { getTimeout: () => Number(client.settings.snapshot().httpTimeout ?? 5000) }), createHostAdapter: null,
    cachePolicy: { "offline.resolve": "none", "offline.submit": "none" }, quality: "silver",
});
