import { DEFAULT_QUICK_FILTER_OPTIONS } from "../../features/list/list-filters.js";
// @ts-check

import { L, r, escapeHtml } from "../../core/constants.js";
import { PRODUCT_NAMES } from "../../core/product-names.js";
import { buildQuickSettingsHtml } from "../../ui/settings/setting-control-renderer.js";
import { DETAIL_SHORTCUT_ACTIONS } from "../../core/detail-shortcuts.js";

/**
 * Build the plugin categories configuration shared between inject and render.
 * Returns the presentation categories; disableability comes from Feature manifests through Diagnostics.
 */
export function getPluginCategories() {
    /** @type {Record<string, [string, string]>} */
    const pluginMeta = {
        SettingPlugin:["设置中心","core"], StatsPlugin:["统计中心","core"], MobileBottomBarPlugin:["工具栏与移动操作","core"],
        DetailShortcutPlugin:["详情鉴定快捷键","detail"],
        CompatibilityEnhancementsPlugin:["站点兼容增强","core"], Fc2NavigationPlugin:["FC2 详情导航","list"], DetailWorkspacePlugin:["详情工作区","detail"],
        OneOneFiveMatchPlugin:["115 资源匹配","network"], UnifiedOfflinePlugin:["统一离线提交","network"],
        ListPagePlugin:["列表状态处理","list"], NavBarPlugin:[`${PRODUCT_NAMES.javdb} 导航`,"list"], BusNavBarPlugin:[`${PRODUCT_NAMES.javbus} 导航`,"list"], ListPageButtonPlugin:["列表操作","list"], HighlightMagnetPlugin:["磁力标记","list"], FoldCategoryPlugin:["分类折叠","list"], AutoPagePlugin:["自动翻页","list"], HitShowPlugin:["热播榜单","list"], TOP250Plugin:["TOP 250","list"],
        DetailPagePlugin:[`${PRODUCT_NAMES.javdb} 详情页`,"detail"], BusDetailPagePlugin:[`${PRODUCT_NAMES.javbus} 详情页`,"detail"], DetailPageButtonPlugin:["详情操作","detail"], ReviewPlugin:["评论","detail"], RelatedPlugin:["相关影片","detail"], TranslatePlugin:["标题翻译","detail"], WantAndWatchedVideosPlugin:["想看与看过","detail"],
        CoverButtonPlugin:["封面快捷操作","media"], PreviewVideoPlugin:[`${PRODUCT_NAMES.javdb} 预览视频`,"media"], BusPreviewVideoPlugin:[`${PRODUCT_NAMES.javbus} 预览视频`,"media"], ScreenShotPlugin:["剧照","media"], BusImgPlugin:[`${PRODUCT_NAMES.javbus} 图片适配`,"media"], ActressInfoPlugin:["演员资料","media"], SearchByImagePlugin:["以图搜图","media"],
        HistoryPlugin:["鉴定记录","data"], BlacklistPlugin:["黑名单","data"], FilterTitleKeywordPlugin:["关键词筛选","data"], FavoriteActressesPlugin:["演员收藏","data"], NewVideoPlugin:["新作品检测","data"], TaskPlugin:["定时任务","data"],
        OtherSitePlugin:["第三方站点","network"], Fc2Plugin:[`${PRODUCT_NAMES.fc2} 详情`,"network"], Fc2By123AvPlugin:[`${PRODUCT_NAMES.fc2} ${PRODUCT_NAMES.av123}`,"network"], MagnetHubPlugin:["磁力聚合","network"], JavTrailersPlugin:["预告片","network"], SubTitleCatPlugin:["字幕搜索","network"], OneTwoThreeOfflinePlugin:[`${PRODUCT_NAMES.pan123}离线`,"network"]
    };
    const group = (/** @type {string} */ key, /** @type {string} */ label) => ({ label, plugins:Object.entries(pluginMeta).filter((e => e[1][1] === key)).map((e => e[0])) });
    return {
        categories: {
            core:group("core", "基础核心"), list:group("list", "列表页"), detail:group("detail", "详情页"),
            media:group("media", "媒体"), data:group("data", "数据"), network:group("network", "网络")
        },
        pluginMeta
    };
}

