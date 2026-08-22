const DETAIL_STATE_BUTTONS = {
    blocked: { selector: "#filterBtn", inactive: () => m, active: () => u },
    favorite: { selector: "#favoriteBtn", inactive: () => v, active: () => b },
    downloaded: { selector: "#hasDownBtn", inactive: () => y, active: () => "已标记下载" },
    watched: { selector: "#hasWatchBtn", inactive: () => k, active: () => "已标记观看" }
};

/** 统一详情页四状态按钮、确认、持久化和精确关闭行为。 */
class DetailStateController {
    bind({ root = document, layerIndex = null, carNum, getRecord, activityType = "detail-state", selectors = {} }) {
        const config = { root, layerIndex, carNum: normalizeCarNum(carNum), getRecord, activityType, selectors };
        for (const [flag, definition] of Object.entries(DETAIL_STATE_BUTTONS)) {
            const selector = selectors[flag] || definition.selector;
            $(root).find(selector).off("click.jhsDetailState").on("click.jhsDetailState", (event => {
                event.preventDefault(), event.stopPropagation(), void this.requestToggle(config, flag, event);
            }));
        }
        void this.render(config);
        return config;
    }
    async requestToggle(config, flag, event = null) {
        if (!config.carNum) return void show.error("番号不可用，无法更新状态");
        const current = await storageManager.getCar(config.carNum), flags = normalizeStateFlags(current?.stateFlags);
        if ("blocked" === flag && !flags.blocked) return void utils.q(event, `是否屏蔽${config.carNum}?`, (() => this.toggle(config, flag, event)));
        return this.toggle(config, flag, event);
    }
    async toggle(config, flag, event = null) {
        const selector = config.selectors[flag] || DETAIL_STATE_BUTTONS[flag].selector, button = event?.currentTarget ? $(event.currentTarget) : $(config.root).find(selector);
        if (button.prop("disabled")) return;
        button.prop("disabled", !0).attr("aria-busy", "true");
        try {
            const record = "function" == typeof config.getRecord ? await config.getRecord() : config.getRecord || { carNum: config.carNum };
            await stateService.toggle(config.carNum, flag, { type: config.activityType, record }), await this.render(config), await utils.closePage({ layerIndex: config.layerIndex, root: config.root });
        } catch (error) {
            clog.error("详情状态更新失败", error), show.error("操作失败");
        } finally {
            button[0]?.isConnected && button.prop("disabled", !1).removeAttr("aria-busy");
        }
    }
    async render({ root = document, carNum, selectors = {} }) {
        const record = await storageManager.getCar(normalizeCarNum(carNum)), flags = normalizeStateFlags(record?.stateFlags);
        for (const [flag, definition] of Object.entries(DETAIL_STATE_BUTTONS)) {
            const button = $(root).find(selectors[flag] || definition.selector), active = !!flags[flag];
            button.attr("aria-pressed", String(active)).find("span").first().text(active ? definition.active() : definition.inactive());
        }
        return flags;
    }
}

const detailStateController = new DetailStateController;
