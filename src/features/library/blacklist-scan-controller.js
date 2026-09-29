// @ts-check

import { shouldSkipStopped } from "../../core/feature-helpers.js";
import { detectSite } from "../../core/site-context.js";

/** Own the scheduled blacklist scan while preserving the established record protocol. */
export class BlacklistScanController {
    /** @param {{state: any, http: any, settings: any, movie: any, scope: any, parsePage: (html: string, item: any, site: string) => Promise<any> | any}} options */
    constructor(options) {
        this.state = options.state;
        this.http = options.http;
        this.settings = options.settings;
        this.movie = options.movie;
        this.scope = options.scope;
        this.parsePage = options.parsePage;
        this.disposed = false;
    }

    /** Filter, fetch, parse and persist eligible actors with bounded concurrency. */
    /** @param {{currentHostname: string, concurrency: number, sleepMs: number, intervalHours: number, ruleHours: number, force: boolean, isUnnecessaryCheck: (date: string, interval: number) => boolean, isNetworkBlocked: (error: unknown) => boolean, sleep: (ms: number) => Promise<unknown>, getTimestamp: () => string, requestConfig: Record<string, any>, onActorStart?: (item: any) => void, onError?: (message: string, item: any, error: unknown) => void, onRemaining?: (remaining: number) => void}} options */
    async scan(options) {
        this.assertActive();
        const items = await this.state.getBlacklist();
        this.assertActive();
        items.sort((/** @type {any} */ left, /** @type {any} */ right) => left.createTime < right.createTime ? 1 : left.createTime > right.createTime ? -1 : 0);
        const result = { success: 0, networkFailed: 0, parseFailed: 0, aborted: 0, skippedInterval: 0, skippedStopped: 0, skippedHost: 0, fatal: false };
        const settings = this.settings.snapshot();
        /** @type {Array<[string, string]>} */
        const origins = [
            [this.movie.externalSiteOrigin("javDbBtn", settings), "javdb"],
            [this.movie.externalSiteOrigin("javBusBtn", settings), "javbus"],
        ];
        /** @type {Array<{item: any, site: string}>} */
        const eligible = [];
        for (const item of items) {
            let itemUrl;
            try { itemUrl = new URL(item.url); }
            catch (error) {
                result.parseFailed++;
                options.onError?.("黑名单地址无效", item, error);
                continue;
            }
            if (options.currentHostname !== itemUrl.hostname) {
                result.skippedHost++;
                continue;
            }
            if (!options.force && item.checkTime && options.isUnnecessaryCheck(item.checkTime, options.intervalHours)) {
                result.skippedInterval++;
                continue;
            }
            if (shouldSkipStopped(item.lastPublishTime, options.ruleHours)) {
                result.skippedStopped++;
                continue;
            }
            const site = resolveBlacklistSite(itemUrl, origins);
            if (!site) {
                result.parseFailed++;
                options.onError?.(`不支持的黑名单来源站点: ${itemUrl.hostname}`, item, null);
                continue;
            }
            eligible.push({ item, site });
        }

        let nextIndex = 0, stopWorkers = false, blockedError = null;
        const workerCount = Math.max(1, Math.min(options.concurrency, eligible.length));
        const workers = Array.from({ length: workerCount }, async () => {
            while (!stopWorkers && !this.disposed) {
                const index = nextIndex++;
                if (index >= eligible.length) return;
                const entry = eligible[index], { item, site } = entry;
                try {
                    await this.scanActor(entry, options);
                    result.success++;
                } catch (error) {
                    if (this.disposed || /** @type {any} */ (error)?.name === "AbortError") throw error;
                    if (options.isNetworkBlocked(error)) {
                        result.networkFailed++;
                        stopWorkers = true;
                        throw error;
                    }
                    const taskError = /** @type {any} */ (error);
                    if (taskError?._taskNetwork) result.networkFailed++;
                    else result.parseFailed++;
                    options.onError?.("解析或保存黑名单演员失败", item, error);
                }
                const remaining = Math.max(0, eligible.length - nextIndex);
                options.onRemaining?.(remaining);
                if (remaining) await options.sleep(options.sleepMs);
            }
            this.assertActive();
        });
        const settled = await Promise.allSettled(workers);
        const failure = settled.find((item) => item.status === "rejected");
        if (failure?.status === "rejected") {
            if (!options.isNetworkBlocked(failure.reason)) throw failure.reason;
            blockedError = failure.reason;
            result.fatal = true;
            result.aborted = Math.max(0, eligible.length - result.success - result.parseFailed - result.networkFailed);
        }
        this.assertActive();
        return { ...result, blockedError };
    }