/** Ordered settings destinations shared by desktop and compact navigation. */
export const SETTINGS_GROUPS = Object.freeze([
    { id: "appearance-panel", label: "外观与布局" },
    { id: "browse-panel", label: "列表与详情" },
    { id: "filtering-panel", label: "筛选与屏蔽" },
    { id: "tasks-panel", label: "任务与新作品" },
    { id: "resources-panel", label: "资源与站点" },
    { id: "cloud-panel", label: "云盘与离线" },
    { id: "data-panel", label: "备份与数据" },
    { id: "advanced-panel", label: "高级与诊断" },
]);

/** @type {Readonly<Record<string, string>>} */
const LEGACY_PANEL_GROUPS = Object.freeze({
    "base-panel": "appearance-panel", "filter-panel": "filtering-panel", "task-panel": "tasks-panel",
    "domain-panel": "resources-panel", "resource-sources-panel": "resources-panel", "cloud-services-panel": "cloud-panel",
    "backup-panel": "data-panel", "snapshot-panel": "data-panel", "data-tools-panel": "data-panel",
    "network-panel": "advanced-panel", "cache-panel": "advanced-panel", "health-panel": "advanced-panel",
    "plugin-mgmt-panel": "advanced-panel", "more-tools-panel": "advanced-panel",
    "shortcut-panel": "browse-panel", "detail-shortcut-settings": "browse-panel",
});

/** Resolve old entry points without changing their destination section. @param {string} [panel] */
export function resolveSettingPanel(panel = "appearance-panel") {
    if (panel === "shortcut-panel") panel = "detail-shortcut-settings";
    if (SETTINGS_GROUPS.some((group) => group.id === panel)) return { group: panel, section: null };
    return { group: LEGACY_PANEL_GROUPS[panel] || "appearance-panel", section: LEGACY_PANEL_GROUPS[panel] ? panel : null };
}

/** @param {string} id @param {string} label @param {string} control @param {string} [description] @param {string} [effect] */
function row(id, label, control, description = "", effect = "manual", layout = "compact") {
    return `<div class="jhs-setting-row jhs-setting-row--${layout}" data-jhs-setting-effect="${effect}"><span class="jhs-setting-row__copy"><label class="jhs-setting-row__label" for="${id}">${label}</label>${description ? `<span class="jhs-setting-row__description">${description}</span>` : ""}</span><div class="jhs-setting-row__control">${control}</div></div>`;
}
/** @param {string} id @param {string} label @param {string} [description] */
const toggleRow = (id, label, description = "") => row(id, label, `<input type="checkbox" id="${id}" class="jhs-checkbox">`, description);
/** @param {string} id @param {string} label @param {number} min @param {number} max */
const numberRow = (id, label, min, max) => row(id, label, `<input type="number" id="${id}" class="jhs-field" min="${min}" max="${max}">`);
/** @param {string} id @param {string} label @param {Array<Array<string|number>>} choices @param {string} [effect] */
const selectRow = (id, label, choices, effect = "manual") => row(id, label, `<select id="${id}" class="jhs-select-source">${choices.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select>`, "", effect);
/** @param {string} id @param {string} title @param {string} content @param {string} [help] */
const section = (id, title, content, help = "") => `<section id="${id}" class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>${title}</h3>${help ? `<p>${help}</p>` : ""}</header>${content}</section>`;

function autoBackupSettings() {
    const toggle = (/** @type {string} */ id, /** @type {string} */ label, description = "") => row(id, label, `<input type="checkbox" id="${id}" class="mini-switch" role="switch">`, description);
    const number = (/** @type {string} */ id, /** @type {string} */ label) => row(id, label, `<input type="number" id="${id}" class="jhs-field" min="1" max="1000000" step="1">`);
    return section("webdav-auto-backup", "自动循环备份",
        toggle("webDavAutoBackupEnabled", "启用自动备份", "默认关闭；保存时先完成一次上传并确认可列出，成功后启用") +
        '<div id="jhs-auto-backup-options" hidden>' +
        toggle("webDavAutoBackupOnChanges", "按更新条数", "影片、演员等业务记录实际变动后累计；刷新后保留进度") +
        number("webDavAutoBackupChangeCount", "累计更新条数") +
        toggle("webDavAutoBackupOnInterval", "按分钟间隔", "两种条件可同时启用，任一先达到就备份") +
        number("webDavAutoBackupMinutes", "间隔分钟") + number("webDavAutoBackupKeepCount", "保留自动备份份数") + '</div>' +
        '<p id="jhs-auto-backup-status" class="jhs-setting-help" role="status" aria-live="polite"></p><div class="jhs-toolbar"><button type="button" id="webdavAutoVerifyBtn" class="jhs-btn jhs-btn--secondary">验证并启用</button></div>',
        "仅在插件页面运行时检查；关闭页面后，下次打开检查到期并补一份。成功上传后只清理本来源的旧自动备份，手动备份保留。");
}
/** @param {string} name */
const liveHost = (name) => `<div data-jhs-setting-section="${name}" class="jhs-setting-group"></div>`;

