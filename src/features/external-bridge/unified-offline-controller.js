// @ts-check

import { readListItem } from "../../core/list-item-reader.js";
import { getDetailResourceAdapter } from "../../ui/detail/detail-resource-adapter.js";

/** @typedef {any} JQueryHandle */
/** @typedef {{ available: boolean, authState: string, reason: string }} ProviderAvailability */
/** @typedef {{ id: string, name: string, capabilities: string[], isEnabled: () => boolean | Promise<boolean>, getAvailability: (options: { force: boolean }) => Promise<ProviderAvailability>, submit: (resource: string, info?: any) => Promise<unknown>, openUrl?: () => string, retryPolicy?: { automaticAttempts: number } }} OfflineProvider */
/** @typedef {{ provider: OfflineProvider, availability: ProviderAvailability }} OfflineCandidate */

export class OfflineProviderRegistry {
    constructor() {
        /** @type {Map<string, OfflineProvider>} */ this.providers = new Map;
        /** @type {Map<string, { time: number, value: ProviderAvailability }>} */ this.availabilityCache = new Map;
        this.positiveTtl = 3e5;
        this.negativeTtl = 2e4;
    }

    /** @param {OfflineProvider} provider */
    register(provider) {
        if (!provider?.id || !Array.isArray(provider.capabilities) || typeof provider.submit !== "function" || typeof provider.getAvailability !== "function") throw new TypeError("Invalid offline provider");
        this.providers.set(provider.id, provider);
        return provider;
    }

    /** @param {string} resource @param {{ force?: boolean }} [options] */
    async getCandidates(resource, { force = false } = {}) {
        const type = /^ed2k:/i.test(resource) ? "ed2k" : /^magnet:/i.test(resource) ? "magnet" : "unknown";
        /** @type {OfflineCandidate[]} */ const candidates = [];
        for (const provider of this.providers.values()) {
            if (!provider.capabilities.includes(type) || !await provider.isEnabled()) continue;
            const availability = await this.getAvailability(provider, force);
            [ "ready", "unknown" ].includes(availability.authState) && candidates.push({ provider, availability });
        }
        return candidates;
    }

    /** @param {OfflineProvider} provider @param {boolean} [force] */
    async getAvailability(provider, force = false) {
        const cached = this.availabilityCache.get(provider.id), ttl = cached && [ "ready", "unknown" ].includes(cached.value.authState) ? this.positiveTtl : this.negativeTtl;
        if (!force && cached && Date.now() - cached.time < ttl) return cached.value;
        const value = await provider.getAvailability({ force });
        this.availabilityCache.set(provider.id, { time: Date.now(), value });
        return value;
    }

    /** @param {string} id @param {ProviderAvailability} value */
    updateAvailability(id, value) { this.availabilityCache.set(id, { time: Date.now(), value }); }
}

/** Own unified offline providers, resource actions, and submission state. */
export class UnifiedOfflineController {
    /** @param {{document?: Document, window?: any, route?: string, hostAdapter: any, offline: any, dialog: any, state: any, settings: any, styles?: any, eventBus?: any, oneTwoThreeController?: any, scope: any}} options */
    constructor(options) {
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window;
        this.route = options.route ?? "unknown";
        this.hostAdapter = options.hostAdapter;
        this.offline = options.offline;
        this.dialog = options.dialog;
        this.state = options.state;
        this.settings = options.settings;
        this.styles = options.styles;
        this.eventBus = options.eventBus;
        this.oneTwoThreeController = options.oneTwoThreeController ?? null;
        this.scope = options.scope;
        this.registry = new OfflineProviderRegistry;
        this.BUTTON_COOLDOWN_MS = 1800;
        this.styleRelease = null;
        this.unsubscribeMagnetUpdates = null;
        this.started = false;
        this.disposed = false;
    }

    getJQuery() { return /** @type {any} */ (globalThis).$ ?? this.window?.jQuery; }
    getShow() { return /** @type {any} */ (globalThis).show ?? {}; }
    getClog() { return /** @type {any} */ (globalThis).clog ?? {}; }
    getUtils() { return /** @type {any} */ (globalThis).utils ?? {}; }

    /** @param {string} key @param {unknown} fallback */
    getSetting(key, fallback) {
        const value = this.settings?.snapshot?.()[key];
        return value === undefined ? fallback : value;
    }

