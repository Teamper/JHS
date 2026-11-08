// @ts-check
import { mountEnhancementAction } from "../../ui/detail/enhancement-actions.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { normalizeCarNum } from "../../core/movie-identity.js";
import { readOwnedMovieContext } from "../../core/movie-context.js";
import { getIcon } from "../../core/icons.js";
import { translationErrorLabel } from "../../core/translation-model.js";
import { createTranslationConnections } from "../../ui/settings/translation-connections.js";
export class TranslationToolsController {
    /** @param {{host:any,service:any,settings:any,privacy:any,dialog:any,ui:any,scope:LifecycleScope,configure?:()=>any}} options */
    constructor(options) {
        this.configureCommand = options.configure;
        this.host = options.host;
        this.service = options.service;
        this.settings = options.settings;
        this.privacy = options.privacy;
        this.dialog = options.dialog;
        this.ui = options.ui;
        this.scope = options.scope;
        this.document = /** @type {Document} */ (options.host.document);
        this.configurationScope = /** @type {LifecycleScope|null} */ (null);
        this.workspaceScope = /** @type {LifecycleScope|null} */ (null);
    }
    start() {
        /** @type {Map<Element,{button:HTMLButtonElement,scope:LifecycleScope}>} */ const entries = new Map();
        const scan = () => {
            const targets = [...this.document.querySelectorAll("[data-jhs-movie-code]")];
            const native = this.host.readMovieRef(), detail = this.host.detectRoute() === "detail" ? this.host.locateDetailSlots()?.summary || this.host.locateDetailRoot() : null;
            if (detail && native?.stateEligibility?.eligible)
                targets.push(detail);
            for (const [element, entry] of entries)
                if (!element.isConnected || !entry.button.isConnected || !targets.includes(element)) {
                    entry.scope.dispose();
                    entries.delete(element);
                }
            for (const element of targets) {
                if (entries.has(element))
                    continue;
                const scope = new LifecycleScope("translation:entry"), release = this.scope.addCleanup(() => scope.dispose()), button = this.document.createElement("button");
                button.type = "button";
                button.className = "jhs-btn jhs-btn--secondary jhs-translation-entry";
                button.innerHTML = getIcon("sparkles");
                button.append("翻译");
                scope.listen(button, "click", () => {
                    const context = readOwnedMovieContext(element) || this.host.readMovieRef();
                    const titleRoot = readOwnedMovieContext(element) ? element : this.document;
                    const titleNode = titleRoot.querySelector(".origin-title") || titleRoot.querySelector(".jhs-fc2-original-title") || titleRoot.querySelector(".current-title") || titleRoot.querySelector("h1,.title.is-4,h3");
                    const title = titleNode?.textContent?.trim() || "";
                    void this.open([{ ...context, title }]).catch(error => { if (!scope.disposed)
                        this.dialog.alert(error.message || "无法打开翻译"); });
                });
                mountEnhancementAction(element, button, scope);
                entries.set(element, { button, scope });
                scope.addCleanup(() => { button.remove(); release(); });
            }
        };
        scan();
        this.scope.observe(this.document.body, records => {
            const changed = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => {
                const element = /** @type {Element} */ (node);
                return node.nodeType === 1 && !element.closest(".jhs-translation-entry,.jhs-translation-settings,.jhs-translation-workspace");
            }));
            if (changed) scan();
        }, { childList: true, subtree: true });
        this.scope.addCleanup(() => { this.configurationScope?.dispose(); this.workspaceScope?.dispose(); for (const entry of entries.values())
            entry.scope.dispose(); entries.clear(); });
    }
    /** @param {string} name */
    viewScope(name) { const scope = new LifecycleScope(name), release = this.scope.addCleanup(() => scope.dispose()); scope.addCleanup(release); return scope; }
    /** @param {HTMLElement} root @param {string} title @param {LifecycleScope} scope */
    mount(root, title, scope) {
        root.style.display = "none";
        this.document.body.append(root);
        let closed = false, id = 0;
        scope.addCleanup(() => { if (!closed && id)
            this.dialog.close(id); if (closed) root.remove(); });
        id = this.dialog.open({ type: 1, title, content: this.ui.jquery(root), ui: { size: "form", body: "scroll" }, end: () => { closed = true; root.remove(); scope.dispose(); } });
    }
    async configure() {
        if (this.configurationScope && !this.configurationScope.disposed)
            return;
        const scope = this.viewScope("translation:configuration");
        this.configurationScope = scope;
        try {
            const state = await this.service.getConfiguration();
            scope.assertActive();
            const root = createTranslationConnections({ document: this.document, scope, state, preferences: this.settings.snapshot(),
                onSave: async (value, revision) => { scope.assertActive(); await this.service.saveConfiguration(value, revision); return this.service.getConfiguration(); },
                onTest: (value, owner) => this.service.testConnection(value, owner),
                onPreferences: value => this.settings.patch(value),
            });
            this.mount(root, "翻译服务", scope);
        }
        catch (error) {
            scope.dispose();
            throw error;
        }
    }
    /** @param {any[]} movies */
    async open(movies) {
        if (this.workspaceScope && !this.workspaceScope.disposed)
            return;
        const unique = new Map(movies.map(movie => [normalizeCarNum(movie?.carNum), movie]));
        const selected = [...unique].filter(([code]) => Boolean(code)).map(([carNum, movie]) => ({ carNum, title: String(movie.title || "").trim() }));
        if (!selected.length)
            throw new Error("请先选择要翻译的影片");
        const scope = this.viewScope("translation:workspace");
        this.workspaceScope = scope;
        const root = this.document.createElement("section"), summary = this.document.createElement("p"), range = this.document.createElement("div"), actions = this.document.createElement("div"), status = this.document.createElement("p");
        root.className = "jhs-translation-workspace jhs-ui";
        range.className = "jhs-translation-range jhs-scrollbar";
        actions.className = "jhs-translation-actions";
        status.setAttribute("role", "status");
        summary.textContent = `已选择 ${selected.length} 部影片`;
        const rows = selected.map(movie => {
            const row = this.document.createElement("article"), code = this.document.createElement("strong"), source = this.document.createElement("p"), output = this.document.createElement("p"), meta = this.document.createElement("p");
            row.className = "jhs-translation-row";
            code.setAttribute("data-jhs-library-code", "");
            code.textContent = movie.carNum;
            source.className = output.className = "jhs-translation-output";
            source.textContent = movie.title || "缺少原始标题，暂不外发";
            meta.className = "jhs-translation-meta";
            meta.setAttribute("role", "status");
            meta.textContent = "未开始";
            row.append(code, source, output, meta);
            range.append(row);
            return { ...movie, output, meta, state: "pending" };
        });
        const mask = () => root.toggleAttribute("data-jhs-translation-masked", this.privacy.masked && this.privacy.targets().some((/** @type {string} */ kind) => ["title", "code"].includes(kind)));
        scope.listen(this.privacy, "privacy.changed", mask);
        scope.listen(this.settings, "settings.changed", mask);
        mask();
        let runScope = /** @type {LifecycleScope|null} */ (null), running = false, stopped = false;
        scope.addCleanup(() => runScope?.dispose());
        const update = () => { if (!scope.disposed)
            status.textContent = `成功 ${rows.filter(row => row.state === "success").length} · 失败 ${rows.filter(row => row.state === "error").length} · 未完成 ${rows.filter(row => ["pending", "loading", "cancelled"].includes(row.state)).length}${stopped ? " · 已停止调度" : ""}`; };
        const start = this.document.createElement("button"), stop = this.document.createElement("button"), configure = this.document.createElement("button");
        for (const button of [start, stop, configure]) {
            button.type = "button";
            button.className = "jhs-btn jhs-btn--secondary";
        }
        start.textContent = "翻译所列标题";
        stop.textContent = "停止";
        stop.disabled = true;
        configure.textContent = "翻译设置";
        scope.listen(configure, "click", () => { void Promise.resolve(this.configureCommand ? this.configureCommand() : this.configure()).catch(error => { if (!scope.disposed)
            status.textContent = error.message; }); });
        scope.listen(stop, "click", () => { stopped = true; runScope?.dispose(); update(); });
        scope.listen(this.service, "translation.changed", () => { if (running) {
            stopped = true;
            runScope?.dispose();
            update();
        } });
        scope.listen(start, "click", () => {
            if (running)
                return;
            running = true;
            stopped = false;
            start.disabled = true;
            stop.disabled = false;
            stop.focus();
            const owner = new LifecycleScope("translation:manual-run");
            runScope = owner;
            for (const row of rows) {
                row.state = "pending";
                row.meta.textContent = "未开始";
                row.output.textContent = "";
            }
            let cursor = 0;
            const worker = async () => {
                while (cursor < rows.length && !stopped && !scope.disposed) {
                    const row = rows[cursor++];
                    if (!row.title) {
                        row.state = "error";
                        row.meta.textContent = "缺少原始标题";
                        update();
                        continue;
                    }
                    row.meta.hidden = false; row.state = "loading";
                    row.meta.textContent = "翻译中…";
                    try {
                        const result = await this.service.translateDetailed(`${row.carNum} ${row.title}`, { cacheAlias: row.carNum, scope: owner });
                        if (scope.disposed || owner.disposed)
                            return;
                        row.output.textContent = result.text;
                        row.meta.textContent = ""; row.meta.hidden = true;
                        row.state = "success";
                    }
                    catch (error) {
                        if (scope.disposed)
                            return;
                        row.state = owner.disposed ? "cancelled" : "error";
                        row.meta.textContent = owner.disposed ? "已取消" : translationErrorLabel(error);
                        if (["AUTH_REQUIRED", "RATE_LIMITED", "QUOTA_EXCEEDED", "UNSUPPORTED"].includes(/** @type {any} */ (error)?.code))
                            stopped = true;
                    }
                    update();
                }
            };
            const concurrency = Math.max(1, Math.min(10, Number(this.settings.snapshot().translationConcurrency) || 2));
            void Promise.all(Array.from({ length: concurrency }, worker)).finally(() => { owner.dispose(); running = false; if (!scope.disposed) {
                const restoreFocus = this.document.activeElement === stop;
                start.disabled = false;
                stop.disabled = true;
                update();
                if (restoreFocus)
                    start.focus();
            } });
        });
        actions.append(start, stop, configure);
        root.append(summary, actions, status, range);
        update();
        try {
            this.mount(root, "标题翻译", scope);
        }
        catch (error) {
            scope.dispose();
            throw error;
        }
    }
}
