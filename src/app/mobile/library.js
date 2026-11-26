// @ts-check
import { getMovieStateEligibility, normalizeMovieCarNum } from "../../core/movie-identity.js";
import { createListEvaluationContext, evaluateListItem } from "../../features/list/list-evaluator.js";
import { DEFAULT_QUICK_FILTER_OPTIONS } from "../../core/list-filters.js";
import { button, el, image, input, select, sheet, STATE_LABELS } from "./components.js";
import { movieTitle } from "./title-translation.js";
import { renderMoviePoster } from "./movie-poster.js";
import { parseBooleanSetting } from "../../core/feature-helpers.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { appendCatalogItems, catalogOrders, libraryOrders, orderMovies, restoreWork, retainMovieSelection, sorting, viewToggle, visibleWork } from "./browse-controls.js";

/** @typedef {import("../../core/lifecycle-scope.js").LifecycleScope} Scope */
/** @typedef {ReturnType<typeof createListEvaluationContext>} ListEvaluation */

const recentKey = "android_recent_catalog";
const catalogCategories = [["all", "最新作品"], ["censored", "有码"], ["uncensored", "无码"],
    ["western", "欧美"], ["fc2", "FC2"], ["anime", "动画"]];
const catalogRankings = [["movies", "影片排行"], ["playback", "热播"], ["top", "TOP250"], ["actors", "演员排行"], ["fanza_award", "FANZA"]];
const rankingsWithCategory = ["movies", "top"];
const rankingsWithPeriod = ["movies", "playback"];

/** @param {any} storage */
export function createRecentWorks(storage) {
    let write = Promise.resolve();
    async function read() {
        const value = await storage.getItem(recentKey);
        return Array.isArray(value) ? value : [];
    }
    return {
        async list() {
            await write;
            return read().catch(() => []);
        },
        remember(/** @type {any} */ movie) {
            const { id, carNum, title, url, coverUrl } = movie;
            if (!id || !getMovieStateEligibility(movie).eligible) return;
            write = write.then(async () => {
                const previous = await read();
                const latest = { id, carNum, title, url, coverUrl };
                await storage.setItem(recentKey, [latest, ...previous.filter(item => item.id !== id)].slice(0, 8));
            }).catch(() => {});
        },
    };
}

/** @param {any} record @param {any} app @param {Map<string,any> | null} selection @param {() => void} [selected] @param {Record<string, any>} [detail] */
export function movieCard(record, app, selection, selected, detail) {
    const card = renderMoviePoster(record, () => {
        if (!selection) { void app.go({ name: "detail", record, ...detail }); return; }
        if (selection.has(record.carNum)) selection.delete(record.carNum);
        else selection.set(record.carNum, record);
        card.setAttribute("aria-pressed", String(selection.has(record.carNum)));
        selected?.();
    });
    if (selection) {
        card.disabled = !(record.stateEligibility ?? getMovieStateEligibility(record.carNum)).eligible;
        card.setAttribute("aria-pressed", String(selection.has(record.carNum)));
    }
    return card;
}

/** @param {any} actor @param {any} app */
function openActor(actor, app) {
    const id = actor.id || actor.starId;
    return app.go({ name: "actor", actor: { ...actor, id } });
}

