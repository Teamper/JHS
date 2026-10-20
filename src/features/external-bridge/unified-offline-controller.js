// @ts-check

import { PRODUCT_NAMES } from "../../core/product-names.js";
import { JhsError } from "../../core/jhs-error.js";

import { parseBooleanSetting } from "../../core/feature-helpers.js";
import { readListItem } from "../../core/list-item-reader.js";
import { resolveMovieContext } from "../../core/movie-context.js";
import { getDetailResourceAdapter } from "../../ui/detail/detail-resource-adapter.js";
import { OfflineProviderRegistry } from "./offline-provider-registry.js";

/** @typedef {any} JQueryHandle */
/** @typedef {{provider: any, availability: any}} OfflineCandidate */

/** Owns offline providers, detail controls, and submission state inside the External Bridge Feature. */
export class UnifiedOfflineController {
    /** @param {{document?:Document, window?:any, route?:string, site?:string, hostAdapter:any, offline:any, submissionReceipts?:any, dialog:any, state:any, settings:any, styles:any, events:any, pan123Credential:any, ui:any, notifications:any, diagnostics:any, scope:any}} options */
    constructor(options) {
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window;
        this.route = options.route ?? "unknown";
        this.site = options.site ?? options.hostAdapter?.site ?? "unknown";
        this.hostAdapter = options.hostAdapter;
        this.offline = options.offline;
        this.submissionReceipts = options.submissionReceipts;
        this.dialog = options.dialog;
        this.state = options.state;
        this.settings = options.settings;
        this.styles = options.styles;
        this.events = options.events;
        this.pan123Credential = options.pan123Credential;
        this.ui = options.ui;
        this.notifications = options.notifications;
        this.diagnostics = options.diagnostics;
        this.scope = options.scope;
        this.registry = new OfflineProviderRegistry();
        this.BUTTON_COOLDOWN_MS = 1800;
        this.SUBMISSION_RECEIPT_MS = 24 * 60 * 60 * 1000;
        this.started = false;
        this.disposed = false;
        this.managedByFeature = true;
        this._legacyPluginsReady = false;
        this._ownedNativeButtons = new Set();
        this._pendingButtonTimers = new Set();
        this._cleanupReleases = new Set();
        this._inFlightResources = new Set();
        this._submittedResources = new Set();
        this._loginLinks = new Map();
    }

    getName() { return "UnifiedOfflinePlugin"; }
    get lifecycleScope() { return this.scope; }
    set lifecycleScope(value) { this.scope = value; }

    /** Register a cleanup with the Feature scope and retain an early-dispose handle. */
    /** @param {() => void} cleanup */
    ownCleanup(cleanup) {
        const release = this.scope.addCleanup(() => {
            this._cleanupReleases.delete(release);
            cleanup();
        });
        this._cleanupReleases.add(release);
        return release;
    }

    /** Preserve the narrow service reads used by existing history UI and diagnostics. */
    /** @param {string} name */
    getRuntimeService(name) {
        const services = /** @type {Record<string, any>} */ ({ settings: this.settings, state: this.state, offline: this.offline, pan123Credential: this.pan123Credential, dialog: this.dialog, events: this.events, scope: () => this.scope });
        if (!Object.prototype.hasOwnProperty.call(services, name)) throw new Error(`UnifiedOfflinePlugin 未声明运行时依赖 ${name}`);
        return services[name];
    }

    getJQuery() { return this.ui?.jquery; }

    /** @param {string} source @param {unknown} error */
    recordError(source, error) {
        this.diagnostics?.recordError?.({ source, featureId: "external-bridge", message: error instanceof Error ? error.message : String(error) });
    }

