import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LifecycleScope } from "../../src/core/lifecycle-scope.js";
import { catalogOrders, libraryOrders, newOrders, orderMovies } from "../../src/app/mobile/browse-controls.js";
import { button, el, input, movieTitle, select, sheet, STATE_LABELS } from "../../src/app/mobile/components.js";
import { mountLiquidNavigation } from "../../src/app/mobile/liquid-navigation.js";
import { renderMoviePoster } from "../../src/app/mobile/movie-poster.js";
import { actors, byId, categories, collections, followLabels, taskLabels, tasks, works } from "./fixtures.js";
import { mediaStrip, previewImage } from "./media.js";
import { createNavigation, defaultFilters, icons, tabs } from "./navigation.js";
import { createStore, flags } from "./store.js";

const root = document.querySelector("#main");
const title = document.querySelector("#title");
const back = document.querySelector("#back");
const privacy = document.querySelector("#privacy");
const status = document.querySelector("#status");
const undoButton = document.querySelector("#undo");
const ui = document.documentElement;
const store = createStore(localStorage);
const navigation = createNavigation(root);
const current = navigation.current;
const updateTabs = mountLiquidNavigation(document.querySelector(".mobile-tabs"), tabs, icons, tab => {
    if (navigation.tab() === tab) return;
    relock();
    navigation.select(tab);
    render();
}, new LifecycleScope("preview:tabs"));
const collectionOptions = Object.entries(collections).map(([key, value]) => [key, value.name]);
const actorOptions = actors.map(name => [name, name]);
const displayOptions = [["all", "全部"], ["category", "分类"], ["ranking", "榜单"]];
const scenarios = [["ready", "普通"], ["empty", "空结果"], ["loading", "先加载"], ["fail-once", "一次失败"]];
let scope, undoAction, revealTimer, scenario = "ready";

function focusPage() { title.focus({ preventScroll: true }); }

function go(name, id, initial) {
    relock();
    navigation.push(name, id, initial);
    render();
    focusPage();
}

function refresh(resetScroll = false) {
    navigation.capture();
    if (resetScroll) navigation.resetScroll();
    render();
}

function dismiss() {
    if (document.fullscreenElement) { document.exitFullscreen(); return true; }
    const dialog = [...root.querySelectorAll("dialog[open]")].at(-1);
    if (dialog) { dialog.close(); return true; }
    if (current().selection) {
        current().selection = null;
        refresh();
        return true;
    }
    if (!navigation.canPop()) return false;
    relock();
    const id = current().name === "detail" ? current().id : null;
    navigation.pop();
    render();
    const item = [...root.querySelectorAll("[data-work]")].find(node => node.dataset.work === id);
    (item?.querySelector(".catalog-item") ?? title).focus({ preventScroll: true });
    return true;
}

function notice(message, change) {
    status.textContent = change?.saved === false ? message + "。本机存储不可用。" : message;
    undoAction = change?.undo;
    undoButton.hidden = !undoAction;
    document.querySelector(".feedback").hidden = !message;
}

undoButton.onclick = () => {
    const saved = undoAction();
    notice("已撤销", { saved });
    refresh();
};
document.querySelector("#dismiss-status").onclick = () => notice("");

function applyPrivacy() {
    const masked = store.preferences().mask && !revealTimer;
    document.body.toggleAttribute("data-jhs-mobile-mask", masked);
    privacy.textContent = masked ? "临时查看" : revealTimer ? "重新遮罩" : "隐私";
    privacy.setAttribute("aria-pressed", String(masked));
    for (const sensitive of root.querySelectorAll("[data-content-sensitive]")) {
        if (masked) sensitive.setAttribute("aria-hidden", "true");
        else sensitive.removeAttribute("aria-hidden");
        if (sensitive.matches("button, .protected")) sensitive.inert = masked;
    }
    for (const poster of root.querySelectorAll(".catalog-item")) {
        if (masked) poster.setAttribute("aria-label", "已遮罩作品");
        else poster.removeAttribute("aria-label");
    }
    for (const control of root.querySelectorAll("[data-private-editor]")) control.disabled = masked;
    if (current().name === "actor") title.textContent = masked ? "演员作品" : current().id;
}

