// @ts-check

/**
 * 6.5 设置语义归一化（幂等，不 bump 数据版本）。
 *
 * enableScreenSvg 与 enableLoadScreenShot 历史上同时表示"长缩略图"：
 * - enableScreenSvg 控制列表卡片的长缩略图按钮；
 * - enableLoadScreenShot 控制详情截图与 FC2 截图。
 *
 * 6.5 起 enableLoadScreenShot 是唯一总开关，enableScreenSvg 退出产品设置层。
 * 迁移规则（NO 优先）：任一为 "no" 则总开关为 "no"，避免用户关闭过的功能在升级后重新出现。
 */

/** @param {import("../services/settings-service.js").SettingsService} settings */
export async function normalizeScreenshotSetting(settings) {
    const snapshot = settings.snapshot();
    const legacy = snapshot.enableScreenSvg;
    const current = snapshot.enableLoadScreenShot;
    if ((legacy === "no" || current === "no") && current !== "no") {
        await settings.set("enableLoadScreenShot", "no");
    }
    // enableScreenSvg 的残留存储值不再被任何运行时代码读取（descriptor surfaces 为空）。
    return settings.snapshot();
}
