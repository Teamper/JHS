// @ts-check

import { b, k, m, normalizeCarNum, u, v, y } from "./constants.js";
import { normalizeStateFlags } from "./state-model.js";

const DETAIL_STATE_BUTTONS = {
    blocked: { selector: "#filterBtn", inactive: () => m, active: () => u },
    favorite: { selector: "#favoriteBtn", inactive: () => v, active: () => b },
    downloaded: { selector: "#hasDownBtn", inactive: () => y, active: () => "已标记下载" },
    watched: { selector: "#hasWatchBtn", inactive: () => k, active: () => "已标记观看" }
};

/** @typedef {keyof import("./state-model.js").StateFlags} DetailStateFlag */
/** @typedef {{root: any, closeRoot?: any, layerIndex: number | null, carNum: string | null, getRecord: any, activityType: string, selectors: Partial<Record<DetailStateFlag, string>>}} DetailStateConfig */

/** @returns {Array<[DetailStateFlag, {selector: string, inactive: () => string, active: () => string}]>} */
function stateButtonEntries() {
    return /** @type {any} */ (Object.entries(DETAIL_STATE_BUTTONS));
}

/** 统一详情页四状态按钮、确认、持久化和精确关闭行为。 */
export class DetailStateController {
    /** @param {import("./state-service.js").StateService} stateService @param {{readState?: (carNum: string) => Promise<any>, confirm?: (event: MouseEvent | null, message: string, accept: () => any) => any, closePage?: (options: any) => Promise<any>, reportError?: (message: string) => any, logError?: (...args: any[]) => any, jquery?: (value: any) => any}} [ui] */
    constructor(stateService, ui = {}) {
        this.stateService = stateService;
        this.ui = {
            readState: ui.readState ?? ((carNum) => storageManager.getCar(carNum)),
            confirm: ui.confirm ?? ((event, message, accept) => utils.q(event, message, accept)),
            closePage: ui.closePage ?? ((options) => utils.closePage(options)),
            reportError: ui.reportError ?? ((message) => show.error(message)),
            logError: ui.logError ?? ((...args) => clog.error(...args)),
            jquery: ui.jquery ?? ((value) => $(value)),
        };
    }
    /** @param {{root?: any, closeRoot?: any, layerIndex?: number | null, carNum: unknown, getRecord?: any, activityType?: string, selectors?: Partial<Record<DetailStateFlag, string>>}} options */
    bind({ root = document, closeRoot = root, layerIndex = null, carNum, getRecord = null, activityType = "detail-state", selectors = {} }) {
        const $ = this.ui.jquery;
        const config = { root, closeRoot, layerIndex, carNum: normalizeCarNum(carNum), getRecord, activityType, selectors };
        for (const [flag, definition] of stateButtonEntries()) {
            const selector = selectors[flag] || definition.selector;
            $(root).find(selector).off("click.jhsDetailState").on("click.jhsDetailState", ((/** @type {MouseEvent} */ event) => {
                event.preventDefault(), event.stopPropagation(), void this.requestToggle(config, flag, event);
            }));
        }
        void this.render(config);
        return config;
    }
    /** @param {DetailStateConfig} config @param {DetailStateFlag} flag @param {MouseEvent | null} [event] */
    async requestToggle(config, flag, event = null) {
        if (!config.carNum) return void this.ui.reportError("番号不可用，无法更新状态");
        const current = await this.ui.readState(config.carNum), flags = normalizeStateFlags(current?.stateFlags);
        if ("blocked" === flag && !flags.blocked) return void this.ui.confirm(event, `是否屏蔽${config.carNum}?`, (() => this.toggle(config, flag, event)));
        return this.toggle(config, flag, event);
    }
    /** @param {DetailStateConfig} config @param {DetailStateFlag} flag @param {MouseEvent | null} [event] */
    async toggle(config, flag, event = null) {
        if (!config.carNum) return void this.ui.reportError("番号不可用，无法更新状态");
        const $ = this.ui.jquery;
        const selector = config.selectors[flag] || DETAIL_STATE_BUTTONS[flag].selector, button = event?.currentTarget ? $(event.currentTarget) : $(config.root).find(selector);
        if (button.prop("disabled")) return;
        button.prop("disabled", !0).attr("aria-busy", "true");
        try {
            const record = "function" == typeof config.getRecord ? await config.getRecord() : config.getRecord || { carNum: config.carNum };
            await this.stateService.toggle(config.carNum, flag, { type: config.activityType, record }), await this.render(config), await this.ui.closePage({ layerIndex: config.layerIndex, root: config.closeRoot || config.root });
        } catch (error) {
            this.ui.logError("详情状态更新失败", error), this.ui.reportError("操作失败");
        } finally {
            button[0]?.isConnected && button.prop("disabled", !1).removeAttr("aria-busy");
        }
    }
    /** @param {{root?: any, carNum: unknown, selectors?: Partial<Record<DetailStateFlag, string>>}} options */
    async render({ root = document, carNum, selectors = {} }) {
        const $ = this.ui.jquery;
        const record = await this.ui.readState(/** @type {string} */ (normalizeCarNum(carNum))), flags = normalizeStateFlags(record?.stateFlags);
        for (const [flag, definition] of stateButtonEntries()) {
            const button = $(root).find(selectors[flag] || definition.selector), active = !!flags[flag];
            button.attr("aria-pressed", String(active)).each((/** @type {number} */ _, /** @type {HTMLElement} */ element) => $(element).find("span").first().text(active ? definition.active() : definition.inactive()));
        }
        return flags;
    }
}