function relock() {
    if (!revealTimer) return;
    clearTimeout(revealTimer);
    revealTimer = undefined;
    for (const dialog of root.querySelectorAll(".full-media[open]")) dialog.close();
    applyPrivacy();
}

privacy.onclick = () => {
    if (revealTimer) { relock(); return; }
    if (store.preferences().mask) {
        revealTimer = setTimeout(relock, 30_000);
        notice("临时显示 30 秒");
    } else {
        const saved = store.setPreferences({ mask: true });
        notice("隐私遮罩已开启", { saved });
    }
    applyPrivacy();
};

function actionRow(...children) {
    const row = el("div", null, "product-actions");
    row.append(...children);
    return row;
}

function actions(label, handler, selected) {
    const control = button(label, handler, "control");
    if (selected !== undefined) control.setAttribute("aria-pressed", String(selected));
    return control;
}

function section(label, ...children) {
    const box = el("section", null, "product-section");
    box.append(el("h2", label), ...children);
    return box;
}

function field(label, options, value, change, empty) {
    const control = select(empty ? [["", empty], ...options] : options, label);
    control.value = value;
    control.onchange = () => change(control.value);
    const row = el("label", null, "product-field");
    row.append(el("span", label), control);
    return row;
}

function check(label, checked, change) {
    const row = el("label", null, "product-check");
    const toggle = el("input");
    toggle.type = "checkbox";
    toggle.checked = checked;
    toggle.onchange = () => change(toggle.checked);
    row.append(toggle, el("span", label));
    return row;
}

function search(route, update) {
    const field = input("search", route.name === "library" ? "检索片库" : "搜索番号、标题或演员", route.q);
    field.classList.add("product-search");
    field.placeholder = field.getAttribute("aria-label");
    field.enterKeyHint = "search";
    field.addEventListener("input", () => {
        route.q = field.value;
        navigation.resetScroll();
        update();
    });
    field.addEventListener("keydown", event => { if (event.key === "Enter") field.blur(); });
    return field;
}

function openSheet(label) {
    const dialog = sheet(root, label, scope);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    return dialog;
}

function configure(route, sort = false) {
    const dialog = openSheet(sort ? "排序" : "筛选");
    const draft = { ...route.filters, flags: [...route.filters.flags] };
    let order = route.sort;
    const all = route.name === "library" ? libraryOrders : route.name === "follow" ? newOrders : catalogOrders;
    const options = all.map(([key, name]) => [key, key === "source" ? "默认顺序" : name]);
    if (sort) {
        dialog.append(field("顺序", options, order, value => { order = value; }));
    } else {
        const fields = el("div", null, "sheet-fields");
        function fill() {
            fields.replaceChildren();
            if (route.name !== "actor") fields.append(field("演员", actorOptions, draft.actor, value => { draft.actor = value; }, "全部演员"));
            if (route.name !== "follow") fields.append(field("分类", categories.map(name => [name, name]),
                draft.category, value => { draft.category = value; }, "全部分类"));
            if (route.name === "library") {
                fields.append(field("清单", collectionOptions, draft.collection, value => { draft.collection = value; }, "全部清单"));
                const stateChecks = el("fieldset");
                stateChecks.append(el("legend", "作品状态"));
                for (const key of flags) stateChecks.append(check(STATE_LABELS[key], draft.flags.includes(key), enabled => {
                    draft.flags = enabled ? [...draft.flags, key] : draft.flags.filter(flag => flag !== key);
                }));
                fields.append(stateChecks, check("仅已评分", draft.rated, value => { draft.rated = value; }));
            }
        }
        fill();
        dialog.append(fields, actions("清除条件", () => { Object.assign(draft, defaultFilters, { flags: [] }); fill(); }));
    }
    dialog.querySelector(".sheet-title button").textContent = "取消";
    dialog.append(actionRow(button("应用", () => {
        route.filters = draft;
        route.sort = order;
        dialog.close();
        refresh();
    }, "primary")));
    dialog.showModal();
}

