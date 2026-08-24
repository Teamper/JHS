// @ts-check

import { BasePlugin } from "../../core/plugin-manager.js";

export class OneTwoThreeOfflinePlugin extends BasePlugin {
    constructor() {
        super(...arguments), this.tokenKey = "jhs_123pan_author_token", this.tokenMetaKey = "jhs_123pan_author_token_meta",
        this.syncTimer = null, this.syncFallbackMs = 3e5;
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
    syncTokenOnce() {
        const storage = this.getRuntimeService("storage"), e = this.getTokenFrom123Pan();
        if (!e.token) return;
        const t = storage.getValue(this.tokenKey, ""), n = storage.getValue(this.tokenMetaKey, null);
        if (t === e.token && n && n.source === e.source) return;
        storage.setValue(this.tokenKey, e.token), storage.setValue(this.tokenMetaKey, {
            source: e.source,
            updatedAt: (new Date).toISOString()
        }), t !== e.token && show.info(`123 云盘授权已更新：${e.source}`);
    }
    getStoredToken() {
        return this.getRuntimeService("storage").getValue(this.tokenKey, "");
    }
    clearStoredToken(/** @type {string} */ e) {
        const storage = this.getRuntimeService("storage");
        storage.setValue(this.tokenKey, ""), storage.setValue(this.tokenMetaKey, {
            source: "cleared",
            reason: e,
            updatedAt: (new Date).toISOString()
        });
    }
}
