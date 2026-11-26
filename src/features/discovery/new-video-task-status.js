// @ts-check

import { renderTaskStatus, taskStatusView } from "../../core/task-status-view.js";
import { formatUiDateTime } from "../../core/ui-date-time.js";
import { getIcon } from "../../core/icons.js";
import { _ } from "../../core/constants.js";
import { normalizeHttpUrl } from "../../core/feature-helpers.js";
import { parseTaskInterval } from "./task-intervals.js";

/** @typedef {import("./new-video-workspace-service.js").NewVideoWorkspaceService} NewVideoWorkspaceService */
/** @typedef {import("./new-video-workspace-service.js").JQueryEvent} JQueryEvent */

/** @param {NewVideoWorkspaceService} owner */
export async function getTaskButtonTips(owner) {
    const task = owner.task?.current();
    if (!owner.task?.available()) return { favorite: "后台任务已关闭", newVideo: "后台任务已关闭" };
    const storage = owner.getRuntimeService("storage"), settings = owner.getRuntimeService("settings").snapshot();
    const interval = async (/** @type {"favoriteActress" | "newVideo"} */ name, /** @type {unknown} */ value) => typeof task?.getLatestTaskInterval === "function"
        ? await task.getLatestTaskInterval(name)
        : parseTaskInterval(name, value);
    const [favoriteHours, newVideoHours] = await Promise.all([
        interval("favoriteActress", settings.checkFavoriteActress_IntervalTime),
        interval("newVideo", settings.checkNewVideo_intervalTime),
    ]);
    return {
        favorite: `上次完整同步: ${storage.getLocal("jhs_time_checkFavoriteActress") || "无"}; 检测间隔时间: ${favoriteHours}小时`,
        newVideo: `上次整批检测: ${storage.getLocal("jhs_time_checkNewVideo") || "无"}; 检测间隔时间: ${newVideoHours}小时`,
    };
}

/** @param {NewVideoWorkspaceService} owner */
export async function resetBtnTip(owner, /** @type {{root: any, generation: number} | null} */ instance = null) {
    const tips = await owner.getTaskButtonTips();
    if (instance && (owner.disposed || !instance.root || instance.root !== owner.nvWorkspaceRoot || instance.generation !== owner.nvDialogGeneration)) return;
    const favoriteButton = instance ? instance.root.find("#checkFavoriteActress") : owner.jquery("#checkFavoriteActress");
    const newVideoButton = instance ? instance.root.find("#checkNewVideo") : owner.jquery("#checkNewVideo");
    favoriteButton.attr("data-tip", tips.favorite);
    newVideoButton.attr("data-tip", tips.newVideo);
}

/** @param {NewVideoWorkspaceService} owner */
export async function runManualTask(owner, /** @type {any} */ button, /** @type {string} */ busyLabel, /** @type {(task: any) => Promise<unknown>} */ runner) {
    if (button.attr("aria-busy") === "true") return;
    const instance = { root: owner.nvWorkspaceRoot, generation: owner.nvDialogGeneration };
    const current = () => !owner.disposed && instance.root === owner.nvWorkspaceRoot && instance.generation === owner.nvDialogGeneration;
    if (!owner.task?.available()) return void owner.notifications.info("后台任务已关闭");
    const label = button.find("span").last(), previous = label.text();
    button.attr("aria-busy", "true").prop("disabled", !0), label.text(busyLabel);
    /** @type {any} */ let task;
    try {
        task = await owner.task.activate();
        if (!current() || !task) return;
        await owner.window.navigator.locks.request(task.singleTaskKey, { ifAvailable: !0 }, (async lock => {
            if (!current()) return;
            if (!lock) return void owner.notifications.error("后台任务正在运行，请稍后再试");
            await runner(task);
        }));
    } catch (error) {
        owner.logger.error("手动任务执行失败", error);
        if (current()) owner.notifications.error(task?.isNetworkBlocked?.(error) ? "网络访问受限，请稍后重试" : "手动任务执行失败，请稍后重试");
    } finally {
        if (current()) {
            button.removeAttr("aria-busy").prop("disabled", !1); label.text(previous);
            owner.renderTaskStatuses(); owner.syncWorkspaceLayout(); await owner.resetBtnTip(instance);
        }
    }
}

