// @ts-check

import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { list115Directory, upload115Subtitle } from "./file-transfers.js";
import { JhsError } from "../../core/jhs-error.js";

const HOME_URL = "https://115.com";
const URL_POLICY = Object.freeze({ trustClass: "builtin-public", hosts: ["115.com"] });

/** @param {unknown} value */
function parsePayload(value) {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); }
    catch (cause) { throw new JhsError("PARSE_ERROR", "115 返回异常响应", { source: "one115", cause }); }
}

/** @param {string} message */
export function classify115OfflineError(message) {
    const text = String(message).toLowerCase();
    if (/未登录|请登录|登录|login|sign|授权|过期|token|cookie|uid|身份|auth|expire|needlogin|need login/i.test(text)) return "AUTH_REQUIRED";
    if (/已存在|重复|exists|duplicate|already|same|conflict|exist/i.test(text)) return "TASK_EXISTS";
    return "OPERATION_FAILED";
}

/** @param {unknown} payload */
export function normalize115SearchResults(payload) {
    const value = /** @type {any} */ (payload);
    if (!value || !Array.isArray(value.data)) throw new JhsError("INVALID_RESPONSE", "115 文件搜索响应无效", { source: "one115" });
    return Object.freeze(value.data.map((/** @type {any} */ item) => {
        const name = String(item.n || item.file_name || "");
        return Object.freeze({ folderId: String(item.pid ?? item.cid ?? ""), fileId: item.fid ? String(item.fid) : null, videoId: String(item.pc || item.pick_code || ""), name, size: Number(item.s || item.size) || 0, createTime: String(item.t || item.create_time || ""), isVideo: /\.(mp4|mkv|avi|mov|flv|wmv|ts|m2ts)$/i.test(name) });
    }).filter((/** @type {{isVideo: boolean}} */ item) => item.isVideo));
}

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createOne115Adapter(http) {
    /** @param {string} url @param {Record<string, any>} options */
    const request = (url, options = {}) => http.request({
        providerId: "one115", capability: options.capability || "account.status", method: options.method || "GET", url, body: options.body, headers: options.headers,
        responseType: options.responseType || "json", urlPolicy: URL_POLICY, ...(options.method === "POST" ? { retryCount: 0 } : {}), onDispatch: options.onDispatch,
    }, options.scope);
    return Object.freeze({
        contracts: ["AccountStatus", "CloudFile", "OfflineSubmission"],
        homeUrl: HOME_URL,
        /** @param {string} folderId @param {any} [options] */
        listDirectory(folderId, options) { return list115Directory(http, folderId, options); },
        /** @param {any} file @param {any} [options] */
        uploadSubtitle(file, options) { return upload115Subtitle(http, context => this.getAccountIdentity(context), file, options); },
        /** @param {{scope?: any}} [options] */
        async checkAccount(options = {}) {
            const response = await request("https://webapi.115.com/offine/downpath", { capability: "account.status", scope: options.scope });
            const payload = /** @type {any} */ (response.data);
            return Object.freeze({ authenticated: Boolean(payload?.state && payload?.data?.length) });
        },
        /** @param {{scope?: any}} [options] */
        async getAccountIdentity(options = {}) {
            const response = await request(`https://115.com/?ct=offline&ac=space&_=${Date.now()}`, { capability: "account.status", scope: options.scope });
            const payload = /** @type {any} */ (parsePayload(response.data));
            const accountId = String(payload?.uid || "");
            if (!payload?.sign || !/^\d+$/.test(accountId)) throw new JhsError("AUTH_REQUIRED", "115 账号身份尚未确认，请登录后重试", { source: "one115" });
            return Object.freeze({ accountId });
        },
        /** @param {string} keyword @param {{scope?: any, offset?: number, limit?: number, ttlMs?: number, force?: boolean}} [options] */
        async searchFilePage(keyword, options = {}) {
            const offset = Math.max(0, Math.trunc(Number(options.offset) || 0));
            const limit = Math.max(1, Math.min(100, Math.trunc(Number(options.limit) || 50)));
            const url = new URL("https://webapi.115.com/files/search");
            url.searchParams.set("search_value", keyword);
            url.searchParams.set("offset", String(offset));
            url.searchParams.set("limit", String(limit));
            url.searchParams.set("type", "4");
            const response = await request(url.href, { capability: "file.search", scope: options.scope });
            const payload = /** @type {any} */ (parsePayload(response.data));
            if (payload?.state === false || payload?.state === 0) throw new JhsError(classify115OfflineError(payload.error || payload.error_msg || ""), "115 文件查询失败", { source: "one115" });
            const items = normalize115SearchResults(payload);
            if (payload.data.length > limit) throw new JhsError("INVALID_RESPONSE", "115 返回条目超过请求分页上限", { source: "one115" });
            const count = payload.count == null ? null : Number(payload.count);
            const total = count !== null && Number.isSafeInteger(count) && count >= 0 ? count : null;
            const nextOffset = offset + payload.data.length;
            const hasMore = total === null ? payload.data.length === limit : nextOffset < total;
            if (hasMore && !payload.data.length) throw new JhsError("INVALID_RESPONSE", "115 分页未推进", { source: "one115" });
            return Object.freeze({ items, total, nextOffset, hasMore, scanned: payload.data.length });
        },
        /** @param {string} keyword @param {{scope?: any, offset?: number, limit?: number, ttlMs?: number, force?: boolean}} [options] */
        async searchFiles(keyword, options = {}) { return (await this.searchFilePage(keyword, options)).items; },
        /** @param {string} resource @param {{scope?: any, folderId?: string, onMutationDispatch?: () => void}} [options] */
        async submit(resource, options = {}) {
            if (!/^magnet:/i.test(resource) && !/^ed2k:/i.test(resource)) throw new JhsError("UNSUPPORTED", "Unsupported offline URL", { source: "one115" });
            const infoResponse = await request(`https://115.com/?ct=offline&ac=space&_=${Date.now()}`, { capability: "offline.submit", scope: options.scope });
            const info = /** @type {any} */ (infoResponse.data);
            if (!info?.sign) throw new JhsError("AUTH_REQUIRED", "115 未登录或离线空间信息获取失败", { source: "one115" });
            const body = new URLSearchParams({ url: resource, wp_path_id: options.folderId || "", uid: String(info.uid || ""), sign: info.sign, time: String(info.time || "") }).toString();
            const response = await request("https://115.com/web/lixian/?ct=lixian&ac=add_task_url", { capability: "offline.submit", scope: options.scope, method: "POST", body, responseType: "text", headers: { "Content-Type": "application/x-www-form-urlencoded" }, onDispatch: options.onMutationDispatch });
            const payload = /** @type {any} */ (parsePayload(response.data));
            if (!payload || payload.state === false || payload.state === 0) {
                const message = String(payload?.error_msg || payload?.error || payload?.msg || "115 离线任务创建失败"), code = classify115OfflineError(message);
                throw new JhsError(code, message, { source: "one115", details: { state: payload?.state ?? null, ...(payload && { submissionOutcome: "rejected" }) } });
            }
            if (payload.state !== true && payload.state !== 1) throw new JhsError("INVALID_RESPONSE", "115 未返回明确的离线任务创建成功状态", { source: "one115" });
            return Object.freeze({ success: true, taskId: String(payload.task_id || payload.info_hash || "") });
        },
        /** @param {string} fileId @param {string} newName @param {{scope?: any, expectedAccountId?: string}} [options] */
        async renameFile(fileId, newName, options = {}) {
            if (options.expectedAccountId && (await this.getAccountIdentity(options)).accountId !== options.expectedAccountId) {
                throw new JhsError("AUTH_REQUIRED", "115 账号已切换，请重新匹配后操作", { source: "one115" });
            }
            const body = new URLSearchParams({ fid: fileId, file_name: newName }).toString();
            const response = await request("https://webapi.115.com/files/edit", { capability: "file.rename", scope: options.scope, method: "POST", body, responseType: "json", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
            const payload = /** @type {any} */ (response.data);
            if (!payload || payload.state === false || payload.state === 0) throw new JhsError("OPERATION_FAILED", String(payload?.error || payload?.error_msg || "115 重命名失败"), { source: "one115" });
            if (payload.state !== true && payload.state !== 1) throw new JhsError("INVALID_RESPONSE", "115 重命名结果待确认，请刷新匹配", { source: "one115" });
            return Object.freeze({ success: true });
        },
        /** @param {Record<string, any>} match */
        getPlayUrl(match) { return match?.videoId ? `https://115.com/?ct=play&pickcode=${encodeURIComponent(match.videoId)}` : null; },
    });
}

export default defineIntegration({
    id: "one115", trustClass: "builtin-public", hosts: ["115.com", "aliyuncs.com"],
    capabilities: ["account.status", "file.search", "file.rename", "file.list", "file.upload", "offline.submit"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createOne115Adapter(client.http), createHostAdapter: null,
    cachePolicy: { "account.status": "none", "file.search": "none", "file.rename": "none", "file.list": "none", "file.upload": "none", "offline.submit": "none" }, quality: "silver",
});
