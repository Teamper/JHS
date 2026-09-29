// @ts-check

import { decryptData, encryptData } from "../core/credential-crypto.js";

export const PAN123_CREDENTIAL_KEYS = Object.freeze({
    token: "jhs_123pan_author_token",
    metadata: "jhs_123pan_author_token_meta",
});

/** Owns the 123Pan page-token bridge and preserves the established encrypted GM-value format. */
export class Pan123CredentialService {
    /** @param {{getLocal: (key: string) => string | null, getValue: (key: string, fallback?: unknown) => unknown, setValue: (key: string, value: unknown) => unknown}} storage @param {{info?: (message: string) => unknown, debug?: (message: string, error?: unknown) => unknown}} notifications @param {{window?: Window, document?: Document, crypto?: Crypto}} [environment] */
    constructor(storage, notifications, environment = {}) {
        this.storage = storage;
        this.notifications = notifications;
        this.window = environment.window ?? globalThis.window;
        this.document = environment.document ?? globalThis.document;
        this.crypto = environment.crypto ?? globalThis.crypto;
        this.tokenKey = PAN123_CREDENTIAL_KEYS.token;
        this.tokenMetaKey = PAN123_CREDENTIAL_KEYS.metadata;
        this.syncTimer = null;
        this.syncFallbackMs = 3e5;
        this.syncGeneration = 0;
        /** @type {import("../core/lifecycle-scope.js").LifecycleScope | null} */
        this.syncScope = null;
    }

    /** @param {import("../core/lifecycle-scope.js").LifecycleScope} scope Start token synchronization only on the original 123Pan account host. */
    startTokenSync(scope) {
        if (this.window?.location?.hostname !== "yun.123pan.com" || this.syncScope === scope) return false;
        this.syncScope = scope;
        void this.syncTokenOnce();
        this.syncTimer && clearInterval(this.syncTimer);
        this.syncTimer = setInterval(() => void this.syncTokenOnce(), this.syncFallbackMs);
        scope.addCleanup(() => {
            if (this.syncScope !== scope) return;
            this.syncGeneration++;
            this.syncTimer && clearInterval(this.syncTimer);
            this.syncTimer = null;
            this.syncScope = null;
        });
        scope.listen(this.window, "storage", () => void this.syncTokenOnce());
        scope.listen(this.window, "focus", () => void this.syncTokenOnce());
        scope.listen(this.document, "visibilitychange", () => {
            this.document.hidden || void this.syncTokenOnce();
        });
        return true;
    }

    stop() {
        this.syncGeneration++;
        this.syncTimer && clearInterval(this.syncTimer);
        this.syncTimer = null;
        this.syncScope = null;
    }

    getTokenFrom123Pan() {
        const authorToken = (this.storage.getLocal("authorToken") || "").trim();
        if (authorToken) return { token: authorToken, source: "authorToken" };
        try {
            const userInfo = JSON.parse(this.storage.getLocal("userInfo") || "{}");
            if (userInfo.authorToken || userInfo.token) return {
                token: (userInfo.authorToken || userInfo.token || "").trim(),
                source: userInfo.authorToken ? "userInfo.authorToken" : "userInfo.token",
            };
        } catch (/** @type {unknown} */ error) { this.notifications.debug?.("123 云盘历史用户信息解析失败，继续尝试其他凭证来源", error); }
        for (const entry of this.document.cookie.split(";")) {
            const separator = entry.indexOf("=");
            if (separator < 0) continue;
            const key = entry.substring(0, separator).trim(), value = entry.substring(separator + 1);
            if (key && /token/i.test(key) && value) return { token: decodeURIComponent(value).trim(), source: `cookie.${key}` };
        }
        return { token: "", source: "" };
    }

    async syncTokenOnce() {
        const generation = ++this.syncGeneration, source = this.getTokenFrom123Pan();
        if (!source.token) return;
        const secretKey = `${this.tokenKey}_secret`;
        const storedSecret = this.storage.getValue(secretKey, "");
        const secret = typeof storedSecret === "string" && storedSecret
            ? storedSecret
            : this.crypto.randomUUID?.() || `${Date.now()}-${this.crypto.getRandomValues(new Uint32Array(4)).join("-")}`;
        if (typeof storedSecret !== "string" || !storedSecret) this.storage.setValue(secretKey, secret);
        const storedValue = this.storage.getValue(this.tokenKey, ""), current = await this.getStoredToken();
        const metadata = /** @type {{source?: string} | null} */ (this.storage.getValue(this.tokenMetaKey, null));
        if (current === source.token && typeof storedValue === "string" && storedValue.startsWith("AES:") && metadata?.source === source.source) return;
        const encrypted = "AES:" + await encryptData(source.token, secret);
        const latest = this.getTokenFrom123Pan();
        if (generation !== this.syncGeneration || latest.token !== source.token || latest.source !== source.source
            || this.storage.getValue(this.tokenKey, "") !== storedValue || this.storage.getValue(secretKey, "") !== secret) return;
        this.storage.setValue(this.tokenKey, encrypted);
        this.storage.setValue(this.tokenMetaKey, { source: source.source, updatedAt: new Date().toISOString() });
        if (current !== source.token) this.notifications.info?.(`123 云盘授权已更新：${source.source}`);
    }

    async getStoredToken() {
        const value = this.storage.getValue(this.tokenKey, ""), secret = this.storage.getValue(`${this.tokenKey}_secret`, "");
        if (typeof value !== "string") return "";
        if (!value.startsWith("AES:")) return value;
        if (typeof secret !== "string" || !secret) return "";
        try { return await decryptData(value.slice(4), secret, false); }
        catch { return ""; }
    }

    /** Invalidate in-flight sync before preserving the established cleared-token marker. @param {string} reason */
    clearStoredToken(reason) {
        this.syncGeneration++;
        this.storage.setValue(this.tokenKey, "");
        this.storage.setValue(this.tokenMetaKey, { source: "cleared", reason, updatedAt: new Date().toISOString() });
    }
}