/** Build all controls once; navigation only changes visibility. @param {string} activePanel @param {Array<{text: string, key: string, title: string}>} cacheItems @param {any} [registry] */
export function buildSettingDialogHtml(activePanel = "appearance-panel", cacheItems = [], registry = null) {
    const active = resolveSettingPanel(activePanel).group;
    const label = (/** @type {string} */ key, /** @type {string} */ fallback) => escapeHtml(registry?.get(key)?.label || fallback);
    const taskState = [["no", "关闭"], ["yes", "开启"]];
    const periods = [2, 3, 6, 12, 24].map((hours) => [hours, `每 ${hours} 小时`]);
    const rules = [[0, "全部检测"], [8760, "跳过停更 1 年以上"], [17520, "跳过停更 2 年以上"], [26280, "跳过停更 3 年以上"]];
    /** @type {Record<string, string>} */
    const bodies = {
        "appearance-panel": section("base-panel", "外观", selectRow("themeMode", label("themeMode", "主题"), [["light", "浅色"], ["dark", "深色"], ["auto", "跟随系统"]], "live") + selectRow("mobileMode", label("mobileMode", "移动模式"), [["auto", "自动检测"], ["on", "强制开启"], ["off", "强制关闭"]], "live"), "立即生效") +
            section("layout-settings", "列表布局", row("containerColumns", label("containerColumns", "列表列数"), '<input type="range" class="jhs-range" id="containerColumns" min="2" max="10" step="1"><output id="showContainerColumns" for="containerColumns"></output>', "", "live") + row("containerWidth", label("containerWidth", "列表宽度"), '<input type="range" class="jhs-range" id="containerWidth" min="0" max="30" step="1"><output id="showContainerWidth" for="containerWidth"></output>', "", "live") + liveHost("appearance"), "立即生效") +
            section("highlight-settings", "标签与演员", selectRow("tagPosition", "状态标签位置", [["rightTop", "右上角"], ["leftTop", "左上角"]]) + (r ? toggleRow("enableFavoriteActresses", "高亮收藏演员") : '<input type="checkbox" id="enableFavoriteActresses" class="jhs-is-hidden">') + row("highlightedTagNumber", '<span id="highlightedTagLabel">高亮边框</span>', '<input type="number" id="highlightedTagNumber" class="jhs-field" min="0" max="20" aria-label="边框宽度（像素）"><input type="color" id="highlightedTagColor" aria-label="边框颜色">'), "保存后生效"),
        "browse-panel": section("list-settings", "列表浏览", selectRow("defaultQuickFilterTab", label("defaultQuickFilterTab", "默认筛选"), DEFAULT_QUICK_FILTER_OPTIONS.map(({ value, label }) => [value, label]), "nextNavigation") + liveHost("list"), "开关立即生效，默认筛选下次进入列表生效") +
            section("card-button-settings", "列表卡片按钮", liveHost("card-buttons"), "立即生效") +
            section("media-settings", "图片与预览", liveHost("media") + selectRow("videoQuality", "默认预览画质", L.filter((item) => item.canSelect).map((item) => [item.quality, item.text])), "开关立即生效，画质需保存") +
            section("detail-settings", "详情页", liveHost("detail") + selectRow("reviewCount", "评论条数", [10, 20, 30, 40, 50].map((count) => [count, `${count} 条`])) + toggleRow("enableSaveActressCarInfo", "鉴定补录演员", "保存后生效") + numberRow("waitCheckCount", "每次鉴定数量", 1, 20) + row("needClosePageBasic", label("needClosePage", "鉴定后关闭详情页"), '<input type="checkbox" id="needClosePageBasic" class="mini-switch" role="switch">', "鉴定完成后自动关闭", "live"), "评论、演员信息与自动关页立即生效；其他设置需保存") +
            section("detail-shortcut-settings", "鉴定快捷键", '<p class="jhs-setting-help">适用于普通详情和 FC2 详情。默认未设置，聚焦录制框后按键自动保存；Escape 退出，Tab 切换。部分组合键可能被系统或浏览器占用。</p><p class="jhs-setting-help" data-shortcut-disabled hidden>详情鉴定快捷键已停用，启用后刷新页面生效。</p><div class="jhs-toolbar"><button type="button" class="jhs-btn jhs-btn--secondary" data-shortcut-manage>功能管理</button></div>' + Object.entries(DETAIL_SHORTCUT_ACTIONS).map(([key, action]) => row(`shortcut-${key}`, action.label, `<div class="jhs-shortcut-fields"><input id="shortcut-${key}" class="jhs-field" type="text" readonly placeholder="聚焦后按键录制" data-shortcut-action="${key}" aria-describedby="shortcut-status-${key}"><button type="button" class="jhs-btn jhs-btn--secondary" data-shortcut-clear="${key}" aria-label="清除${action.label}快捷键">清除</button><p id="shortcut-status-${key}" class="jhs-shortcut-feedback" data-shortcut-status="${key}" role="status" aria-live="polite"></p></div>`, "", "live", "stacked")).join(""), "键位立即保存；独立功能开关修改后刷新生效"),
        "filtering-panel": section("filter-panel", "关键词屏蔽", toggleRow("enableTitleSelectFilter", "划词屏蔽") + [ ["reviewKeywordContainer", "评论屏蔽词"], ["filterKeywordContainer", "影片标题屏蔽词"] ].map(([id, title]) => `<div id="${id}">${row(`${id}-input`, title, `<div class="jhs-inline-fields"><input id="${id}-input" type="text" class="keyword-input jhs-field" placeholder="添加屏蔽词"><button type="button" class="jhs-btn add-tag-btn">添加</button></div>`)}<div class="tag-box"></div></div>`).join(""), "保存后生效") + section("magnet-filter-settings", "磁力过滤", liveHost("filter"), "立即生效"),
        "tasks-panel": section("task-panel", "任务状态", '<div id="setting-task-status-list" aria-live="polite"></div>' + numberRow("checkConcurrencyCount", "并发数", 2, 5) + numberRow("checkRequestSleep", "请求间隔（毫秒）", 0, 3000), "任务设置保存后生效") +
            section("setting-blacklist", "黑名单检测", selectRow("enableCheckBlacklist", "任务开关", taskState) + selectRow("checkBlacklist_intervalTime", "检查周期", periods) + selectRow("checkBlacklist_ruleTime", "停更筛选", rules)) +
            (r ? section("setting-checkFavoriteActress", "收藏演员同步", selectRow("enableCheckFavoriteActress", "任务开关", taskState) + selectRow("checkFavoriteActress_IntervalTime", "同步周期", [[12, "每 12 小时"], [24, "每 24 小时"]])) + section("setting-checkNewVideo", "新作品检测", selectRow("enableCheckNewVideo", "任务开关", taskState) + selectRow("checkNewVideo_intervalTime", "检查周期", periods) + selectRow("checkNewVideo_ruleTime", "停更筛选", rules)) : '<div class="jhs-is-hidden">' + selectRow("enableCheckFavoriteActress", "任务开关", taskState) + selectRow("checkFavoriteActress_IntervalTime", "同步周期", [[12, "每 12 小时"], [24, "每 24 小时"]]) + selectRow("enableCheckNewVideo", "任务开关", taskState) + selectRow("checkNewVideo_intervalTime", "检查周期", periods) + selectRow("checkNewVideo_ruleTime", "停更筛选", rules) + '</div>') +
            section("new-video-settings", "新作品标记", toggleRow("autoRemoveNewVideoMarkAfterBrowse", "浏览后移除标记"), "保存后生效"),
        "resources-panel": section("domain-panel", "第三方站点", liveHost("resources") + [["missAvUrl", PRODUCT_NAMES.missav], ["jableUrl", PRODUCT_NAMES.jable], ["avgleUrl", PRODUCT_NAMES.avgle], ["javTrailersUrl", PRODUCT_NAMES.javtrailers], ["av123Url", PRODUCT_NAMES.av123], ["javDbUrl", PRODUCT_NAMES.javdb], ["javBusUrl", PRODUCT_NAMES.javbus], ["supJavUrl", PRODUCT_NAMES.supjav]].map(([id, name]) => row(id, `${name} 地址`, `<input type="url" id="${id}" class="jhs-field" placeholder="输入站点地址">`)).join(""), "开关立即生效，站点地址需保存") + '<div id="resource-sources-panel" class="jhs-setting-section"></div>',
        "cloud-panel": '<div id="cloud-services-panel" class="jhs-setting-section"></div>',
        "data-panel": section("backup-panel", "数据备份", '<div class="jhs-toolbar"><button type="button" id="importBtn" class="jhs-btn">导入数据</button><button type="button" id="exportBtn" class="jhs-btn">导出数据</button></div>') + section("webdav-settings", `${PRODUCT_NAMES.webdav} 备份`, '<div class="jhs-toolbar"><button type="button" id="webdavBackupListBtn" class="jhs-btn">查看备份</button><button type="button" id="webdavBackupBtn" class="jhs-btn">备份数据</button></div>' + row("webDavUrl", "服务地址", '<input type="url" id="webDavUrl" class="jhs-field" placeholder="输入服务地址">') + row("webDavUsername", "用户名", '<input type="text" id="webDavUsername" class="jhs-field" autocomplete="username">') + row("webDavPassword", "密码", '<input type="password" id="webDavPassword" class="jhs-field" autocomplete="current-password">'), "修改连接信息后保存，再执行备份") + autoBackupSettings() + '<div id="snapshot-panel" class="jhs-setting-section"></div><div id="data-tools-panel" class="jhs-setting-section"></div>',
        "advanced-panel": section("network-settings", "网络与日志", numberRow("httpTimeout", "请求超时（毫秒）", 1000, 120000) + numberRow("httpRetryCount", "重试次数", 1, 10) + selectRow("enableClog", label("enableClog", "日志"), [["no", "关闭"], ["yes", "开启"]], "live") + numberRow("clogMsgCount", "日志最大行数", 100, 3000), "日志开关立即生效，其余设置需保存") + '<div id="network-panel" class="jhs-setting-section"></div>' +
            section("cache-panel", "缓存管理", '<div class="jhs-cache-grid">' + cacheItems.map((item) => `<article class="cache-item"><h4 class="cache-item__title">${escapeHtml(item.text)}</h4><div class="cache-item__actions"><button type="button" class="jhs-btn clean-btn" data-key="${escapeHtml(item.key)}" title="${escapeHtml(item.title)}">清理</button><button type="button" class="jhs-btn view-btn" data-key="${escapeHtml(item.key)}">查看</button></div></article>`).join("") + '</div><div id="cache-data-display" class="jhs-is-hidden"><pre class="jhs-cache-preview"></pre></div><div class="jhs-toolbar"><button type="button" id="clean-all" class="jhs-btn jhs-btn--danger">清理全部缓存</button></div>', "清理缓存保留鉴定记录与演员数据") + '<div id="health-panel" class="jhs-setting-section"></div><div id="plugin-mgmt-panel" class="jhs-setting-section"></div>',
    };
    return `<div class="jhs-setting-layout jhs-ui"><nav class="jhs-mobile-sidebar" aria-label="设置分类">${SETTINGS_GROUPS.map((group) => `<button type="button" class="jhs-btn side-menu-item${group.id === active ? " active" : ""}" data-panel="${group.id}" aria-controls="${group.id}"${group.id === active ? ' aria-current="page"' : ""}>${group.label}</button>`).join("")}</nav><div class="jhs-setting-main"><div class="jhs-setting-body">${SETTINGS_GROUPS.map((group) => `<div id="${group.id}" class="content-panel${group.id === active ? " active" : ""}" role="region" aria-label="${group.label}"${group.id === active ? "" : " hidden"}><h2 class="jhs-setting-group-title">${group.label}</h2>${bodies[group.id]}</div>`).join("")}</div><footer class="jhs-setting-footer"><div class="jhs-setting-footer__copy"><span id="settings-hydration-status" class="jhs-caption" aria-live="polite"></span><span class="jhs-caption">即时设置会自动保存；其他修改点击保存</span></div><button type="button" id="saveBtn" class="jhs-btn jhs-btn--primary">保存设置</button></footer></div></div>`;
}

