// @ts-check

export class WebDavClient {
    /** @param {import("./http-service.js").HttpService} http @param {string} davUrl @param {string} username @param {string} password */
    constructor(http, davUrl, username, password) {
        this.http = http;
        this.baseUrl = new URL(davUrl.endsWith("/") ? davUrl : `${davUrl}/`);
        this.username = username;
        this.password = password;
        this.folderName = null;
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
        const response = await this.http.request({
            providerId: "webdav", method, url: url.href, headers: { ...this.authHeaders(), ...headers }, body,
            responseType: "text", cacheScope: "none", ...requestOptions,
            urlPolicy: { trustClass: "user-local", expectedOrigin: this.baseUrl.origin },
        });
        return response.data ?? response.responseText ?? "";
    }
    /** @param {string} folder */
    async ensureFolder(folder) {
        // Existing WebDAV collections report 405|409 and are valid outcomes.
        await this.request("MKCOL", folder, {}, undefined, { acceptableStatuses: [405, 409] });
    }
    /** @param {string} folder @param {string} name @param {string} content */
    async backup(folder, name, content) { await this.ensureFolder(folder); await this.request("PUT", `${folder}/${name}`, { "Content-Type": "text/plain" }, content); }
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
    async deleteFile(name) { await this.request("DELETE", `${this.folderName}/${encodeURI(name)}`, { "Cache-Control": "no-cache" }); }
    /** @param {string} folder */
    async getBackupList(folder) { this.folderName = folder; await this.ensureFolder(folder); return this.getFileList(folder); }
    /** @param {string} name */
    async getFileContent(name) { return String(await this.request("GET", `${this.folderName}/${name}`, { Accept: "application/octet-stream" })); }
}

export class WebDavService {
    /** @param {import("./http-service.js").HttpService} http @param {import("./credential-service.js").CredentialService} [credential] @param {import("./settings-service.js").SettingsService} [settings] */
    constructor(http, credential = undefined, settings = undefined) { this.http = http; this.credential = credential; this.settings = settings; }
    /** @param {{url: string, username: string, password: string}} config */
    createClient(config) { return new WebDavClient(this.http, config.url, config.username, config.password); }
    /** Return the installation-local profile without exposing the encrypted password. */
    async getProfile() {
        const settings = this.settings?.snapshot?.() || {};
        const password = this.credential ? await this.credential.get("jhs_webdav_password") : "";
        return { url: String(settings.webDavUrl || ""), username: String(settings.webDavUsername || ""), password };
    }
    /** Atomically coordinate the GM credential write with the settings update. */
    async saveProfile(/** @type {Record<string, any>} */ patch = {}) {
        if (!this.settings || !this.credential) throw new Error("WebDAV 配置服务未初始化");
        const previous = /** @type {{password: string}} */ (await this.getProfile());
        const passwordChanged = Object.prototype.hasOwnProperty.call(patch, "password");
        if (passwordChanged) await /** @type {any} */ (this.credential).set("jhs_webdav_password", String(patch.password || ""));
        try {
            await this.settings.update((draft) => {
                for (const key of ["url", "username"]) if (Object.prototype.hasOwnProperty.call(patch, key)) draft[key === "url" ? "webDavUrl" : "webDavUsername"] = String(patch[key] || "");
            });
        } catch (error) {
            if (passwordChanged) await /** @type {any} */ (this.credential).set("jhs_webdav_password", previous.password);
            throw error;
        }
        return this.getProfile();
    }
}