/** @param {NewVideoWorkspaceService} owner */
export function renderTaskStatuses(owner) {
    const container = owner.jquery("#jhs-task-status-list");
    if (!container.length) return;
    const taskPlugin = owner.task?.current();
    const settings = owner.getRuntimeService("settings").snapshot();
    container.empty();
    const statuses = new Map();
    for (const name of ["favoriteActress", "newVideo", "blacklist"]) {
        const snapshot = taskPlugin?.getTaskStatusSnapshot(name), view = taskStatusView(name, snapshot, settings);
        statuses.set(view.status, (statuses.get(view.status) || 0) + 1);
        container.append(renderTaskStatus(owner.jquery, name, snapshot, settings));
    }
    owner.jquery("#nvTaskToggle span").text(`任务：${[...statuses].map(([status, count]) => `${count}项${status}`).join(" · ")}`);
    const health = owner.getRuntimeService("sourceHealth");
    const origin = owner.getRuntimeService("movie")?.externalSiteOrigin?.("javDbBtn", settings);
    const unavailable = origin && health ? health.list(origin) : [];
    if (unavailable.length) {
        const panel = owner.jquery('<section class="jhs-source-health-panel" aria-label="来源不可用的演员"></section>');
        const details = owner.jquery('<details class="jhs-source-health-details" open></details>');
        const summary = owner.jquery('<summary class="jhs-source-health-panel__summary"></summary>').append(
            owner.jquery('<span class="jhs-source-health-panel__heading"></span>').append(
                owner.jquery('<strong class="jhs-source-health-panel__title"></strong>').text(`来源不可用：${unavailable.length} 位演员`),
                owner.jquery('<span class="jhs-source-health-panel__note"></span>').text("原作品保留；24 小时后自动重查，也可单独重试。")
            ),
            owner.jquery(getIcon("chevron-down"))
        );
        const list = owner.jquery('<div class="jhs-source-health-list"></div>');
        for (const item of unavailable) {
            const starId = String(item.starId || "");
            const profileUrl = normalizeHttpUrl(`/actors/${encodeURIComponent(starId)}?t=d`, origin);
            const findActress = () => owner.nvActressesCache?.find(actor => actor.starId === starId) || { starId, name: item.name, allName: [item.name].filter(Boolean) };
            const retry = owner.jquery('<button type="button" class="jhs-btn jhs-btn--secondary"><span>重试</span></button>').attr({ "aria-label": `重试 ${item.name}`, "data-source-retry": starId });
            const rebind = owner.jquery('<button type="button" class="jhs-btn jhs-btn--secondary"><span>重新绑定</span></button>').attr({ "aria-label": `重新绑定 ${item.name}`, "data-source-rebind": starId });
            const remove = owner.jquery('<button type="button" class="jhs-btn jhs-btn--ghost"><span>移除</span></button>').attr({ "aria-label": `移除 ${item.name}`, "data-source-remove": starId });
            const info = owner.jquery('<div class="jhs-source-health-item__info"></div>').append(
                owner.jquery('<strong class="jhs-source-health-item__name"></strong>').text(item.name),
                owner.jquery('<span class="jhs-source-health-item__meta"></span>').text(`页面不存在（可能已合并或下架 · ID: ${starId}）· ${formatUiDateTime(item.retryAt)} 自动重查`)
            );
            const actions = owner.jquery('<div class="jhs-source-health-item__actions"></div>');
            if (profileUrl) {
                actions.append(owner.jquery('<a class="jhs-btn jhs-btn--ghost" target="_blank" rel="noopener noreferrer">查看主页</a>').attr({ href: profileUrl, "aria-label": `查看 ${item.name} 的演员主页` }));
            }
            actions.append(rebind, retry, remove);
            const row = owner.jquery('<div class="jhs-source-health-item"></div>').append(info, actions);
            const resolveActress = async () => {
                const cached = owner.nvActressesCache?.find(actor => actor.starId === starId);
                if (cached) return cached;
                if (!owner.nvWorkspaceLoading) return null;
                const list = await owner.getRuntimeService("state")?.getFavoriteActressList?.();
                return Array.isArray(list) ? list.find(actor => actor.starId === starId) || null : null;
            };
            rebind.on("click", async () => {
                if (rebind.attr("aria-busy") === "true" || rebind.prop("disabled")) return;
                const generation = owner.nvDialogGeneration;
                rebind.attr("aria-busy", "true").prop("disabled", true);
                let actress;
                try {
                    actress = await resolveActress();
                } catch (error) {
                    owner.logger.error("读取收藏演员失败", error);
                    if (!owner.disposed && owner.nvWorkspaceMounted && generation === owner.nvDialogGeneration) {
                        owner.notifications.error("读取演员信息失败，请重试");
                    }
                    return;
                } finally {
                    rebind.removeAttr("aria-busy").prop("disabled", false);
                }
                if (owner.disposed || !owner.nvWorkspaceMounted || generation !== owner.nvDialogGeneration) return;
                if (!actress) return void owner.notifications.info("本地收藏中已没有该演员");
                void owner.openRebindActorDialog(actress);
            });
            retry.on("click", async () => {
                if (retry.attr("aria-busy") === "true" || retry.prop("disabled")) return;
                const generation = owner.nvDialogGeneration;
                let actress;
                try {
                    actress = await resolveActress();
                } catch (error) {
                    owner.logger.error("读取收藏演员失败", error);
                    if (!owner.disposed && owner.nvWorkspaceMounted && generation === owner.nvDialogGeneration) {
                        owner.notifications.error("读取演员信息失败，请重试");
                    }
                    return;
                }
                if (owner.disposed || !owner.nvWorkspaceMounted || generation !== owner.nvDialogGeneration) return;
                if (retry.attr("aria-busy") === "true" || retry.prop("disabled")) return;
                if (!actress) return void owner.notifications.info("本地收藏中已没有该演员");
                await owner.runManualTask(retry, "检测中…", (/** @type {any} */ task) => task.checkOneNewVideo(actress));
                if (!owner.disposed && owner.nvWorkspaceMounted && generation === owner.nvDialogGeneration) (owner.jquery('[data-source-retry]').filter((/** @type {number} */ _, /** @type {HTMLElement} */ node) => node.getAttribute("data-source-retry") === starId)[0] || owner.jquery("#nvTaskToggle:visible")[0] || owner.jquery(".jhs-new-video-view [role='tab'][aria-selected='true']")[0])?.focus({ preventScroll: true });
            });
            remove.on("click", (/** @type {JQueryEvent} */ event) => {
                const actress = findActress();
                owner.removeUnavailableActress(event, actress, origin);
            });
            list.append(row);
        }
        details.append(summary, list);
        panel.append(details);
        container.append(panel);
    }
}