    /** Fetch and commit one actor page through the existing storage schema. */
    /** @param {{item: any, site: string}} entry @param {any} options */
    async scanActor(entry, options) {
        this.assertActive();
        const { item, site } = entry, target = new URL(item.url);
        options.onActorStart?.(item);
        let response;
        try {
            const builtinHost = site === "javdb" ? "javdb.com" : "javbus.com";
            const isBuiltin = target.hostname === builtinHost || target.hostname.endsWith(`.${builtinHost}`);
            response = await this.http.request({
                providerId: `host-task:${site}`, method: "GET", url: target.href, responseType: "text", cacheScope: "none",
                timeout: options.requestConfig.httpTimeout,
                transport: "native-fetch", nativeTimeout: options.requestConfig.httpTimeout,
                retryCount: Math.max(0, (options.requestConfig.httpRetryCount ?? 1) - 1),
                circuitThreshold: options.requestConfig.circuitBreakerThreshold,
                circuitCooldownMs: options.requestConfig.circuitBreakerCooldown,
                urlPolicy: isBuiltin
                    ? { trustClass: "builtin-public", hosts: [builtinHost], expectedOrigin: target.origin }
                    : { trustClass: "custom-public", expectedOrigin: target.origin },
            }, this.scope);
        } catch (error) {
            const taskError = error instanceof Error ? error : new Error(String(error));
            /** @type {any} */ (taskError)._taskNetwork = true;
            throw taskError;
        }
        this.assertActive();
        if (typeof response.data !== "string") throw new TypeError("宿主页面响应不是 HTML 文本");
        let parsed;
        try { parsed = await this.parsePage(response.data, item, site); }
        catch (cause) {
            const body = response.data.trim();
            const loginRedirect = /^window\.location\.(?:href|replace)\s*(?:=|\()\s*['"]\/login/i.test(body);
            const responseContext = [
                `transport=${response.transportUsed || "unknown"}`,
                `fallback=${response.nativeFallbackCode || "none"}`,
                `status=${Number(response.status) || 0}`,
                `length=${body.length}`,
                `loginRedirect=${loginRedirect}`,
            ].join(", ");
            throw new Error(`${cause instanceof Error ? cause.message : String(cause)} (${responseContext})`, { cause });
        }
        this.assertActive();
        await this.state.batchSaveBlacklistCarList(parsed.records);
        await this.state.updateBlacklistItem({
            starId: item.starId, name: item.name, checkTime: options.getTimestamp(), lastPublishTime: parsed.lastPublishTime,
        });
        this.assertActive();
    }

    dispose() { this.disposed = true; }

    assertActive() {
        if (this.disposed || this.scope?.disposed) throw Object.assign(new Error("Blacklist scan is closed"), { name: "AbortError" });
    }
}

/** Resolve configured aliases first, then the supported native hosts. @param {URL} itemUrl @param {Array<[string, string]>} origins */
function resolveBlacklistSite(itemUrl, origins) {
    for (const [origin, site] of origins) {
        try {
            if (origin && itemUrl.hostname === new URL(origin).hostname) return site;
        } catch { /* Invalid optional host configuration is ignored. */ }
    }
    const site = detectSite(itemUrl.href).site;
    return site === "javdb" || site === "javbus" ? site : null;
}