/** @param {HTMLElement} root @param {any} app @param {any} state @param {Scope} scope */
export async function showBrowse(root, app, state, scope) {
    const replace = (/** @type {Record<string,any>} */ next) =>
        app.replace({ name: "browse", layout: state.layout, order: state.order, ...next });
    const dock = el("div", null, "search-dock");
    const form = el("form");
    const q = input("search", "搜索番号、标题或演员", state.q);
    q.dataset.contentSensitive = "";
    q.maxLength = 120;
    q.enterKeyHint = "search";
    const mode = select([["movie", "作品"], ["actor", "演员"], ["advanced", "进阶"]], "搜索类型");
    mode.value = state.mode || "movie";
    const submit = el("button", "搜索", "quiet-action");
    form.append(q, submit);
    const shortcuts = el("div", null, "catalog-shortcuts actions");
    const filters = sheet(root, "筛选", scope);
    const fields = el("div", null, "filter-fields");
    const category = select(catalogCategories, "分类");
    category.value = state.category || "all";
    const ranking = select([["", "分类浏览"], ...catalogRankings], "榜单");
    ranking.value = state.ranking || "";
    const period = select([["daily", "日榜"], ["weekly", "周榜"], ["monthly", "月榜"]], "排行周期");
    period.value = state.period || "daily";
    const advancedKind = select([["", "全部类型"], ["1", "有码"], ["2", "无码"], ["3", "FC2"], ["4", "欧美"]], "进阶类型");
    advancedKind.value = state.advancedKind || "";
    const tag = select([["", "全部标签"], ...(state.tag ? [[state.tag, state.tagLabel]] : [])], "标签");
    tag.value = state.tag || "";
    /** @param {string} label @param {HTMLElement} control */
    function field(label, control) {
        const row = el("label");
        row.append(el("span", label), control);
        fields.append(row);
        return row;
    }
    field("搜索", mode);
    const advanced = field("进阶类型", advancedKind);
    const categoryRow = field("分类", category);
    const rankingRow = field("榜单", ranking);
    const periods = field("周期", period);
    const tagRow = field("标签", tag);
    const tagFeedback = el("div", null, "catalog-feedback");
    const isSearching = () => Boolean(q.value.trim()) || mode.value === "advanced";
    const updateFields = () => {
        const searching = isSearching();
        const rank = searching ? "" : ranking.value;
        advanced.hidden = mode.value !== "advanced";
        categoryRow.hidden = searching || (Boolean(rank) && !rankingsWithCategory.includes(rank));
        rankingRow.hidden = searching;
        periods.hidden = !rankingsWithPeriod.includes(rank);
        tagRow.hidden = searching || Boolean(rank);
        tagFeedback.hidden = tagRow.hidden;
        if (tagRow.hidden) facets?.dispose();
        else if (filters.open) void loadTags();
    };
    mode.onchange = ranking.onchange = updateFields;
    let loadedCategory = "";
    /** @type {LifecycleScope|undefined} */ let facets;
    async function loadTags() {
        const current = category.value;
        if (loadedCategory === current) return;
        facets?.dispose();
        const owner = facets = new LifecycleScope("android:tags");
        const release = scope.addCleanup(() => owner.dispose());
        owner.addCleanup(release);
        tagFeedback.textContent = "正在读取标签…";
        tag.disabled = true;
        const result = await app.readCatalog("/v1/browse", { category: current, facets: "1" }, owner, tagFeedback, () => loadTags());
        if (owner.disposed) return;
        tag.disabled = false;
        if (!result) {
            if (!tagFeedback.querySelector("button")) tagFeedback.append(button("重试标签", () => loadTags()));
            return;
        }
        loadedCategory = current;
        const selected = tag.value;
        tag.replaceChildren(new Option("全部标签", ""), ...(result.facets ?? []).map((/** @type {any} */ entry) =>
            new Option(entry.label, entry.key + "=" + entry.value)));
        tag.value = selected && [...tag.options].some(option => option.value === selected) ? selected : "";
        if (!result.facets?.length) tagFeedback.textContent = "此分类暂无标签";
    }
    category.onchange = () => {
        loadedCategory = "";
        tag.replaceChildren(new Option("全部标签", ""));
        updateFields();
    };
    scope.listen(filters, "close", () => { facets?.dispose(); });
    const startSearch = (/** @type {string} */ searchMode, /** @type {string} */ kind) =>
        replace({ q: q.value.trim(), search: true, mode: searchMode, quick: state.quick,
            ...(searchMode === "advanced" && kind ? { advancedKind: kind } : {}) });
    const apply = () => {
        filters.close();
        if (isSearching()) {
            void startSearch(mode.value, advancedKind.value);
            return;
        }
        const rank = ranking.value;
        const categoryValue = !rank || rankingsWithCategory.includes(rank) ? category.value : "all";
        const browse = { category: categoryValue, mode: mode.value, quick: state.quick };
        if (rank) {
            void replace({ ...browse, ranking: rank, period: period.value });
            return;
        }
        void replace({ ...browse, tag: tag.value, tagLabel: tag.value ? tag.selectedOptions[0]?.text : "" });
    };
    form.addEventListener("submit", event => {
        event.preventDefault();
        q.blur();
        if (!q.value.trim()) { void replace({ category: state.category }); return; }
        void startSearch(state.mode || "movie", state.advancedKind || "");
    });
    filters.append(fields, tagFeedback, button("应用筛选", apply, "primary"));
    /** @param {string} label @param {string[][]} choices @param {(key:string)=>any} activate */
    function picker(label, choices, activate) {
        const menu = sheet(root, label, scope);
        for (const [key, text] of choices) menu.append(button(text, () => {
            menu.close();
            void activate(key);
        }, "settings-link"));
        return button(label, () => menu.showModal(), "quiet-action");
    }
    shortcuts.append(button("最新", () => replace({}), "quiet-action"),
        picker("分类", catalogCategories, key => replace({ category: key })),
        picker("榜单", catalogRankings, key => replace({ ranking: key, period: "daily" })),
        button("筛选", () => {
            mode.value = state.mode || "movie";
            category.value = state.category || "all";
            ranking.value = state.ranking || "";
            period.value = state.period || "daily";
            advancedKind.value = state.advancedKind || "";
            if (loadedCategory !== category.value) tag.replaceChildren(new Option("全部标签", ""), ...(state.tag ? [new Option(state.tagLabel, state.tag)] : []));
            tag.value = state.tag || "";
            filters.showModal();
            updateFields();
        }, "quiet-action"));
    dock.append(form);
    root.append(dock, shortcuts);
    /** @type {((evaluation: ListEvaluation) => void) | undefined} */ let renderRecent;
    if (!state.search && !state.ranking && !state.tag && (!state.category || state.category === "all")) {
        /** @type {{id:string,carNum:string,title:string}[]} */
        const recent = await app.recentWorks.list();
        scope.assertActive();
        if (recent.length) {
            const section = el("section", null, "section");
            const gallery = el("div", null, "recent-catalog");
            section.hidden = true;
            /** @type {string[]} */ let shown = [];
            renderRecent = evaluation => {
                const visible = recent.filter(movie => !evaluateListItem(movie, evaluation).hardHidden).slice(0, 4);
                if (visible.length === shown.length && visible.every((movie, index) => movie.id === shown[index])) return;
                shown = visible.map(movie => movie.id);
                gallery.replaceChildren(...visible.map(movie => {
                    const card = movieCard(movie, app, null);
                    card.removeAttribute("data-work");
                    return card;
                }));
                section.hidden = !visible.length;
            };
            section.append(el("h2", "继续浏览", "catalog-heading"), gallery);
            root.append(section);
        }
    }
    const heading = el("h2", state.search ? "搜索结果" : state.ranking ? ranking.selectedOptions[0]?.text
        : category.selectedOptions[0]?.text || "最新作品", "catalog-heading");
    root.append(heading);
    const applied = [state.category && state.category !== "all" ? category.selectedOptions[0]?.text : "", state.tagLabel,
        rankingsWithPeriod.includes(state.ranking) ? period.selectedOptions[0]?.text : "",
        state.search && state.mode === "actor" ? "演员" : ""];
    if (state.search && state.mode === "advanced") applied.push("进阶", state.advancedKind ? advancedKind.selectedOptions[0]?.text : "");
    const appliedLabels = [...new Set(applied.filter(Boolean))];
    if (appliedLabels.length) root.append(el("p", appliedLabels.join(" · "), "active-filters"));
    let path = "/v1/browse";
    /** @type {Record<string,string>} */ let params = {};
    if (state.search) {
        path = "/v1/search";
        params = { mode: state.mode, q: state.q, ...(state.mode === "advanced" && state.advancedKind ? { type: state.advancedKind } : {}) };
    } else if (state.ranking) {
        path = "/v1/rankings/" + state.ranking;
        if (rankingsWithPeriod.includes(state.ranking)) params.p = state.period;
        if (rankingsWithCategory.includes(state.ranking) && state.category && state.category !== "all") params.t = state.category;
    } else {
        params.category = state.category || "all";
        if (state.tag) Object.assign(params, Object.fromEntries(new URLSearchParams(state.tag)));
    }
    await showResults(root, app, state, path, params, scope, state.search ? state.mode === "actor" : state.ranking === "actors", renderRecent);
}

