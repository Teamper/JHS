// @ts-check
import { L } from "../core/constants.js";
import { parseBooleanSetting } from "../core/feature-helpers.js";
import { SYNC_DEFAULTS } from "../core/webdav-sync-model.js";
import { CIRCUIT_BREAKER_THRESHOLD, CIRCUIT_BREAKER_COOLDOWN_SECONDS } from "../core/circuit-breaker-settings.js";

/** @type {Array<[string,string,number,number,number]>} */
const numbers = [
    ["reviewCount", "评论条数", 20, 1, 50],
    ["waitCheckCount", "每次鉴定数量", 5, 1, 20],
    ["highlightedTagNumber", "高亮边框宽度", 1, 0, 20],
    ["checkConcurrencyCount", "并发数", 2, 2, 5],
    ["checkRequestSleep", "请求间隔", 100, 0, 3000],
    ["checkBlacklist_intervalTime", "黑名单检测间隔", 12, 1, 8760],
    ["checkBlacklist_ruleTime", "黑名单停更期限", 8760, 0, 876000],
    ["checkFavoriteActress_IntervalTime", "同步收藏演员间隔", 24, 1, 8760],
    ["checkNewVideo_intervalTime", "新作品检测间隔", 12, 1, 8760],
    ["checkNewVideo_ruleTime", "新作品停更期限", 8760, 0, 876000],
    ["httpTimeout", "请求超时", 5000, 1000, 120000],
    ["httpRetryCount", "重试次数", 3, 1, 10],
    ["circuitBreakerThreshold", "连续失败阈值", CIRCUIT_BREAKER_THRESHOLD.defaultValue, CIRCUIT_BREAKER_THRESHOLD.min, CIRCUIT_BREAKER_THRESHOLD.max],
    ["circuitBreakerCooldown", "连接冷却时间", CIRCUIT_BREAKER_COOLDOWN_SECONDS.defaultValue * 1000, CIRCUIT_BREAKER_COOLDOWN_SECONDS.min * 1000, CIRCUIT_BREAKER_COOLDOWN_SECONDS.max * 1000],
    ["clogMsgCount", "日志最大行数", 2000, 100, 3000],
    ["webDavSyncKeepCount", "最近同步版本", SYNC_DEFAULTS.webDavSyncKeepCount, 3, 1000000],
    ["webDavSyncHistoryDays", "每日版本保留天数", SYNC_DEFAULTS.webDavSyncHistoryDays, 0, 365],
];

/** @param {unknown} value */
function urlValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let url;
    try { url = new URL(raw); }
    catch { throw new TypeError("站点地址格式无效"); }
    if (url.protocol !== "https:" || url.username || url.password) throw new TypeError("仅允许 HTTPS URL，地址中须省略用户名和密码");
    return url.href.replace(/\/$/u, "");
}

/** @param {string} key @param {string} label @param {Record<string, any>} fields */
const descriptor = (key, label, fields) => ({
    key, label, owner: "SettingsFeature", effect: "manual", surfaces: ["full"], syncPolicy: "shared",
    formSelector: key === "circuitBreakerCooldown" ? "#circuitBreakerCooldownSec" : "#" + key,
    ...fields,
});

export const MANUAL_SETTINGS = Object.freeze([
    ...numbers.map(([key, label, defaultValue, min, max]) => descriptor(key, label, {
        type: "number", defaultValue, min, max, step: 1, integer: true, formScale: key === "circuitBreakerCooldown" ? 1000 : 1,
        normalize: (/** @type {unknown} */ value) => {
            const parsed = value == null || value === "" ? NaN : Number(value);
            return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : defaultValue;
        },
    })),
    ...[["enableCheckBlacklist", "定时检测黑名单", true], ["enableCheckFavoriteActress", "同步收藏演员", true], ["enableCheckNewVideo", "定时检测新作品", true],
        ["enableTitleSelectFilter", "划词屏蔽", true], ["enableFavoriteActresses", "高亮收藏演员", true], ["enableSaveActressCarInfo", "鉴定补录演员", false],
        ["autoRemoveNewVideoMarkAfterBrowse", "浏览后移除新作品标记", false]].map(([key, label, enabled]) => descriptor(String(key), String(label), {
        type: "boolean", defaultValue: enabled ? "yes" : "no",
        normalize: (/** @type {unknown} */ value) => parseBooleanSetting(value, Boolean(enabled)) ? "yes" : "no",
    })),
    descriptor("videoQuality", "默认预览画质", { type: "select", defaultValue: "", options: [{ value: "", label: "自动" }, ...L.filter(item => item.canSelect).map(item => ({ value: item.quality, label: item.text }))] }),
    descriptor("tagPosition", "状态标签位置", { type: "select", defaultValue: "rightTop", options: [{ value: "rightTop", label: "右上角" }, { value: "leftTop", label: "左上角" }] }),
    descriptor("highlightedTagColor", "高亮边框颜色", { type: "text", defaultValue: "#ce2222", validate: (/** @type {unknown} */ value) => /^#[a-f\d]{6}$/iu.test(String(value)) }),
    ...[["missAv", "MissAV"], ["jable", "Jable"], ["avgle", "Avgle"], ["javTrailers", "JavTrailers"], ["av123", "123AV"],
        ["javDb", "JavDB"], ["javBus", "JavBus"], ["supJav", "SupJav"]].map(([key, label]) => descriptor(key + "Url", label + " 地址", {
        type: "text", defaultValue: "", siteId: key + "Btn", readFormValue: urlValue, normalize: (/** @type {unknown} */ value) => { try { return urlValue(value); } catch { return value; } },
        validateSync: (/** @type {unknown} */ value) => typeof value === "string" && (value === "" || Boolean(urlValue(value))),
    })),
    ...[["webDavUrl", "WebDAV 地址"], ["webDavUsername", "WebDAV 用户名"], ["webDavPassword", "WebDAV 密码"]].map(([key, label]) => descriptor(key, label, {
        type: key === "webDavPassword" ? "password" : "text", defaultValue: "", sensitive: true, syncPolicy: "excluded",
    })),
]);
