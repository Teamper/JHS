// @ts-check
import { NewVideoWorkspaceController } from "../../features/discovery/new-video-workspace-controller.js";
import { isNewVideoDecisionHidden } from "../../core/new-video-model.js";
import { button, el, input, select, sheet } from "./components.js";
import { movieCard } from "./library.js";
import { newOrders, orderMovies, restoreWork, retainMovieSelection, sorting, viewToggle, visibleWork } from "./browse-controls.js";

/** @typedef {import("../../core/lifecycle-scope.js").LifecycleScope} Scope */
/** @typedef {["dismissed" | "snoozed" | "ignored" | null, string]} QueueAction */

/** @type {QueueAction[]} */
const queueActions = [["dismissed", "处理完成"], ["snoozed", "暂缓"], ["ignored", "忽略"]];
const queueStates = [["pending", "待办"], ["snoozed", "暂缓"], ["dismissed", "已处理"], ["ignored", "已忽略"]];

/** @param {any} item @param {any} app @param {any} route @param {Scope} scope @param {() => any} after */
export function followActions(item, app, route, scope, after) {
    const actions = el("div", null, "actions follow-actions");
    /** @type {QueueAction[]} */ const choices = isNewVideoDecisionHidden(item.decision) ? [[null, "恢复待办"]] : queueActions;
    for (const [action, label] of choices) actions.append(button(label, () => app.run(scope, async () => {
        const until = action === "snoozed" ? new Date(Date.now() + 7 * 864e5).toISOString() : null;
        const outcome = await app.services.state.setNewVideoDecision(item.carNum, action, until);
        if (outcome.transactionId) route.undo = outcome.transactionId;
        if (!scope.disposed) await after();
    }), "quiet-action"));
    return actions;
}

/** @param {HTMLElement} root @param {any} app @param {any} route @param {Scope} scope */
export async function showNew(root, app, route, scope) {
    const workspace = new NewVideoWorkspaceController(app.services);
    scope.addCleanup(() => workspace.dispose());
    const selection = route.selection ??= new Map();
    const controls = el("div", null, "actions section");
    const actions = el("div", null, "actions batch-actions");
    const result = el("p", null, "empty");
    result.setAttribute("role", "status");
    const group = select([["date", "按发行日期"], ["actor", "按演员"]], "分组");
    const filter = select(queueStates, "追新状态");
    const actor = select([["", "全部演员"]], "演员筛选");
    const filters = sheet(root, "追新筛选", scope, false);
    const fields = el("div", null, "filter-fields");
    const statusField = el("label", "状态"), actorField = el("label", "演员");
    actorField.dataset.contentSensitive = "";
    statusField.append(filter);
    actorField.append(actor);
    fields.append(statusField, actorField);
    const applied = el("p", null, "active-filters");
    applied.dataset.contentSensitive = "";
    const filterActions = el("div", null, "actions sheet-actions");
    filterActions.append(button("取消", () => filters.close(), "quiet-action"), button("应用筛选", () => {
        route.filter = filter.value;
        route.actor = actor.value;
        filters.close();
        window.scrollTo(0, 0);
        draw();
    }, "primary"));
    filters.append(fields, filterActions);
    const pending = el("p", null, "catalog-heading");
    pending.setAttribute("role", "status");
    group.value = route.group || "date";
    const list = el("div", null, "section");
    const order = sorting(root, scope, newOrders, route.order || "date", key => { route.order = key; draw(); });
    const scan = button("扫描新作", () => app.run(scope, async () => {
        scan.disabled = true;
        try {
            await app.tasks.invalidateConfig();
            const outcome = await app.tasks.checkNewVideo(true);
            scope.assertActive();
            result.textContent = outcome?.completed ? "扫描完成" : "扫描未完成，已保留原有条目";
            await refresh();
        } finally { scan.disabled = false; }
    }));
    const openFilters = button("筛选", () => {
        filter.value = route.filter || "pending";
        actor.value = route.actor || "";
        filters.showModal();
    }, "quiet-action");
    openFilters.setAttribute("aria-haspopup", "dialog");
    controls.append(openFilters, group, order, viewToggle(app, scope, list, route, "list"), scan);
    const choose = button("多选", () => {
        route.multi = !route.multi;
        if (!route.multi) selection.clear();
        draw();
    });
    controls.append(choose);
    const selectedCount = el("span");
    selectedCount.setAttribute("role", "status");
    actions.append(selectedCount);
    for (const [key, label] of /** @type {QueueAction[]} */ ([...queueActions, [null, "恢复待办"]])) {
        actions.append(button(label, () => app.run(scope, async () => {
            if (!selection.size) throw new Error("请先选中新作");
            const until = key === "snoozed" ? new Date(Date.now() + 7 * 864e5).toISOString() : null;
            const outcome = await app.services.state.setNewVideoDecision([...selection.keys()], key, until);
            scope.assertActive();
            if (outcome.transactionId) route.undo = outcome.transactionId;
            result.textContent = `已处理 ${outcome.changed.length} 部`;
            selection.clear();
            await refresh();
        })));
    }
    const undo = button("撤销上次操作", () => app.run(scope, async () => {
        const outcome = await app.services.state.undoTransaction(route.undo);
        route.undo = null;
        result.textContent = outcome.conflicts?.length ? "部分作品已变化，请查看历史" : "已撤销";
        await refresh();
    }));
    root.append(pending, controls, applied, actions, undo, result, list);
    /** @type {any[]} */ let items = [];
    function draw() {
        if (scope.disposed) return;
        const anchor = window.scrollY > 0 ? visibleWork(list) : null;
        const status = route.filter || "pending";
        const visible = items.filter(movie => movie.decisionState === status && (!route.actor || movie.actresses.includes(route.actor)));
        retainMovieSelection(selection, visible);
        applied.textContent = [route.actor, status === "pending" ? "" : queueStates.find(([key]) => key === status)?.[1]].filter(Boolean).join(" · ");
        applied.hidden = !applied.textContent;
        choose.setAttribute("aria-pressed", String(Boolean(route.multi)));
        updateBatch();
        undo.hidden = !route.undo;
        const groups = new Map();
        for (const movie of orderMovies(visible, route.order || "date")) {
            const title = (group.value === "actor" ? movie.actressName : movie.publishTime) || "未分类";
            if (!groups.has(title)) groups.set(title, []);
            groups.get(title).push(movie);
        }
        list.replaceChildren();
        for (const [label, movies] of groups) {
            const heading = el("h2", label, "catalog-heading");
            heading.dataset.contentSensitive = "";
            const grid = el("div", null, "poster-grid");
            for (const movie of movies) {
                const row = el("article", null, "follow-work");
                const card = movieCard({ ...movie, releaseDate: movie.publishTime, actorNames: movie.actresses }, app, route.multi ? selection : null,
                    updateBatch, { queue: route });
                const people = el("span", movie.actressName, "movie-metadata");
                card.querySelector(".card-label")?.append(people);
                row.append(card);
                if (!route.multi) row.append(followActions(movie, app, route, scope, refresh));
                grid.append(row);
            }
            list.append(heading, grid);
        }
        if (!groups.size) list.append(el("p", "暂无新作", "empty"));
        restoreWork(list, anchor);
    }
    let refreshNumber = 0;
    const refresh = async () => {
        const number = ++refreshNumber;
        const next = await workspace.loadWorkspace();
        scope.assertActive();
        if (number !== refreshNumber) return;
        items = next.items;
        pending.textContent = `${next.pendingCount} 部待处理`;
        const names = [...new Set(items.flatMap(item => item.actresses))].sort((a, b) => a.localeCompare(b, "zh-CN"));
        const selectedActor = actor.value;
        actor.replaceChildren(new Option("全部演员", ""), ...names.map(name => new Option(name, name)));
        actor.value = names.includes(selectedActor) ? selectedActor : "";
        if (!names.includes(route.actor)) route.actor = "";
        draw();
    };
    function updateBatch() {
        actions.hidden = !route.multi || !selection.size;
        selectedCount.textContent = `已选 ${selection.size} 部`;
    }
    group.onchange = () => {
        route.group = group.value;
        draw();
    };
    route.handleBack = () => {
        if (!route.multi) return false;
        route.multi = false;
        selection.clear();
        draw();
        return true;
    };
    for (const key of ["new-video-changed", "actress-changed", "car-state-changed"]) {
        scope.addCleanup(app.events.on(key, () => app.run(scope, refresh)));
    }
    await refresh();
}

