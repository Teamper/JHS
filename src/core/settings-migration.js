// @ts-check

/**
 * 6.5 设置语义归一化（一次性，不 bump 数据版本）。
 *
 * enableScreenSvg 与 enableLoadScreenShot 历史上同时表示"长缩略图"：
 * - enableScreenSvg 控制列表卡片的长缩略图按钮；
 * - enableLoadScreenShot 控制详情截图与 FC2 截图。
 *
 * 6.5 起两个开关恢复为独立语义：列表卡片按钮与详情/FC2 自动加载互不影响。
 * 两个旧值都存在时原样保留；缺失项只按兼容默认值补齐。旧版本已删除
 * enableScreenSvg 时，按 enableLoadScreenShot 的当前值一次性补回，保持可见行为。
 */

/** @param {import("../services/settings-service.js").SettingsService} settings */
export async function normalizeScreenshotSetting(settings) {
    return settings.update((draft) => {
        if (!Object.prototype.hasOwnProperty.call(draft, "enableLoadScreenShot")) draft.enableLoadScreenShot = "yes";
        if (!Object.prototype.hasOwnProperty.call(draft, "enableScreenSvg")) draft.enableScreenSvg = draft.enableLoadScreenShot ?? "yes";
    });
}
