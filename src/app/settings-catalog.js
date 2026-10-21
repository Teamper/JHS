// @ts-check

/**
 * Canonical settings definition source for JHS 6.5.
 *
 * Every UI-visible setting is registered here once; the full settings dialog,
 * the quick settings panel and any future surface read the same descriptor and
 * write through the same SettingsService key. Feature toggles are "live":
 * changes apply immediately through the feature owner's mount/unmount/reconfigure.
 */
import { PRODUCT_NAMES } from "../core/product-names.js";
import { DEFAULT_QUICK_FILTER_OPTIONS } from "../features/list/list-filters.js";
import { parseBooleanSetting } from "../core/feature-helpers.js";
import { AUTO_BACKUP_DEFAULTS } from "../core/auto-backup-policy.js";

/** @param {import("./settings-registry.js").SettingsRegistry} registry */
export function registerDefaultSettings(registry) {
    const backupLabels = ["自动备份", "按更新条数", "按分钟间隔", "累计更新条数", "间隔分钟", "自动备份保留份数"];
    Object.entries(AUTO_BACKUP_DEFAULTS).forEach(([key, defaultValue], index) => registry.register({
        key, defaultValue, label: backupLabels[index], owner: "AutoBackupFeature", section: "backup", effect: "manual", surfaces: ["full"],
        type: typeof defaultValue === "number" ? "number" : "boolean", min: 1, max: 1e6, step: 1,
    }));
    const boolean = { type: "boolean", effect: "live" };
    const yes = "yes", no = "no";
    /** @type {Record<string, string>} */
    const sections = {
        enableVerticalModel: "appearance", hoverBigImg: "appearance",
        enableScreenSvg: "media", enableLoadScreenShot: "media", enablePreviewVideo: "media", enableLoadPreviewVideo: "media",
        enableVideoSvg: "card-buttons", enableHandleSvg: "card-buttons", enableSiteSvg: "card-buttons", enableCopySvg: "card-buttons",
        autoPage: "list", translateTitle: "list", enableLoadReview: "detail", enableLoadActressInfo: "detail",
        enableLoadOtherSite: "resources", enableMagnetsFilter: "filter",
    };
    /** @param {string} key @param {string} owner @param {string} label @param {Record<string, any>} [extra] */
    const toggle = (key, owner, label, extra = {}) => registry.register({ key, owner, label, section: sections[key], ...boolean, defaultValue: extra.defaultValue ?? yes, ...extra });
    /** @param {unknown} value @param {number} fallback @param {number} min @param {number} max */
    const normalizeInteger = (value, fallback, min, max) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(max, Math.max(min, Math.round(parsed)));
    };

    // ---- Screenshot（列表按钮与详情自动加载独立开关） ----
    toggle("enableScreenSvg", "ScreenshotFeature", "列表长缩略图", {
        description: "在列表卡片显示长缩略图入口",
        surfaces: ["full"], defaultValue: yes,
    });
    toggle("enableLoadScreenShot", "ScreenshotFeature", "详情页长缩略图", {
        description: `在详情页与 ${PRODUCT_NAMES.fc2} 页面加载长缩略图`,
        surfaces: ["full", "quick"],
    });

    // ---- Preview（总开关 + DMM 增强子开关） ----
    toggle("enablePreviewVideo", "PreviewVideoFeature", "预览视频", {
        description: "在列表与详情页显示预览视频",
        surfaces: ["full", "quick"],
    });
    toggle("enableLoadPreviewVideo", "PreviewVideoFeature", `${PRODUCT_NAMES.dmm} 高画质预览`, {
        description: `优先使用 ${PRODUCT_NAMES.dmm} 高画质预览，关闭后使用站点预览`,
        surfaces: ["full", "quick"],
        indent: true,
    });

    // ---- 卡片按钮 ----
    toggle("enableVideoSvg", "CoverButtonFeature", "播放", { description: "", surfaces: ["full"] });
    toggle("enableHandleSvg", "CoverButtonFeature", "鉴定", { description: "", surfaces: ["full"] });
    toggle("enableSiteSvg", "CoverButtonFeature", "第三方站点", { description: "", surfaces: ["full"] });
    toggle("enableCopySvg", "CoverButtonFeature", "复制", { description: "", surfaces: ["full"] });

    // ---- 列表 ----
    toggle("autoPage", "AutoPageFeature", "瀑布流", {
        description: "滚动到底加载下一页，开启后仅支持默认排序",
        surfaces: ["full", "quick"],
    });
    toggle("translateTitle", "TranslateFeature", "标题翻译", {
        description: "翻译列表与详情页标题",
        surfaces: ["full", "quick"],
    });
    toggle("hoverBigImg", "ListImageFeature", "悬浮大图", {
        description: "悬停封面时显示大图",
        surfaces: ["full", "quick"],
        defaultValue: no,
    });
    registry.register({
        key: "defaultQuickFilterTab", owner: "ListPageFeature", label: "默认筛选",
        description: "下次进入列表时生效",
        type: "select", defaultValue: "waitCheck", effect: "nextNavigation", surfaces: ["full"],
        options: DEFAULT_QUICK_FILTER_OPTIONS,
    });

    // ---- 详情 ----
    toggle("enableLoadReview", "ReviewFeature", "评论", {
        description: `在详情页与 ${PRODUCT_NAMES.fc2} 页面显示评论`,
        surfaces: ["full", "quick"],
    });
    toggle("enableLoadOtherSite", "OtherSiteFeature", "第三方站点", {
        description: "在详情页显示第三方站点入口",
        surfaces: ["full", "quick"],
    });
    toggle("enableLoadActressInfo", "ActressInfoFeature", "演员信息", {
        description: "在详情页与演员页显示资料",
        surfaces: ["full", "quick"],
    });
    toggle("enableMagnetsFilter", "MagnetFeature", "磁力质量过滤", {
        description: "隐藏低质量磁力",
        surfaces: ["full"],
    });

    // ---- 界面/布局 ----
    toggle("needClosePage", "WorkflowFeature", "鉴定后关闭详情页", {
        description: "鉴定完成后自动关闭",
        surfaces: ["full", "quick"],
    });
    toggle("enableVerticalModel", "LayoutFeature", "竖图模式", {
        description: "使用竖图比例显示封面",
        surfaces: ["full", "quick"],
        defaultValue: no,
    });
    registry.register({ key: "mobileMode", owner: "LayoutFeature", label: "移动模式", type: "select", defaultValue: "auto", effect: "live", surfaces: ["full"], options: Object.freeze([{ value: "auto", label: "自动检测" }, { value: "on", label: "强制开启" }, { value: "off", label: "强制关闭" }]) });
    registry.register({ key: "themeMode", owner: "ThemeFeature", label: "主题", type: "select", defaultValue: "light", effect: "live", surfaces: ["full"], options: Object.freeze([{ value: "light", label: "浅色" }, { value: "dark", label: "深色" }, { value: "auto", label: "跟随系统" }]) });
    registry.register({ key: "containerColumns", owner: "LayoutFeature", label: "列表列数", type: "number", defaultValue: 5, effect: "live", surfaces: ["full"] });
    registry.register({ key: "containerWidth", owner: "LayoutFeature", label: "列表宽度", type: "number", defaultValue: 100, effect: "live", surfaces: ["full"] });

    // ---- 资源/高级（完整设置面板自行管理交互，仅注册 descriptor） ----
    registry.register({ key: "screenshotMode", owner: "ScreenshotFeature", label: "截图来源模式", type: "select", defaultValue: "auto", effect: "manual", surfaces: ["full"], options: Object.freeze([{ value: "auto", label: "自动选择" }, { value: "manual", label: "手动选择" }]) });
    registry.register({ key: "screenshotProviders", owner: "ScreenshotFeature", label: "截图来源", type: "json", defaultValue: [], effect: "manual", surfaces: ["full"] });
    registry.register({ key: "enableClog", owner: "CoreFeature", label: "日志", type: "select", defaultValue: yes, effect: "live", surfaces: ["full"], options: Object.freeze([{ value: yes, label: "开启" }, { value: no, label: "关闭" }]) });
    registry.register({ key: "videoMuted", owner: "PreviewVideoFeature", label: "视频默认静音", type: "boolean", defaultValue: true, effect: "live", surfaces: [] });

    // ---- 云盘服务（与完整设置的云盘面板共用 Catalog / Binding） ----
    toggle("enable123Offline", "OfflineFeature", `${PRODUCT_NAMES.pan123}离线`, {
        description: `支持磁力，需先在 ${PRODUCT_NAMES.pan123}页面同步授权`,
        surfaces: ["full"], section: "cloud", defaultValue: true, normalize: (/** @type {unknown} */ value) => parseBooleanSetting(value, false),
    });
    toggle("enable115Offline", "OfflineFeature", `${PRODUCT_NAMES.one115} 离线下载`, {
        description: "支持磁力与 ED2K",
        surfaces: ["full"], section: "cloud", defaultValue: false, normalize: (/** @type {unknown} */ value) => parseBooleanSetting(value, false),
    });
    registry.register({
        key: "offlineProviderMode", owner: "OfflineFeature", label: "默认服务", description: "选择优先使用的离线服务",
        type: "select", defaultValue: "ask", effect: "live", surfaces: ["full"], section: "cloud",
        options: Object.freeze([{ value: "ask", label: "每次询问" }, { value: "123", label: "优先 123" }, { value: "115", label: "优先 115" }]),
        normalize: (/** @type {unknown} */ value) => ["ask", "123", "115"].includes(String(value)) ? String(value) : "ask",
    });
    toggle("enable115Match", "OfflineFeature", `${PRODUCT_NAMES.one115} 文件匹配`, {
        description: "按番号查找云盘中的影片",
        surfaces: ["full"], section: "cloud", defaultValue: false, normalize: (/** @type {unknown} */ value) => parseBooleanSetting(value, false),
    });
    toggle("enable115LoginRedirect", "OfflineFeature", "未登录时显示入口", {
        description: `提交失败时显示 ${PRODUCT_NAMES.one115} 登录入口`,
        surfaces: ["full"], section: "cloud", defaultValue: false, normalize: (/** @type {unknown} */ value) => parseBooleanSetting(value, false),
    });
    registry.register({
        key: "oneOneFiveConcurrency", owner: "OfflineFeature", label: "匹配并发数", description: "范围 1–10，立即生效",
        type: "number", defaultValue: 4, effect: "live", surfaces: ["full"], section: "cloud",
        min: 1, max: 10, step: 1, normalize: (/** @type {unknown} */ value) => normalizeInteger(value, 4, 1, 10),
    });
    registry.register({
        key: "oneOneFiveCacheMinutes", owner: "OfflineFeature", label: "匹配缓存（分钟）", description: "范围 1–1440 分钟，立即生效",
        type: "number", defaultValue: 60, effect: "live", surfaces: ["full"], section: "cloud",
        min: 1, max: 1440, step: 1, normalize: (/** @type {unknown} */ value) => normalizeInteger(value, 60, 1, 1440),
    });
}