/** @param {HTMLElement} root @param {any} app @param {any} state @param {string} path @param {Record<string,string>} params @param {Scope} scope @param {boolean} [actors] @param {(evaluation: ListEvaluation) => void} [renderRecent] */
async function showResults(root, app, state, path, params, scope, actors = false, renderRecent) {
    const area = el("div", null, "poster-grid section");
    const selection = state.selection ??= new Map();
    const selectedMode = state.selectedMode ??= { value: false };
    const actions = el("div", null, "actions catalog-result-actions");
    const count = el("p", null, "catalog-count");
    /** @type {any[]} */ const items = state.items ??= [];
    const quick = select(DEFAULT_QUICK_FILTER_OPTIONS.map(({value, label}) => [value, label]), "作品状态");
    quick.classList.add("catalog-quick-filter");
    quick.value = state.quick || "all";
    let evaluation = createListEvaluationContext();
    let filtersReady = false;
    let filterRevision = 0;
    const refreshFilters = async (drawResults = true) => {
        const revision = ++filterRevision;
        const storage = app.services.legacyStorage, state = app.services.state;
        const [titleKeywords, blacklist, works, carMap, favorites, activity] = await Promise.all([
            storage.getTitleFilterKeyword(), storage.getBlacklistMap(), storage.getBlacklistCarList(),
            state.getCarMap(), state.getFavoriteActressList(), state.getActivityLog(),
        ]);
        if (scope.disposed || revision !== filterRevision) return;
        const actorCarNumToNameMap = new Map(), actressCarNumToNameMap = new Map(), recentCarNums = new Set();
        for (const item of works) {
            const role = blacklist.get(item.starId)?.role;
            const key = normalizeMovieCarNum(item.carNum);
            if (role && key) (role === "actor" ? actorCarNumToNameMap : actressCarNumToNameMap).set(key, item.names);
        }
        for (const entry of activity.entries || []) {
            if (entry.commitState !== "committed" || Date.parse(entry.createdAt) < Date.now() - 604800000) continue;
            for (const change of entry.changes) {
                if (change.undoState !== "reverted" && change.fields?.some((/** @type {string} */ field) => field.startsWith("stateFlags."))) recentCarNums.add(change.carNum);
            }
        }
        evaluation = createListEvaluationContext({ titleKeywords, carMap, actorCarNumToNameMap, actressCarNumToNameMap, recentCarNums, favoriteActresses: favorites, settings: app.services.settings.snapshot() });
        filtersReady = true;
        if (drawResults) render();
        else renderRecent?.(evaluation);
    };
    if (!actors) {
        if (!state.ranking) {
            const orders = state.search ? [["source", "相关性"], ...catalogOrders.slice(1)] : catalogOrders;
            actions.append(sorting(root, scope, orders, state.order || "source", key => { state.order = key; render(false); }));
        }
        actions.append(viewToggle(app, scope, area, state));
        const choose = button("多选", () => {
            selectedMode.value = !selectedMode.value;
            choose.setAttribute("aria-pressed", String(selectedMode.value));
            if (!selectedMode.value) selection.clear();
            render();
        }, "quiet-action");
        const batch = el("div", null, "actions");
        const batchCount = el("span");
        batchCount.setAttribute("role", "status");
        batch.append(batchCount);
        const undo = button("撤销批量标记", () => app.run(scope, async () => {
            const result = await app.services.state.undoTransaction(state.catalogUndo);
            state.catalogUndo = null;
            if (scope.disposed) return;
            undo.hidden = true;
            app.services.notifications.info(result.conflicts?.length ? "部分记录已变化，请查看鉴定记录" : "已撤销批量标记");
            await refreshFilters();
        }), "quiet-action");
        const updateBatch = () => {
            batch.hidden = !selectedMode.value || !selection.size;
            batchCount.textContent = `已选 ${selection.size} 部`;
            undo.hidden = !state.catalogUndo;
        };
        choose.setAttribute("aria-pressed", String(selectedMode.value));
        updateBatch();
        for (const [flag, text] of Object.entries(STATE_LABELS)) batch.append(button(text, () => app.run(scope, async () => {
            if (!selection.size) throw new Error("请先选择影片");
            const result = await app.services.state.patch([...selection.keys()], { [flag]: true }, {
                preserveNewVideo: true,
                keepExistingNames: true,
                records: [...selection.values()].map(item => ({
                    carNum: item.carNum, url: item.url, names: item.title, title: item.title,
                    publishTime: item.releaseDate, actorNames: item.actorNames,
                })),
            });
            if (result.transactionId) state.catalogUndo = result.transactionId;
            selection.clear();
            if (scope.disposed) return;
            await refreshFilters();
        })));
        batch.append(button("存入清单", () => app.run(scope, () => app.openLists([...selection.values()]))));
        quick.onchange = () => { state.quick = quick.value; if (nextPage && !loading) failed = false; render(false); };
        actions.append(quick, choose, batch, undo);
        state.handleBack = () => {
            if (!selectedMode.value) return false;
            selectedMode.value = false;
            selection.clear();
            choose.setAttribute("aria-pressed", "false");
            render();
            return true;
        };
        scope.listen(area, "click", updateBatch);
        scope.listen(area, "jhs:results", updateBatch);
    }
    root.append(actions, count, area);
    if (!actors) {
        for (const event of ["car-state-changed", "car-records-removed", "actress-changed", "blacklist-rules-changed", "filter-rules-changed"]) {
            scope.addCleanup(app.events.on(event, () => app.run(scope, refreshFilters)));
        }
    }
    function render(keepPosition = true) {
        if (!actors && !filtersReady) return;
        const anchor = keepPosition ? visibleWork(area) : null;
        renderRecent?.(evaluation);
        const ordered = actors || state.ranking ? items : orderMovies(items, state.order || "source", { exact: normalizeMovieCarNum(params.q) });
        const actorNames = state.actor ? [state.actor.name] : undefined;
        const visible = actors ? ordered : ordered.flatMap(item => {
            const decision = evaluateListItem(item, evaluation, { filter: quick.value });
            if (!decision.matchesCurrentFilter || quick.value === "all" && decision.hardHidden) return [];
            return [{ ...item, actorNames, rank: state.ranking ? items.indexOf(item) + 1 : null, highlight: decision.favoriteActresses.length > 0 }];
        });
        if (!actors) retainMovieSelection(selection, visible);
        const cards = visible.map(item => {
            if (!actors) return movieCard(item, app, selectedMode.value ? selection : null);
            const node = button("", () => { void openActor(item, app); }, "poster catalog-item");
            node.append(image(item.coverUrl, "cover"), el("span", item.name, "card-label"));
            node.dataset.contentSensitive = "";
            return node;
        });
        area.replaceChildren(...cards);
        count.textContent = items.length ? `已加载 ${items.length} ${actors ? "位" : "部"}` + (visible.length !== items.length ? ` · 显示 ${visible.length}` : "") : "";
        if (!visible.length) area.append(el("p", "没有结果", "empty"));
        restoreWork(area, anchor);
        area.dispatchEvent(new Event("jhs:results"));
    }
    const load = async (/** @type {number} */ page) => {
        const result = await app.readCatalog(path, { ...params, ...(page > 1 ? { page: String(page) } : {}) }, scope, feedback, more);
        scope.assertActive();
        if (!result) { failed = true; next.textContent = "重试"; return; }
        failed = false;
        if (result.usedSession) state.firstSessionPage ??= { page, publicCount: items.length };
        appendCatalogItems(items, result.items);
        if (actors) render();
        else await refreshFilters();
        scope.assertActive();
        next.hidden = !result.nextPage;
        next.textContent = "加载更多";
        nextPage = state.nextPage = result.nextPage;
    };
    let nextPage = state.nextPage === undefined ? 1 : state.nextPage;
    let loading = false, failed = false;
    const more = async () => {
        if (!nextPage || loading || scope.disposed) return;
        if (!navigator.onLine) { feedback.textContent = "当前离线"; next.textContent = "重试"; return; }
        loading = true;
        next.disabled = true;
        next.textContent = "正在加载…";
        try { await load(nextPage); }
        catch (error) {
            if (!scope.disposed) feedback.textContent = /** @type {Error} */ (error).message || "目录读取失败";
        } finally {
            loading = false;
            if (!scope.disposed) {
                next.disabled = false;
                next.hidden = !nextPage;
                if (next.textContent === "正在加载…") { failed = true; next.textContent = "重试"; }
            }
        }
    };
    const next = button("加载更多", more, "quiet-action");
    const feedback = el("div", null, "catalog-feedback");
    root.append(feedback, next);
    if (parseBooleanSetting(app.services.settings.snapshot().autoPage, true)) {
        const observer = new IntersectionObserver(entries => {
            if (!failed && entries.some(entry => entry.isIntersecting)) void more();
        }, { rootMargin: "160px 0px" });
        scope.ownObserver(observer);
        observer.observe(next);
        scope.listen(window, "online", () => {
            if (nextPage && !failed && next.getBoundingClientRect().top < window.innerHeight + 160) void more();
            else if (nextPage) next.textContent = failed ? "重试" : "加载更多";
        });
    }
    if (state.nextPage !== undefined) {
        if (actors) render();
        else await refreshFilters();
        next.hidden = !nextPage;
    } else if (renderRecent) await Promise.all([refreshFilters(false), more()]);
    else await more();
}

