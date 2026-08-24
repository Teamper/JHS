import { l, r } from "../../core/constants.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { readListItem } from "../../core/list-item-reader.js";
import { stateService } from "../../core/state-service.js";
import { getDetailResourceAdapter } from "../status/detail-workspace.js";

class OfflineProviderRegistry {
    constructor() { this.providers = new Map, this.availabilityCache = new Map, this.positiveTtl = 3e5, this.negativeTtl = 2e4; }
    register(provider) {
        if (!provider?.id || !Array.isArray(provider.capabilities) || "function" != typeof provider.submit || "function" != typeof provider.getAvailability) throw new TypeError("Invalid offline provider");
        return this.providers.set(provider.id, provider), provider;
    }
    async getCandidates(resource, { force = !1 } = {}) {
        const type = /^ed2k:/i.test(resource) ? "ed2k" : /^magnet:/i.test(resource) ? "magnet" : "unknown", candidates = [];
        for (const provider of this.providers.values()) {
            if (!provider.capabilities.includes(type) || !await provider.isEnabled()) continue;
            const availability = await this.getAvailability(provider, force);
            [ "ready", "unknown" ].includes(availability.authState) && candidates.push({ provider, availability });
        }
        return candidates;
    }
    async getAvailability(provider, force = !1) {
        const cached = this.availabilityCache.get(provider.id);
        const ttl = [ "ready", "unknown" ].includes(cached?.value?.authState) ? this.positiveTtl : this.negativeTtl;
        if (!force && cached && Date.now() - cached.time < ttl) return cached.value;
        const value = await provider.getAvailability({ force });
        return this.availabilityCache.set(provider.id, { time: Date.now(), value }), value;
    }
    updateAvailability(id, value) { this.availabilityCache.set(id, { time: Date.now(), value }); }
}

