// @ts-check

import { parseBooleanSetting } from "../../core/feature-helpers.js";

import { l, r } from "../../core/constants.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { readListItem } from "../../core/list-item-reader.js";
import { readOwnedMovieContext, resolveMovieContext as resolveMovieContextCore } from "../../core/movie-context.js";
import { getDetailResourceAdapter } from "../../ui/detail/detail-resource-adapter.js";

/** @typedef {any} JQueryHandle Legacy jQuery runtime handle. */
/** @typedef {{ available: boolean, authState: string, reason: string }} ProviderAvailability */
/** @typedef {{ id: string, name: string, capabilities: string[], isEnabled: () => boolean | Promise<boolean>, getAvailability: (options: { force: boolean }) => Promise<ProviderAvailability>, submit: (resource: string, info?: any, options?: {isActive?: () => boolean}) => Promise<unknown>, openUrl?: () => string, retryPolicy?: { automaticAttempts: number } }} OfflineProvider */
/** @typedef {{ provider: OfflineProvider, availability: ProviderAvailability }} OfflineCandidate */
/** @typedef {{ preventDefault: () => void, stopPropagation: () => void, currentTarget: EventTarget }} JQueryClickEvent */

/** Compatibility wrapper for VM-loaded legacy fixtures; production uses the shared resolver. */
/** @param {Record<string, any>} options */
function resolveOfflineMovieContext(options) {
    if (typeof resolveMovieContextCore === "function") return resolveMovieContextCore(options);
    const explicit = options.explicitContext;
    if (explicit?.carNum) return { context: explicit, source: "explicit" };
    const owned = typeof readOwnedMovieContext === "function" ? readOwnedMovieContext(options.trigger) : null;
    if (owned) return { context: owned, source: "owned-surface" };
    for (const [source, resolver] of [["list-item", options.listResolver], ["native-detail", options.nativeResolver], ["legacy-fallback", options.legacyResolver]]) {
        const value = resolver?.();
        if (value?.carNum) return { context: value, source };
    }
    return { context: null, source: "missing" };
}

class OfflineProviderRegistry {
    constructor() {
        /** @type {Map<string, OfflineProvider>} */ this.providers = new Map;
        /** @type {Map<string, { time: number, value: ProviderAvailability }>} */ this.availabilityCache = new Map;
        /** @type {string[]} */ this.unavailableReasons = [];
        this.positiveTtl = 3e5, this.negativeTtl = 2e4;
    }
    /** @param {OfflineProvider} provider */
    register(provider) {
        if (!provider?.id || !Array.isArray(provider.capabilities) || "function" != typeof provider.submit || "function" != typeof provider.getAvailability) throw new TypeError("Invalid offline provider");
        return this.providers.set(provider.id, provider), provider;
    }
    /** @param {string} resource @param {{ force?: boolean }} [options] */
    async getCandidates(resource, { force = !1 } = {}) {
        const type = /^ed2k:/i.test(resource) ? "ed2k" : /^magnet:/i.test(resource) ? "magnet" : "unknown", candidates = /** @type {OfflineCandidate[]} */ ([]);
        const reasons = /** @type {string[]} */ ([]);
        for (const provider of this.providers.values()) {
            if (!provider.capabilities.includes(type)) { reasons.push(`${provider.name}：不支持 ${type === "unknown" ? "该资源格式" : type.toUpperCase()}`); continue; }
            if (!await provider.isEnabled()) { reasons.push(`${provider.name}：未启用`); continue; }
            const availability = await this.getAvailability(provider, force);
            if ([ "ready", "unknown" ].includes(availability.authState)) candidates.push({ provider, availability });
            else reasons.push(`${provider.name}：${availability.reason || "授权不可用"}`);
        }
        this.unavailableReasons = reasons;
        return candidates;
    }
    getUnavailableReason() {
        const reasons = [...this.unavailableReasons];
        if (!this.providers.has("123")) reasons.unshift("123 云盘：授权桥接插件未加载或已禁用");
        return reasons.join("；") || "离线服务插件未加载或已禁用";
    }
    /** @param {OfflineProvider} provider @param {boolean} [force] */
    async getAvailability(provider, force = !1) {
        const cached = this.availabilityCache.get(provider.id);
        const ttl = cached && [ "ready", "unknown" ].includes(cached.value.authState) ? this.positiveTtl : this.negativeTtl;
        if (!force && cached && Date.now() - cached.time < ttl) return cached.value;
        const value = await provider.getAvailability({ force });
        return this.availabilityCache.set(provider.id, { time: Date.now(), value }), value;
    }
    /** @param {string} id @param {ProviderAvailability} value */
    updateAvailability(id, value) { this.availabilityCache.set(id, { time: Date.now(), value }); }
}