    /** Start providers and listeners after the Feature scope has been created. */
    start() {
        this.scope.assertActive();
        if (this.started) return true;
        if (!["javdb", "javbus"].includes(this.site)) return false;
        this.started = true;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
        try {
            const removeStyle = this.styles?.register?.("jhs-external-bridge-offline-feature", this.initCss());
            if (typeof removeStyle === "function") this.ownCleanup(removeStyle);
            this.registerProviders();
            this.bindSubmit();
            if (typeof this.settings?.addEventListener === "function") {
                this.ownCleanup(this.scope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => {
                    if (event.detail?.names?.includes("enable115LoginRedirect") && !parseBooleanSetting(this.getSetting("enable115LoginRedirect", false), false)) this.clear115LoginLinks();
                }));
            }
            this.ownCleanup(() => this.getJQuery()?.(this.document).off("click.jhsUnifiedOffline", ".jhs-offline-btn"));
            if (this.route === "detail") {
                this.ownCleanup(this.events?.on?.("magnet-items-updated", () => {
                    if (this._legacyPluginsReady) this.injectNativeButtons();
                }) ?? (() => {}));
                this.ownCleanup(this.events?.on?.("jhs-features-ready", () => {
                    this._legacyPluginsReady = true;
                    this.injectNativeButtons();
                }) ?? (() => {}));
            }
            return true;
        } catch (error) {
            this.dispose();
            throw error;
        }
    }

    initCss() { return ".jhs-offline-btn.loading{cursor:wait;opacity:.65}.jhs-offline-native{margin-left:6px;padding:3px 8px}"; }

    registerProviders() {
        const credential = this.pan123Credential;
        this.registry.register({
            id: "123", name: PRODUCT_NAMES.pan123, capabilities: ["magnet"], retryPolicy: { automaticAttempts: 0 },
            isEnabled: () => parseBooleanSetting(this.getSetting("enable123Offline", true), false),
            getAvailability: async () => await credential.getStoredToken()
                ? { available: true, authState: "ready", reason: "授权已同步" }
                : { available: false, authState: "token-missing", reason: "尚未同步 123 授权" },
            submit: async (/** @type {string} */ resource, /** @type {any} */ _info, /** @type {{isActive?: () => boolean, onMutationDispatch?: () => void}} */ options = {}) => {
                const token = await credential.getStoredToken();
                if (this.scope.disposed || options.isActive?.() === false) throw Object.assign(new Error("界面已关闭，未提交任务"), { code: "SUBMIT_CANCELLED" });
                if (!parseBooleanSetting(this.getSetting("enable123Offline", true), false)) throw Object.assign(new Error("123 离线服务已关闭，未提交任务"), { code: "SERVICE_DISABLED" });
                if (!token) throw Object.assign(new Error("尚未同步 123 授权"), { code: "TOKEN_MISSING" });
                return this.offline.submitWithIntegration("pan123", resource, { token, scope: this.scope, onMutationDispatch: () => {
                    if (!parseBooleanSetting(this.getSetting("enable123Offline", true), false)) throw new JhsError("ABORTED", "123 离线服务已关闭，未提交任务");
                    options.onMutationDispatch?.();
                } });
            },
            openUrl: () => this.offline.getIntegrationHomeUrl("pan123"),
        });
        this.registry.register({
            id: "115", name: PRODUCT_NAMES.one115, capabilities: ["magnet", "ed2k"], retryPolicy: { automaticAttempts: 0 },
            isEnabled: () => parseBooleanSetting(this.getSetting("enable115Offline", false), false),
            getAvailability: async () => ({ available: true, authState: "unknown", reason: "提交时确认登录状态" }),
            submit: (/** @type {string} */ resource, /** @type {any} */ _info, /** @type {{isActive?: () => boolean, onMutationDispatch?: () => void}} */ options = {}) => {
                if (this.scope.disposed || options.isActive?.() === false) throw Object.assign(new Error("界面已关闭，未提交任务"), { code: "SUBMIT_CANCELLED" });
                if (!parseBooleanSetting(this.getSetting("enable115Offline", false), false)) throw Object.assign(new Error("115 离线服务已关闭，未提交任务"), { code: "SERVICE_DISABLED" });
                return this.offline.submitWithIntegration("one115", resource, { scope: this.scope, onMutationDispatch: () => {
                    if (!parseBooleanSetting(this.getSetting("enable115Offline", false), false)) throw new JhsError("ABORTED", "115 离线服务已关闭，未提交任务");
                    options.onMutationDispatch?.();
                } });
            },
            openUrl: () => this.offline.getIntegrationHomeUrl("one115"),
        });
        this.window.offlineProviderRegistry = this.registry;
    }

    /** @param {string} key @param {unknown} fallback */
    getSetting(key, fallback) {
        const value = this.settings?.snapshot?.()[key];
        return value === undefined ? fallback : value;
    }

    /** Resolve only the built-in 115 login origin. */
    get115LoginUrl() {
        try {
            const url = new URL(this.offline.getIntegrationHomeUrl("one115"));
            return url.protocol === "https:" && !url.username && !url.password ? url.origin : null;
        } catch { return null; }
    }

    /** Remove login guidance owned by this feature. */
    clear115LoginLinks() {
        for (const link of this._loginLinks.values()) link.remove();
        this._loginLinks.clear();
    }

    /** Show a safe login link beside the failed submission control. @param {Element | null | undefined} button @param {string} url */
    show115LoginLink(button, url) {
        if (!button?.isConnected || this.scope.disposed) return;
        const link = this.document.createElement("a");
        link.className = "jhs-btn jhs-btn--ghost jhs-115-login-link";
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `登录 ${PRODUCT_NAMES.one115}`;
        link.title = url;
        button.insertAdjacentElement("afterend", link);
        this._loginLinks.set(button, link);
    }

    bindSubmit() {
        const $ = this.getJQuery();
        if (!$) return;
        $(this.document).off("click.jhsUnifiedOffline", ".jhs-offline-btn").on("click.jhsUnifiedOffline", ".jhs-offline-btn", async (/** @type {any} */ event) => {
            event.preventDefault();
            event.stopPropagation();
            const button = $(event.currentTarget), resource = button.attr("data-resource") || button.attr("data-magnet") || button.closest(".magnet-result,.item,td").find('a[href^="magnet:"],a[href^="ed2k:"]').first().attr("href");
            resource ? await this.submitResource(event, resource, button) : this.notifications.error("未找到可提交资源");
        });
    }

    injectNativeButtons() {
        const $ = this.getJQuery(), adapter = getDetailResourceAdapter(this.hostAdapter, { jquery: $, isDetailPage: this.route === "detail" });
        if (!$ || !adapter || this.scope.disposed) return;
        adapter.rows().forEach((/** @type {Element} */ row) => {
            const resource = adapter.getResource(row), target = adapter.getActionTarget(row);
            if (!resource || !target?.length || $(row).closest(".magnet-container,.jhs-review-panel,.movie-detail-container").length) return;
            const owner = `native-${adapter.site}`;
            let button = $(row).find(`.jhs-offline-btn[data-jhs-offline-owner="${owner}"]`).first();
            $(row).find(`.jhs-offline-btn[data-jhs-offline-owner="${owner}"]`).not(button).remove();
            if (!button.length) {
                button = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-offline-btn jhs-offline-native">离线</button>').attr("data-jhs-offline-owner", owner);
                this._ownedNativeButtons.add(button[0]);
            }
            button.attr("data-resource", resource);
            target.append(button);
        });
    }

    /** @param {unknown} event @param {any[]} candidates @returns {Promise<any|null>} */
    async chooseCandidate(event, candidates) {
        if (candidates.length === 1) return candidates[0];
        if (this.scope.disposed) return null;
        const mode = this.getSetting("offlineProviderMode", "ask"), preferred = candidates.find((candidate) => candidate.provider.id === mode);
        if (preferred) return preferred;
        const $ = this.getJQuery();
        return new Promise((resolve) => {
            const content = $('<div class="jhs-form-dialog"><p>选择离线服务</p><div class="jhs-toolbar"></div></div>'), toolbar = content.find(".jhs-toolbar");
            let settled = false;
            let closed = false;
            /** @type {number|null} */ let index = null;
            let releaseScope = () => {};
            const close = () => { if (!closed && index != null) { closed = true; this.dialog.close(index); } };
            /** @param {any|null} value @param {boolean} [shouldClose] */
            const finish = (value, shouldClose = false) => {
                if (settled) return;
                settled = true;
                if (shouldClose) close();
                const release = releaseScope;
                releaseScope = () => {};
                release();
                resolve(value);
            };
            releaseScope = this.ownCleanup(() => { close(); finish(null); });
            candidates.forEach((candidate) => toolbar.append($('<button type="button" class="jhs-btn jhs-btn--secondary"></button>').text(`${candidate.provider.name} · ${candidate.availability.authState === "ready" ? "已就绪" : "状态未知"}`).on("click", () => finish(candidate, true))));
            index = this.dialog.open({ type: 1, title: "选择离线服务", content, area: this.ui.getDialogArea?.("sm"), cancel: () => { closed = true; finish(null); }, end: () => { closed = true; finish(null); } });
        });
    }

    /** @param {JQueryHandle} button @param {any} [explicitContext] */
    getVideoInfo(button, explicitContext = null) {
        const trigger = button?.[0] || button;
        const item = this.hostAdapter?.locateListItems?.().find((/** @type {Element} */ card) => trigger && card.contains(trigger));
        const result = resolveMovieContext({
            explicitContext, trigger,
            listResolver: () => item ? readListItem(item) : null,
            nativeResolver: () => this.route === "detail" ? this.hostAdapter?.readMovieInfo?.() ?? this.hostAdapter?.readMovieRef?.() : null,
            legacyResolver: () => this.hostAdapter?.readMovieInfo?.() ?? this.hostAdapter?.readMovieRef?.(),
            logger: (message, context) => this.diagnostics?.recordError?.({ source: "offline-movie-context", featureId: "external-bridge", message, context }),
        });
        return result.context;
    }

    /** @param {Element|null} root */
    getOwningLayerIndex(root) {
        let node = root;
        while (node) {
            const match = /^layui-layer(\d+)$/.exec(node.id || "");
            if (match) return Number(match[1]);
            node = node.parentElement;
        }
        return null;
    }

    /** Prefer a hashed resource key while sharing the same Web Lock across same-origin tabs. @param {string} resource */
    async getSubmissionLockName(resource) {
        const crypto = this.window.crypto;
        if (!crypto?.subtle || !this.window.TextEncoder) return `jhs_offline_submit_v1:${resource}`;
        const digest = await crypto.subtle.digest("SHA-256", new this.window.TextEncoder().encode(resource));
        return `jhs_offline_submit_v1:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    }

    /** Keep a cross-tab receipt outside the IndexedDB history write that may fail after cloud success. */
    /** @param {string} resource */
    async getSubmissionReceiptKey(resource) {
        if (!this.submissionReceipts || !this.window.crypto?.subtle || !this.window.TextEncoder) return null;
        return `jhs_offline_receipt_v1:${(await this.getSubmissionLockName(resource)).slice("jhs_offline_submit_v1:".length)}`;
    }

    /** @param {any} provider @returns {Promise<boolean>} */
    confirmRetry(provider) {
        if (this.scope.disposed) return Promise.resolve(false);
        return new Promise((resolve) => {
            const $ = this.getJQuery(), content = $("<div></div>")
                .append($("<div></div>").text(`请先在 ${provider.name} 核实任务。重新提交可能产生重复任务。`));
            if (provider.openUrl) content.append($('<a target="_blank" rel="noopener noreferrer">打开云盘核实</a>').attr("href", provider.openUrl()));
            let settled = false, release = () => {};
            /** @type {number|null} */ let index = null;
            /** @param {boolean} value */
            const finish = (value) => {
                if (settled) return;
                settled = true;
                if (index !== null) this.dialog.close(index);
                release();
                resolve(value);
            };
            release = this.ownCleanup(() => finish(false));
            index = this.dialog.open({
                type: 0, title: "确认重新提交", content: content[0].outerHTML, ui: { initialFocus: ".layui-layer-btn0" },
                skin: "jhs-confirm-actions", scrollbar: false, anim: -1, area: [this.ui.getDialogArea?.("sm")?.[0] || "480px", ""],
                btn: ["取消", "已核实，重新提交"],
                yes: () => finish(false), btn2: () => { finish(true); return false; },
                cancel: () => finish(false), end: () => finish(false),
            });
        });
    }

    /** @param {any} info @param {{root:any,layerIndex:number|null}} closeContext */
    async markDownloadedAndClose(info, closeContext) {
        if (!info?.carNum) return false;
        try {
            await this.state.patch(info.carNum, { downloaded: true }, { type: "offline-mark-downloaded", record: { ...info, names: info.actress || info.names || "" } });
            const verified = await this.state.getState?.(info.carNum);
            if (typeof this.state.getState === "function" && verified?.stateFlags?.downloaded !== true) throw new Error("状态回读未确认已下载");
        } catch (error) {
            this.recordError("offline-mark-downloaded", error);
            this.notifications.error("离线已提交，但标记已下载失败");
            return false;
        }
        try {
            const preference = this.settings.snapshot().needClosePage ?? "yes";
            if (preference !== "yes" && preference !== true) return true;
            const closed = await this.ui.closePage(closeContext);
            if (!closed) throw new Error("未找到可关闭的详情页");
            return true;
        } catch (error) {
            this.recordError("offline-close-page", error);
            this.notifications.error("已标记下载，但无法自动关闭");
            return false;
        }
    }

    /** @param {unknown} event @param {string} resource @param {JQueryHandle|null} [button] @param {any} [context] @param {string|null} [retryOf] @param {{forceAvailabilityRefresh?:boolean,preferredProviderId?:string,previousOutcome?:string}} [options] */
    async submitResource(event, resource, button = null, context = null, retryOf = null, options = {}) {
        const $ = this.getJQuery();
        button = button ?? $();
        const resourceKey = String(resource ?? "").trim();
        if (this.scope.disposed || button.hasClass("loading") || !resourceKey || this._inFlightResources.has(resourceKey) || (!this.submissionReceipts && this._submittedResources.has(resourceKey) && !retryOf)) return;
        this._inFlightResources.add(resourceKey);
        const trigger = button[0] || /** @type {any} */ (event)?.currentTarget;
        this._loginLinks.get(trigger)?.remove();
        this._loginLinks.delete(trigger);
        const initiallyConnected = Boolean(trigger?.isConnected);
        const original = button.text();
        const active = () => !this.scope.disposed && (!initiallyConnected || trigger.isConnected);
        const restoreButton = () => button.removeClass("loading").removeAttr("aria-busy aria-disabled").text(original);
        let submitted = false;
        let submissionOutcome = "";
        let localHistoryFailed = false;
        let receiptKey = null;
        /** @type {string|null} */ let previousReceipt = null;
        /** @type {any|null} */ let selected = null;
        /** @type {any} */ let info = null;
        try {
            button.addClass("loading").attr({ "aria-busy": "true", "aria-disabled": "true" }).text("提交中");
            let candidates = await this.registry.getCandidates(resource, { force: Boolean(options.forceAvailabilityRefresh) });
            if (!candidates.length && !options.forceAvailabilityRefresh && active()) candidates = await this.registry.getCandidates(resource, { force: true });
            if (!active()) return;
            if (!candidates.length) {
                this.notifications.error("离线不可用，请检查授权与设置");
                return;
            }
            selected = options.preferredProviderId
                ? candidates.find((candidate) => candidate.provider.id === options.preferredProviderId)
                : await this.chooseCandidate(event, candidates);
            if (options.preferredProviderId && !selected) {
                this.notifications.info("原服务不可用，请恢复后核实重试");
                return;
            }
            if (!selected) return;
            const enabled = await selected.provider.isEnabled();
            if (!active()) return;
            if (!enabled) {
                this.notifications.error("所选离线服务已关闭，未提交任务");
                return;
            }
            info = this.getVideoInfo(button, context);
            if (!info) {
                this.notifications.error("未识别影片，未提交离线任务");
                return;
            }
            const detailRoot = trigger || null;
            const closeContext = { root: detailRoot, layerIndex: this.ui.getOwningLayerIndex?.({ root: detailRoot }) ?? this.getOwningLayerIndex(detailRoot) };
            /** @type {{raw:string|null, providerId:string}|null} */ let confirmed = null;
            const uncertainRetry = retryOf && options.previousOutcome !== "failed";
            const submitAndRecord = async () => {
                if (!active()) return false;
                if (!await selected.provider.isEnabled()) throw Object.assign(new Error("所选离线服务已关闭，未提交任务"), { code: "SERVICE_DISABLED" });
                if (!active()) return false;
                receiptKey = await this.getSubmissionReceiptKey(resourceKey);
                if (this.submissionReceipts) {
                    try {
                        if (!receiptKey) throw new Error();
                        this.submissionReceipts.prune(this.SUBMISSION_RECEIPT_MS);
                        previousReceipt = this.submissionReceipts.getRaw(receiptKey);
                        const existingReceipt = this.submissionReceipts.read(receiptKey, this.SUBMISSION_RECEIPT_MS);
                        if (confirmed && (previousReceipt !== confirmed.raw || selected.provider.id !== confirmed.providerId)) return "changed";
                        if (!confirmed && (existingReceipt || uncertainRetry)) return { raw: previousReceipt, providerId: existingReceipt?.providerId || selected.provider.id };
                    } catch {
                        throw Object.assign(new Error("无法建立跨标签提交保护，未提交任务"), { code: "SUBMISSION_GUARD_UNAVAILABLE" });
                    }
                }
                if (!receiptKey && uncertainRetry && !confirmed) return { raw: null, providerId: selected.provider.id };
                const attempt = { attemptId: this.window.crypto?.randomUUID?.() || String(Date.now()), providerId: selected.provider.id };
                if (receiptKey) this.submissionReceipts.write(receiptKey, "pending", attempt);
                let dispatched = false, failure;
                try {
                    await selected.provider.submit(resource, info, { isActive: active, onMutationDispatch: () => {
                        if (!active()) throw new JhsError("ABORTED", "界面已关闭，未提交任务");
                        dispatched = true;
                    } });
                    submissionOutcome = "submitted";
                } catch (error) {
                    failure = error;
                    const record = /** @type {any} */ (error);
                    submissionOutcome = record?.code === "TASK_EXISTS" ? "exists"
                        : dispatched && record?.details?.submissionOutcome !== "rejected" && ![401, 403].includes(record?.details?.status) ? "unknown" : "failed";
                }
                submitted = ["submitted", "exists"].includes(submissionOutcome);
                if (submitted) this._submittedResources.add(resourceKey);
                if (receiptKey && submissionOutcome !== "unknown") {
                    try {
                        if (submitted) this.submissionReceipts.write(receiptKey, "submitted", attempt);
                        else this.submissionReceipts.restore(receiptKey, previousReceipt);
                    } catch (error) {
                        this.recordError("offline-submit-receipt", error);
                    }
                }
                if (submitted && active()) this.registry.updateAvailability(selected.provider.id, { available: true, authState: "ready", reason: "最近提交成功" });
                const failureRecord = /** @type {any} */ (failure);
                if (["SUBMIT_CANCELLED", "SERVICE_DISABLED", "ABORTED"].includes(failureRecord?.code) && !dispatched) throw failure;
                try {
                    await this.state.appendOfflineHistory({ id: attempt.attemptId, providerId: selected.provider.id, providerName: selected.provider.name, resource, resourceType: /^ed2k:/i.test(resource) ? "ed2k" : "magnet", carNum: info.carNum, status: submitted ? "submitted" : submissionOutcome === "unknown" ? "pending" : "failed", submissionOutcome, errorCode: failureRecord?.code, retryOf });
                } catch (error) {
                    localHistoryFailed = true;
                    this.recordError(submissionOutcome === "failed" ? "offline-failure-history" : "offline-history-after-submit", error);
                    try {
                        if (active() && submitted) this.notifications.error("任务已创建，但本地记录保存失败，请勿重复提交");
                    } catch (notificationError) {
                        this.recordError("offline-history-notice", notificationError);
                    }
                }
                if (submissionOutcome === "failed") throw failure;
                return true;
            };
            const locks = this.window.navigator?.locks;
            // Acquire the resource lock before appendOfflineHistory takes the shared storage lock.
            const withLock = async () => locks?.request
                ? await locks.request(await this.getSubmissionLockName(resourceKey), { ifAvailable: true }, (/** @type {any} */ lock) => lock ? submitAndRecord() : "busy")
                : await submitAndRecord();
            let result = await withLock();
            if (result && typeof result === "object") {
                const candidate = candidates.find((item) => item.provider.id === result.providerId);
                if (!candidate) { if (active()) this.notifications.info("原服务不可用，请恢复后核实重试"); return; }
                if (!active() || !await this.confirmRetry(candidate.provider) || !active()) return;
                confirmed = result;
                const refreshed = await this.registry.getCandidates(resource, { force: true });
                selected = refreshed.find((item) => item.provider.id === candidate.provider.id);
                if (!selected || !active()) return;
                result = await withLock();
            }
            if (!active()) return;
            if (result === "busy") {
                this.notifications.info("该资源正在其他标签页提交，请勿重复操作");
                return;
            }
            if (result === "changed") {
                this.notifications.info("其他操作已更新提交状态，请重新核实");
                return;
            }
            if (submissionOutcome === "unknown") {
                this.notifications.info("提交结果待确认，请检查云盘；再次点击可核实重试");
                return;
            }
            if (!result) return;
            if (active()) {
                button.text("已提交");
                if (!localHistoryFailed) this.notifications.ok(submissionOutcome === "exists" ? "云端任务已存在" : `${selected.provider.name} 离线任务已创建`);
                if (submissionOutcome === "exists") return;
                this.ui.confirm({ clientX: /** @type {any} */ (event)?.clientX ?? 0, clientY: /** @type {any} */ (event)?.clientY ?? 0 }, "将此影片标记为已下载？", () => { void this.markDownloadedAndClose(info, closeContext); }, { confirmText: "标记已下载" });
            }
        } catch (error) {
            if (submitted) {
                this.recordError("offline-after-submit", error);
                return;
            }
            const errorRecord = /** @type {{code?:string,message?:string}} */ (error);
            const code = errorRecord?.code || (error === "TOKEN_EXPIRED" ? "TOKEN_EXPIRED" : "SUBMIT_FAILED"), message = errorRecord?.message || String(error);
            const needsAuth = ["AUTH_REQUIRED", "LOGIN_REQUIRED", "TOKEN_EXPIRED", "TOKEN_MISSING"].includes(code);
            if (code === "SUBMIT_CANCELLED" || code === "ABORTED" && submissionOutcome === "failed") return;
            this.diagnostics?.recordError?.({ source: "offline-submit", featureId: "external-bridge", message, error });
            if (code === "SERVICE_DISABLED") { if (active()) this.notifications.error("离线服务已关闭"); return; }
            if (selected && needsAuth) this.registry.updateAvailability(selected.provider.id, { available: false, authState: selected.provider.id === "115" ? "login-required" : "token-missing", reason: "授权已失效，请重新登录" });
            if (!active()) return;
            const loginUrl = selected?.provider.id === "115" && needsAuth
                && parseBooleanSetting(this.getSetting("enable115LoginRedirect", false), false) ? this.get115LoginUrl() : null;
            if (loginUrl) this.show115LoginLink(trigger, loginUrl);
            this.notifications.error(loginUrl ? "离线失败，请登录后重试" : "离线提交失败，请稍后重试");
        } finally {
            this._inFlightResources.delete(resourceKey);
            if (submitted && active()) {
                button.text("已提交");
                let release = () => {};
                const timer = this.window.setTimeout(() => { release(); if (active()) restoreButton(); }, this.BUTTON_COOLDOWN_MS);
                this._pendingButtonTimers.add(timer);
                release = this.ownCleanup(() => { this.window.clearTimeout(timer); this._pendingButtonTimers.delete(timer); });
            } else if (active()) restoreButton();
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const release of [...this._cleanupReleases].reverse()) release();
        this._cleanupReleases.clear();
        for (const timer of this._pendingButtonTimers) this.window.clearTimeout(timer);
        this._pendingButtonTimers.clear();
        for (const button of this._ownedNativeButtons) button.remove?.();
        this._ownedNativeButtons.clear();
        this.clear115LoginLinks();
        if (this.window.offlineProviderRegistry === this.registry) delete this.window.offlineProviderRegistry;
        this.started = false;
    }
}