function matches(work, route) {
    const { filters } = route;
    const query = route.q.trim().toLocaleLowerCase();
    const record = store.record(work.id);
    return (!query || [work.carNum, work.title, ...work.actors].some(text => text.toLocaleLowerCase().includes(query)))
        && (!filters.actor || work.actors.includes(filters.actor))
        && (!filters.category || work.category === filters.category)
        && (!filters.collection || store.hasMembership(filters.collection, work.id))
        && (!filters.rated || record.rating > 0)
        && filters.flags.every(flag => record[flag]);
}

function listFor(route) {
    const ranking = route.name === "browse" && route.mode === "ranking";
    const candidates = works.filter(work => {
        if (!matches(work, route)) return false;
        if (route.name === "library") return store.inLibrary(work.id);
        if (route.name === "follow") return work.origins && store.follow(work.id) === route.follow;
        return !store.record(work.id).blocked && (route.name !== "actor" || work.actors.includes(route.id));
    });
    const exact = candidates.find(work => work.carNum.toLocaleLowerCase() === route.q.trim().toLocaleLowerCase())?.carNum;
    const ratings = Object.fromEntries(candidates.map(work => [work.carNum, store.record(work.id)]));
    const ranked = orderMovies(candidates.map(work => ({
        ...work, updateDate: new Date(store.record(work.id).updated).toISOString(),
    })), ranking ? "rating" : route.sort, { exact, ratings });
    if (ranking) return ranked.map((work, index) => ({ ...work, rank: index + 1 }));
    return ranked.map(work => byId.get(work.id));
}

function saveNote(work, previous) {
    const dialog = openSheet("作品备注");
    const text = el("textarea");
    text.value = previous;
    text.rows = 5;
    text.maxLength = 1000;
    text.setAttribute("aria-label", "备注");
    dialog.append(text, actionRow(button("保存备注", () => {
        const change = store.setWorks([work.id], { note: text.value.trim() });
        dialog.close();
        notice("备注已保存", change);
        refresh();
    }, "primary")));
    dialog.showModal();
}

function details(route, label, ...children) {
    const fold = el("details", null, "detail-fold");
    route.sections ??= new Set();
    fold.open = route.sections.has(label);
    fold.ontoggle = () => {
        if (fold.open) route.sections.add(label);
        else route.sections.delete(label);
    };
    fold.append(el("summary", label), ...children);
    return fold;
}

function detailPage(route) {
    const work = byId.get(route.id);
    const record = store.record(work.id);
    const hero = el("section", null, "detail-hero");
    const cover = el("div", null, "detail-cover");
    cover.dataset.contentSensitive = "";
    cover.append(previewImage(work));
    const identity = el("div", null, "detail-identity");
    identity.dataset.contentSensitive = "";
    identity.append(movieTitle("h2", work.title, work.carNum), el("p", work.carNum, "movie-code"));
    hero.append(cover, identity);

    const controls = actionRow(...flags.map(key => actions(STATE_LABELS[key], () => {
        const change = store.setWorks([work.id], { [key]: !store.record(work.id)[key] });
        notice(`已更新${STATE_LABELS[key]}`, change);
        refresh();
        root.querySelector(`[data-flag="${key}"]`)?.focus({ preventScroll: true });
    }, record[key])));
    [...controls.children].forEach((child, index) => { child.dataset.flag = flags[index]; });
    const rating = field("我的评分", [["0", "未评分"], ...[1, 2, 3, 4, 5].map(value => [String(value), `${value} / 5`])],
        String(record.rating), value => {
            const change = store.setWorks([work.id], { rating: Number(value) });
            notice(value === "0" ? "评分已清除" : "评分已保存", change);
        });
    const actorLinks = actionRow(...work.actors.map(name => actions(name, () => go("actor", name))));
    actorLinks.classList.add("protected");
    actorLinks.dataset.contentSensitive = "";
    const facts = el("p", `${work.releaseDate} · ${work.duration} 分钟 · ${work.category}`, "detail-facts");
    facts.dataset.contentSensitive = "";
    const memberships = Object.keys(collections).filter(key => store.hasMembership(key, work.id)).map(key => collections[key].name);
    const note = el("p", record.note || "暂无备注", "detail-note");
    note.dataset.contentSensitive = "";
    const editNote = actions("编辑备注", () => saveNote(work, record.note));
    editNote.dataset.privateEditor = "";
    const strip = mediaStrip(root, work);
    const review = el("p", work.ratingValue ? `样片评分 ${work.ratingValue.toFixed(1)} / 5 · ${work.voteCount} 条评价。` : "暂无样片评价。");
    const related = el("div", null, "related-list protected");
    related.dataset.contentSensitive = "";
    const similar = works.filter(item => item.id !== work.id && item.category === work.category && !store.record(item.id).blocked).slice(0, 3);
    for (const item of similar) related.append(actions(item.title, () => go("detail", item.id)));
    const parent = navigation.parent();
    root.append(hero, section("我的记录", controls, rating),
        ...(parent?.name === "follow" ? [section("追新", followActions(work, store.follow(work.id)))] : []),
        section("发行资料", facts, actorLinks, note, actionRow(editNote,
            actions("编辑清单", () => editCollections([work.id]))),
        ...(memberships.length ? [el("p", memberships.join(" · "), "active-filters")] : [])),
        section("预告与画面", strip.childElementCount ? strip : el("p", "这部作品暂无预告或画面。")),
        details(route, "资源", el("p", "片源样片 · 1080p · 仅用于离线演示。"),
            el("p", "简体中文字幕 · 示例记录。")),
        details(route, "评价", review, el("p", "样片短评 · 适合留意镜头里的环境和色彩。")),
        details(route, "相关作品", related));
}

