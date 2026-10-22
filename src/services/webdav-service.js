// @ts-check

import { JhsError } from "../core/jhs-error.js";
import { CREDENTIAL_KEYS } from "./credential-service.js";
import { isManagedBackup } from "../core/auto-backup-policy.js";
import { SYNC_FOLDER, parseSyncFileName } from "../core/webdav-sync-model.js";

const DOWNLOAD_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** @param {string} name */
function encodeBackupFileName(name) {
    if (typeof name !== "string" || !name || name === "." || name === ".." || /[/\\]/.test(name)) throw new JhsError("INVALID_URL", "备份文件名必须是单个有效文件名", { source: "WebDavClient" });
    return encodeURIComponent(name);
}

export class WebDavClient {
    /** @param {import("./http-service.js").HttpService} http @param {string} davUrl @param {string} username @param {string} password @param {any} [scope] */
    constructor(http, davUrl, username, password, scope = undefined) {
        this.http = http;
        this.baseUrl = new URL(davUrl.endsWith("/") ? davUrl : `${davUrl}/`);
        this.username = username;
        this.password = password;
        this.folderName = null;
        this.scope = scope;
    }
    authHeaders() {
        // TextEncoder 编码后再 btoa，兼容非 Latin1（中文）用户名/密码
        const bytes = new TextEncoder().encode(`${this.username}:${this.password}`);
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return { Authorization: `Basic ${btoa(binary)}`, Depth: "1" };
    }
    /** @param {string} method @param {string} path @param {Record<string, string>} [headers] @param {unknown} [body] @param {Record<string, unknown>} [requestOptions] */
    async request(method, path, headers = {}, body, requestOptions = {}) {
        const url = new URL(path.replace(/^\/+/, ""), this.baseUrl);
        const response = await this.#requestResponse(method, url, headers, body, requestOptions);
        return response.data ?? response.responseText ?? "";
    }
    /** Return response metadata while isolating anonymous download hops. @param {string} method @param {URL} url @param {Record<string, string>} headers @param {unknown} body @param {Record<string, unknown>} requestOptions @param {boolean} [anonymous] */
    async #requestResponse(method, url, headers, body, requestOptions, anonymous = false) {
        const options = {
            providerId: "webdav", method, url: url.href, headers: anonymous ? headers : { ...this.authHeaders(), ...headers }, body,
            responseType: "text", cacheScope: "none", ...requestOptions, timeout: 10_000,
            urlPolicy: { trustClass: anonymous ? "custom-public" : "user-local", expectedOrigin: anonymous ? url.origin : this.baseUrl.origin },
        };
        return this.scope ? this.http.request(options, this.scope) : this.http.request(options);
    }
    /** @param {string} folder */
    async ensureFolder(folder) {
        // Existing WebDAV collections report 405|409 and are valid outcomes.
        await this.request("MKCOL", folder, {}, undefined, { acceptableStatuses: [405, 409] });
    }
    /** @param {string} folder @param {string} name @param {string} content @param {(event: {stage: string, result: string, durationMs: number, bytes?: number, code?: string, status?: number, timeoutMs: number}) => void} [onStage] */
    async backup(folder, name, content, onStage) {
        const encodedName = encodeBackupFileName(name);
        /** @template T @param {string} stage @param {() => Promise<T>} action @param {number} [bytes] @returns {Promise<T>} */
        const runStage = async (stage, action, bytes) => {
            const startedAt = performance.now();
            let result = "success", code, status;
            try { return await action(); }
            catch (error) {
                result = "error";
                if (error && typeof error === "object") {
                    const failure = /** @type {any} */ (error);
                    code = typeof failure.code === "string" ? failure.code : undefined;
                    status = Number.isFinite(failure.details?.status) ? failure.details.status : undefined;
                }
                throw error;
            } finally {
                try { onStage?.({ stage, result, durationMs: Math.round(performance.now() - startedAt), ...(bytes == null ? {} : { bytes }), ...(code ? { code } : {}), ...(status == null ? {} : { status }), timeoutMs: 10_000 }); }
                catch { /* Diagnostics must not change the backup result. */ }
            }
        };
        await runStage("建目录", () => this.ensureFolder(folder));
        await runStage("上传", () => this.request("PUT", `${folder}/${encodedName}`, { "Content-Type": "text/plain" }, content), content.length);
    }
    /** @param {string} folder */
    async getFileList(folder) {
        const xml = String(await this.request("PROPFIND", folder, { "Content-Type": "application/xml" }, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:getcontentlength/><d:creationdate/><d:getlastmodified/><d:iscollection/></d:prop></d:propfind>'));
        const responses = new DOMParser().parseFromString(xml, "text/xml").getElementsByTagNameNS("DAV:", "response"), files = [];
        for (let index = 1; index < responses.length; index++) {
            const item = responses[index], node = (/** @type {string} */ name) => item.getElementsByTagNameNS("DAV:", name)[0]?.textContent || "";
            const href = node("href"), name = node("displayname") || decodeURIComponent(href.replace(/\/$/, "").split("/").pop() || ""), size = node("getcontentlength");
            if (size !== "0") files.push({ fileId: name, name, size: Number(size), createTime: node("creationdate") || node("getlastmodified") });
        }
        return files.reverse();
    }
    /** @param {string} name */
    async deleteFile(name) { await this.request("DELETE", `${this.folderName}/${encodeBackupFileName(name)}`, { "Cache-Control": "no-cache" }); }
    /** @param {string} folder */
    async getBackupList(folder) { this.folderName = folder; await this.ensureFolder(folder); return this.getFileList(folder); }
    /** Strict href-based listing for verification and destructive retention. @param {string} folder @param {string} sourceId */
    async listManagedBackups(folder, sourceId) {
        const directory = new URL(`${encodeBackupFileName(folder)}/`, this.baseUrl);
        const xml = String(await this.request("PROPFIND", encodeBackupFileName(folder), { "Content-Type": "application/xml" }, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/></d:prop></d:propfind>'));
        const document = new DOMParser().parseFromString(xml, "text/xml");
        if (document.getElementsByTagName("parsererror").length || document.documentElement?.localName !== "multistatus" || document.documentElement?.namespaceURI !== "DAV:") throw new Error("WebDAV 备份列表格式无效");
        const files = new Set();
        for (const response of document.getElementsByTagNameNS("DAV:", "response")) {
            const href = [...response.children].find(node => node.namespaceURI === "DAV:" && node.localName === "href")?.textContent?.trim();
            if (!href) continue;
            let url, name;
            try {
                url = new URL(href, directory);
                if (url.origin !== directory.origin || url.search || url.hash || url.username || url.password || !url.pathname.startsWith(directory.pathname)) continue;
                const remainder = url.pathname.slice(directory.pathname.length);
                if (!remainder || remainder.includes("/")) continue;
                name = decodeURIComponent(remainder);
                if (name.includes("/") || name.includes("\\") || !isManagedBackup(name, sourceId)) continue;
            } catch { continue; }
            const valid = [...response.getElementsByTagNameNS("DAV:", "propstat")].some(propstat => {
                const status = propstat.getElementsByTagNameNS("DAV:", "status")[0]?.textContent || "";
                const prop = propstat.getElementsByTagNameNS("DAV:", "prop")[0];
                return /\s2\d\d(?:\s|$)/.test(status) && prop && prop.getElementsByTagNameNS("DAV:", "resourcetype").length > 0 && !prop.getElementsByTagNameNS("DAV:", "collection").length;
            });
            if (valid) files.add(name);
        }
        return [...files].sort().reverse();
    }
    /** Delete only a strictly identified automatic backup in this directory. @param {string} folder @param {string} name @param {string} sourceId */
    async deleteManagedBackup(folder, name, sourceId) {
        if (!isManagedBackup(name, sourceId)) throw new Error("拒绝删除非本来源的自动备份");
        await this.request("DELETE", `${encodeBackupFileName(folder)}/${encodeBackupFileName(name)}`);
    }
    /** Metadata is additive; existing callers still receive only the body. @param {string} method @param {string} path @param {Record<string, string>} [headers] @param {unknown} [body] @param {Record<string, unknown>} [options] */
    requestMetadata(method, path, headers = {}, body, options = {}) {
        return this.#requestResponse(method, new URL(path.replace(/^\/+/, ""), this.baseUrl), headers, body, options);
    }
    async listSyncFiles() {
        const folder = encodeBackupFileName(SYNC_FOLDER), directory = new URL(`${folder}/`, this.baseUrl);
        const xml = String(await this.request("PROPFIND", folder, { Depth: "1", "Cache-Control": "no-cache", "Content-Type": "application/xml" }, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>'));
        const document = new DOMParser().parseFromString(xml, "text/xml");
        if (document.getElementsByTagName("parsererror").length || document.documentElement?.localName !== "multistatus" || document.documentElement.namespaceURI !== "DAV:") throw new Error("同步目录列表格式无效");
        /** @type {Map<string, any>} */ const files = new Map();
        for (const response of document.getElementsByTagNameNS("DAV:", "response")) {
            const hrefs = [...response.children].filter(node => node.namespaceURI === "DAV:" && node.localName === "href");
            if (hrefs.length !== 1 || !hrefs[0].textContent?.trim()) throw new Error("同步目录存在异常路径，暂停清理");
            const url = new URL(hrefs[0].textContent.trim(), directory);
            if (url.origin === directory.origin && !url.search && !url.hash && !url.username && !url.password && url.pathname === directory.pathname.replace(/\/$/, "")) continue;
            if (url.origin !== directory.origin || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(directory.pathname)) throw new Error("同步目录路径越界");
            const suffix = url.pathname.slice(directory.pathname.length);
            if (!suffix) continue;
            const name = decodeURIComponent(suffix);
            if (suffix.includes("/") || /[/\\]/.test(name)) throw new Error("同步目录包含非直接文件路径");
            const version = /^sync_v(\d+)_/.exec(name);
            if (!version) continue;
            if (Number(version[1]) !== 1) throw Object.assign(new Error("同步目录含更新协议，请更新 JHS"), { code: "SYNC_FUTURE_VERSION" });
            const parsed = parseSyncFileName(name); if (!parsed) throw new Error("同步文件名称异常，暂停清理");
            const valid = [...response.children].filter(node => node.namespaceURI === "DAV:" && node.localName === "propstat").some(propstat => {
                const status = [...propstat.children].find(node => node.namespaceURI === "DAV:" && node.localName === "status")?.textContent || "";
                const prop = [...propstat.children].find(node => node.namespaceURI === "DAV:" && node.localName === "prop");
                const resource = prop && [...prop.children].find(node => node.namespaceURI === "DAV:" && node.localName === "resourcetype");
                return /\s2\d\d(?:\s|$)/.test(status) && resource && resource.children.length === 0;
            });
            if (!valid) throw new Error("同步目录未完整提供文件类型，暂停清理");
            files.set(name, parsed);
        }
        return [...files.values()];
    }
    /** @param {string} name @param {boolean} [missingOK] */
    async readSyncFile(name, missingOK = false) {
        if (!parseSyncFileName(name)) throw new Error("同步文件名无效");
        const response = await this.#download(`${encodeBackupFileName(SYNC_FOLDER)}/${encodeBackupFileName(name)}`, { missingOK, noCache: true });
        return Number(response.status) === 404 ? null : String(response.data ?? response.responseText ?? "");
    }
    /** @param {string} name @param {string} content */
    async writeSyncFile(name, content) {
        if (!parseSyncFileName(name)) throw new Error("同步文件名无效");
        await this.request("PUT", `${encodeBackupFileName(SYNC_FOLDER)}/${encodeBackupFileName(name)}`, { "Content-Type": "text/plain", "Cache-Control": "no-cache" }, content);
    }
    /** @param {string} name @param {string} replicaId */
    async deleteSyncFile(name, replicaId) {
        if (parseSyncFileName(name)?.replicaId !== replicaId) throw new Error("拒绝清理其他副本的文件");
        await this.request("DELETE", `${encodeBackupFileName(SYNC_FOLDER)}/${encodeBackupFileName(name)}`, { "Cache-Control": "no-cache" }, undefined, { acceptableStatuses: [404] });
    }
    /** @param {string} name */
    async getFileContent(name) {
        const response = await this.#download(`${this.folderName}/${encodeBackupFileName(name)}`);
        return String(response.data ?? response.responseText ?? "");
    }
    /** Follow downloads without forwarding origin credentials after a cross-origin hop. @param {string} path @param {{missingOK?: boolean, noCache?: boolean}} [options] */
    async #download(path, { missingOK = false, noCache = false } = {}) {
        let url = new URL(path.replace(/^\/+/, ""), this.baseUrl), anonymous = false;
        const visited = new Set();
        for (let redirects = 0; ; redirects++) {
            this.scope?.assertActive();
            url.hash = "";
            if (visited.has(url.href)) throw new JhsError("INVALID_URL", "WebDAV 下载跳转形成循环", { source: "WebDavClient" });
            visited.add(url.href);
            const response = await this.#requestResponse("GET", url, { Accept: "application/octet-stream", ...(noCache ? { "Cache-Control": "no-cache" } : {}) }, undefined, {
                requestOptions: { redirect: "manual", ...(anonymous ? { anonymous: true } : {}) },
                // A missing CDN object does not prove the DAV object is absent.
                acceptableStatuses: missingOK && !anonymous ? [404] : [],
            }, anonymous);
            this.scope?.assertActive();
            const status = Number(response.status);
            if ((status >= 200 && status < 300) || (status === 404 && missingOK && !anonymous)) return response;
            if (!DOWNLOAD_REDIRECT_STATUSES.has(status)) throw new JhsError("NETWORK_ERROR", "WebDAV 下载返回无效响应", { source: "WebDavClient", details: { status } });
            if (redirects >= 5) throw new JhsError("INVALID_URL", "WebDAV 下载跳转次数超过限制", { source: "WebDavClient" });
            const location = String(response.responseHeaders ?? "").match(/^location\s*:\s*(.+)$/im)?.[1]?.trim();
            if (!location) throw new JhsError("INVALID_URL", "WebDAV 下载跳转缺少可读取的 Location", { source: "WebDavClient" });
            try { url = new URL(location, url); }
            catch { throw new JhsError("INVALID_URL", "WebDAV 下载跳转地址无效", { source: "WebDavClient" }); }
            if (url.username || url.password) throw new JhsError("INVALID_URL", "WebDAV 下载跳转地址不能包含凭证", { source: "WebDavClient" });
            anonymous ||= url.origin !== this.baseUrl.origin;
        }
    }
}

export class WebDavService {
    /** @param {import("./http-service.js").HttpService} http @param {import("./credential-service.js").CredentialService} [credential] @param {import("./settings-service.js").SettingsService} [settings] @param {string} [pageOrigin] */
    constructor(http, credential = undefined, settings = undefined, pageOrigin = globalThis.location?.origin) {
        this.http = http; this.credential = credential; this.settings = settings;
        const origin = pageOrigin ? new URL(pageOrigin).origin : null;
        this.passwordKey = origin && origin !== "null" ? `${CREDENTIAL_KEYS.webDavPassword}:origin:${encodeURIComponent(origin)}` : null;
        /** @type {import("./webdav-shared-profile.js").WebDavSharedProfile | null} */ this.sharedProfile = null;
    }
    /** @param {{url: string, username: string, password: string}} config @param {{scope?: any}} [options] */
    createClient(config, options = {}) { return new WebDavClient(this.http, config.url, config.username, config.password, options.scope); }
    async getProfileSnapshot() {
        if (this.sharedProfile) return this.sharedProfile.snapshot();
        if (!this.settings) return { profile: await this.getProfile(), revision: "" };
        return this.settings.runExclusive(async () => ({ profile: await this.readProfileWithoutLock(), revision: String(this.settings?.snapshot().webDavProfileRevision || "") }));
    }
    /** Read the site-local profile in the same queue as profile saves. */
    async getProfile() {
        if (this.sharedProfile) {
            try { const shared = await this.sharedProfile.snapshot(); if (shared.revision) return shared.profile; }
            catch (cause) {
                if (/** @type {any} */ (cause).code !== "SYNC_PROFILE_CONFLICT") throw Object.assign(new Error("共享 WebDAV 密码无法读取，请重新输入密码并保存", { cause }), { code: "WEBDAV_CREDENTIAL_UNREADABLE" });
            }
        }
        return this.settings ? this.settings.runExclusive(() => this.readProfileWithoutLock()) : this.readProfileWithoutLock();
    }
    /** Caller holds the settings lock; never re-enter getProfile/update here. */
    async readProfileWithoutLock() {
        const settings = this.settings?.snapshot?.() || {};
        let password = "";
        if (this.credential) {
            if (!this.passwordKey) throw new Error("无法确定 WebDAV 所属站点，请重新打开设置");
            try {
                const entry = await this.credential.readEntry(this.passwordKey);
                password = entry.value;
                if (!entry.exists) {
                    const legacy = await this.credential.readEntry(CREDENTIAL_KEYS.webDavPassword);
                    if (legacy.exists) password = await this.credential.replaceWithRollback(this.passwordKey, legacy.value, async () => legacy.value);
                }
            } catch (cause) {
                throw Object.assign(new Error("此站点 WebDAV 密码无法读取，请重新输入密码并保存", { cause }), { code: "WEBDAV_CREDENTIAL_UNREADABLE" });
            }
        }
        return { url: String(settings.webDavUrl || ""), username: String(settings.webDavUsername || ""), password };
    }
    /** Serialize site-local credential/settings writes and rollback under their shared lock. @param {Record<string, any>} [patch] @param {(draft: Record<string, unknown>) => unknown} [updateSettings] */
    async saveProfile(patch = {}, updateSettings) {
        if (!this.settings || !this.credential) throw new Error("WebDAV 配置服务未初始化");
        if (updateSettings != null && typeof updateSettings !== "function") throw new TypeError("WebDAV settings updater must be a function");
        if (this.sharedProfile) {
            const saved = await this.sharedProfile.save(patch);
            // The GM record is authoritative. Local side effects must never roll it back.
            try { await this.settings.update(draft => {
                draft.webDavUrl = saved.profile.url; draft.webDavUsername = saved.profile.username; draft.webDavProfileRevision = saved.revision;
                return updateSettings?.(draft);
            }); } catch (cause) { throw new Error("共享连接已保存，本机设置保存失败，请重新打开设置后重试", { cause }); }
            return saved.profile;
        }
        const settings = this.settings, credential = this.credential;
        return settings.runExclusive(async () => {
            const passwordChanged = Object.prototype.hasOwnProperty.call(patch, "password");
            const password = passwordChanged ? String(patch.password || "") : (await this.readProfileWithoutLock()).password;
            const persist = async () => {
                await settings.updateWithoutLock((draft) => {
                    const connectionChanged = passwordChanged || ["url", "username"].some(key => Object.hasOwn(patch, key) && String(patch[key] || "") !== String(draft[key === "url" ? "webDavUrl" : "webDavUsername"] || ""));
                    for (const key of ["url", "username"]) if (Object.prototype.hasOwnProperty.call(patch, key)) draft[key === "url" ? "webDavUrl" : "webDavUsername"] = String(patch[key] || "");
                    if (connectionChanged || !draft.webDavProfileRevision) draft.webDavProfileRevision = crypto.randomUUID();
                    return updateSettings?.(draft);
                });
                const saved = settings.snapshot();
                return { url: String(saved.webDavUrl || ""), username: String(saved.webDavUsername || ""), password };
            };
            if (passwordChanged) {
                if (!this.passwordKey) throw new Error("无法确定 WebDAV 所属站点，请重新打开设置");
                return credential.replaceWithRollback(this.passwordKey, password, persist);
            }
            return persist();
        });
    }
}
