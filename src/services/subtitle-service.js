// @ts-check
import { LifecycleScope } from "../core/lifecycle-scope.js";
import { parseSubtitleAsset, SUBTITLE_EXTENSIONS } from "../core/subtitle-asset.js";

export class SubtitleService {
    /** @param {import("../app/integration-registry.js").IntegrationRegistry} integrations */
    constructor(integrations) {
        this.integrations = integrations;
        /** @type {Map<string, ReturnType<typeof parseSubtitleAsset>>} */ this.assets = new Map();
        /** @type {Map<string, {scope: LifecycleScope, users: number, promise: Promise<ReturnType<typeof parseSubtitleAsset>>}>} */ this.inflight = new Map();
    }

    /** @param {Record<string, unknown>} movieRef @param {{scope?: LifecycleScope, refreshCache?: boolean, onSource?: (result: {providerId: string, status: string, records: any[], error?: string}) => void}} [options] */
    async searchAll(movieRef, options = {}) {
        const results = await Promise.all(this.integrations.list("subtitle.search").map(async manifest => {
            try {
                const records = (await this.search(manifest.id, movieRef, options)).filter((/** @type {any} */ item) => SUBTITLE_EXTENSIONS.includes(String(item.extension).toLowerCase()));
                options.scope?.assertActive();
                const result = { providerId: manifest.id, status: records.length ? "success" : "empty", records };
                options.onSource?.(result);
                return result;
            } catch (error) {
                options.scope?.assertActive();
                const result = { providerId: manifest.id, status: "error", records: [], error: error instanceof Error ? error.message : String(error) };
                options.onSource?.(result);
                return result;
            }
        }));
        return results;
    }

    /** Preview, save and upload use the same retained bytes. Consumers cancel independently. @param {string} providerId @param {Record<string, any>} subtitle @param {{scope?: LifecycleScope}} [options] */
    async fetchAsset(providerId, subtitle, options = {}) {
        options.scope?.assertActive();
        const key = JSON.stringify([providerId, subtitle.url, subtitle.extension]);
        const cached = this.assets.get(key);
        if (cached) return { ...cached, bytes: cached.bytes.slice(0) };
        let entry = this.inflight.get(key);
        if (!entry) {
            const adapter = this.integrations.getAdapter(providerId);
            if (typeof adapter?.downloadAsset !== "function") throw new TypeError("字幕来源不支持原始资源获取");
            const scope = new LifecycleScope("subtitle-asset");
            entry = { scope, users: 0, promise: Promise.resolve(/** @type {any} */ (null)) };
            entry.promise = Promise.resolve().then(() => adapter.downloadAsset(subtitle, { scope })).then(response => {
                scope.assertActive();
                const asset = parseSubtitleAsset(response.data, { extension: subtitle.extension, headers: response.responseHeaders });
                this.assets.set(key, asset);
                let total = [...this.assets.values()].reduce((sum, item) => sum + item.size, 0);
                while (this.assets.size > 20 || total > 25 * 1024 * 1024) {
                    const oldest = this.assets.keys().next().value;
                    if (oldest === undefined) break;
                    total -= this.assets.get(oldest)?.size || 0;
                    this.assets.delete(oldest);
                }
                return asset;
            }).finally(() => { if (this.inflight.get(key) === entry) this.inflight.delete(key); scope.dispose(); });
            this.inflight.set(key, entry);
        }
        const current = entry;
        current.users++;
        try {
            const asset = await new Promise((resolve, reject) => {
                const onAbort = () => reject(new DOMException("字幕操作已取消", "AbortError"));
                options.scope?.signal.addEventListener("abort", onAbort, { once: true });
                current.promise.then(resolve, reject).finally(() => options.scope?.signal.removeEventListener("abort", onAbort));
                if (options.scope?.signal.aborted) onAbort();
            });
            options.scope?.assertActive();
            return { ...asset, bytes: asset.bytes.slice(0) };
        } finally {
            current.users--;
            if (!current.users) {
                if (this.inflight.get(key) === current) this.inflight.delete(key);
                current.scope.dispose();
            }
        }
    }

    /** @param {string} providerId @param {Record<string, unknown>} movieRef @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope, refreshCache?: boolean}} [options] */
    async search(providerId, movieRef, options = {}) {
        const manifest = this.integrations.list("subtitle.search").find((item) => item.id === providerId);
        if (!manifest) return [];
        const adapter = this.integrations.getAdapter(manifest.id);
        return typeof adapter?.search === "function" ? adapter.search(movieRef, options) : [];
    }

    /** @param {string} providerId @param {Record<string, unknown>} subtitle @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async download(providerId, subtitle, options = {}) {
        const manifest = this.integrations.list("subtitle.download").find((item) => item.id === providerId);
        if (!manifest) throw new TypeError(`Subtitle provider is unavailable: ${providerId}`);
        const adapter = this.integrations.getAdapter(manifest.id);
        if (typeof adapter?.download !== "function") throw new TypeError(`Subtitle download is unavailable: ${providerId}`);
        return adapter.download(subtitle, options);
    }
}
