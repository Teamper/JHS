// @ts-check
import { mountEnhancementAction } from "../../ui/detail/enhancement-actions.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { getMovieStateEligibility, normalizeCarNum } from "../../core/movie-identity.js";
import { readListItem } from "../../core/list-item-reader.js";
import { createPersonalRatingControl } from "../../ui/library/personal-rating.js";

export class PersonalRatingController {
    /** @param {{host: any, state: any, events: any, scope: LifecycleScope, dialog: any, ui: any}} options */
    constructor(options) {
        this.host = options.host;
        this.state = options.state;
        this.events = options.events;
        this.scope = options.scope;
        this.dialog = options.dialog;
        this.ui = options.ui;
        this.document = /** @type {Document} */ (options.host.document);
        this.ratings = /** @type {Record<string, any>} */ ({});
        /** @type {Map<Element, any>} */ this.items = new Map();
        this.dialogScope = /** @type {LifecycleScope | null} */ (null);
        this.refreshGeneration = 0;
    }
    async start() {
        await this.refresh();
        this.scope.assertActive();
        this.scope.addCleanup(this.events.on("personal-rating-changed", () => this.refresh()));
        this.scope.observe(this.document.body, records => {
            if (records.some(record => record.removedNodes.length || [...record.addedNodes].some(node => node.nodeType === 1 && !/** @type {Element} */ (node).closest(".jhs-personal-rating,.jhs-rating-badge")))) this.scan();
        }, { childList: true, subtree: true });
        this.scope.addCleanup(() => { this.dialogScope?.dispose(); for (const item of this.items.values()) item.scope.dispose(); this.items.clear(); });
        this.scan();
    }
    async refresh() {
        const generation = ++this.refreshGeneration;
        const ratings = await this.state.getPersonalRatings();
        if (this.scope.disposed || generation !== this.refreshGeneration) return;
        this.ratings = ratings;
        for (const item of this.items.values()) this.render(item);
    }
    scan() {
        if (this.scope.disposed) return;
        const native = this.host.readMovieRef();
        const nativeRoot = native?.stateEligibility?.eligible && this.host.detectRoute() === "detail" ? this.host.locateDetailSlots()?.summary || this.host.locateDetailRoot() : null;
        for (const [element, item] of this.items) if (!element.isConnected || !item.root.isConnected || item.native && element !== nativeRoot) { item.scope.dispose(); this.items.delete(element); }
        const selectors = this.host.getCardEnhancementSelectors?.() || this.host.getListSelectors();
        for (const element of this.document.querySelectorAll(`${selectors.itemSelector},a.tile-item[href]`)) {
            if (this.items.has(element)) continue;
            const movie = readListItem(element, this.ui.jquery);
            if (!movie.stateEligibility.eligible) continue;
            this.attach(element, movie, false);
        }
        if (nativeRoot && !this.items.has(nativeRoot)) this.attach(nativeRoot, native, true, true);
        for (const element of this.document.querySelectorAll("[data-jhs-movie-code]")) {
            if (this.items.has(element)) continue;
            const carNum = normalizeCarNum(element.getAttribute("data-jhs-movie-code"));
            if (getMovieStateEligibility(carNum).eligible) this.attach(element, { carNum }, true);
        }
    }
    /** @param {Element} host @param {any} movie @param {boolean} detail @param {boolean} [native] */
    attach(host, movie, detail, native = false) {
        const carNum = normalizeCarNum(movie.carNum);
        if (!carNum) return;
        const scope = new LifecycleScope(`rating:${movie.carNum}`), release = this.scope.addCleanup(() => scope.dispose());
        const value = this.ratings[carNum]?.rating || null;
        const view = null;
        const root = this.document.createElement(detail ? "button" : "span");
        if (!view) root.className = "jhs-badge jhs-badge--neutral jhs-rating-badge";
        const target = detail ? host.querySelector('[data-jhs-slot="summary-actions"],.jhs-fc2-toolbar') || host : host;
        if (detail) {
            root.className = "jhs-btn jhs-btn--secondary jhs-personal-rating-entry";
            root.setAttribute("type", "button");
            scope.listen(root, "click", () => { void this.open([movie]).catch(error => { if (!scope.disposed) root.textContent = error.message; }); });
            mountEnhancementAction(host, root, scope, true);
        } else target.append(root);
        const item = { host, carNum, scope, root, view, native, detail };
        this.items.set(host, item);
        this.render(item);
        scope.addCleanup(() => { root.remove(); release(); });
    }
    /** @param {any} item */
    render(item) {
        const rating = this.ratings[item.carNum]?.rating || null;
        if (item.detail) item.root.textContent = `个人评分 · ${rating ? rating + " 星" : "未评分"}`;
        else if (item.view) item.view.update(rating);
        else { item.root.hidden = !rating; item.root.textContent = rating ? `个人 ${rating} 星` : ""; }
    }
    /** @param {any[]} movies */
    async open(movies) {
        if (this.dialogScope && !this.dialogScope.disposed) return;
        const codes = [...new Set(movies.filter(movie => getMovieStateEligibility(movie).eligible).map(movie => normalizeCarNum(movie.carNum)).filter((/** @type {string | null} */ code) => code !== null))];
        if (!codes.length) throw new Error("请先选择可评分的影片");
        const scope = new LifecycleScope("rating:editor");
        this.dialogScope = scope;
        const release = this.scope.addCleanup(() => scope.dispose());
        scope.addCleanup(release);
        try {
            const ratings = await this.state.getPersonalRatings();
            scope.assertActive();
            const root = this.document.createElement("section"), summary = this.document.createElement("p"), range = this.document.createElement("details"), caption = this.document.createElement("summary"), list = this.document.createElement("ul");
            root.className = "jhs-rating-editor jhs-ui";
            summary.textContent = `将为所选 ${codes.length} 部影片设置个人评分`;
            caption.textContent = "查看所选影片";
            list.className = "jhs-rating-movies jhs-scrollbar";
            for (const code of codes) { const row = this.document.createElement("li"); row.setAttribute("data-jhs-library-code", ""); row.textContent = code; list.append(row); }
            range.append(caption, list);
            const mixed = !codes.every(code => ratings[code]?.rating === ratings[codes[0]]?.rating);
            const initial = mixed ? null : ratings[codes[0]]?.rating || null;
            const control = createPersonalRatingControl({ document: this.document, scope, rating: initial, mixed, onChange: async rating => { await this.state.setPersonalRating(codes, rating); } });
            root.append(summary, range, control.root);
            root.style.display = "none";
            this.document.body.append(root);
            let closed = false, id = 0;
            scope.addCleanup(() => { if (!closed && id) this.dialog.close(id); root.remove(); });
            id = this.dialog.open({ type: 1, title: "个人评分", content: this.ui.jquery(root), ui: { size: "md", body: "scroll" }, end: () => { closed = true; scope.dispose(); } });
        } catch (error) { scope.dispose(); throw error; }
    }
}
