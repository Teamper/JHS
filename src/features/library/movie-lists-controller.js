// @ts-check
import { mountEnhancementAction } from "../../ui/detail/enhancement-actions.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { readOwnedMovieContext } from "../../core/movie-context.js";

export const MOVIE_LISTS_STYLES = `
.jhs-movie-lists{padding:var(--jhs-space-4);box-sizing:border-box;display:grid;gap:var(--jhs-space-3);color:var(--jhs-text)}
.jhs-movie-lists [hidden]{display:none!important}
.jhs-list-controls,.jhs-list-task-actions{display:flex;flex-wrap:wrap;gap:var(--jhs-space-2);align-items:center}
.jhs-list-directory,.jhs-list-range,.jhs-list-task-results{max-height:220px;overflow:auto;overscroll-behavior:contain}
.jhs-list-directory{display:grid;gap:var(--jhs-space-2);padding:var(--jhs-space-2);border:1px solid var(--jhs-border);border-radius:var(--jhs-radius-md)}
.jhs-list-directory label{display:flex;gap:var(--jhs-space-2);align-items:center;overflow-wrap:anywhere}
.jhs-list-task{display:grid;gap:var(--jhs-space-2);padding:var(--jhs-space-3);border:1px solid var(--jhs-border);border-radius:var(--jhs-radius-md)}
.jhs-list-task summary,.jhs-list-task p{overflow-wrap:anywhere}
`;