/** Fill a pre-existing tool section without duplicating controls. @param {(value:any)=>any} jquery @param {any} root @param {string} id @param {string} html */
function fillSection(jquery, root, id, html) {
    const target = (root ? jquery(root).find(`#${id}`) : jquery(`#${id}`)).first();
    if (target.length && !target.children().length) target.append(html);
}
/** @param {(value:any)=>any} jquery @param {any} [root] */
export function injectHealthPanel(jquery, root) {
    fillSection(jquery, root, "health-panel", '<header class="jhs-setting-section__header"><h3>数据体检</h3><p>备份后修复可恢复的数据问题</p></header><div class="jhs-toolbar jhs-health-actions"><button type="button" id="runHealthCheckBtn" class="jhs-btn">重新体检</button><button type="button" id="repairHealthBtn" class="jhs-btn">备份并修复</button></div><div id="health-data-display" class="jhs-setting-output" aria-live="polite">点击重新体检查看结果</div>');
}
/** @param {(value:any)=>any} jquery @param {any} [root] */
export function injectPluginMgmtPanel(jquery, root) {
    fillSection(jquery, root, "plugin-mgmt-panel", '<header class="jhs-setting-section__header"><h3>功能管理</h3><p>功能开关保存后刷新生效，核心功能保持开启</p></header><div class="jhs-setting-metrics"><div class="jhs-setting-metric"><strong id="pm-total">0</strong><span>总功能数</span></div><div class="jhs-setting-metric"><strong id="pm-enabled">0</strong><span>已开启</span></div><div class="jhs-setting-metric"><strong id="pm-disabled">0</strong><span>已关闭</span></div></div><div id="plugin-mgmt-list"></div><details class="jhs-diagnostics"><summary>诊断信息</summary><div class="jhs-diagnostics__content"><h3 class="jhs-setting-subheading">功能激活耗时</h3><div id="plugin-timing-table"></div><h3 class="jhs-setting-subheading">错误日志</h3><div class="jhs-toolbar"><button type="button" id="pm-clear-log" class="jhs-btn">清空日志</button></div><div id="plugin-error-log" class="jhs-setting-output jhs-setting-output--compact">暂无错误记录</div><h3 class="jhs-setting-subheading">缓存命中率</h3><div id="cache-hit-stats" class="jhs-setting-output"></div></div></details>');
}
/** @param {(value:any)=>any} jquery @param {any} [root] */
export function injectSnapshotPanel(jquery, root) {
    fillSection(jquery, root, "snapshot-panel", '<header class="jhs-setting-section__header"><h3>恢复点</h3><p>最多保留 10 个快照，超出后移除最早的快照</p></header><div class="jhs-toolbar"><button type="button" id="createSnapshotBtn" class="jhs-btn">创建快照</button></div><div id="snapshot-list"></div>');
}
/** @param {(value:any)=>any} jquery @param {any} [root] */
export function injectNetworkPanel(jquery, root) {
    fillSection(jquery, root, "network-panel", '<header class="jhs-setting-section__header"><h3>站点连接</h3><p>连接规则需保存，重置与清空立即执行</p></header>' + numberRow("circuitBreakerThreshold", "连续失败阈值（次）", 2, 10) + numberRow("circuitBreakerCooldownSec", "冷却时间（秒）", 10, 300) + '<div class="jhs-toolbar"><button type="button" id="resetAllBreakersBtn" class="jhs-btn">重置全部连接</button></div><h4 class="jhs-setting-subheading">站点健康状态</h4><div id="site-health-table"></div><h4 class="jhs-setting-subheading">域名使用统计</h4><div class="jhs-toolbar"><button type="button" id="clearDomainStatsBtn" class="jhs-btn">清空统计</button></div><div id="domain-stats-table"></div>');
}
/** @param {(value:any)=>any} jquery @param {any} [root] */
export function injectResourceSourcesPanel(jquery, root) {
    fillSection(jquery, root, "resource-sources-panel", `<header class="jhs-setting-section__header"><h3>磁力来源</h3><p>来源开关立即生效，数字越小越优先</p></header><div id="builtin-magnet-source-list" class="jhs-resource-card-list"></div><div class="jhs-toolbar"><h4>自定义来源</h4><button type="button" id="add-custom-magnet-source" class="jhs-btn">添加来源</button></div><div id="custom-magnet-source-list" class="jhs-resource-card-list"></div><h3 class="jhs-setting-subheading">磁力规则</h3><div class="jhs-toolbar"><h4>标签规则</h4><button type="button" id="add-magnet-tag-rule" class="jhs-btn">新建规则</button></div><div id="magnet-tag-rule-list" class="jhs-resource-card-list"></div><div class="jhs-toolbar"><h4>过滤规则</h4><button type="button" id="add-magnet-filter-rule" class="jhs-btn">新建规则</button></div><div id="magnet-filter-rule-list" class="jhs-resource-card-list"></div><h3 class="jhs-setting-subheading">截图来源</h3><p class="jhs-setting-help">来源与模式立即生效</p><fieldset class="jhs-choice-group"><legend>截图选择模式</legend><label class="jhs-choice"><input type="radio" name="screenshotMode" value="auto"><span>自动选择</span></label><label class="jhs-choice"><input type="radio" name="screenshotMode" value="manual"><span>手动选择</span></label></fieldset><div id="screenshot-source-list" class="jhs-resource-card-list"></div><details class="jhs-setting-section jhs-resource-advanced"><summary>资源设置导入与导出</summary><p class="jhs-setting-help">校验并导入会立即应用设置</p><div class="jhs-toolbar"><button type="button" id="export-resource-config" class="jhs-btn">导出资源配置</button><button type="button" id="edit-resource-config" class="jhs-btn">编辑原始 ${PRODUCT_NAMES.json}</button><button type="button" id="import-resource-config" class="jhs-btn">校验并导入</button></div><textarea id="advanced-resource-json" class="jhs-textarea" rows="10" aria-label="资源配置 ${PRODUCT_NAMES.json}"></textarea></details>`);
    fillSection(jquery, root, "cloud-services-panel", `<header class="jhs-setting-section__header"><h3>离线服务</h3><p>服务设置立即生效</p></header><div id="cloud-settings-catalog" class="jhs-setting-group" aria-label="云盘服务设置"></div>`);
    fillSection(jquery, root, "data-tools-panel", '<header class="jhs-setting-section__header"><h3>番号列表导入</h3><p>支持换行、空格或逗号分隔，预览后导入</p></header><div class="jhs-setting-row jhs-setting-row--stacked"><label class="jhs-setting-row__label" for="car-number-import">番号列表</label><div class="jhs-setting-row__control"><textarea id="car-number-import" class="jhs-textarea" rows="8" placeholder="粘贴番号列表"></textarea></div></div>' + selectRow("car-number-import-status", "导入状态", [["", "请选择"], ["favorite", "收藏"], ["hasDown", "已下载"], ["hasWatch", "已观看"], ["filter", "屏蔽"]], "action") + '<div class="jhs-toolbar"><button type="button" id="preview-car-number-import" class="jhs-btn">解析预览</button><button type="button" id="confirm-car-number-import" class="jhs-btn" disabled>导入记录</button></div><p id="car-number-import-help" class="jhs-setting-help" role="status">填写番号并选择状态后，点击解析预览</p><div id="car-number-import-preview" class="jhs-card jhs-import-result" hidden aria-live="polite"></div>');
}

/** @param {any} [registry] @param {{ disabledContributions?: Set<string> }} [options] */
export function buildQuickSettingHtml(registry = undefined, options = {}) {
    const list = registry ? buildQuickSettingsHtml(registry, options) : null;
    return `<div class="simple-setting__panel jhs-ui"><div class="simple-setting__scroll jhs-scrollbar">${list ? list.prop("outerHTML") : '<div class="simple-setting__list"></div>'}</div><footer class="simple-setting__footer"><button type="button" id="moreBtn" class="jhs-btn jhs-btn--ghost">完整设置 <span aria-hidden="true">›</span></button></footer></div>`;
}
