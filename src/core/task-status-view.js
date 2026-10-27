// @ts-check
import { formatUiDateTime } from "./ui-date-time.js";

/** Display committed schedules without interpreting retry sentinels as regular execution times. @param {string} name @param {any} snapshot @param {Record<string, any>} settings */
export function taskStatusView(name, snapshot, settings = {}) {
    const keys = {blacklist:"enableCheckBlacklist", favoriteActress:"enableCheckFavoriteActress", newVideo:"enableCheckNewVideo"};
    const names = {blacklist:"黑名单", favoriteActress:"演员同步", newVideo:"新作品"};
    const key = keys[/** @type {keyof typeof keys} */ (name)], enabled = settings[key] !== "no" && settings[key] !== false;
    const format = formatUiDateTime;
    let status = "正常", next = "未计划", nextLabel = "下次检查";
    if (!enabled) { status = "已停用"; next = "已停用"; }
    else if (!snapshot || snapshot.ready === false) status = "未就绪";
    else if (snapshot.state === "running") { status = "运行中"; next = "完成后更新"; }
    else if (snapshot.isPending || snapshot.state === "pending") {
        status = "等待重试"; nextLabel = "重试检查"; next = snapshot.nextAt > Date.now() ? format(snapshot.nextAt) : "待检查";
    } else if (snapshot.state === "due" || snapshot.nextAt > 0 && snapshot.nextAt <= Date.now()) { status = "待检查"; next = "待检查"; }
    else if (snapshot.nextAt > 0) next = format(snapshot.nextAt);
    if (enabled && status === "正常" && snapshot?.unavailableCount > 0) status = "完成，有异常项";
    return {name:names[/** @type {keyof typeof names} */ (name)] || name, status, last:format(snapshot?.completedAt), next, nextLabel};
}

/** @param {any} jquery @param {string} name @param {any} snapshot @param {Record<string, any>} settings @param {boolean} [settingRow] */
export function renderTaskStatus(jquery, name, snapshot, settings, settingRow = false) {
    const view = taskStatusView(name, snapshot, settings);
    const root = jquery('<div></div>').addClass(settingRow ? "jhs-setting-row jhs-task-setting-status" : "jhs-task-status");
    root.append(jquery('<span></span>').addClass(settingRow ? "jhs-setting-row__label" : "jhs-task-status__name").text(`${view.name}：${view.status}`));
    const times = jquery('<dl class="jhs-task-times"></dl>');
    for (const [label,value] of [["上次完成",view.last],[view.nextLabel,view.next]]) times.append(jquery('<div></div>').append(jquery('<dt></dt>').text(label),jquery('<dd></dd>').text(value)));
    return root.append(times);
}