export class MovieListsController {
    /** @param {{host:any, service:any, scope:LifecycleScope, dialog:any, ui:any}} options */
    constructor(options) {
        this.host = options.host;
        this.service = options.service;
        this.scope = options.scope;
        this.dialog = options.dialog;
        this.ui = options.ui;
        this.document = /** @type {Document} */ (this.host.document);
        this.viewScope = /** @type {LifecycleScope|null} */ (null);
    }
    start() {
        /** @type {Map<Element,{button:HTMLButtonElement,scope:LifecycleScope}>} */ const entries = new Map();
        const scan = () => {
            const targets = [...this.document.querySelectorAll("[data-jhs-movie-code]")];
            const native = this.host.readMovieRef();
            const detail = this.host.detectRoute() === "detail" ? this.host.locateDetailSlots()?.summary || this.host.locateDetailRoot() : null;
            if (detail && native?.stateEligibility?.eligible) targets.push(detail);
            for (const [element, entry] of entries) if (!element.isConnected || !entry.button.isConnected || !targets.includes(element)) { entry.scope.dispose(); entries.delete(element); }
            for (const element of targets) {
                if (entries.has(element)) continue;
                const scope = new LifecycleScope("lists:entry"), release = this.scope.addCleanup(() => scope.dispose());
                const button = this.document.createElement("button");
                button.type = "button";
                button.className = "jhs-btn jhs-btn--secondary";
                button.textContent = "JavDB 清单";
                scope.listen(button,"click",() => {
                    const context = readOwnedMovieContext(element);
                    const id = context?.movieId;
                    const movie = context ? {carNum:context.carNum,url:typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? `${this.document.location.origin}/v/${id}` : context.detailUrl} : this.host.readMovieRef();
                    void this.open([movie]).catch(error => { if (!scope.disposed) this.dialog.alert(error.message || "清单打开失败，请重试", { ui: { size: "sm", body: "scroll" } }); });
                });
                mountEnhancementAction(element, button, scope);
                entries.set(element,{button,scope});
                scope.addCleanup(() => { button.remove(); release(); });
            }
        };
        scan();
        this.scope.observe(this.document.body, records => {
            if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1))) scan();
        }, {childList:true,subtree:true});
        this.scope.addCleanup(() => { for (const entry of entries.values()) entry.scope.dispose(); entries.clear(); });
    }
    /** @param {any[]} [movies] */
    async open(movies = []) {
        if (this.viewScope && !this.viewScope.disposed) return;
        const scope = new LifecycleScope("lists:workspace");
        this.viewScope = scope;
        const release = this.scope.addCleanup(() => scope.dispose());
        scope.addCleanup(release);
        const root = this.document.createElement("section");
        root.className = "jhs-movie-lists jhs-ui";
        const status = this.document.createElement("p"), controls = this.document.createElement("div"), directory = this.document.createElement("div"), preview = this.document.createElement("section"), taskArea = this.document.createElement("section");
        status.setAttribute("role", "status");
        status.textContent = "正在核对网页账号";
        controls.className = "jhs-list-controls";
        directory.className = "jhs-list-directory jhs-scrollbar";
        preview.hidden = true;
        const search = this.document.createElement("input"), movieSelect = this.document.createElement("select"), mode = this.document.createElement("select");
        search.type = "search";
        search.className = "jhs-field";
        search.placeholder = "搜索现有清单";
        search.setAttribute("aria-label", "搜索现有清单");
        movieSelect.className = mode.className = "jhs-field";
        movieSelect.setAttribute("aria-label", "查看此影片的成员状态");
        mode.setAttribute("aria-label", "目标成员状态");
        for (const [value, text] of [["add", "加入所选清单"], ["remove", "移出所选清单"]]) { const option = this.document.createElement("option"); option.value = value; option.textContent = text; mode.append(option); }
        const button = (/** @type {string} */ label, /** @type {()=>any} */ action, /** @type {HTMLElement} */ parent) => {
            const node = this.document.createElement("button");
            node.type = "button";
            node.className = "jhs-btn jhs-btn--secondary";
            node.textContent = label;
            scope.listen(node, "click", () => Promise.resolve().then(action).catch(error => { if (!scope.disposed) { status.className = "jhs-field-error"; status.textContent = error.message || "清单操作失败"; } }));
            parent.append(node);
            return node;
        };
        /** @type {Map<string, any>} */ const taskViews = new Map();
        const renderTask = (/** @type {any} */ progress) => {
            if (scope.disposed) return;
            const task = progress.task;
            let view = taskViews.get(task.id);
            if (!view) {
                const section = this.document.createElement("details"), title = this.document.createElement("summary"), counts = this.document.createElement("p"), actions = this.document.createElement("div"), results = this.document.createElement("ul");
                section.className = "jhs-list-task";
                actions.className = "jhs-list-task-actions";
                results.className = "jhs-list-task-results jhs-scrollbar";
                const range = this.document.createElement("details"), caption = this.document.createElement("summary"), members = this.document.createElement("ul");
                caption.textContent = "查看任务影片与清单";
                members.className = "jhs-list-range jhs-scrollbar";
                for (const name of [...task.movies.map((/** @type {any} */ movie) => movie.carNum), ...task.lists.map((/** @type {any} */ list) => list.name)]) {
                    const item = this.document.createElement("li"); item.setAttribute("data-jhs-library-code", ""); item.textContent = name; members.append(item);
                }
                range.append(caption,members);
                section.append(title, counts, range, actions, results);
                const resume = button("核对状态并继续", async () => {
                    try { await this.service.resume(task.id); }
                    finally { if (!scope.disposed) await Promise.all([refreshTasks(),loadDirectory()]); }
                }, actions);
                const stop = button("停止并等待结算", () => this.service.stop(task.id), actions);
                section.open = task.state === "running";
                taskArea.append(section);
                view = { section, title, counts, resume, stop, results, rows:new Map() };
                taskViews.set(task.id, view);
            }
            view.title.textContent = `${task.checked ? "加入" : "移出"} ${task.movies.length} 部影片 × ${task.lists.length} 个清单 · ${task.accountLabel || "网页账号"} · ${task.state === "complete" ? "完成" : task.state === "running" ? "执行中" : task.state === "account-changed" ? "账号待核对" : "可恢复"}`;
            view.counts.textContent = `成功 ${progress.counts.success}，失败 ${progress.counts.failed}，待确认 ${progress.counts.unknown}，未开始 ${progress.counts.unstarted}`;
            view.resume.disabled = task.state === "running" || task.state === "complete";
            view.stop.disabled = task.state !== "running";
            for (const result of progress.results) {
                let row = view.rows.get(result.key);
                if (!row) { row = this.document.createElement("li"); row.setAttribute("data-jhs-library-code", ""); view.results.append(row); view.rows.set(result.key,row); }
                const [movie, list] = result.key.split("/").map(Number);
                const labels = /** @type {Record<string,string>} */ ({success:"成功",failed:"失败",unknown:"待确认",checking:"核对中",submitting:"提交中"});
                row.textContent = `${task.movies[movie].carNum} · ${task.lists[list].name} · ${labels[result.state]} ${result.message || ""}`;
            }
        };
        scope.listen(this.service, "lists.progress", event => renderTask(/** @type {CustomEvent} */ (event).detail));
        const refreshTasks = async () => {
            for (const task of await this.service.listTasks()) {
                scope.assertActive();
                try { renderTask(await this.service.inspect(task)); }
                catch { if (!scope.disposed) { status.className = "jhs-field-error"; status.textContent = "部分清单恢复记录无法安全读取，已保留记录"; } }
            }
        };
        root.append(status, controls, directory, preview, taskArea);
        root.style.display = "none";
        this.document.body.append(root);
        let closed = false, id = 0;
        scope.addCleanup(() => { if (!closed && id) this.dialog.close(id); root.remove(); });
        try { id = this.dialog.open({type:1, title:"JavDB 现有清单", content:this.ui.jquery(root), ui:{size:"lg",body:"scroll"}, end:() => { closed = true; scope.dispose(); }}); }
        catch (error) { scope.dispose(); throw error; }
        /** @type {any} */ let access = null;
        /** @type {any[]} */ let selectedMovies = [];
        /** @type {any[]} */ let lists = [];
        /** @type {Map<string,{label:HTMLLabelElement,input:HTMLInputElement,text:HTMLElement}>} */ const rows = new Map();
        /** @type {Set<string>} */ const selectedLists = new Set();
        let generation = 0, directoryGeneration = 0, busy = false;
        const filter = () => { for (const [key, row] of rows) row.label.hidden = !lists.find(list => list.id === key)?.name.toLowerCase().includes(search.value.trim().toLowerCase()); };
        const load = async () => {
            const current = ++generation;
            preview.hidden = true;
            status.className = "";
            status.textContent = "正在核对账号与清单目录";
            try {
                const nextAccess = await this.service.access(scope);
                scope.assertActive();
                if (current !== generation) return;
                if (access?.account?.fingerprint !== nextAccess.account?.fingerprint) selectedLists.clear();
                access = nextAccess;
                try { selectedMovies = movies.length ? this.service.normalizeMovies(movies, access.origin) : []; }
                catch (error) { selectedMovies = []; status.className = "jhs-field-error"; status.textContent = /** @type {Error} */ (error).message; }
                movieSelect.replaceChildren();
                for (const movie of selectedMovies) { const option = this.document.createElement("option"); option.value = movie.videoId; option.textContent = movie.carNum; movieSelect.append(option); }
                movieSelect.disabled = !selectedMovies.length;
                await loadDirectory();
                if (!scope.disposed && current === generation) {
                    status.className = "";
                    status.textContent = `${access.account?.label || "账号未核对"}。${access.reason || `已选 ${selectedMovies.length} 部影片，每部影片按所选清单依次处理`}${movies.length && !selectedMovies.length ? "。所选影片缺少当前 JavDB 链接，成员操作保持只读" : ""}`;
                }
            } catch (error) { if (!scope.disposed && current === generation) { status.className = "jhs-field-error"; status.textContent = /** @type {Error} */ (error).message; } }
        };
        const loadDirectory = async () => {
            if (!access) return;
            const current = ++directoryGeneration, videoId = movieSelect.value || null;
            const result = await this.service.directory(access, videoId, scope);
            if (scope.disposed || current !== directoryGeneration) return;
            lists = result;
            for (const [key,row] of rows) if (!lists.some(list => list.id === key)) { row.label.remove(); rows.delete(key); selectedLists.delete(key); }
            for (const list of lists) {
                let row = rows.get(list.id);
                if (!row) {
                    const label = this.document.createElement("label"), input = this.document.createElement("input"), text = this.document.createElement("span");
                    input.type = "checkbox";
                    input.className = "jhs-checkbox";
                    label.append(input,text);
                    directory.append(label);
                    scope.listen(input,"change",() => { input.checked ? selectedLists.add(list.id) : selectedLists.delete(list.id); preview.hidden = true; });
                    row = {label,input,text}; rows.set(list.id,row);
                }
                row.input.disabled = list.disabled || !access.writable || !selectedMovies.length;
                if (row.input.disabled) selectedLists.delete(list.id);
                row.input.checked = selectedLists.has(list.id);
                row.text.textContent = `${list.name}${videoId ? list.checked ? " · 已加入当前影片" : " · 未加入当前影片" : ""}${list.disabled ? " · 不可操作" : ""}`;
            }
            filter();
        };
        button("预览操作范围", () => {
            if (busy || !access?.writable || !selectedMovies.length || !selectedLists.size) throw new Error("请核对账号并选择影片与可操作清单");
            const chosen = lists.filter(list => selectedLists.has(list.id));
            const operation = mode.value === "add";
            const summary = this.document.createElement("p"), range = this.document.createElement("ul"), confirm = this.document.createElement("button");
            summary.textContent = `${access.account.label}，${operation ? "加入" : "移出"} ${selectedMovies.length} 部影片与 ${chosen.length} 个清单。网站确认目标状态后计入成功。`;
            range.className = "jhs-list-range jhs-scrollbar";
            for (const value of [...selectedMovies.map(movie => movie.carNum), ...chosen.map(list => list.name)]) { const item = this.document.createElement("li"); item.setAttribute("data-jhs-library-code",""); item.textContent = value; range.append(item); }
            confirm.type = "button";
            confirm.className = "jhs-btn jhs-btn--primary";
            confirm.textContent = "确认并开始";
            const fingerprint = access.account.fingerprint, rangeMovies = [...selectedMovies];
            scope.listen(confirm, "click", async () => {
                if (busy) return;
                busy = true; confirm.disabled = true;
                try {
                    const task = await this.service.createTask({movies:rangeMovies, lists:chosen, checked:operation, expectedAccount:fingerprint}, scope);
                    if (scope.disposed) return;
                    preview.hidden = true;
                    // Execution outlives this view. Closing only collapses the progress UI.
                    await this.service.resume(task.id);
                } catch (error) { if (!scope.disposed) status.textContent = /** @type {Error} */ (error).message; }
                finally { busy = false; if (!scope.disposed) { confirm.disabled = false; await Promise.all([refreshTasks(),loadDirectory()]); } }
            });
            preview.replaceChildren(summary,range,confirm);
            preview.hidden = false;
            confirm.focus();
        }, controls);
        controls.prepend(search, movieSelect, mode);
        button("刷新账号与目录", load, controls);
        button("刷新恢复记录", refreshTasks, controls);
        scope.listen(search,"input",filter);
        scope.listen(movieSelect,"change",() => { preview.hidden = true; void loadDirectory().catch(error => { if (!scope.disposed) status.textContent = error.message; }); });
        scope.listen(mode,"change",() => { preview.hidden = true; });
        await Promise.allSettled([load(), refreshTasks()]);
    }
}