export class UnifiedOfflinePlugin extends BasePlugin {
    constructor() { super(), this.registry = new OfflineProviderRegistry, this.BUTTON_COOLDOWN_MS = 1800; }
    getName() { return "UnifiedOfflinePlugin"; }
    async initCss() { return '<style>.jhs-offline-btn.loading{cursor:wait;opacity:.65}.jhs-offline-native{margin-left:6px;padding:3px 8px}</style>'; }
    async handle() {
        if (!(r || l)) return;
        const scope = await this.getRuntimeService("scope")();
        this.registerProviders(scope), this.bindSubmit(), scope.addCleanup((() => $(document).off(".jhsUnifiedOffline")));
        if (window.isDetailPage) this.injectNativeButtons(), scope.addCleanup(jhsEventBus.on("magnet-items-updated", (() => this.injectNativeButtons())));
    }
    registerProviders(scope) {
        const one23 = this.getDependency("OneTwoThreeOfflinePlugin"), offline = this.getRuntimeService("offline");
        one23 && this.registry.register({ id: "123", name: "123 云盘", capabilities: [ "magnet" ], retryPolicy: { automaticAttempts: 0 }, isEnabled: () => storageManager.getSetting("enable123Offline", !0), getAvailability: async () => one23.getStoredToken() ? { available: !0, authState: "ready", reason: "授权已同步" } : { available: !1, authState: "token-missing", reason: "尚未同步 123 授权" }, submit: async resource => { const token = one23.getStoredToken(); if (!token) throw Object.assign(new Error("尚未同步 123 授权"), { code: "TOKEN_MISSING" }); return offline.submitWithIntegration("pan123", resource, { token, scope }); }, openUrl: () => offline.getIntegrationHomeUrl("pan123") });
        this.registry.register({ id: "115", name: "115", capabilities: [ "magnet", "ed2k" ], retryPolicy: { automaticAttempts: 0 }, isEnabled: () => storageManager.getSetting("enable115Offline", !1), getAvailability: async () => ({ available: !0, authState: "unknown", reason: "提交时确认登录状态" }), submit: resource => offline.submitWithIntegration("one115", resource, { scope }), openUrl: () => offline.getIntegrationHomeUrl("one115") });
        window.offlineProviderRegistry = this.registry;
    }
    bindSubmit() {
        $(document).off("click.jhsUnifiedOffline", ".jhs-offline-btn").on("click.jhsUnifiedOffline", ".jhs-offline-btn", (async event => {
            event.preventDefault(), event.stopPropagation();
            const button = $(event.currentTarget), resource = button.attr("data-resource") || button.attr("data-magnet") || button.closest(".magnet-result,.item,td").find('a[href^="magnet:"],a[href^="ed2k:"]').first().attr("href");
            resource ? await this.submitResource(event, resource, button) : show.error("未找到可提交资源");
        }));
    }
    injectNativeButtons() {
        const adapter = getDetailResourceAdapter();
        if (!adapter) return;
        adapter.rows().forEach((row => {
            const resource = adapter.getResource(row), target = adapter.getActionTarget(row);
            if (!resource || !target?.length || $(row).closest(".magnet-container,.jhs-review-panel,.movie-detail-container").length) return;
            const owner = `native-${adapter.site}`;
            let button = $(row).find(`.jhs-offline-btn[data-jhs-offline-owner="${owner}"]`).first();
            $(row).find(`.jhs-offline-btn[data-jhs-offline-owner="${owner}"]`).not(button).remove();
            button.length || (button = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-offline-btn jhs-offline-native">离线</button>').attr("data-jhs-offline-owner", owner)),
            button.attr("data-resource", resource), target.append(button);
        }));
    }
    async chooseCandidate(event, candidates) {
        if (1 === candidates.length) return candidates[0];
        const mode = await storageManager.getSetting("offlineProviderMode", "ask"), preferred = candidates.find((candidate => candidate.provider.id === mode));
        if (preferred) return preferred;
        return new Promise((resolve => {
            const dialog = this.getRuntimeService("dialog");
            const content = $('<div class="jhs-form-dialog"><p>选择离线服务</p><div class="jhs-toolbar"></div></div>'), toolbar = content.find(".jhs-toolbar");
            candidates.forEach((candidate => toolbar.append($("<button type=\"button\" class=\"jhs-btn jhs-btn--secondary\"></button>").text(`${candidate.provider.name} · ${"ready" === candidate.availability.authState ? "已就绪" : "状态未知"}`).on("click", (() => { dialog.close(index), resolve(candidate); })))));
            const index = dialog.open({ type: 1, title: "选择离线服务", content, area: utils.getDialogArea("sm"), cancel: () => resolve(null) });
        }));
    }
    getVideoInfo(button) {
        if (window.isDetailPage) return this.getPageInfo();
        const item = button?.closest?.(".item");
        return item?.length ? readListItem(item) : this.getPageInfo();
    }
    async submitResource(event, resource, button = $(), context = null, retryOf = null, options = {}) {
        if (button.hasClass("loading")) return;
        const candidates = await this.registry.getCandidates(resource, { force: !!options.forceAvailabilityRefresh });
        if (!candidates.length) return void show.error("没有已启用且支持该资源的离线服务，请检查授权与设置");
        const selected = candidates.find((candidate => candidate.provider.id === options.preferredProviderId)) || await this.chooseCandidate(event, candidates);
        if (!selected) return;
        const info = context || this.getVideoInfo(button), original = button.text(), restoreButton = () => {
            if (!button[0]?.isConnected) return;
            button.removeClass("loading").removeAttr("aria-busy aria-disabled").text(original);
        };
        let submitted = !1;
        try {
            button.addClass("loading").attr({ "aria-busy": "true", "aria-disabled": "true" }).text("提交中"), await selected.provider.submit(resource, info), this.registry.updateAvailability(selected.provider.id, { available: !0, authState: "ready", reason: "最近提交成功" });
            await stateService.appendOfflineHistory({ providerId: selected.provider.id, providerName: selected.provider.name, resource, resourceType: /^ed2k:/i.test(resource) ? "ed2k" : "magnet", carNum: info?.carNum, status: "submitted", retryOf }), submitted = !0,
            button.text("已提交"), show.ok(`${selected.provider.name} 离线任务已创建`), utils.q(event, "是否将该作品标记为已下载？", (async () => { info?.carNum && await stateService.patch(info.carNum, { downloaded: !0 }, { type: "offline-mark-downloaded", record: { ...info, names: info.actress || info.names || "" } }); }));
        } catch (error) {
            const code = error?.code || ("TOKEN_EXPIRED" === error ? "TOKEN_EXPIRED" : "SUBMIT_FAILED");
            [ "AUTH_REQUIRED", "LOGIN_REQUIRED", "TOKEN_EXPIRED", "TOKEN_MISSING" ].includes(code) && this.registry.updateAvailability(selected.provider.id, { available: !1, authState: "115" === selected.provider.id ? "login-required" : "token-missing", reason: error.message || String(error) });
            restoreButton();
            submitted || await stateService.appendOfflineHistory({ providerId: selected.provider.id, providerName: selected.provider.name, resource, resourceType: /^ed2k:/i.test(resource) ? "ed2k" : "magnet", carNum: info?.carNum, status: "failed", errorCode: code, errorMessage: error?.message || String(error), retryOf }), show.error(`${selected.provider.name} 离线失败：${error?.message || error}`);
        } finally { submitted ? setTimeout(restoreButton, this.BUTTON_COOLDOWN_MS) : restoreButton(); }
    }
}