export class UnifiedOfflinePlugin extends BasePlugin {
    constructor() { super(), this.registry = new OfflineProviderRegistry, this.BUTTON_COOLDOWN_MS = 1800; }
    getName() { return "UnifiedOfflinePlugin"; }
    async initCss() { return '<style>.jhs-offline-btn.loading{cursor:wait;opacity:.65}.jhs-offline-native{margin-left:6px;padding:3px 8px}</style>'; }
    async handle() {
        if (!(r || l)) return;
        const scope = await this.getRuntimeService("scope")();
        this.lifecycleScope = scope;
        this.registerProviders(scope), this.bindSubmit(), scope.addCleanup((() => $(document).off(".jhsUnifiedOffline")));
        if (window.isDetailPage) this.injectNativeButtons(), jhsEventBus && scope.addCleanup(jhsEventBus.on("magnet-items-updated", (() => this.injectNativeButtons())));
    }
    /** @param {any} scope */
    registerProviders(scope) {
        const one23 = this.getOptionalDependency("OneTwoThreeOfflinePlugin"), offline = this.getRuntimeService("offline");
        one23 && this.registry.register({ id: "123", name: "123 云盘", capabilities: [ "magnet" ], retryPolicy: { automaticAttempts: 0 }, isEnabled: async () => parseBooleanSetting(this.getRuntimeService("settings").snapshot().enable123Offline ?? true, false), getAvailability: async () => await one23.getStoredToken() ? { available: !0, authState: "ready", reason: "授权已同步" } : { available: !1, authState: "token-missing", reason: "尚未同步 123 授权" }, submit: async (resource, _info, options = {}) => {
            const token = await one23.getStoredToken();
            if (scope?.disposed || options.isActive?.() === false) throw Object.assign(new Error("所属界面已关闭，未提交任务"), { code: "SUBMIT_CANCELLED" });
            if (!parseBooleanSetting(this.getRuntimeService("settings").snapshot().enable123Offline ?? true, false)) throw Object.assign(new Error("123 离线服务已关闭，未提交任务"), { code: "SERVICE_DISABLED" });
            if (!token) throw Object.assign(new Error("尚未同步 123 授权"), { code: "TOKEN_MISSING" });
            return offline.submitWithIntegration("pan123", resource, { token, scope });
        }, openUrl: () => offline.getIntegrationHomeUrl("pan123") });
        this.registry.register({ id: "115", name: "115", capabilities: [ "magnet", "ed2k" ], retryPolicy: { automaticAttempts: 0 }, isEnabled: async () => parseBooleanSetting(this.getRuntimeService("settings").snapshot().enable115Offline ?? false, false), getAvailability: async () => ({ available: !0, authState: "unknown", reason: "提交时确认登录状态" }), submit: (/** @type {string} */ resource) => offline.submitWithIntegration("one115", resource, { scope }), openUrl: () => offline.getIntegrationHomeUrl("one115") });
        (/** @type {any} */ (window)).offlineProviderRegistry = this.registry;
    }
    bindSubmit() {
        $(document).off("click.jhsUnifiedOffline", ".jhs-offline-btn").on("click.jhsUnifiedOffline", ".jhs-offline-btn", (async (/** @type {JQueryClickEvent} */ event) => {
            event.preventDefault(), event.stopPropagation();
            const button = $(event.currentTarget), resource = button.attr("data-resource") || button.attr("data-magnet") || button.closest(".magnet-result,.item,td").find('a[href^="magnet:"],a[href^="ed2k:"]').first().attr("href");
            resource ? await this.submitResource(event, resource, button) : show.error("未找到可提交资源");
        }));
    }
    injectNativeButtons() {
        const adapter = getDetailResourceAdapter(this.getRuntimeService("host"));
        if (!adapter) return;
        adapter.rows().forEach(((/** @type {Element} */ row) => {
            const resource = adapter.getResource(row), target = adapter.getActionTarget(row);
            if (!resource || !target?.length || $(row).closest(".magnet-container,.jhs-review-panel,.movie-detail-container").length) return;
            const owner = `native-${adapter.site}`;
            let button = $(row).find(`.jhs-offline-btn[data-jhs-offline-owner="${owner}"]`).first();
            $(row).find(`.jhs-offline-btn[data-jhs-offline-owner="${owner}"]`).not(button).remove();
            button.length || (button = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-offline-btn jhs-offline-native">离线</button>').attr("data-jhs-offline-owner", owner)),
            button.attr("data-resource", resource), target.append(button);
        }));
    }
    /** @param {unknown} event @param {OfflineCandidate[]} candidates @returns {Promise<OfflineCandidate | null>} */
    async chooseCandidate(event, candidates) {
        if (1 === candidates.length) return candidates[0];
        const mode = await storageManager.getSetting("offlineProviderMode", "ask"), preferred = candidates.find((candidate => candidate.provider.id === mode));
        if (preferred) return preferred;
        return new Promise((resolve => {
            const dialog = this.getRuntimeService("dialog");
            const content = $('<div class="jhs-form-dialog"><p>选择离线服务</p><div class="jhs-toolbar"></div></div>'), toolbar = content.find(".jhs-toolbar");
            candidates.forEach((candidate => toolbar.append($("<button type=\"button\" class=\"jhs-btn jhs-btn--secondary\"></button>").text(`${candidate.provider.name} · ${"ready" === candidate.availability.authState ? "已就绪" : "状态未知"}`).on("click", (() => { resolve(candidate), dialog.close(index); })))));
            const index = dialog.open({ type: 1, title: "选择离线服务", content, area: utils.getDialogArea("sm"), cancel: () => resolve(null), end: () => resolve(null) });
        }));
    }
    /** Resolve the movie identity from the action's owning surface. */
    /** @param {JQueryHandle} button @param {unknown} [explicitContext] */
    getVideoInfo(button, explicitContext = null) {
        const trigger = button?.[0] || button;
        const item = this.getRuntimeService("host")?.locateListItems?.().find((/** @type {Element} */ card) => trigger && card.contains(trigger));
        const result = resolveOfflineMovieContext({
            explicitContext,
            trigger: button,
            listResolver: () => item ? readListItem(item) : null,
            nativeResolver: () => window.isDetailPage ? this.getPageInfo() : null,
            legacyResolver: () => this.getPageInfo?.(),
            logger: (/** @type {string} */ message) => clog.warn(message),
        });
        return result.context;
    }
    /** @param {any} info @param {{root: any, layerIndex: number | null}} closeContext */
    async markDownloadedAndClose(info, closeContext) {
        if (!info?.carNum) return !1;
        try {
            const state = this.getRuntimeService("state");
            await state.patch(info.carNum, { downloaded: !0 }, { type: "offline-mark-downloaded", record: { ...info, names: info.actress || info.names || "" } });
            const verified = await state.getState?.(info.carNum);
            if (verified && verified.stateFlags?.downloaded !== true) throw new Error("状态回读未确认已下载");
        } catch (error) {
            clog.error("离线任务标记已下载失败", error), show.error("离线已提交，但标记已下载失败");
            return !1;
        }
        try {
            const preference = this.getRuntimeService("settings").snapshot().needClosePage ?? "yes";
            if (preference !== "yes" && preference !== true) return !0;
            const closed = await utils.closePage(closeContext);
            if (!closed) throw new Error("未找到可关闭的详情页");
            return !0;
        } catch (error) {
            clog.error("离线任务完成后关闭详情页失败", error), show.error("已标记下载，但无法自动关闭");
            return !1;
        }
    }
    /** @param {unknown} event @param {string} resource @param {JQueryHandle} [button] @param {any} [context] @param {string | null} [retryOf] @param {{ forceAvailabilityRefresh?: boolean, preferredProviderId?: string }} [options] */
    async submitResource(event, resource, button = $(), context = null, retryOf = null, options = {}) {
        if (this.lifecycleScope?.disposed || button.hasClass("loading")) return;
        const original = button.text(), trigger = button[0] || /** @type {any} */ (event)?.currentTarget;
        const initiallyConnected = !!trigger?.isConnected;
        const restoreButton = () => {
            button.removeClass("loading").removeAttr("aria-busy aria-disabled").text(original);
        };
        let submitted = false;
        /** @type {OfflineCandidate | null} */ let selected = null;
        /** @type {any} */ let info = null;
        try {
        button.addClass("loading").attr({ "aria-busy": "true", "aria-disabled": "true" }).text("提交中");
        let candidates = await this.registry.getCandidates(resource, { force: !!options.forceAvailabilityRefresh });
        if (!candidates.length && !options.forceAvailabilityRefresh && !this.lifecycleScope?.disposed && (!initiallyConnected || trigger.isConnected)) candidates = await this.registry.getCandidates(resource, { force: !0 });
        if (!candidates.length) return void show.error(`无法离线：${this.registry.getUnavailableReason?.() || "没有已启用且支持该资源的离线服务，请检查授权与设置"}`);
        if (this.lifecycleScope?.disposed || initiallyConnected && !trigger.isConnected) return;
        selected = candidates.find((candidate => candidate.provider.id === options.preferredProviderId)) || await this.chooseCandidate(event, candidates);
        if (!selected) return;
        if (!await selected.provider.isEnabled()) return void show.error("所选离线服务已关闭，未提交任务");
        if (this.lifecycleScope?.disposed || initiallyConnected && !trigger.isConnected) return;
        info = this.getVideoInfo(button, context);
        const detailRoot = trigger || null;
        if (!info) return void show.error("无法确定影片身份，未执行离线操作");
        const closeContext = { root: detailRoot, layerIndex: utils.getOwningLayerIndex({ root: detailRoot }) };
            button.text("提交中");
            await selected.provider.submit(resource, info, { isActive: () => !this.lifecycleScope?.disposed && (!initiallyConnected || trigger.isConnected) });
            submitted = true;
            this.registry.updateAvailability(selected.provider.id, { available: !0, authState: "ready", reason: "最近提交成功" });
            try {
                await this.getRuntimeService("state").appendOfflineHistory({ providerId: selected.provider.id, providerName: selected.provider.name, resource, resourceType: /^ed2k:/i.test(resource) ? "ed2k" : "magnet", carNum: info?.carNum, status: "submitted", retryOf });
            } catch (error) {
                clog.error("离线任务已创建，但本地记录保存失败", error);
                show.error("任务已创建，但本地记录保存失败，请勿重复提交");
            }
            if (!initiallyConnected || trigger.isConnected) {
                button.text("已提交");
                show.ok(`${selected.provider.name} 离线任务已创建`);
                utils.q(event, "是否将该作品标记为已下载？", (() => { void this.markDownloadedAndClose(info, closeContext); }));
            }
        } catch (error) {
            if (submitted) { clog.error("离线任务已创建，后续界面更新失败", error); return; }
            const errorRecord = /** @type {{ code?: string, message?: string }} */ (error), code = errorRecord?.code || ("TOKEN_EXPIRED" === error ? "TOKEN_EXPIRED" : "SUBMIT_FAILED"), message = errorRecord?.message || String(error);
            if (code === "SUBMIT_CANCELLED") return;
            if (code === "SERVICE_DISABLED") return void show.error(message);
            if (selected) {
                [ "AUTH_REQUIRED", "LOGIN_REQUIRED", "TOKEN_EXPIRED", "TOKEN_MISSING" ].includes(code) && this.registry.updateAvailability(selected.provider.id, { available: !1, authState: "115" === selected.provider.id ? "login-required" : "token-missing", reason: message });
                try { await this.getRuntimeService("state").appendOfflineHistory({ providerId: selected.provider.id, providerName: selected.provider.name, resource, resourceType: /^ed2k:/i.test(resource) ? "ed2k" : "magnet", carNum: info?.carNum, status: "failed", errorCode: code, errorMessage: message, retryOf }); }
                catch (historyError) { clog.error("离线失败记录保存失败", historyError); }
            }
            show.error(`${selected?.provider.name || ""} 离线失败：${message}`);
        } finally { submitted ? setTimeout(restoreButton, this.BUTTON_COOLDOWN_MS) : restoreButton(); }
    }
}
