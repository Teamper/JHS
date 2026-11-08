// @ts-check

import { JhsError } from "../core/jhs-error.js";

const PRIVATE_IPV4 = [
    /^10\./, /^127\./, /^169\.254\./, /^192\.168\./,
    /^172\.(?:1[6-9]|2\d|3[01])\./, /^0\./,
];

/** @param {string} hostname */
function isPrivateLiteral(hostname) {
    const value = hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (value === "localhost" || value.endsWith(".localhost") || value === "::1") return true;
    const mapped = /^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/.exec(value);
    if (mapped) {
        const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
        return PRIVATE_IPV4.some((pattern) => pattern.test(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`));
    }
    if (value.includes(":")) return value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb");
    return PRIVATE_IPV4.some((pattern) => pattern.test(value));
}

export class ExternalUrlPolicy {
    /** @param {{localOrigins?: string[]}} [options] */
    constructor(options = {}) {
        this.localOrigins = new Set();
        /** @type {Map<string, Set<string>>} */ this.localOriginOwners = new Map();
        this.replaceLocalOrigins(options.localOrigins ?? []);
    }

    /** @param {string} origin */
    authorizeLocalOrigin(origin) { this.localOrigins.add(new URL(origin).origin); }

    /** Atomically replaces the exact local origins authorized by the user. @param {readonly string[]} origins */
    replaceLocalOrigins(origins) {
        const next = new Set(origins.map((origin) => new URL(origin).origin));
        this.localOrigins = next;
    }

    /** Revoke one connection owner without replacing other user grants. @param {string} owner @param {string[]} origins */
    setLocalOriginOwner(owner, origins) { if (origins.length) this.localOriginOwners.set(owner, new Set(origins.map(origin => new URL(origin).origin))); else this.localOriginOwners.delete(owner); }

    /** @param {string | URL} input @param {{trustClass: string, hosts?: string[], expectedOrigin?: string, expectedUrl?: string}} policy */
    assertAllowed(input, policy) {
        let url;
        try { url = input instanceof URL ? input : new URL(input); }
        catch (cause) { throw new JhsError("INVALID_URL", "外部地址无效", { source: "ExternalUrlPolicy", cause }); }
        if (!new Set(["http:", "https:"]).has(url.protocol)) throw new JhsError("INVALID_URL", "仅允许 HTTP/HTTPS 地址", { source: "ExternalUrlPolicy" });
        if (url.username || url.password) throw new JhsError("INVALID_URL", "地址不得包含用户身份信息", { source: "ExternalUrlPolicy" });
        if (policy.expectedUrl && url.href !== new URL(policy.expectedUrl).href) throw new JhsError("INVALID_URL", "地址离开已确认的精确目标", { source: "ExternalUrlPolicy" });
        if (policy.expectedOrigin && url.origin !== new URL(policy.expectedOrigin).origin) throw new JhsError("INVALID_URL", "地址离开已声明的精确 origin", { source: "ExternalUrlPolicy" });
        if (policy.trustClass === "builtin-public") {
            if (url.protocol !== "https:" || !(policy.hosts ?? []).some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
                throw new JhsError("INVALID_URL", "地址不在 Integration manifest 允许范围", { source: "ExternalUrlPolicy" });
            }
        } else if (policy.trustClass === "custom-public") {
            if (url.protocol !== "https:" || isPrivateLiteral(url.hostname)) throw new JhsError("INVALID_URL", "自定义公开来源必须使用公网 HTTPS", { source: "ExternalUrlPolicy" });
        } else if (policy.trustClass === "user-local") {
            const expectedOrigin = policy.expectedOrigin ? new URL(policy.expectedOrigin).origin : url.origin;
            if (!(this.localOrigins.has(expectedOrigin) || [...this.localOriginOwners.values()].some(origins => origins.has(expectedOrigin))) || url.origin !== expectedOrigin) throw new JhsError("INVALID_URL", "本地来源未获得精确 origin 授权", { source: "ExternalUrlPolicy" });
        } else throw new JhsError("INVALID_URL", "未知 URL trust class", { source: "ExternalUrlPolicy" });
        return url;
    }

    /** @param {string | URL} finalUrl @param {{trustClass: string, hosts?: string[], expectedOrigin?: string, expectedUrl?: string}} policy */
    assertFinalUrl(finalUrl, policy) { return this.assertAllowed(finalUrl, policy); }
}
