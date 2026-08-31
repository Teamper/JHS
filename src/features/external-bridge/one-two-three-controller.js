// @ts-check

import { decryptCredential, encryptCredential } from "../../core/credential-crypto.js";

/** Own 123Pan site-token discovery and the shared encrypted credential. */
export class OneTwoThreeAuthController {
    /** @param {{document?: Document, window?: Window, storage: any, ui?: any, scope: any}} options */
    constructor(options) {
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window;
        this.storage = options.storage;
        this.ui = options.ui;
        this.scope = options.scope;
        this.tokenKey = "jhs_123pan_author_token";
        this.tokenMetaKey = "jhs_123pan_author_token_meta";
        this.syncTimer = null;
        this.syncFallbackMs = 3e5;
        this.started = false;
    }

    getClog() { return this.ui?.getClog?.() ?? {}; }
    getShow() { return this.ui?.show ?? {}; }

    /** Start 123Pan token synchronization on the 123Pan host only. */
    start() {
        this.scope.assertActive();
        if (this.started) return;
        this.started = true;
        if (this.window?.location?.hostname !== "yun.123pan.com") return;
        this.runSync();
        this.syncTimer = this.window.setInterval(() => this.runSync(), this.syncFallbackMs);
        const sync = () => this.runSync();
        this.scope.listen(this.window, "storage", sync);
        this.scope.listen(this.window, "focus", sync);
        this.scope.listen(this.document, "visibilitychange", () => {
            this.document.hidden || this.runSync();
        });
        this.scope.addCleanup(() => this.dispose());
    }

    runSync() {
        void this.syncTokenOnce().catch((error) => this.getClog().debug?.("123 云盘授权同步失败", error));
    }

    getTokenFrom123Pan() {
        let token = (this.storage.getLocal("authorToken") || "").trim();
        if (token) return { token, source: "authorToken" };
        try {
            const userInfo = JSON.parse(this.storage.getLocal("userInfo") || "{}");
            if (userInfo.authorToken || userInfo.token) return { token: (userInfo.authorToken || userInfo.token || "").trim(), source: userInfo.authorToken ? "userInfo.authorToken" : "userInfo.token" };
        } catch (error) { this.getClog().debug?.("123 云盘历史用户信息解析失败，继续尝试其他凭证来源", error); }
        for (const cookie of this.document.cookie.split(";")) {
            const separator = cookie.indexOf("=");
            if (separator < 0) continue;
            const name = cookie.substring(0, separator).trim(), value = cookie.substring(separator + 1);
            if (name && /token/i.test(name) && value) return { token: decodeURIComponent(value).trim(), source: `cookie.${name}` };
        }
        return { token: "", source: "" };
    }

    async syncTokenOnce() {
        const discovered = this.getTokenFrom123Pan();
        if (!discovered.token) return;
        const secretKey = `${this.tokenKey}_secret`;
        let secret = this.storage.getValue(secretKey, "");
        if (!secret) {
            const cryptoApi = /** @type {any} */ (globalThis).crypto;
            secret = cryptoApi.randomUUID?.() || `${Date.now()}-${cryptoApi.getRandomValues(new Uint32Array(4)).join("-")}`;
            this.storage.setValue(secretKey, secret);
        }
        const stored = this.storage.getValue(this.tokenKey, ""), current = await decryptCredential(stored, secret), meta = this.storage.getValue(this.tokenMetaKey, null);
        if (current === discovered.token && stored.startsWith("AES:") && meta && meta.source === discovered.source) return;
        this.storage.setValue(this.tokenKey, await encryptCredential(discovered.token, secret));
        this.storage.setValue(this.tokenMetaKey, { source: discovered.source, updatedAt: new Date().toISOString() });
        current !== discovered.token && this.getShow().info?.(`123 云盘授权已更新：${discovered.source}`);
    }

    async getStoredToken() {
        const value = this.storage.getValue(this.tokenKey, ""), secret = this.storage.getValue(`${this.tokenKey}_secret`, "");
        return value && secret ? decryptCredential(value, secret) : value;
    }

    /** @param {string} reason */
    clearStoredToken(reason) {
        this.storage.setValue(this.tokenKey, "");
        this.storage.setValue(this.tokenMetaKey, { source: "cleared", reason, updatedAt: new Date().toISOString() });
    }

    dispose() {
        if (this.syncTimer !== null) this.window.clearInterval(this.syncTimer);
        this.syncTimer = null;
        this.started = false;
    }
}
