// @ts-check
import { readListItem } from "../../core/list-item-reader.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { isCardVisible } from "../../core/list-filters.js";

export const MOVIE_SELECTION_STYLES = `
.jhs-movie-selection{display:flex;flex-wrap:wrap;gap:var(--jhs-space-2,8px);align-items:center;margin-block:12px;padding:12px;background:var(--jhs-surface-2);border:1px solid var(--jhs-border);border-radius:var(--jhs-radius-md)}
.jhs-movie-choice{display:flex;align-items:center;gap:6px;padding:6px;color:var(--jhs-text);background:var(--jhs-surface)}
.jhs-movie-selection [hidden]{display:none!important}
.jhs-movie-selection [role=status]{flex-basis:100%;overflow-wrap:anywhere}
`;

export class MovieSelectionController {
    /** @param {{host:any, service:any, ui:any, state?:any, clipboard?:any, scope:any, available?:(name:string)=>boolean, execute:(name:string, movies:any[])=>any}} options */
    constructor(options) {
        this.host = options.host;
        this.service = options.service;
        this.ui = options.ui;
        this.state = options.state;
        this.clipboard = options.clipboard;
        this.scope = options.scope;
        this.execute = options.execute;
        this.available = options.available || (() => true);
        this.document = /** @type {Document} */ (this.host.document);
        /** @type {Map<Element, {movie:any, label:HTMLElement, input:HTMLInputElement, scope:LifecycleScope}>} */ this.cards = new Map();
        this.selecting = false;
        this.toolbar = /** @type {HTMLElement|null} */ (null);
        this.status = /** @type {HTMLElement|null} */ (null);
        this.buttons = /** @type {HTMLButtonElement[]} */ ([]);
        /** @type {LifecycleScope | null} */ this.toolbarScope = null;
        /** @type {HTMLElement | null} */ this.selectedList = null;
        /** @type {HTMLElement | null} */ this.selectionSummary = null;
    }
    toggle() {
        this.selecting = !this.selecting;
        this.scan();
        this.document.dispatchEvent(new CustomEvent("jhs-selection-mode-changed"));
    }
    start() {
        this.scope.listen(this.service, "selection.changed", () => { this.render(); this.document.dispatchEvent(new CustomEvent("jhs-selection-mode-changed")); });
        this.scope.listen(this.document, "jhs-feature-availability-changed", () => this.render());
        this.scan();
        this.scope.observe(this.document.body, (/** @type {MutationRecord[]} */ records) => {
            if (records.some(record => {
                const target = /** @type {Element} */ (record.target);
                return !target.closest(".jhs-movie-choice,.jhs-movie-selection") &&
                    [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && !/** @type {Element} */ (node).matches(".jhs-movie-choice,.jhs-movie-selection"));
            })) this.scan();
        }, {childList:true, subtree:true});
        this.scope.addCleanup(() => { this.toolbarScope?.dispose(); this.toolbar?.remove(); for (const card of this.cards.values()) card.scope.dispose(); this.cards.clear(); });
    }
    scan() {
        for (const [element, card] of this.cards) if (!element.isConnected) { card.scope.dispose(); this.cards.delete(element); }
        const list = this.host.locateListRoot();
        if (!list) return;
        if (!this.selecting) {
            this.toolbarScope?.dispose();
            this.toolbar?.remove();
            for (const card of this.cards.values()) card.scope.dispose();
            this.cards.clear();
            return;
        }
        if (!this.toolbar?.isConnected) this.mount(list);
        for (const element of this.host.locateListItems()) {
            if (this.cards.has(element)) continue;
            let movie;
            try { movie = readListItem(element, this.ui.jquery); } catch { continue; }
            if (!movie.stateEligibility.eligible) continue;
            const label = this.document.createElement("label"), input = this.document.createElement("input");
            label.className = "jhs-movie-choice";
            input.type = "checkbox";
            input.className = "jhs-checkbox";
            input.setAttribute("aria-label", `选择 ${movie.carNum}`);
            label.append(input);
            // The control belongs beside a native link, never inside that link.
            const parent = element.matches("a") ? element.parentElement : element;
            if (!parent) continue;
            const scope = new LifecycleScope(`selection:${movie.carNum}`), release = this.scope.addCleanup(() => scope.dispose());
            scope.addCleanup(() => { label.remove(); release(); });
            parent.append(label);
            scope.listen(input, "change", () => {
                try { this.service.set(movie, input.checked); }
                catch (error) { this.report(error); this.render(); }
            });
            this.cards.set(element, { movie, label, input, scope });
        }
        this.render();
    }
    /** @param {Element} list */
    mount(list) {
        this.toolbarScope?.dispose();
        const scope = this.toolbarScope = new LifecycleScope("movie-selection-toolbar");
        this.toolbar?.remove();
        const root = this.document.createElement("section"), status = this.document.createElement("p");
        root.className = "jhs-movie-selection jhs-ui";
        root.setAttribute("aria-label", "跨页影片选择");
        status.setAttribute("role", "status");
        this.buttons = [];
        const actions = [
            ["选择本页可见影片", () => this.service.setMany([...this.cards.entries()].filter(([element]) => isCardVisible(element) && element.getClientRects().length > 0).map(([,card]) => card.movie), true)],
            ["清空选择", () => this.service.clear()],
            ["批量评分", () => this.execute("library.rating.open", this.service.values())],
            ["批量翻译", () => this.execute("translation.selection", this.service.values())],
            ["管理清单与恢复", () => this.execute("library.lists.open", this.service.values())],
            ["退出选择", () => this.toggle()],
        ];
        for (const [label, action] of /** @type {Array<[string,()=>any]>} */ (actions)) {
            const button = this.document.createElement("button");
            button.type = "button";
            button.className = "jhs-btn jhs-btn--secondary";
            button.textContent = label;
            scope.listen(button, "click", () => Promise.resolve().then(action).catch(error => this.report(error)));
            root.append(button);
            this.buttons.push(button);
        }
        for (const [label, flag] of Object.entries({ 收藏: "favorite", 已下载: "downloaded", 已观看: "watched", 屏蔽: "blocked", 复制选中番号: "copy" })) {
            const button = this.document.createElement("button");
            button.type = "button";
            button.className = "jhs-btn jhs-btn--secondary";
            button.dataset.selectionBatch = flag;
            button.textContent = label;
            scope.listen(button, "click", async () => {
                const movies = this.service.values(), codes = movies.map((/** @type {any} */ movie) => movie.carNum);
                button.disabled = true;
                try {
                    if (flag === "copy") await this.clipboard.copyText("选中番号", codes.join("\n"));
                    else await this.state.patch(codes, { [flag]: true }, { type: "list-batch-state", records: movies });
                } catch (error) { if (!scope.disposed) this.report(error); }
                finally { button.disabled = !codes.length; }
            });
            root.append(button);
        }
        const selected = this.document.createElement("details"), summary = this.document.createElement("summary"), results = this.document.createElement("div");
        selected.append(summary, results);
        root.append(selected);
        this.selectionSummary = summary;
        this.selectedList = results;
        scope.listen(results, "click", event => {
            const code = /** @type {HTMLElement} */ (event.target).dataset.selectionRemove;
            const movie = code && this.service.values().find((/** @type {any} */ item) => item.carNum === code);
            if (movie) this.service.set(movie, false);
        });
        root.append(status);
        list.before(root);
        this.toolbar = root;
        this.status = status;
    }
    /** @param {unknown} error */
    report(error) {
        if (!this.status) return;
        this.status.className = "jhs-field-error";
        this.status.textContent = error instanceof Error ? error.message : String(error);
    }
    render() {
        const movies = this.service.values(), count = movies.length;
        if (this.selectionSummary) this.selectionSummary.textContent = "已选择 " + count + " 部影片";
        if (this.selectedList) {
            this.selectedList.replaceChildren(...movies.map((/** @type {any} */ movie) => {
                const button = this.document.createElement("button");
                button.type = "button"; button.className = "jhs-btn jhs-btn--ghost jhs-btn--sm";
                button.dataset.selectionRemove = movie.carNum;
                button.setAttribute("data-jhs-privacy-kind", "code");
                button.textContent = "移除 " + movie.carNum;
                button.disabled = this.service.readOnly;
                return button;
            }));
        }
        this.toolbar?.querySelectorAll("button[data-selection-batch]").forEach(node => {
            /** @type {HTMLButtonElement} */ (node).disabled = !count;
        });
        if (this.status) {
            this.status.className = "jhs-helper-text";
            this.status.textContent = `已选择 ${count} 部影片，可跨页保留。${this.service.warning || ""}`;
        }
        for (const card of this.cards.values()) { card.input.checked = this.service.has(card.movie); card.input.disabled = this.service.readOnly; }
        this.buttons.forEach((button, index) => {
            const command = ["", "", "library.rating.open", "translation.selection", "library.lists.open"][index];
            button.hidden = Boolean(command && !this.available(command));
            button.disabled = index < 2 ? this.service.readOnly : [2,3].includes(index) && !count;
        });
    }
}
