import { l, normalizeCarNum, r } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { normalizeJavStoreAssetUrl } from "../../integrations/javstore/parser.js";
import { ResourceSettingsService } from "../backup/resource-settings.js";
import { ScreenshotProviderRegistry } from "./screenshot-provider-registry.js";

export class ScreenShotPlugin extends BasePlugin {
    constructor() {
        super(...arguments), this.providerRegistry = new ScreenshotProviderRegistry();
    }
    async initializeProviders() {
        const settings = await new ResourceSettingsService().getScreenshotSettings(), configured = id => settings.providers.find((provider => provider.id === id)) || {};
        this.providerRegistry = new ScreenshotProviderRegistry([
            { id: "javstore", name: "JavStore", priority: 10, getScreenshot: carNum => this.getServiceScreenshot(carNum) },
            { id: "projectjav", name: "ProjectJav", enabled: !1, priority: 20, getScreenshot: async () => null },
            { id: "18av", name: "18AV", enabled: !1, priority: 30, getScreenshot: async () => null }
        ].map((provider => ({ ...provider, ...configured(provider.id), enabled: !["projectjav", "18av"].includes(provider.id) && (configured(provider.id).enabled ?? provider.enabled ?? true), getScreenshot: provider.getScreenshot }))));
        return settings.mode;
    }
    getName() {
        return "ScreenShotPlugin";
    }
    async initCss() {
        return `<style>.jhs-screenshot-message{margin-top:50px;color:var(--jhs-text-muted);cursor:auto}.jhs-screenshot-message--bus{margin-top:30px}</style>`;
    }
    async handle() {
        await this.loadScreenShot();
    }
    async loadScreenShot() {
        if (!isDetailPage) return;
        if ("yes" !== await storageManager.getSetting("enableLoadScreenShot", "yes")) return;
        let e = this.getPageInfo().carNum;
        r && $(".preview-images .tile-item").first().before(' <a class="tile-item screen-container jhs-layout-cd9d5db1"><div class="jhs-layout-9db87399">正在加载缩略图</div></a> '),
        l && $("#sample-waterfall .sample-box:first").after(' <a class="sample-box screen-container jhs-layout-b5c4e4f7"><div class="jhs-layout-3536a853">正在加载缩略图</div></a> ');
        const mode = await this.initializeProviders();
        if ("manual" === mode) return $(".screen-container").text("请选择截图来源"), void this.renderProviderTabs(e);
        try {
            const t = await this.getScreenshotFromInitializedProviders(e);
            t ? (this.addImg("缩略图", t), clog.log("加载缩略图:", t)) : this.showErrorFallback(e, null);
        } catch (t) {
            this.showErrorFallback(e, t);
        }
    }
    renderProviderTabs(carNum) {
        const tabs = $('<div class="jhs-screenshot-providers" role="tablist"></div>');
        this.providerRegistry.providers.forEach((provider => tabs.append($("<button type=\"button\" class=\"jhs-btn jhs-btn--secondary\"></button>").prop("disabled", !provider.enabled).attr("data-provider", provider.id).text(provider.name))));
        $(".screen-container").before(tabs);
        tabs.on("click", "button:not(:disabled)", (async event => {
            const provider = this.providerRegistry.get($(event.currentTarget).data("provider"));
            $(".screen-container").text(`${provider.name} 加载中…`);
            try { const result = await provider.getScreenshot(carNum); result?.url ? this.addImg(`${provider.name} 缩略图`, result.url) : $(".screen-container").text(`${provider.name} 无结果`); } catch (error) { $(".screen-container").text(`${provider.name} 请求失败`); clog.error("截图源请求失败", error); }
        }));
    }
    async getScreenshot(e) {
        e = normalizeCarNum(e);
        if (!e) throw clog.warn("跳过缩略图解析：番号不可用"), new Error("缩略图番号不可用");
        await this.initializeProviders();
        return this.getScreenshotFromInitializedProviders(e);
    }
    async getScreenshotFromInitializedProviders(e) {
        e = normalizeCarNum(e);
        if (!e) throw new Error("缩略图番号不可用");
        let n;
        try {
            n = await this.providerRegistry.first(e);
        } catch (i) {
            throw clog.error("获取缩略图资源失败:", n, i), i;
        }
        if (!n) return null;
        let url = n.url, a = url.indexOf("https://");
        return -1 !== a && (url = url.substring(a)), clog.log(`缩略图获取成功 (${n.source}):`, url), url;
    }
    async getServiceScreenshot(carNum) {
        const scope = await this.getRuntimeService("scope")();
        const images = await this.getRuntimeService("screenshot").resolve({ carNum }, { scope });
        const image = Array.isArray(images) ? images[0] : images;
        return image?.url ? { url: image.url, source: image.providerId || "javstore", detailUrl: null } : null;
    }
    addImg(e, t) {
        const url = normalizeJavStoreAssetUrl(t);
        url && (r && $(".screen-container").html(`<img src="${url}" alt="${e}" loading="lazy" class="jhs-layout-cad980f4">`),
        l && $(".screen-container").html(`<div class="photo-frame"><img src="${url}" title="${e}" alt="${e}" class="jhs-layout-d4a575e8"></div>`),
        $(".screen-container").on("click", (e => {
            e.stopPropagation(), e.preventDefault(), showImageViewer(e.currentTarget);
        })));
    }
    showErrorFallback(e, t) {
        var n;
        clog.error("获取缩略图失败:", null == (n = null == t ? void 0 : t.message) ? void 0 : n.substring(0, 100));
        const a = `jhs-screenshot-message${l ? " jhs-screenshot-message--bus" : ""}`;
        if (!(e = normalizeCarNum(e))) return void $(".screen-container").empty().append($("<div></div>").addClass(a).text("无法获取番号，缩略图未加载"));
        const searchUrl = `https://javstore.net/search?q=${encodeURIComponent(e)}`;
        $(".screen-container").html(`<div class="${a}">获取缩略图失败</div><br/><a href='#' class='retry-link'>点击重试</a> 或 <a class="check-link" href='${searchUrl}' target='_blank'>前往确认</a>`).off("click", ".retry-link").off("click", ".check-link").on("click", ".retry-link", (async t => {
            t.stopPropagation(), t.preventDefault(), $(".screen-container").html(`<div class="${a}">正在重新加载...</div>`);
            try {
                const t = await this.getScreenshot(e);
                this.addImg("缩略图", t);
            } catch (n) {
                this.showErrorFallback(e, n);
            }
        })).on("click", ".check-link", (async t => {
            t.stopPropagation(), t.preventDefault(), window.open(searchUrl, "_blank");
        }));
    }
    /** 将截图状态与结果限制在指定容器内，供自有详情工作区使用。 */
    async loadInto(target, carNum, { isActive = () => !0 } = {}) {
        const host = $(target);
        if (!host.length || "yes" !== await storageManager.getSetting("enableLoadScreenShot", "yes")) return host.empty(), null;
        const mode = await this.initializeProviders(), renderMessage = message => isActive() && host.empty().append($("<div></div>").addClass("jhs-panel-state").text(message));
        if ("manual" === mode) {
            host.empty();
            const tabs = $('<div class="jhs-screenshot-providers" role="tablist" aria-label="截图来源"></div>'), result = $('<div class="jhs-screenshot-result"></div>').text("请选择截图来源");
            this.providerRegistry.providers.forEach((provider => tabs.append($('<button type="button" class="jhs-btn jhs-btn--secondary"></button>').prop("disabled", !provider.enabled).attr("data-provider", provider.id).text(provider.name))));
            host.append(tabs, result), tabs.on("click", "button:not(:disabled)", (async event => {
                const provider = this.providerRegistry.get($(event.currentTarget).data("provider"));
                result.text(`${provider.name} 加载中…`);
                try {
                    const loaded = await provider.getScreenshot(normalizeCarNum(carNum));
                    if (!isActive()) return;
                    loaded?.url ? this.renderInto(result, loaded.url, `${provider.name} 缩略图`) : result.text(`${provider.name} 无结果`);
                } catch (error) {
                    isActive() && result.text(`${provider.name} 请求失败`), clog.error("截图源请求失败", error);
                }
            }));
            return host;
        }
        renderMessage("正在加载缩略图…");
        try {
            const url = await this.getScreenshotFromInitializedProviders(carNum);
            if (!isActive()) return null;
            if (!url) return host.empty(), null;
            return this.renderInto(host, url, "缩略图"), url;
        } catch (error) {
            if (!isActive()) return null;
            host.empty();
            const state = $('<div class="jhs-panel-state"></div>').text("缩略图加载失败 "), retry = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm">重试</button>');
            retry.on("click", (() => void this.loadInto(host, carNum, { isActive }))), host.append(state.append(retry));
            return clog.error("缩略图加载失败", error), null;
        }
    }
    renderInto(target, url, alt) {
        const host = $(target), image = $("<img>").attr({ src: normalizeJavStoreAssetUrl(url), alt, loading: "lazy" }).addClass("jhs-fc2-gallery__image"), button = $('<button type="button" class="jhs-btn jhs-fc2-gallery-item jhs-fc2-screenshot-thumbnail"></button>').attr("aria-label", `查看${alt}大图`).append(image);
        host.empty().append(button).off("click.jhsScreenshot").on("click.jhsScreenshot", ".jhs-fc2-screenshot-thumbnail", (event => {
            event.preventDefault(), event.stopPropagation(), showImageViewer(image[0]);
        }));
    }
}
