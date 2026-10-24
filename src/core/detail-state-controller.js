// @ts-check

import { b, k, m, normalizeCarNum, u, v, y } from "./constants.js";
import { normalizeStateFlags } from "./state-model.js";
import { assertMovieStateEligible, getMovieStateEligibility } from "./movie-identity.js";

const DETAIL_STATE_BUTTONS = {
    blocked: { selector: "#filterBtn", inactive: () => m, active: () => u },
    favorite: { selector: "#favoriteBtn", inactive: () => v, active: () => b },
    downloaded: { selector: "#hasDownBtn", inactive: () => y, active: () => "已标记下载" },
    watched: { selector: "#hasWatchBtn", inactive: () => k, active: () => "已标记观看" }
};

/** @typedef {keyof import("./state-model.js").StateFlags} DetailStateFlag */
/** @typedef {{root: any, closeRoot?: any, layerIndex: number | null, carNum: string | null, getRecord: any, activityType: string, selectors: Partial<Record<DetailStateFlag, string>>, isActive?: () => boolean, scope?: {disposed: boolean}, reading?: Set<string>}} DetailStateConfig */

/** @returns {Array<[DetailStateFlag, {selector: string, inactive: () => string, active: () => string}]>} */
function stateButtonEntries() {
    return /** @type {any} */ (Object.entries(DETAIL_STATE_BUTTONS));
}

