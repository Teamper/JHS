// @ts-check
import { m, v, y, k } from "../../core/constants.js";

const actions = Object.freeze({
    blocked: { id: "filterBtn", tone: "filter", label: m },
    favorite: { id: "favoriteBtn", tone: "fav", label: v },
    downloaded: { id: "hasDownBtn", tone: "down", label: y },
    watched: { id: "hasWatchBtn", tone: "watch", label: k },
});

/** 只创建控件；影片状态与点击行为由 DetailStateController 管理。 */
/** @param {{ actions?: (keyof typeof actions)[], ids?: Record<string,string> }} [options] */
export function createStateActions({ actions: subset = ["blocked", "favorite", "downloaded", "watched"], ids = {} } = {}) {
    const jq = /** @type {any} */ (globalThis).$;
    const group = jq('<div class="jhs-state-actions"><div class="jhs-state-actions__buttons" role="group" aria-label="影片状态"></div></div>');
    group.attr("data-jhs-state-count", String(subset.length));
    for (const key of subset) {
        const action = actions[key];
        if (!action) continue;
        const button = jq('<button type="button" class="jhs-btn jhs-state-action" aria-pressed="false"><span></span></button>');
        button.attr("id", ids[key] || action.id).addClass(`jhs-btn--${action.tone}`).find("span").text(action.label);
        group.children().append(button);
    }
    return group;
}
