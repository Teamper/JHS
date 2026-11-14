// @ts-check
import { readListItem } from "../../core/list-item-reader.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";

export const MOVIE_SELECTION_STYLES = `
.jhs-movie-selection{display:flex;flex-wrap:wrap;gap:var(--jhs-space-2,8px);align-items:center;margin-block:12px;padding:12px;background:var(--jhs-surface-2);border:1px solid var(--jhs-border);border-radius:var(--jhs-radius-md)}
.jhs-movie-choice{display:flex;align-items:center;gap:6px;padding:6px;color:var(--jhs-text);background:var(--jhs-surface)}
.jhs-movie-selection [hidden]{display:none!important}
.jhs-movie-selection [role=status]{flex-basis:100%;overflow-wrap:anywhere}
`;

export class MovieSelectionController {
    /** @param {{host:any, service:any, ui:any, scope:any, available?:(name:string)=>boolean, execute:(name:string, movies:any[])=>any}} options */
    constructor(options) {
        this.host = options.host;
        this.service = options.service;
        this.ui = options.ui;
        this.scope = options.scope;
        this.execute = options.execute;
        this.available = options.available || (() => true);
        this.document = /** @type {Document} */ (this.host.document);
        /** @type {Map<Element, {movie:any, label:HTMLElement, input:HTMLInputElement, scope:LifecycleScope}>} */ this.cards = new Map();
        this.selecting = false;
        this.toolbar = /** @type {HTMLElement|null} */ (null);
        this.status = /** @type {HTMLElement|null} */ (null);
        this.buttons = /** @type {HTMLButtonElement[]} */ ([]);
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
            if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && !/** @type {Element} */ (node).closest(".jhs-movie-choice,.jhs-movie-selection")))) this.scan();
        }, {childList:true, subtree:true});
        this.scope.addCleanup(() => { this.toolbar?.remove(); for (const card of this.cards.values()) card.scope.dispose(); this.cards.clear(); });
    }
    scan() {
        for (const [element, card] of this.cards) if (!element.isConnected) { card.scope.dispose(); this.cards.delete(element); }
        const list = this.host.locateListRoot();
        if (!list) return;
        if (!this.selecting) {
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
            const label = this.document.createElement("label"), input = this.document.createElement("input"), text = this.document.createElement("span");
            label.className = "jhs-movie-choice";
            input.type = "checkbox";
            input.className = "jhs-checkbox";
            input.setAttribute("aria-label", `选择 ${movie.carNum}`);
            text.textContent = "";
            label.append(input, text);
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
        this.toolbar?.remove();
        const root = this.document.createElement("section"), status = this.document.createElement("p");
        root.className = "jhs-movie-selection jhs-ui";
        root.setAttribute("aria-label", "跨页影片选择");
        status.setAttribute("role", "status");
        this.buttons = [];
        const actions = [
            ["选择本页可见影片", () => this.service.setMany([...this.cards.entries()].filter(([element]) => /** @type {HTMLElement} */ (element).getClientRects().length > 0).map(([,card]) => card.movie), true)],
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
            this.scope.listen(button, "click", () => Promise.resolve().then(action).catch(error => this.report(error)));
            root.append(button);
            this.buttons.push(button);
        }
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
        const count = this.service.values().length;
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