/** Escape confirmation labels without depending on an ambient page document. @param {string} value */
function escapeConfirmationLabel(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

/** 统一详情页四状态按钮、确认、持久化和精确关闭行为。 */
export class DetailStateController {
    /** @param {import("./state-service.js").StateService} stateService @param {{readState?: (carNum: string) => Promise<any>, confirm?: (event: MouseEvent | null, message: string, accept: () => any, options?: {confirmText?: string, cancelText?: string}) => any, closePage?: (options: any) => Promise<any>, reportError?: (message: string) => any, logError?: (...args: any[]) => any, jquery?: (value: any) => any}} [ui] */
    constructor(stateService, ui = {}) {
        this.stateService = stateService;
        this.ui = {
            readState: ui.readState ?? ((carNum) => storageManager.getCar(carNum)),
            confirm: ui.confirm ?? ((event, message, accept, options) => utils.q(event, message, accept, undefined, options)),
            closePage: ui.closePage ?? ((options) => utils.closePage(options)),
            reportError: ui.reportError ?? ((message) => show.error(message)),
            logError: ui.logError ?? ((...args) => clog.error(...args)),
            jquery: ui.jquery ?? ((value) => $(value)),
        };
    }
    /** @param {{root?: any, closeRoot?: any, layerIndex?: number | null, carNum: unknown, getRecord?: any, activityType?: string, selectors?: Partial<Record<DetailStateFlag, string>>, isActive?: () => boolean, scope?: {disposed: boolean}}} options */
    bind({ root = document, closeRoot = root, layerIndex = null, carNum, getRecord = null, activityType = "detail-state", selectors = {}, isActive, scope }) {
        const $ = this.ui.jquery;
        const config = { root, closeRoot, layerIndex, carNum: normalizeCarNum(carNum), getRecord, activityType, selectors, isActive, scope, reading: new Set() };
        for (const [flag, definition] of stateButtonEntries()) {
            const selector = selectors[flag] || definition.selector;
            $(root).find(selector).off("click.jhsDetailState").on("click.jhsDetailState", ((/** @type {MouseEvent} */ event) => {
                event.preventDefault(), event.stopPropagation(), void this.requestToggle(config, flag, event);
            }));
        }
        void this.render(config).catch(error => { if (this.isActive(config)) { this.ui.logError("详情状态读取失败", error); this.ui.reportError("状态读取失败，请重试"); } });
        return config;
    }
    /** @param {{root?: any, isActive?: () => boolean, scope?: {disposed: boolean}}} config */
    isActive(config) {
        const root = config.root?.jquery ? config.root[0] : config.root;
        return !config.scope?.disposed && config.isActive?.() !== false && root?.isConnected !== false;
    }
    /** Re-read source evidence after async work; the URL hint alone cannot enable a state action. @param {{carNum: unknown, getRecord?: any}} config */
    async resolveRecord(config) {
        const hasSource = typeof config.getRecord === "function" || config.getRecord != null;
        const record = typeof config.getRecord === "function" ? await config.getRecord() : config.getRecord;
        return { ...(record ?? {}), carNum: normalizeCarNum(hasSource ? record?.carNum : config.carNum) };
    }
    /** @param {DetailStateConfig} config @param {DetailStateFlag} flag @param {MouseEvent | null} [event] */
    async requestToggle(config, flag, event = null) {
        if (!this.isActive(config) || config.reading?.has(flag)) return;
        config.reading?.add(flag);
        try {
            const record = await this.resolveRecord(config);
            if (!this.isActive(config)) return;
            assertMovieStateEligible(record);
            const current = await this.ui.readState(record.carNum), flags = normalizeStateFlags(current?.stateFlags);
            if (!this.isActive(config)) return;
            if ("blocked" === flag && !flags.blocked) return this.ui.confirm(event, `屏蔽「${escapeConfirmationLabel(record.carNum)}」？`, (() => this.isActive(config) && this.toggle(config, flag, event, record.carNum)), { confirmText: "屏蔽" });
            return await this.toggle(config, flag, event, record.carNum);
        } catch (error) {
            if (this.isActive(config)) { this.ui.logError("详情状态读取失败", error); this.ui.reportError(/** @type {any} */ (error)?.code === "UNRELIABLE_MOVIE_IDENTITY" && error instanceof Error ? error.message : "状态读取失败，请重试"); }
        } finally { config.reading?.delete(flag); }
    }
    /** @param {DetailStateConfig} config @param {DetailStateFlag} flag @param {MouseEvent | null} [event] @param {string | null} [expectedCarNum] */
    async toggle(config, flag, event = null, expectedCarNum = null) {
        if (!this.isActive(config)) return;
        const $ = this.ui.jquery;
        const selector = config.selectors[flag] || DETAIL_STATE_BUTTONS[flag].selector, button = event?.currentTarget ? $(event.currentTarget) : $(config.root).find(selector);
        if (button.prop("disabled") && button.attr("data-jhs-identity-unavailable") !== "true") return;
        button.prop("disabled", !0).attr("aria-busy", "true");
        let committed = false;
        try {
            const record = await this.resolveRecord(config);
            if (!this.isActive(config)) return;
            assertMovieStateEligible(record);
            if (expectedCarNum && record.carNum !== expectedCarNum) throw Object.assign(new Error("影片信息已变化，请重新操作"), {code:"UNRELIABLE_MOVIE_IDENTITY"});
            await this.stateService.toggle(record.carNum, flag, { type: config.activityType, record });
            committed = true;
            if (!this.isActive(config)) return;
            await this.render(config);
            if (this.isActive(config)) await this.ui.closePage({ layerIndex: config.layerIndex, root: config.closeRoot || config.root });
        } catch (error) {
            this.ui.logError(committed ? "详情状态已保存，界面更新失败" : "详情状态更新失败", error);
            if (this.isActive(config)) this.ui.reportError(committed ? "状态已保存，请重新打开详情" : /** @type {any} */ (error)?.code === "UNRELIABLE_MOVIE_IDENTITY" && error instanceof Error ? error.message : "状态更新失败，请重试");
        } finally {
            if (button[0]?.isConnected) {
                button.removeAttr("aria-busy");
                if (this.isActive(config)) await this.render(config).catch(error => this.ui.logError("详情状态读取失败", error));
            }
        }
    }
    /** @param {{root?: any, carNum: unknown, getRecord?: any, selectors?: Partial<Record<DetailStateFlag, string>>, isActive?: () => boolean, scope?: {disposed: boolean}}} options */
    async render({ root = document, carNum, getRecord, selectors = {}, isActive, scope }) {
        const $ = this.ui.jquery;
        const target = await this.resolveRecord({carNum, getRecord}), eligible = getMovieStateEligibility(target).eligible;
        if (!this.isActive({root, isActive, scope})) return normalizeStateFlags(null);
        const record = eligible ? await this.ui.readState(target.carNum) : null, flags = normalizeStateFlags(record?.stateFlags);
        if (!this.isActive({root, isActive, scope})) return flags;
        for (const [flag, definition] of stateButtonEntries()) {
            const button = $(root).find(selectors[flag] || definition.selector), active = !!flags[flag];
            button.prop("disabled", !eligible || button.attr("aria-busy") === "true");
            if (eligible) button.removeAttr("data-jhs-identity-unavailable").removeAttr("title");
            else button.attr("data-jhs-identity-unavailable", "true").attr("title", "影片番号无法确认，暂不能更改状态");
            button.attr("aria-pressed", String(active)).each((/** @type {number} */ _, /** @type {HTMLElement} */ element) => $(element).find("span").first().text(active ? definition.active() : definition.inactive()));
        }
        return flags;
    }
}
