// @ts-check
import { ExternalUrlPolicy } from "../../src/services/external-url-policy.js";

const policy = new ExternalUrlPolicy();

/** @param {string | null | undefined} value @param {URL | string} base @param {string} [expectedOrigin] */
export function httpsLink(value, base, expectedOrigin) {
    if (!value?.trim()) return null;
    try {
        const url = new URL(value, base);
        return policy.assertAllowed(url, { trustClass: "custom-public", expectedOrigin }).href;
    } catch { return null; }
}

/** @param {string | null} value */
export function publicMagnet(value) {
    if (!value || /[\s\u0000-\u001f]/u.test(value) || !value.startsWith("magnet:?")) return null;
    const topics = new URLSearchParams(value.slice(8)).getAll("xt");
    return topics.some(topic => /^urn:btih:(?:[a-f\d]{40}|[a-z2-7]{32})$/i.test(topic)) ? value : null;
}
