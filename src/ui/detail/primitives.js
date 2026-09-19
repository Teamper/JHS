// @ts-check

/**
 * 详情面板统一组件基元：FC2 与 hosted 详情共用同一套 loading/empty/error/retry 与 section 结构。
 * 数据 adapter 可以不同，视觉与交互组件不允许各写一套。
 */

/** @param {string} message @param {{ retry?: (() => void) | null, tone?: "neutral" | "error", extraClass?: string }} [options] */
export function createPanelState(message, { retry = null, tone = "neutral", extraClass = "" } = {}) {
    const jq = /** @type {any} */ (globalThis).$;
    const state = jq('<div class="jhs-panel-state"></div>').text(message);
    if (extraClass) state.addClass(extraClass);
    if ("error" === tone) state.addClass("is-error");
    if (retry) state.append(" ", jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm">重试</button>').on("click", retry));
    return state;
}

/** @param {string} [message] */
export function createPanelLoading(message = "正在加载…") {
    return createPanelState(message);
}

/** @param {string} [message] */
export function createPanelEmpty(message = "暂无内容") {
    return createPanelState(message);
}

/** @param {string} message @param {(() => void) | null} [retry] */
export function createPanelError(message, retry = null) {
    return createPanelState(message, { retry, tone: "error" });
}

/** 统一的详情分区：header（标题 + 动作区）+ content 插槽。 */
/** @param {string} name @param {string} title @param {{ className?: string }} [options] */
export function createDetailSection(name, title, { className = "jhs-detail-section" } = {}) {
    const jq = /** @type {any} */ (globalThis).$;
    const section = jq(`<section class="${className}" data-jhs-section="${name}"></section>`);
    const header = jq('<header class="jhs-detail-section__header"></header>');
    header.append(jq("<h2></h2>").text(title), jq(`<div class="jhs-detail-section__actions" data-jhs-section-actions="${name}"></div>`));
    section.append(header, jq(`<div class="jhs-detail-section__content" data-jhs-slot="${name}"></div>`));
    return section;
}