const activeTasks = new Map();

function runTask(id) {
    if (activeTasks.has(id)) return;
    const timer = setInterval(() => {
        const task = store.task(id);
        const progress = Math.min(100, task.progress + 16);
        store.setTask(id, progress === 100 ? "done" : "running", progress);
        if (current().name === "tasks") updateTasks();
        if (progress === 100) stopTask(id);
    }, 2400);
    activeTasks.set(id, timer);
}

function stopTask(id) {
    clearInterval(activeTasks.get(id));
    activeTasks.delete(id);
}

function updateTasks() {
    for (const task of tasks) {
        const row = root.querySelector(`[data-task="${task.id}"]`);
        if (!row) continue;
        const { status: state, progress } = store.task(task.id);
        row.querySelector(".task-state").textContent = taskLabels[state];
        row.querySelector(".task-percent").textContent = `${progress}%`;
        row.querySelector("progress").value = progress;
        row.querySelector("[data-task-start]").hidden = state !== "failed" && state !== "queued";
        row.querySelector("[data-task-start]").textContent = state === "failed" ? "重试" : "开始";
        row.querySelector("[data-task-cancel]").hidden = state !== "queued" && state !== "running";
    }
}

function taskPage() {
    const list = el("div", null, "task-list");
    for (const task of tasks) {
        const row = el("article", null, "task-row");
        row.dataset.task = task.id;
        const meter = el("progress");
        meter.max = 100;
        meter.setAttribute("aria-label", `${task.name}进度`);
        const start = actions("开始", () => {
            const saved = store.setTask(task.id, "running", 0);
            runTask(task.id);
            updateTasks();
            notice("任务已开始", { saved });
        });
        const cancel = actions("取消任务", () => {
            stopTask(task.id);
            const saved = store.setTask(task.id, "cancelled", store.task(task.id).progress);
            updateTasks();
            notice("任务已取消", { saved });
        });
        start.dataset.taskStart = "";
        cancel.dataset.taskCancel = "";
        row.append(el("h2", task.name), actionRow(el("span", null, "task-state"), el("span", null, "task-percent")),
            meter, actionRow(start, cancel));
        list.append(row);
    }
    root.append(list);
    updateTasks();
}

function myPage() {
    const summary = el("div", null, "summary-grid");
    for (const key of ["favorite", "watched", "downloaded"]) {
        const amount = works.filter(work => store.record(work.id)[key]).length;
        summary.append(button(`${STATE_LABELS[key]} ${amount}`, () => go("library", undefined,
            { filters: { ...defaultFilters, flags: [key] } }), "summary-link"));
    }
    const pending = works.filter(work => work.origins && store.follow(work.id) === "pending").length;
    summary.append(button(`追新待办 ${pending}`, () => go("follow"), "summary-link"));
    const rows = el("div", null, "settings-group-list");
    for (const [label, route] of [["任务", "tasks"], ["显示与隐私", "settings"], ["演示场景", "scenario"]]) {
        const entry = button(label, () => go(route), "settings-link");
        const chevron = el("span", "›", "chevron");
        chevron.setAttribute("aria-hidden", "true");
        entry.append(chevron);
        rows.append(entry);
    }
    root.append(summary, rows);
}

