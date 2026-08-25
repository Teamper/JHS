// @ts-check

/**
 * Canonical settings definition source for JHS 6.5.
 *
 * Every UI-visible setting is registered here once; the full settings dialog,
 * the quick settings panel and any future surface read the same descriptor and
 * write through the same SettingsService key. Feature toggles are "live":
 * changes apply immediately through the feature owner's mount/unmount/reconfigure.
 */
/** @param {import("./settings-registry.js").SettingsRegistry} registry */
export function registerDefaultSettings(registry) {
    const boolean = { type: "boolean", effect: "live" };
    const yes = "yes", no = "no";
    /** @param {string} key @param {string} owner @param {string} label @param {Record<string, any>} [extra] */
    const toggle = (key, owner, label, extra = {}) => registry.register({ key, owner, label, ...boolean, defaultValue: extra.defaultValue ?? yes, ...extra });

    // ---- Screenshot（长缩略图，唯一总开关） ----
    toggle("enableLoadScreenShot", "ScreenshotFeature", "长缩略图", {
        description: "在详情页图片区加载长缩略图。关闭后列表长缩略图按钮、详情截图与截图来源请求全部停止。",
        surfaces: ["full", "quick"],
    });
    // 6.5 兼容项：旧设置不再参与 UI，仅保留 descriptor 供迁移读取。
    toggle("enableScreenSvg", "ScreenshotFeature", "长缩略图（旧）", { surfaces: [], defaultValue: yes });

    // ---- Preview（总开关 + DMM 增强子开关） ----
    toggle("enablePreviewVideo", "PreviewVideoFeature", "预览视频", {
        description: "预览视频总开关。关闭后 JavDB/JavBus 详情与列表卡片的预览入口、播放器与 DMM 请求全部消失。",
        surfaces: ["full", "quick"],
    });
    toggle("enableLoadPreviewVideo", "PreviewVideoFeature", "DMM 高画质增强", {
        description: "解析更高画质的 DMM 预览视频；关闭后仍可使用宿主原生预览，但不发起 DMM 请求。",
        surfaces: ["full", "quick"],
        indent: true,
    });

    // ---- 卡片按钮 ----
    toggle("enableVideoSvg", "CoverButtonFeature", "卡片播放视频", { description: "在列表卡片上显示播放视频按钮。", surfaces: ["full"] });
    toggle("enableHandleSvg", "CoverButtonFeature", "卡片鉴定处理", { description: "在列表卡片上显示鉴定处理菜单。", surfaces: ["full"] });
    toggle("enableSiteSvg", "CoverButtonFeature", "卡片第三方网站", { description: "在列表卡片上显示第三方网站菜单。", surfaces: ["full"] });
    toggle("enableCopySvg", "CoverButtonFeature", "卡片复制", { description: "在列表卡片上显示复制菜单。", surfaces: ["full"] });

    // ---- 列表 ----
    toggle("autoPage", "AutoPageFeature", "瀑布流", {
        description: "连续加载列表；启用后普通列表只支持默认排序。",
        surfaces: ["full", "quick"],
    });
    toggle("translateTitle", "TranslateFeature", "标题翻译", {
        description: "翻译列表和详情页标题。",
        surfaces: ["full", "quick"],
    });
    toggle("hoverBigImg", "ListImageFeature", "悬浮大图", {
        description: "鼠标悬停封面时显示大图。",
        surfaces: ["full", "quick"],
        defaultValue: no,
    });
    registry.register({
        key: "defaultQuickFilterTab", owner: "ListPageFeature", label: "列表默认筛选",
        description: "进入列表页时默认选中的筛选标签，修改后下次进入列表生效。",
        type: "select", defaultValue: "waitCheck", effect: "nextNavigation", surfaces: ["full"],
        options: Object.freeze([
            { value: "all", label: "全部" }, { value: "waitCheck", label: "待鉴定" }, { value: "favorite", label: "收藏" },
            { value: "hasDown", label: "下载" }, { value: "hasWatch", label: "已看" }, { value: "blockedItems", label: "屏蔽项" },
        ]),
    });

    // ---- 详情 ----
    toggle("enableLoadOtherSite", "OtherSiteFeature", "外部站点", {
        description: "在详情页提供第三方站点入口。",
        surfaces: ["full", "quick"],
    });
    toggle("enableLoadActressInfo", "ActressInfoFeature", "演员信息", {
        description: "在详情页与演员页展示演员资料。",
        surfaces: ["full", "quick"],
    });
    toggle("enableMagnetsFilter", "MagnetFeature", "磁力质量过滤", {
        description: "在资源列表中过滤低质量磁力。",
        surfaces: ["full"],
    });

    // ---- 界面/布局 ----
    toggle("needClosePage", "WorkflowFeature", "鉴定后立即关闭", {
        description: "完成鉴定后关闭当前详情窗口。",
        surfaces: ["full", "quick"],
    });
    toggle("enableVerticalModel", "LayoutFeature", "竖图模式", {
        description: "使用竖图比例的列表卡片布局。",
        surfaces: ["full", "quick"],
        defaultValue: no,
    });
    registry.register({ key: "mobileMode", owner: "LayoutFeature", label: "移动模式", type: "select", defaultValue: "auto", effect: "live", surfaces: ["full"], options: Object.freeze([{ value: "auto", label: "自动" }, { value: "desktop", label: "桌面" }, { value: "mobile", label: "移动" }]) });
    registry.register({ key: "themeMode", owner: "ThemeFeature", label: "主题", type: "select", defaultValue: "light", effect: "live", surfaces: ["full"], options: Object.freeze([{ value: "light", label: "浅色" }, { value: "dark", label: "深色" }]) });
    registry.register({ key: "containerColumns", owner: "LayoutFeature", label: "列表列数", type: "number", defaultValue: 5, effect: "live", surfaces: ["full"] });
    registry.register({ key: "containerWidth", owner: "LayoutFeature", label: "列表宽度", type: "number", defaultValue: 100, effect: "live", surfaces: ["full"] });

    // ---- 资源/高级（完整设置面板自行管理交互，仅注册 descriptor） ----
    registry.register({ key: "screenshotMode", owner: "ScreenshotFeature", label: "截图来源模式", type: "select", defaultValue: "auto", effect: "manual", surfaces: ["full"], options: Object.freeze([{ value: "auto", label: "自动选择" }, { value: "manual", label: "手动选择" }]) });
    registry.register({ key: "screenshotProviders", owner: "ScreenshotFeature", label: "截图来源", type: "json", defaultValue: [], effect: "manual", surfaces: ["full"] });
    registry.register({ key: "enableClog", owner: "CoreFeature", label: "日志", type: "select", defaultValue: yes, effect: "live", surfaces: ["full"], options: Object.freeze([{ value: yes, label: "开启" }, { value: no, label: "关闭" }]) });
    registry.register({ key: "videoMuted", owner: "PreviewVideoFeature", label: "视频默认静音", type: "boolean", defaultValue: true, effect: "live", surfaces: [] });
}
