// @ts-check

import { BasePlugin } from "../../core/plugin-manager.js";
import { decryptData, encryptData } from "../../core/credential-crypto.js";

export class OneTwoThreeOfflinePlugin extends BasePlugin {
    constructor() {
        super(...arguments), this.tokenKey = "jhs_123pan_author_token", this.tokenMetaKey = "jhs_123pan_author_token_meta",
        this.syncTimer = null, this.syncFallbackMs = 3e5, this.syncGeneration = 0;
    }
    getName() {
        return "OneTwoThreeOfflinePlugin";
    }
    async handle() {
        if ("yun.123pan.com" !== window.location.hostname) return;
        this.startTokenSync(await this.getRuntimeService("scope")());
    }
    /** @param {any} scope */
    startTokenSync(scope) {
        this.syncTokenOnce(), this.syncTimer && clearInterval(this.syncTimer), this.syncTimer = setInterval((() => this.syncTokenOnce()), this.syncFallbackMs);
        const e = () => this.syncTokenOnce();
        scope.addCleanup((() => { this.syncTimer && clearInterval(this.syncTimer), this.syncTimer = null; }));
        scope.listen(window, "storage", e), scope.listen(window, "focus", e), scope.listen(document, "visibilitychange", (() => {
            document.hidden || this.syncTokenOnce();
        }));
    }
    getTokenFrom123Pan() {
        const storage = this.getRuntimeService("storage");
        let e = (storage.getLocal("authorToken") || "").trim();
        if (e) return {
            token: e,
            source: "authorToken"
        };
        try {
            const t = JSON.parse(storage.getLocal("userInfo") || "{}");
            if (t.authorToken || t.token) return {
                token: (t.authorToken || t.token || "").trim(),
                source: t.authorToken ? "userInfo.authorToken" : "userInfo.token"
            };
        } catch (t) { clog.debug("123 云盘历史用户信息解析失败，继续尝试其他凭证来源", t); }
        const t = document.cookie.split(";");
        for (const n of t) {
            const e = n.indexOf("=");
            if (e < 0) continue;
            const t = n.substring(0, e).trim(), a = n.substring(e + 1);
            if (t && /token/i.test(t) && a) return {
                token: decodeURIComponent(a).trim(),
                source: `cookie.${t}`
            };
        }
        return {
            token: "",
            source: ""
        };
    }
    async syncTokenOnce() {
        const generation = ++this.syncGeneration;
        const storage = this.getRuntimeService("storage"), e = this.getTokenFrom123Pan();
        if (!e.token) return;
        const secretKey = `${this.tokenKey}_secret`;
        let secret = storage.getValue(secretKey, "");
        if (!secret) secret = crypto.randomUUID?.() || `${Date.now()}-${crypto.getRandomValues(new Uint32Array(4)).join("-")}`, storage.setValue(secretKey, secret);
        const t = storage.getValue(this.tokenKey, ""), current = await this.getStoredToken(), n = storage.getValue(this.tokenMetaKey, null);
        if (current === e.token && t.startsWith("AES:") && n && n.source === e.source) return;
        const encrypted = "AES:" + await encryptData(e.token, secret);
        const latest = this.getTokenFrom123Pan();
        if (generation !== this.syncGeneration || latest.token !== e.token || latest.source !== e.source || storage.getValue(this.tokenKey, "") !== t || storage.getValue(secretKey, "") !== secret) return;
        storage.setValue(this.tokenKey, encrypted), storage.setValue(this.tokenMetaKey, {
            source: e.source,
            updatedAt: (new Date).toISOString()
        }), current !== e.token && show.info(`123 云盘授权已更新：${e.source}`);
    }
    async getStoredToken() {
        const storage = this.getRuntimeService("storage"), value = storage.getValue(this.tokenKey, ""), secret = storage.getValue(`${this.tokenKey}_secret`, "");
        if (typeof value !== "string") return "";
        if (!value.startsWith("AES:")) return value;
        if (typeof secret !== "string" || !secret) return "";
        try { return await decryptData(value.slice(4), secret, false); }
        catch { return ""; }
    }
    clearStoredToken(/** @type {string} */ e) {
        this.syncGeneration++;
        const storage = this.getRuntimeService("storage");
        storage.setValue(this.tokenKey, ""), storage.setValue(this.tokenMetaKey, {
            source: "cleared",
            reason: e,
            updatedAt: (new Date).toISOString()
        });
    }
}
