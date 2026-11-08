// @ts-check
import { SUBTITLE_MAX_BYTES, subtitleFilename } from "../../core/subtitle-asset.js";

const policy115 = { trustClass: "builtin-public", hosts: ["115.com"] };

/** @param {unknown} value */
function payload(value) { return typeof value === "string" ? JSON.parse(value) : value; }

/** @param {string} folderId */
function assertFolder(folderId) { if (!/^\d+$/.test(folderId)) throw new TypeError("115 目标目录无效"); }

/** @param {unknown} input */
export function assert115UploadTarget(input) {
    const url = new URL(String(input || ""));
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/" || !/^[a-z0-9-]+\.oss-[a-z0-9-]+\.aliyuncs\.com$/.test(url.hostname)) throw new TypeError("115 返回的上传目标未获授权");
    return url.href;
}

/** @param {any} http @param {string} folderId @param {{scope?: any, offset?: number, limit?: number}} [options] */
export async function list115Directory(http, folderId, options = {}) {
    assertFolder(folderId);
    const offset = Math.max(0, Math.trunc(options.offset || 0)), limit = Math.max(1, Math.min(100, Math.trunc(options.limit || 100)));
    const url = new URL("https://webapi.115.com/files");
    for (const [key, value] of Object.entries({ cid: folderId, offset, limit, show_dir: 1, format: "json" })) url.searchParams.set(key, String(value));
    const response = await http.request({ providerId: "one115", capability: "file.list", url: url.href, responseType: "json", urlPolicy: policy115 }, options.scope);
    const data = payload(response.data);
    if (!data || data.state === false || data.state === 0 || !Array.isArray(data.data) || data.data.length > limit) throw new TypeError("115 目录读取失败");
    const items = data.data.map((/** @type {any} */ item) => ({ fileId: String(item.fid || ""), folderId: String(item.pid || folderId), name: String(item.n || item.file_name || ""), size: Number(item.s || item.size || 0), sha1: String(item.sha || item.sha1 || "").toLowerCase(), isFolder: !item.fid }));
    const nextOffset = offset + items.length, total = Number(data.count);
    if (!Number.isSafeInteger(total) || total < 0 || nextOffset < total && !items.length) throw new TypeError("115 目录分页信息无效");
    return { items, nextOffset, hasMore: nextOffset < total, total };
}

/** @param {any} http @param {(options: any) => Promise<{accountId: string}>} identity @param {{folderId: string, filename: string, bytes: ArrayBuffer, accountId: string}} file @param {{scope?: any, onMutationDispatch?: () => void}} [options] */
export async function upload115Subtitle(http, identity, file, options = {}) {
    assertFolder(file.folderId);
    const ext = file.filename.split(".").pop()?.toLowerCase() || "";
    if (!["srt", "ass", "ssa", "vtt"].includes(ext) || subtitleFilename(file.filename, ext) !== file.filename || !(file.bytes instanceof ArrayBuffer) || !file.bytes.byteLength || file.bytes.byteLength > SUBTITLE_MAX_BYTES) throw new TypeError("115 字幕上传文件无效");
    const checkAccount = async () => { if (!file.accountId || (await identity(options)).accountId !== file.accountId) throw new TypeError("115 账号已切换，请重新确认目录"); };
    await checkAccount();
    const init = await http.request({ providerId: "one115", capability: "file.upload", method: "POST", url: "https://uplb.115.com/3.0/sampleinitupload.php", body: new URLSearchParams({ filename: file.filename, filesize: String(file.bytes.byteLength), target: `U_1_${file.folderId}` }).toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" }, responseType: "json", retryCount: 0, urlPolicy: policy115 }, options.scope);
    const data = payload(init.data);
    if (!data || data.state === false || data.state === 0) throw new TypeError("115 上传初始化失败");
    const target = assert115UploadTarget(data.host);
    for (const key of ["object", "policy", "accessid", "callback", "signature"]) if (typeof data[key] !== "string" || !data[key].trim()) throw new TypeError("115 上传凭据不完整");
    if (data.object.includes("${") || /[\r\n]/.test(data.object)) throw new TypeError("115 上传对象无效");
    await checkAccount();
    options.scope?.assertActive();
    const body = new FormData();
    for (const [key, value] of Object.entries({ name: file.filename, key: data.object, policy: data.policy, OSSAccessKeyId: data.accessid, callback: data.callback, signature: data.signature, success_action_status: "200" })) body.append(key, value);
    body.append("file", new Blob([file.bytes], { type: "application/octet-stream" }), file.filename);
    const response = await http.request({ providerId: "one115", capability: "file.upload", method: "POST", url: target, body, responseType: "json", retryCount: 0, onDispatch: options.onMutationDispatch,
        requestOptions: { anonymous: true, fetch: true, redirect: "error" }, urlPolicy: { trustClass: "builtin-public", hosts: ["aliyuncs.com"], expectedOrigin: new URL(target).origin, expectedUrl: target },
    }, options.scope);
    if (response.finalUrl && new URL(response.finalUrl).href !== target) throw new TypeError("115 上传响应离开已确认目标");
    const result = payload(response.data);
    if (result?.state !== true && result?.state !== 1) throw new TypeError("115 上传结果尚未确认");
    return { success: true, fileId: String(result.file_id || result.fid || result.data?.file_id || result.data?.fid || "") };
}