/** @param {HTMLElement} root @param {any} app @param {any} state @param {Scope} scope */
export async function showActor(root, app, state, scope) {
    const { actor } = state;
    const favorite = button("收藏演员", () => app.run(scope, async () => {
        const existing = (await app.services.state.getFavoriteActressList()).some((/** @type {any} */ item) => String(item.starId) === actor.id);
        if (existing) await app.services.state.removeFavoriteActress(actor.id);
        else await app.services.state.addFavoriteActressList([{ starId: actor.id, name: actor.name, avatar: actor.coverUrl || "" }]);
        await refresh();
    }));
    const refresh = async () => {
        const saved = (await app.services.state.getFavoriteActressList()).some((/** @type {any} */ item) => String(item.starId) === actor.id);
        if (!scope.disposed) {
            favorite.textContent = saved ? "取消收藏" : "收藏演员";
            favorite.setAttribute("aria-pressed", String(saved));
        }
    };
    const blocked = button("屏蔽演员", () => app.run(scope, async () => {
        const stored = await app.services.state.getBlacklist();
        scope.assertActive();
        const existing = stored.some((/** @type {any} */ item) => String(item.starId) === String(actor.id));
        if (existing) await app.services.state.removeBlacklistActor(String(actor.id));
        else {
            const starId = String(actor.id);
            await app.services.state.addBlacklistItem({ starId, name: actor.name,
                role: actor.role === "actor" ? "actor" : "actress", url: new URL("/actors/" + starId, "https://javdb.com").href });
            const records = (state.items || []).filter((/** @type {any} */ movie) => getMovieStateEligibility(movie).eligible)
                .map((/** @type {any} */ movie) => ({ carNum: movie.carNum, url: movie.url, names: actor.name,
                    actionType: "filter", starId, publishTime: movie.releaseDate }));
            if (records.length) await app.services.state.batchSaveBlacklistCarList(records);
        }
        await app.events.emit("blacklist-rules-changed", { starId: actor.id });
        await refreshBlocked();
    }));
    const refreshBlocked = async () => {
        const stored = await app.services.state.getBlacklist();
        if (scope.disposed) return;
        const existing = stored.some((/** @type {any} */ item) => String(item.starId) === String(actor.id));
        blocked.textContent = existing ? "解除屏蔽" : "屏蔽演员";
        blocked.setAttribute("aria-pressed", String(existing));
    };
    const controls = el("div", null, "actions section");
    controls.append(favorite, blocked);
    root.append(controls);
    await refresh();
    await refreshBlocked();
    await showResults(root, app, state, `/v1/actors/${actor.id}/movies`, {}, scope);
}