    /** Start unified offline providers on a supported host. */
    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
        return Promise.resolve().then(() => {
            const removeStyle = this.styles?.register?.("external-bridge-offline", this.initCss());
            if (typeof removeStyle === "function") this.styleRelease = this.scope.addCleanup(removeStyle);
            this.registerProviders();
            this.bindSubmit();
            if (this.route === "detail") {
                this.injectNativeButtons();
                if (this.eventBus?.on) this.unsubscribeMagnetUpdates = this.eventBus.on("magnet-items-updated", () => this.injectNativeButtons());
            }
        }).catch((error) => {
            this.dispose();
            throw error;
        });
    }

    initCss() { return ".jhs-offline-btn.loading{cursor:wait;opacity:.65}.jhs-offline-native{margin-left:6px;padding:3px 8px}"; }

    registerProviders() {
        const one23 = this.oneTwoThreeController;
        if (one23) this.registry.register({
            id: "123", name: "123 云盘", capabilities: [ "magnet" ], retryPolicy: { automaticAttempts: 0 },
            isEnabled: () => Boolean(this.getSetting("enable123Offline", true)),
            getAvailability: async () => await one23.getStoredToken() ? { available: true, authState: "ready", reason: "授权已同步" } : { available: false, authState: "token-missing", reason: "尚未同步 123 授权" },
            submit: async (/** @type {string} */ resource) => {
                const token = await one23.getStoredToken();
                if (!token) throw Object.assign(new Error("尚未同步 123 授权"), { code: "TOKEN_MISSING" });
                return this.offline.submitWithIntegration("pan123", resource, { token, scope: this.scope });
            },
            openUrl: () => this.offline.getIntegrationHomeUrl("pan123"),
        });
        this.registry.register({
            id: "115", name: "115", capabilities: [ "magnet", "ed2k" ], retryPolicy: { automaticAttempts: 0 },
            isEnabled: () => Boolean(this.getSetting("enable115Offline", false)),
            getAvailability: async () => ({ available: true, authState: "unknown", reason: "提交时确认登录状态" }),
            submit: (/** @type {string} */ resource) => this.offline.submitWithIntegration("one115", resource, { scope: this.scope }),
            openUrl: () => this.offline.getIntegrationHomeUrl("one115"),
        });
        this.window.offlineProviderRegistry = this.registry;
    }

    bindSubmit() {
        const $ = this.getJQuery();
        if (!$) return;
        $(this.document).off("click.jhsUnifiedOffline", ".jhs-offline-btn").on("click.jhsUnifiedOffline", ".jhs-offline-btn", async (/** @type {any} */ event) => {
            event.preventDefault();
            event.stopPropagation();
            const button = $(event.currentTarget), resource = button.attr("data-resource") || button.attr("data-magnet") || button.closest(".magnet-result,.item,td").find('a[href^="magnet:"],a[href^="ed2k:"]').first().attr("href");
            resource ? await this.submitResource(event, resource, button) : this.getShow().error?.("未找到可提交资源");
        });
    }

    injectNativeButtons() {
        const $ = this.getJQuery(), adapter = getDetailResourceAdapter(this.hostAdapter);
        if (!$ || !adapter) return;
        adapter.rows().forEach((/** @type {Element} */ row) => {
            const resource = adapter.getResource(row), target = adapter.getActionTarget(row);
            if (!resource || !target?.length || $(row).closest(".magnet-container,.jhs-review-panel,.movie-detail-container").length) return;
            const owner = `native-${adapter.site}`;
            let button = $(row).find(`.jhs-offline-btn[data-jhs-offline-owner="${owner}"]`).first();
            $(row).find(`.jhs-offline-btn[data-jhs-offline-owner="${owner}"]`).not(button).remove();
            button.length || (button = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-offline-btn jhs-offline-native">离线</button>').attr("data-jhs-offline-owner", owner));
            button.attr("data-resource", resource);
            target.append(button);
        });
    }

    /** @param {unknown} event @param {OfflineCandidate[]} candidates @returns {Promise<OfflineCandidate | null>} */
    async chooseCandidate(event, candidates) {
        if (candidates.length === 1) return candidates[0];
        const mode = this.getSetting("offlineProviderMode", "ask"), preferred = candidates.find((candidate) => candidate.provider.id === mode);
        if (preferred) return preferred;
        const $ = this.getJQuery();
        return new Promise((resolve) => {
            const content = $('<div class="jhs-form-dialog"><p>选择离线服务</p><div class="jhs-toolbar"></div></div>'), toolbar = content.find(".jhs-toolbar");
            /** @type {number | null} */ let index = null;
            candidates.forEach((candidate) => toolbar.append($('<button type="button" class="jhs-btn jhs-btn--secondary"></button>').text(`${candidate.provider.name} · ${candidate.availability.authState === "ready" ? "已就绪" : "状态未知"}`).on("click", () => { this.dialog.close(index); resolve(candidate); })));
            index = this.dialog.open({ type: 1, title: "选择离线服务", content, area: this.getUtils().getDialogArea?.("sm"), cancel: () => resolve(null) });
        });
    }

    /** @param {JQueryHandle} button */
    getVideoInfo(button) {
        if (this.route === "detail") return this.hostAdapter?.readMovieRef?.() ?? {};
        const item = button?.closest?.(".item");
        return item?.length ? readListItem(item) : this.hostAdapter?.readMovieRef?.() ?? {};
    }

    /** @param {any} info @param {{root: any, layerIndex: number | null}} closeContext */
    async markDownloadedAndClose(info, closeContext) {
        if (!info?.carNum) return false;
        try {
            await this.state.patch(info.carNum, { downloaded: true }, { type: "offline-mark-downloaded", record: { ...info, names: info.actress || info.names || "" } });
        } catch (error) {
            this.getClog().error?.("离线任务标记已下载失败", error);
            this.getShow().error?.("离线已提交，但标记已下载失败");
            return false;
        }
        try {
            const closed = await this.getUtils().closePage?.(closeContext);
            if (!closed) throw new Error("未找到可关闭的详情页");
            return true;
        } catch (error) {
            this.getClog().error?.("离线任务完成后关闭详情页失败", error);
            this.getShow().error?.("已标记下载，但无法自动关闭");
            return false;
        }
    }

    /** @param {unknown} event @param {string} resource @param {JQueryHandle} [button] @param {any} [context] @param {string | null} [retryOf] @param {{ forceAvailabilityRefresh?: boolean, preferredProviderId?: string }} [options] */
    async submitResource(event, resource, button = null, context = null, retryOf = null, options = {}) {
        const $ = this.getJQuery();
        button = button ?? $();
        if (button.hasClass("loading")) return;
        const candidates = await this.registry.getCandidates(resource, { force: Boolean(options.forceAvailabilityRefresh) });
        if (!candidates.length) return void this.getShow().error?.("没有已启用且支持该资源的离线服务，请检查授权与设置");
        const selected = candidates.find((candidate) => candidate.provider.id === options.preferredProviderId) || await this.chooseCandidate(event, candidates);
        if (!selected) return;
        const info = context || this.getVideoInfo(button), detailRoot = button[0] || /** @type {any} */ (event)?.currentTarget || null;
        const closeContext = { root: detailRoot, layerIndex: this.getUtils().getOwningLayerIndex?.({ root: detailRoot }) ?? null };
        const original = button.text(), restoreButton = () => {
            if (!button[0]?.isConnected) return;
            button.removeClass("loading").removeAttr("aria-busy aria-disabled").text(original);
        };
        let submitted = false;
        try {
            button.addClass("loading").attr({ "aria-busy": "true", "aria-disabled": "true" }).text("提交中");
            await selected.provider.submit(resource, info);
            this.registry.updateAvailability(selected.provider.id, { available: true, authState: "ready", reason: "最近提交成功" });
            await this.state.appendOfflineHistory({ providerId: selected.provider.id, providerName: selected.provider.name, resource, resourceType: /^ed2k:/i.test(resource) ? "ed2k" : "magnet", carNum: info?.carNum, status: "submitted", retryOf });
            submitted = true;
            button.text("已提交");
            this.getShow().ok?.(`${selected.provider.name} 离线任务已创建`);
            this.getUtils().q?.(event, "是否将该作品标记为已下载？", () => { void this.markDownloadedAndClose(info, closeContext); });
        } catch (error) {
            const errorRecord = /** @type {{ code?: string, message?: string }} */ (error), code = errorRecord?.code || (error === "TOKEN_EXPIRED" ? "TOKEN_EXPIRED" : "SUBMIT_FAILED"), message = errorRecord?.message || String(error);
            [ "AUTH_REQUIRED", "LOGIN_REQUIRED", "TOKEN_EXPIRED", "TOKEN_MISSING" ].includes(code) && this.registry.updateAvailability(selected.provider.id, { available: false, authState: selected.provider.id === "115" ? "login-required" : "token-missing", reason: message });
            restoreButton();
            submitted || await this.state.appendOfflineHistory({ providerId: selected.provider.id, providerName: selected.provider.name, resource, resourceType: /^ed2k:/i.test(resource) ? "ed2k" : "magnet", carNum: info?.carNum, status: "failed", errorCode: code, errorMessage: message, retryOf });
            this.getShow().error?.(`${selected.provider.name} 离线失败：${message}`);
        } finally {
            submitted ? this.window.setTimeout(restoreButton, this.BUTTON_COOLDOWN_MS) : restoreButton();
        }
    }

    dispose() {
        if (this.unsubscribeMagnetUpdates) this.unsubscribeMagnetUpdates(), this.unsubscribeMagnetUpdates = null;
        const $ = this.getJQuery();
        $?.(this.document).off("click.jhsUnifiedOffline", ".jhs-offline-btn").find?.(".jhs-offline-native").remove?.();
        if (this.window.offlineProviderRegistry === this.registry) delete this.window.offlineProviderRegistry;
        this.styleRelease?.();
        this.styleRelease = null;
        this.disposed = true;
        this.started = false;
    }
}