function settingsPage() {
    const preferences = store.preferences();
    root.append(
        field("主题", [["system", "跟随系统"], ["light", "浅色"], ["dark", "深色"]], preferences.theme,
            theme => { notice("主题已更新", { saved: store.setPreferences({ theme }) }); applyTheme(); }),
        check("隐私遮罩", preferences.mask, mask => {
            relock();
            const saved = store.setPreferences({ mask });
            notice(mask ? "隐私遮罩已开启" : "隐私遮罩已关闭", { saved });
            applyPrivacy();
        }),
    );
}

function scenarioPage() {
    root.append(field("发现结果", scenarios, scenario, value => {
        scenario = value;
        notice("演示场景已切换");
    }), actions("重置样片数据", () => {
        const dialog = openSheet("重置样片数据");
        dialog.append(el("p", "将清除这个离线预览中的备注、标记、任务和偏好。"),
            button("确认重置", () => {
                for (const task of tasks) stopTask(task.id);
                relock();
                scenario = "ready";
                const saved = store.reset();
                dialog.close();
                notice("样片数据已重置", { saved });
                for (const task of tasks) if (store.task(task.id).status === "running") runTask(task.id);
                refresh();
            }, "primary"));
        dialog.showModal();
    }));
}

function applyTheme() {
    const { theme } = store.preferences();
    if (theme === "system") delete ui.dataset.jhsTheme;
    else ui.dataset.jhsTheme = theme;
}

function render() {
    scope?.dispose();
    scope = new LifecycleScope("preview:page");
    root.replaceChildren();
    const route = current();
    updateTabs(navigation.tab());
    title.textContent = { actor: route.id, detail: "作品详情", tasks: "任务", settings: "显示与隐私",
        scenario: "演示场景", ...tabs }[route.name];
    document.body.dataset.route = route.name;
    back.hidden = !(navigation.canPop() || route.selection);
    if (route.name === "detail") detailPage(route);
    else if (route.name === "mine") myPage();
    else if (route.name === "tasks") taskPage();
    else if (route.name === "settings") settingsPage();
    else if (route.name === "scenario") scenarioPage();
    else listPage(route);
    applyTheme();
    applyPrivacy();
    navigation.restore();
}

const textEntry = () => document.activeElement?.matches("textarea, input:not([type=checkbox])");
const viewport = window.visualViewport;
let viewportHeight = viewport?.height;
let viewportWidth = viewport?.width;
function updateKeyboard() {
    if (!viewport) return;
    const editing = textEntry();
    // Android may resize the WebView and the visual viewport together.
    if (!editing || Math.abs(viewport.width - viewportWidth) > 80) {
        viewportHeight = viewport.height;
        viewportWidth = viewport.width;
    } else {
        viewportHeight = Math.max(viewportHeight, viewport.height);
    }
    const keyboard = editing && viewportHeight - viewport.height > 100;
    ui.toggleAttribute("data-keyboard", Boolean(keyboard));
    if (keyboard) ui.style.setProperty("--keyboard-viewport", `${Math.round(viewport.height - 10)}px`);
    else ui.style.removeProperty("--keyboard-viewport");
}
viewport?.addEventListener("resize", updateKeyboard);
document.addEventListener("focusin", updateKeyboard);
document.addEventListener("focusout", () => requestAnimationFrame(updateKeyboard));
back.onclick = dismiss;
window.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (textEntry()) {
        event.preventDefault();
        document.activeElement.blur();
    } else if (dismiss()) event.preventDefault();
});
if (Capacitor.isNativePlatform()) {
    App.addListener("backButton", () => {
        if (ui.hasAttribute("data-keyboard")) document.activeElement?.blur();
        else if (!dismiss()) App.exitApp();
    });
}
if (new URLSearchParams(location.search).get("mode") === "wireframe") ui.dataset.wireframe = "";
for (const task of tasks) if (store.task(task.id).status === "running") runTask(task.id);
render();