/** @param {HTMLElement} root @param {any} app @param {any} state @param {Scope} scope */
export async function showLibrary(root, app, state, scope) {
    const links = el("div", null, "actions section");
    const management = sheet(root, "片库管理", scope);
    const destinations = el("div", null, "settings-group-list");
    for (const [label, route] of [["鉴定记录", "history"], ["演员收藏", "actors"], ["黑名单", "blacklist"]]) {
        destinations.append(button(label, () => { management.close(); void app.go({ name: route }); }, "settings-link"));
    }
    destinations.append(button("JavDB 清单", () => {
        management.close();
        void app.run(scope, () => app.openLists());
    }, "settings-link"));
    management.append(destinations);
    links.append(button("管理", () => management.showModal(), "quiet-action"));
    const form = el("div", null, "search-dock actions");
    const keyword = input("search", "搜索本地作品", state.q);
    keyword.dataset.contentSensitive = "";
    const filters = sheet(root, "片库筛选", scope);
    const flags = el("div", null, "filter-fields");
    const checks = new Map();
    for (const [key, label] of [...Object.entries(STATE_LABELS), ["rated", "有评分"], ["pending", "待鉴定"]]) {
        const control = el("input");
        control.type = "checkbox";
        const row = el("label", label);
        row.append(control);
        flags.append(row);
        checks.set(key, control);
    }
    const active = el("p", null, "active-filters");
    const filter = button("筛选", () => {
        for (const [key, control] of checks) control.checked = state.localFilters?.includes(key) === true;
        filters.showModal();
    }, "quiet-action");
    filters.append(flags, button("清除条件", () => { for (const control of checks.values()) control.checked = false; }),
        button("应用筛选", () => {
            state.localFilters = [...checks].filter(([, control]) => control.checked).map(([key]) => key);
            filters.close();
            state.count = count = 40;
            window.scrollTo(0, 0);
            render(false);
        }, "primary"));
    form.append(keyword, filter);
    const rows = el("div", null, "library-rows");
    const batch = el("div", null, "actions batch-actions");
    const selectedRecords = state.localSelection ??= new Map();
    const choose = button("多选", () => {
        state.localMulti = !state.localMulti;
        if (!state.localMulti) selectedRecords.clear();
        render();
    });
    links.append(choose);
    const layout = button("", () => { state.layout = state.layout === "grid" ? "list" : "grid"; render(); }, "quiet-action");
    links.append(layout);
    const batchText = el("p");
    batchText.setAttribute("role", "status");
    batch.append(batchText);
    /** @param {{transactionId:string|null}} outcome @param {string[]} targets */
    async function finishBatch(outcome, targets) {
        if (outcome.transactionId) state.localUndo = outcome.transactionId;
        for (const key of targets) selectedRecords.delete(key);
        await reload();
    }
    for (const [flag, label] of Object.entries(STATE_LABELS)) batch.append(button(label, () => app.run(scope, async () => {
        const targets = [...selectedRecords.keys()];
        const outcome = await app.services.state.patch(targets, { [flag]: true }, { preserveNewVideo: true, existingOnly: true });
        await finishBatch(outcome, targets);
    })));
    batch.append(button("管理清单", () => app.run(scope, () => app.openLists([...selectedRecords.values()]))));
    batch.append(button("移出片库", () => {
        const targets = [...selectedRecords.keys()];
        const dialog = sheet(root, "移出片库", scope, false);
        const actions = el("div", null, "actions sheet-actions");
        const cancel = button("取消", () => dialog.close(), "quiet-action");
        cancel.autofocus = true;
        const remove = button("移出", () => app.run(scope, async () => {
            remove.disabled = cancel.disabled = true;
            try {
                const outcome = await app.services.state.remove(targets);
                dialog.close();
                await finishBatch(outcome, targets);
            } finally { remove.disabled = cancel.disabled = false; }
        }), "primary");
        actions.append(cancel, remove);
        dialog.append(el("p", `将 ${targets.length} 部作品移出片库？`), actions);
        dialog.addEventListener("close", () => dialog.remove(), { once: true });
        dialog.showModal();
    }, "quiet-action"));
    const undo = button("撤销上次操作", () => app.run(scope, async () => {
        const outcome = await app.services.state.undoTransaction(state.localUndo);
        state.localUndo = null;
        if (scope.disposed) return;
        app.services.notifications.info(outcome.conflicts?.length ? "部分记录已变化，请查看鉴定记录" : "已撤销");
        await reload();
    }), "quiet-action");
    links.prepend(sorting(root, scope, libraryOrders, state.order || "updated", key => { state.order = key; render(); }));
    root.append(form, active, links, batch, undo, rows);
    /** @type {any[]} */ let records = [];
    /** @type {Record<string,{rating:number}>} */ let ratings = {};
    let count = state.count || 40;
    function render(keepPosition = true) {
        const anchor = keepPosition && window.scrollY > 0 ? visibleWork(rows) : null;
        choose.setAttribute("aria-pressed", String(Boolean(state.localMulti)));
        undo.hidden = !state.localUndo;
        const grid = state.layout === "grid";
        rows.classList.toggle("poster-grid", grid);
        layout.textContent = grid ? "紧凑列表" : "网格";
        /** @type {string[]} */ const applied = state.localFilters ?? [];
        active.textContent = applied.map(key => checks.get(key).parentElement.textContent).join(" · ");
        active.hidden = !applied.length;
        const text = keyword.value.trim().toLowerCase();
        const filtered = records.filter(record => {
            const flags = record.stateFlags || {};
            return applied.every(key => key === "pending" ? !Object.values(flags).some(Boolean)
                : key === "rated" ? Boolean(ratings[record.carNum]?.rating) : Boolean(flags[key]))
                && [record.carNum, record.names, record.title, record.actorNames, record.remark].some(value => String(value || "").toLowerCase().includes(text));
        });
        retainMovieSelection(selectedRecords, filtered);
        batch.hidden = !state.localMulti || !selectedRecords.size;
        batchText.textContent = `已选 ${selectedRecords.size} 部`;
        const selected = orderMovies(filtered, state.order || "updated", { ratings });
        rows.replaceChildren();
        for (const record of selected.slice(0, count)) {
            const activate = () => {
                if (!state.localMulti) { void app.go({ name: "detail", record, saved: true }); return; }
                if (selectedRecords.has(record.carNum)) selectedRecords.delete(record.carNum);
                else if (getMovieStateEligibility(record.carNum).eligible) selectedRecords.set(record.carNum, record);
                render();
            };
            const title = grid ? renderMoviePoster({ ...record, title: record.title || record.names || record.carNum }, activate)
                : button("", activate, "library-work catalog-item");
            title.dataset.work = record.carNum;
            if (state.localMulti) title.setAttribute("aria-pressed", String(selectedRecords.has(record.carNum)));
            let held = false;
            let timer = 0;
            let originX = 0, originY = 0;
            const stop = () => window.clearTimeout(timer);
            title.onpointerdown = event => {
                if (event.pointerType !== "touch" || !event.isPrimary || !getMovieStateEligibility(record.carNum).eligible) return;
                held = false;
                originX = event.clientX;
                originY = event.clientY;
                timer = window.setTimeout(() => {
                    if (scope.disposed || !title.isConnected) return;
                    held = true;
                    state.localMulti = true;
                    selectedRecords.set(record.carNum, record);
                    render();
                }, 500);
            };
            title.onpointermove = event => { if (Math.hypot(event.clientX - originX, event.clientY - originY) > 8) stop(); };
            title.onpointerup = title.onpointercancel = title.onlostpointercapture = stop;
            title.oncontextmenu = event => { if (held || event.pointerType === "touch") event.preventDefault(); };
            title.dataset.contentSensitive = "";
            /** @type {string[]} */ const tags = Object.entries(STATE_LABELS).filter(([key]) => record.stateFlags?.[key]).map(([, label]) => label);
            if (ratings[record.carNum]) tags.push(`${ratings[record.carNum].rating} 星`);
            const labels = grid ? title.querySelector(".card-label") : title;
            if (!grid) labels?.append(movieTitle("span", record.title || record.names || record.carNum, record.carNum));
            if (tags.length || !grid) labels?.append(el("span", [...(grid ? [] : [record.carNum]), ...tags].filter(Boolean).join(" · "), "movie-metadata"));
            if (record.remark) labels?.append(el("span", record.remark, "saved-movie-note"));
            rows.append(title);
        }
        if (!selected.length) rows.append(el("p", "暂无作品", "empty"));
        if (selected.length > count) rows.append(button("更多作品", () => { state.count = count += 40; render(); }));
        restoreWork(rows, anchor);
    }
    keyword.oninput = () => { state.count = count = 40; state.q = keyword.value; render(false); };
    state.handleBack = () => {
        if (!state.localMulti) return false;
        state.localMulti = false;
        selectedRecords.clear();
        render();
        return true;
    };
    const reload = async () => {
        const latest = await Promise.all([app.services.legacyStorage.getCarList(), app.services.state.getPersonalRatings()]);
        if (scope.disposed) return;
        [records, ratings] = latest;
        render();
    };
    for (const event of ["car-state-changed", "car-records-removed", "personal-rating-changed"]) {
        scope.addCleanup(app.events.on(event, reload));
    }
    await reload();
}

/** @param {HTMLElement} root @param {any} app @param {Scope} scope */
export async function showActors(root, app, scope) {
    const items = await app.services.state.getFavoriteActressList();
    scope.assertActive();
    const rows = el("div", null, "surface");
    if (!items.length) rows.append(el("p", "暂无收藏演员", "empty"));
    for (const item of items) {
        const row = el("div", null, "data-row actions");
        const title = button(item.name || item.starId, () => { void openActor(item, app); });
        title.dataset.contentSensitive = "";
        row.append(title, button("扫描新作", () => app.run(scope, () => app.tasks.checkOneNewVideo(item))));
        rows.append(row);
    }
    root.append(rows);
}