/** @param {HTMLElement} root @param {any} app @param {Scope} scope */
export async function showHistory(root, app, scope) {
    const list = el("div", null, "surface");
    root.append(list);
    await render();
    async function render() {
        const log = await app.services.state.getActivityLog();
        scope.assertActive();
        list.replaceChildren();
        const entries = log.entries.filter((/** @type {any} */ entry) => entry.commitState === "committed").sort(
            (/** @type {any} */ a, /** @type {any} */ b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        for (const entry of entries.slice(0, 80)) {
            const row = el("article", null, "data-row");
            const time = new Date(entry.createdAt).toLocaleString();
            row.append(el("strong", time), el("p", entry.changes.map((/** @type {any} */ change) => change.carNum).join("、")));
            row.dataset.contentSensitive = "";
            if (entry.undoAvailable !== false && entry.changes.some((/** @type {any} */ change) => change.undoState === "pending")) {
                row.append(button("撤销", () => app.run(scope, async () => {
                    const outcome = await app.services.state.undoTransaction(entry.id);
                    app.services.notifications.info(outcome.conflicts?.length ? "部分记录已变化" : "已撤销");
                    await render();
                })));
            }
            list.append(row);
        }
        if (!entries.length) list.append(el("p", "暂无操作记录", "empty"));
    }
}

/** @param {HTMLElement} root @param {any} app @param {Scope} scope */
export async function showBlacklist(root, app, scope) {
    const list = el("div", null, "surface");
    const keyword = input("text", "标题关键词");
    keyword.dataset.contentSensitive = "";
    const add = button("添加规则", () => app.run(scope, async () => {
        if (!keyword.value.trim()) return;
        await app.services.titleKeywords.add(keyword.value.trim());
        keyword.value = "";
        await render();
    }));
    root.append(el("h2", "标题规则"), keyword, add,
        button("管理规则", () => app.run(scope, () => app.command("library.blacklist.open"))), list);
    await render();
    async function render() {
        const [actors, words] = await Promise.all([app.services.state.getBlacklist(), app.services.titleKeywords.getAll()]);
        scope.assertActive();
        list.replaceChildren(el("h2", "屏蔽的演员"));
        for (const actor of actors) {
            const row = el("div", null, "data-row actions");
            row.dataset.contentSensitive = "";
            row.append(el("span", actor.name), button("解除屏蔽", () => app.run(scope, async () => {
                await app.services.state.removeBlacklistActor(actor.starId);
                await render();
            })));
            list.append(row);
        }
        if (!actors.length) list.append(el("p", "暂无屏蔽演员", "empty"));
        if (words.length) {
            const values = el("p", words.join("、"));
            values.dataset.contentSensitive = "";
            list.append(el("h2", "生效的标题规则"), values);
        }
    }
}
