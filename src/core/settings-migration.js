// @ts-check

/**
 * 6.5 设置语义归一化（一次性，不 bump 数据版本）。
 *
 * enableScreenSvg 与 enableLoadScreenShot 历史上同时表示"长缩略图"：
 * - enableScreenSvg 控制列表卡片的长缩略图按钮；
 * - enableLoadScreenShot 控制详情截图与 FC2 截图。
 *
 * 6.5 起 enableLoadScreenShot 是唯一总开关，enableScreenSvg 退出产品设置层。
 * 迁移规则（NO 优先）：任一为 "no" 则总开关为 "no"，避免用户关闭过的功能在升级后重新出现。
 *
 * 迁移以旧 key 的存在作为一次性标记：写新 key 与删除旧 key 在同一个
 * lock-scoped atomic update 中完成。迁移后 enableScreenSvg 不再存在于
 * storage，后续 bootstrap 永远不会再次读取它。
 */

/** @param {import("../services/settings-service.js").SettingsService} settings */
export async function normalizeScreenshotSetting(settings) {
    return settings.update((draft) => {
        if (!Object.prototype.hasOwnProperty.call(draft, "enableScreenSvg")) return;
        const legacy = draft.enableScreenSvg;
        const current = draft.enableLoadScreenShot;
        const master = (legacy === "no" || current === "no") ? "no" : (current ?? "yes");
        draft.enableLoadScreenShot = master;
        delete draft.enableScreenSvg;
    });
}
