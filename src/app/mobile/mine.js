// @ts-check
import { button, el } from "./components.js";
import { NewVideoWorkspaceController } from "../../features/discovery/new-video-workspace-controller.js";

/** @typedef {import("../../core/lifecycle-scope.js").LifecycleScope} Scope */

/** @param {HTMLElement} root @param {any} app @param {Scope} scope */
export async function showMine(root, app, scope) {
    const workspace = new NewVideoWorkspaceController(app.services);
    scope.addCleanup(() => workspace.dispose());
    const totals = el("div", null, "mobile-summary actions");
    const refreshTotals = async () => {
        const { carMap, pendingCount } = await workspace.loadWorkspace();
        scope.assertActive();
        const records = [...carMap.values()];
        totals.replaceChildren(...[["favorite", "收藏"], ["watched", "已看"], ["downloaded", "已下载"]].map(([flag, label]) =>
            button(`${label} ${records.filter(record => record.stateFlags?.[flag]).length}`, () => app.go({ name: "library", localFilters: [flag] }))),
            button(`追新待办 ${pendingCount}`, () => app.go({ name: "new" })));
    };
    const links = el("nav", null, "settings-group-list");
    const status = el("small", null, "sync-status");
    const refreshSync = async () => {
        const value = await app.services.webdavSync.getStatus();
        if (scope.disposed) return;
        status.textContent = value.message || (value.configured ? "WebDAV 已连接" : "WebDAV 未连接");
    };
    for (const [label, name, section] of [["设置", "settings"], ["同步与备份", "settings", "sync"], ["云盘任务", "tasks"], ["统计", "stats"]]) {
        const row = button("", () => app.go({ name, section }), "settings-link");
        const text = el("span", label);
        if (section === "sync") text.append(status);
        const arrow = el("span", "›");
        arrow.setAttribute("aria-hidden", "true");
        row.append(text, arrow);
        links.append(row);
    }
    root.append(totals, links);
    scope.listen(app.services.webdavSync, "status", refreshSync);
    for (const event of ["car-state-changed", "actress-changed", "new-video-changed"]) {
        scope.addCleanup(app.events.on(event, () => app.run(scope, refreshTotals)));
    }
    await Promise.all([refreshSync(), refreshTotals()]);
}

/** @param {HTMLElement} root @param {any} app @param {Scope} scope */
export async function showTasks(root, app, scope) {
    const services = app.services;
    const output = el("div", null, "surface");
    const status = el("p", null, "empty");
    status.setAttribute("role", "status");
    const refresh = button("刷新任务", () => app.run(scope, () => update(true)));
    const update = async (force = false) => {
        refresh.disabled = true;
        status.hidden = false;
        status.textContent = "正在查询任务…";
        try {
            const [snapshot, history] = await Promise.all([app.offlineTasks.refresh(force), app.services.state.getOfflineHistory()]);
            scope.assertActive();
            output.replaceChildren();
            for (const [id, name] of [["pan123", "123 云盘"], ["one115", "115"]]) {
                const service = snapshot[id];
                if (!service) continue;
                const row = el("div", null, "data-row");
                row.append(el("strong", name), el("p", service.reason || `${service.total ?? service.items.length} 项`));
                for (const task of service.items) {
                    const item = el("p", [task.name, task.status,
                        task.progress == null ? "" : `${task.progress}%`].filter(Boolean).join(" · "));
                    item.dataset.contentSensitive = "";
                    row.append(item);
                }
                if (service.needsLogin) row.append(button(`登录 ${name}`, () => app.run(scope, async () => {
                    refresh.disabled = true;
                    row.replaceChildren(el("strong", name));
                    try { await app.login(id); }
                    finally { if (!scope.disposed) await update(true); }
                }), "quiet-action"));
                output.append(row);
            }
            const superseded = new Set(history.filter((/** @type {any} */ row) => row.retryOf && ["unknown", "submitted", "exists"].includes(row.submissionOutcome))
                .map((/** @type {any} */ row) => row.retryOf));
            const pending = history.filter((/** @type {any} */ row) => !superseded.has(row.id)
                && ["unknown", "failed"].includes(row.submissionOutcome));
            if (pending.length) {
                output.append(el("h2", "待处理的离线提交", "catalog-heading"));
                for (const row of pending.slice(-25).reverse()) {
                    const unknown = row.submissionOutcome === "unknown";
                    const item = el("div", null, "data-row");
                    item.append(el("p", [row.providerName, row.carNum, unknown ? "待确认" : "提交失败"].filter(Boolean).join(" · ")));
                    item.dataset.contentSensitive = "";
                    const provider = app.offline.registry.providers.get(row.providerId);
                    if (provider && typeof row.resource === "string" && row.carNum) {
                        const actions = el("div", null, "actions");
                        const retry = button(unknown ? "核实后重试" : "重试", event => app.run(scope, async () => {
                            retry.disabled = true;
                            try {
                                const check = unknown ? await app.offline.checkPendingSubmission(row.resource, scope, row.id) : null;
                                scope.assertActive();
                                if (unknown && !check) {
                                    services.notifications.info("请在原提交设备或云盘核对");
                                    return;
                                }
                                if (check?.found) services.notifications.info("已在 115 云端找到任务");
                                else await app.offline.submitResource(event, row.resource, services.domUi.jquery(retry), row, row.id, {
                                    preferredProviderId: row.providerId, previousOutcome: row.submissionOutcome,
                                    expectedReceipt: check?.raw, forceAvailabilityRefresh: true,
                                });
                                if (!scope.disposed) await update(Boolean(check?.found));
                            } finally { retry.disabled = false; }
                        }), "quiet-action");
                        actions.append(retry, button("打开云盘", () => app.run(scope, () => app.external(provider.openUrl())), "quiet-action"));
                        item.append(actions);
                    }
                    output.append(item);
                }
            }
            if (!output.childElementCount) output.append(el("p", "暂无云盘任务"));
        } finally {
            refresh.disabled = false;
            status.hidden = true;
        }
    };
    root.append(refresh, status, output);
    await update();
}

/** @param {HTMLElement} root @param {any} app @param {Scope} scope */
export async function showStats(root, app, scope) {
    const workspace = new NewVideoWorkspaceController(app.services);
    scope.addCleanup(() => workspace.dispose());
    const [{ carMap, actresses, pendingCount }, blacklist] = await Promise.all([
        workspace.loadWorkspace(), app.services.state.getBlacklist(),
    ]);
    scope.assertActive();
    const entries = [["作品", carMap.size], ["收藏演员", actresses.length], ["黑名单", blacklist.length], ["追新待办", pendingCount]];
    const rows = el("div", null, "surface");
    for (const [label, count] of entries) rows.append(el("div", label + " · " + count, "data-row"));
    root.append(rows);
}