function setSelection(route, id) {
    route.selection ??= new Set();
    if (route.selection.has(id)) route.selection.delete(id);
    else route.selection.add(id);
    refresh();
    root.querySelector(".selection-count").focus({ preventScroll: true });
}

function longPress(control, id, route) {
    let timer, origin, suppress = false;
    const clear = () => clearTimeout(timer);
    scope.addCleanup(clear);
    control.addEventListener("pointerdown", event => {
        if (!event.isPrimary || event.button !== 0) return;
        suppress = false;
        origin = [event.clientX, event.clientY];
        timer = setTimeout(() => { suppress = true; setSelection(route, id); }, 480);
    });
    control.addEventListener("pointermove", event => {
        if (origin && Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 10) clear();
    });
    for (const name of ["pointerup", "pointercancel", "pointerleave"]) control.addEventListener(name, clear);
    control.addEventListener("contextmenu", event => event.preventDefault());
    control.addEventListener("click", event => {
        if (!suppress) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);
}

function workCard(work, route) {
    const library = route.name === "library", following = route.name === "follow";
    const wrapper = el("article", null, "work-item");
    wrapper.dataset.work = work.id;
    const poster = renderMoviePoster(work, () => {
        if (route.selection) setSelection(route, work.id);
        else go("detail", work.id);
    });
    delete poster.dataset.work;
    const artwork = poster.querySelector(".artwork");
    artwork.dataset.contentSensitive = "";
    artwork.replaceChildren(previewImage(work));
    const labels = poster.querySelector(".card-label");
    if (library) {
        const record = store.record(work.id);
        const summary = flags.filter(key => record[key]).map(key => STATE_LABELS[key]);
        if (record.rating) summary.push(`${record.rating}/5`);
        if (summary.length) labels.append(el("span", summary.join(" · "), "personal-state"));
        if (record.note) labels.append(el("span", record.note, "personal-note"));
        if (route.selection) {
            const selected = route.selection.has(work.id);
            poster.setAttribute("aria-pressed", String(selected));
            poster.append(el("span", selected ? "✓" : "○", "selection-mark"));
        } else longPress(poster, work.id, route);
    }
    if (following) labels.append(el("span", work.actors.join("、"), "personal-state"));
    wrapper.append(poster);
    if (following) wrapper.append(followActions(work, route.follow));
    return wrapper;
}

function changeFollow(work, value) {
    const change = store.setFollow(work.id, value);
    notice(value === "pending" ? "已恢复待办" : followLabels[value], change);
    if (current().name === "detail") dismiss();
    else refresh();
}

function followActions(work, value) {
    return value === "pending"
        ? actionRow(button("处理完成", () => changeFollow(work, "done"), "primary"),
            actions("暂缓", () => changeFollow(work, "snoozed")), actions("忽略", () => changeFollow(work, "ignored")))
        : actionRow(actions("恢复待办", () => changeFollow(work, "pending")));
}

function batch(route) {
    const toolbar = el("div", null, "batch-toolbar");
    const count = el("strong", `已选 ${route.selection.size} 部`, "selection-count");
    count.tabIndex = -1;
    const selected = [...route.selection];
    const mark = button("批量标记", () => {
        const dialog = openSheet("批量标记");
        for (const key of flags) {
            const set = !selected.every(id => store.record(id)[key]);
            dialog.append(actions(`${set ? "标为" : "取消"}${STATE_LABELS[key]}`, () => {
                const change = store.setWorks(selected, { [key]: set });
                dialog.close();
                route.selection = null;
                notice(`已更新 ${selected.length} 部作品`, change);
                refresh();
            }));
        }
        dialog.showModal();
    }, "primary");
    mark.disabled = !selected.length;
    const lists = actions("编辑清单", () => editCollections(selected, () => { route.selection = null; }));
    lists.disabled = mark.disabled;
    toolbar.append(count, actionRow(mark, lists, actions("退出多选", dismiss)));
    return toolbar;
}

function editCollections(ids, finish = () => {}) {
    const dialog = openSheet("编辑清单");
    for (const [key, name] of collectionOptions) {
        const all = ids.every(id => store.hasMembership(key, id));
        const count = works.filter(work => store.hasMembership(key, work.id)).length;
        const row = el("div", null, "collection-row");
        row.append(el("span", `${name} · ${count} 部`), actions(all ? "移出" : "加入", () => {
            const change = store.setMembers(key, ids, !all);
            dialog.close();
            finish();
            notice(all ? `已移出${name}` : `已加入${name}`, change);
            refresh();
        }));
        dialog.append(row);
    }
    dialog.showModal();
}

function listPage(route) {
    const discovery = route.name === "browse", library = route.name === "library", follow = route.name === "follow";
    const ranking = discovery && route.mode === "ranking";
    const controls = el("div", null, "list-controls");
    const count = el("p", null, "result-count");
    count.setAttribute("role", "status");
    const grid = el("div", null, "poster-grid");
    grid.dataset.catalogLayout = route.layout;
    const problem = el("div", null, "list-problem");
    if (discovery || library || route.name === "actor") controls.append(search(route, update));
    if (discovery) {
        controls.append(actionRow(...displayOptions.map(([key, label]) => actions(label, () => {
            route.mode = key;
            refresh(true);
        }, route.mode === key))));
        if (route.mode === "category") controls.append(actionRow(...categories.map(name => actions(name, () => {
            route.filters.category = route.filters.category === name ? "" : name;
            refresh(true);
        }, route.filters.category === name))));
    }
    if (follow) {
        const pending = works.filter(work => work.origins && store.follow(work.id) === "pending").length;
        controls.append(el("p", `${pending} 部待处理`, "queue-total"), actionRow(...Object.entries(followLabels)
            .map(([key, label]) => actions(label, () => { route.follow = key; refresh(true); }, route.follow === key))));
    }
    const { flags: selectedFlags, actor, category, collection, rated } = route.filters;
    const selectedFilters = [actor, category, collections[collection]?.name, ...selectedFlags.map(key => STATE_LABELS[key]), rated && "已评分"].filter(Boolean);
    controls.append(actionRow(actions(selectedFilters.length ? `筛选 · ${selectedFilters.length}` : "筛选", () => configure(route)),
        ...(!ranking ? [actions("排序", () => configure(route, true))] : []),
        ...(!follow ? [actions(route.layout === "grid" ? "列表" : "网格", () => {
            route.layout = route.layout === "grid" ? "list" : "grid";
            refresh();
        })] : []),
        ...(library && !route.selection ? [actions("多选", () => { route.selection = new Set(); refresh(); })] : [])));
    const orderName = [...catalogOrders, ...libraryOrders].find(([key]) => key === route.sort)?.[1];
    const context = [...selectedFilters, !ranking && !["source", "updated"].includes(route.sort) && orderName].filter(Boolean);
    if (context.length) controls.append(el("p", context.join(" · "), "active-filters"));
    if (route.selection) controls.append(batch(route));
    root.append(controls, count, problem, grid);

    if (discovery && scenario === "loading") {
        const timer = setTimeout(() => { scenario = "ready"; update(); }, 620);
        scope.addCleanup(() => clearTimeout(timer));
    }

    function update() {
        let listed = listFor(route);
        problem.replaceChildren();
        if (discovery) {
            if (scenario === "empty" || scenario === "loading") listed = [];
            if (scenario === "fail-once") {
                listed = listed.slice(0, 8);
                problem.append(el("p", "后续结果加载失败，已保留已有作品。"),
                    actions("重试", () => { scenario = "ready"; refresh(); }));
            }
        }
        count.textContent = discovery && scenario === "loading" ? "正在加载…" : `${listed.length} 部作品`;
        grid.replaceChildren(...listed.map(work => workCard(work, route)));
        if (!listed.length && !(discovery && (scenario === "loading" || scenario === "fail-once"))) {
            grid.append(el("p", "没有符合条件的作品", "empty-result"));
        }
        applyPrivacy();
    }
    update();
}
