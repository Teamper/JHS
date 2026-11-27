// @ts-check
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { readListItem } from "../../core/list-item-reader.js";
import { getMovieStateEligibility, normalizeCarNum } from "../../core/movie-identity.js";
import { createMediaStatus } from "../../ui/settings/media-connections.js";

/** Own media-library badges without mutating JHS state flags or list order. */
export class MediaLibraryController {
    /** @param {{host: any, service: any, scope: LifecycleScope, dialog: any, ui: any}} options */
    constructor(options) {
        this.host = options.host;
        this.service = options.service;
        this.scope = options.scope;
        this.dialog = options.dialog;
        this.ui = options.ui;
        this.document = /** @type {Document} */ (this.host.document);
        this.window = /** @type {Window & typeof globalThis} */ (this.document.defaultView);
        /** @type {Map<Element, any>} */ this.cards = new Map();
        this.mountScope = /** @type {LifecycleScope | null} */ (null);
        this.filter = "all";
        /** @type {HTMLElement | null} */ this.filterStatus = null;
        this.queryingFilter = false;
        this.pendingReconfigure = false;
        this.refreshFocusHost = /** @type {Element | null} */ (null);
        this.refreshFocusPrevious = /** @type {Element | null} */ (null);
    }
    async start() {
        await this.service.initialize();
        this.scope.assertActive();
        this.scope.listen(this.service, "media.changed", () => {
            if (this.pendingReconfigure) return;
            this.pendingReconfigure = true;
            queueMicrotask(() => { this.pendingReconfigure = false; if (!this.scope.disposed) this.reconfigure(); });
        });
        this.scope.addCleanup(() => this.mountScope?.dispose());
        this.reconfigure();
    }
    reconfigure() {
        const previouslyQueried = new Set([...this.cards.values()].filter(card => card.started).map(card => card.movie.carNum));
        this.mountScope?.dispose();
        this.cards.clear();
        if (!this.service.enabled()) return;
        const scope = new LifecycleScope("media:page");
        this.mountScope = scope;
        const observer = new this.window.IntersectionObserver(entries => {
            for (const item of entries) if (item.isIntersecting) {
                const card = this.cards.get(item.target);
                if (card && !card.started) this.query(card);
            }
        }, { rootMargin: "0px" });
        scope.ownObserver(observer);
        const scan = () => {
            if (scope.disposed) return;
            for (const [element, card] of this.cards) if (!element.isConnected) { card.scope.dispose(); observer.unobserve(element); this.cards.delete(element); }
            const selectors = this.host.getListSelectors();
            for (const element of this.document.querySelectorAll(selectors.itemSelector)) {
                if (this.cards.has(element)) continue;
                let movie;
                try { movie = readListItem(element, this.ui.jquery); } catch { continue; }
                if (!movie.stateEligibility.eligible) continue;
                const card = this.attach(element, movie, scope, element.matches(this.host.getLiveListSelectors?.().itemSelector || selectors.itemSelector));
                observer.observe(element);
                this.cards.set(element, card);
                if (previouslyQueried.has(movie.carNum)) this.query(card);
            }
            for (const element of this.document.querySelectorAll("[data-jhs-movie-code]")) {
                if (this.cards.has(element)) continue;
                const carNum = normalizeCarNum(element.getAttribute("data-jhs-movie-code"));
                if (!getMovieStateEligibility(carNum).eligible) continue;
                const host = element.querySelector('[data-jhs-slot="summary-actions"],.jhs-fc2-toolbar') || element;
                const card = this.attach(host, { carNum }, scope, false);
                this.cards.set(element, card);
                this.query(card);
            }
            this.mountFilter(scope);
            this.runFilterQueries(scope);
        };
        const native = this.host.readMovieRef();
        const detailHost = this.host.locateMediaLibraryDetailRoot();
        if (detailHost && native?.stateEligibility?.eligible) {
            const card = this.attach(detailHost, native, scope, false);
            this.cards.set(detailHost, card);
            this.query(card);
        }
        scan();
        scope.observe(this.document.body, records => {
            if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && !/** @type {Element} */ (node).matches(".jhs-media-badge,.jhs-media-filter")))) scan();
        }, { childList: true, subtree: true });
        scope.addCleanup(() => {
            for (const card of this.cards.values()) card.scope.dispose();
            this.document.querySelectorAll("[data-jhs-media-filtered]").forEach(node => node.removeAttribute("data-jhs-media-filtered"));
        });
    }
    /** @param {Element} host @param {any} movie @param {LifecycleScope} owner @param {boolean} list */
    attach(host, movie, owner, list) {
        const scope = new LifecycleScope(`media:movie:${movie.carNum}`), card = { host, movie, scope, list, started: false, result: this.service.peek(movie.carNum), view: /** @type {any} */ (null) };
        const release = owner.addCleanup(() => scope.dispose());
        scope.addCleanup(() => { release(); card.view.root.remove(); host.removeAttribute("data-jhs-media-filtered"); });
        card.view = createMediaStatus({ document: this.document, onOpen: result => this.openHits(result), onRefresh: () => this.refresh(card) });
        host.append(card.view.root);
        card.view.render(card.result);
        this.applyFilter(card);
        return card;
    }
    /** @param {any} card */
    async query(card) {
        if (card.scope.disposed) return;
        card.started = true;
        const update = (/** @type {any} */ result) => {
            if (card.scope.disposed || !card.host.isConnected) return;
            card.result = result;
            card.view.render(result);
            this.applyFilter(card);
            if (this.refreshFocusHost === card.host && result.status !== "loading") {
                if (this.document.activeElement === this.document.body || this.document.activeElement === this.refreshFocusPrevious) card.view.refresh.focus({ preventScroll: true });
                this.refreshFocusHost = null;
                this.refreshFocusPrevious = null;
            }
        };
        try {
            update(await this.service.queryMovie(card.movie, { scope: card.scope, onUpdate: update }));
        } catch {
            update({ status: "unknown", hits: [], servers: [{ status: "error", name: "媒体库", error: "查询失败" }] });
        }
    }
    /** @param {LifecycleScope} scope */
    async runFilterQueries(scope) {
        if (this.queryingFilter || !["present", "absent"].includes(this.filter) || scope.disposed) return;
        this.queryingFilter = true;
        try {
            while (!scope.disposed && ["present", "absent"].includes(this.filter)) {
                const cards = [...this.cards.values()].filter(card => card.list);
                const pending = cards.filter(card => !card.started);
                if (!pending.length) break;
                if (this.filterStatus) this.filterStatus.textContent = `正在筛选媒体库 ${cards.length - pending.length}/${cards.length}`;
                await Promise.all(pending.slice(0, 24).map(card => this.query(card)));
            }
        } finally {
            this.queryingFilter = false;
            if (this.filterStatus) this.filterStatus.textContent = "";
            if (this.mountScope && scope !== this.mountScope) void this.runFilterQueries(this.mountScope);
        }
    }
    /** Refresh shared indexes once, then requery every mounted consumer through the existing scheduler. @param {any} card */
    refresh(card) {
        if (card.scope.disposed) return;
        this.refreshFocusHost = card.host;
        this.refreshFocusPrevious = this.document.activeElement;
        this.service.invalidate();
    }
    /** @param {any} card */
    applyFilter(card) {
        if (!card.list) return;
        const filtered = this.filter !== "all" && card.result.status !== this.filter
            && !(this.filter === "unknown" && ["unknown", "loading"].includes(card.result.status));
        if (card.host.hasAttribute("data-jhs-media-filtered") === filtered) return;
        card.host.toggleAttribute("data-jhs-media-filtered", filtered);
        this.document.dispatchEvent(new this.window.Event("jhs-card-visibility-changed"));
    }
    /** @param {LifecycleScope} scope */
    mountFilter(scope) {
        const existing = this.document.querySelector(".jhs-media-filter");
        const menu = this.document.documentElement.classList.contains("jhs-fab-mounted")
            ? this.document.querySelector(".jhs-mobile-filter-menu") : this.document.querySelector(".jhs-quick-filter__menu");
        if (existing) {
            if (menu && existing.parentElement !== menu) menu.append(existing);
            return;
        }
        const list = this.host.locateListRoot();
        if (!list) return;
        const root = this.document.createElement("div");
        root.className = "jhs-media-filter jhs-ui";
        root.setAttribute("role", "group");
        root.setAttribute("aria-label", "媒体库筛选");
        const label = this.document.createElement("span");
        label.textContent = "媒体库";
        root.append(label);
        for (const [value, text] of Object.entries({ all: "全部", present: "已入库", absent: "未入库", unknown: "结果未知" })) {
            const button = this.document.createElement("button");
            button.type = "button";
            button.className = "jhs-btn jhs-btn--secondary jhs-btn--sm";
            button.dataset.mediaFilter = value;
            button.setAttribute("aria-pressed", String(this.filter === value));
            button.textContent = text;
            scope.listen(button, "click", () => {
                this.filter = value;
                root.querySelectorAll("button").forEach(node => node.setAttribute("aria-pressed", String(node === button)));
                for (const card of this.cards.values()) this.applyFilter(card);
                void this.runFilterQueries(scope);
            });
            root.append(button);
        }
        const hint = this.document.createElement("span");
        hint.setAttribute("role", "status");
        this.filterStatus = hint;
        root.append(hint);
        (menu || this.document.querySelector("#jhs-quick-filter") || list.parentElement).append(root);
        scope.addCleanup(() => { root.remove(); if (this.filterStatus === hint) this.filterStatus = null; });
    }
    /** Always choose explicitly when several servers or versions match. @param {any} result */
    openHits(result) {
        const root = this.document.createElement("div");
        root.className = "jhs-media-connections";
        for (const hit of result.hits) {
            const row = this.document.createElement("div"), link = this.document.createElement("a"), path = this.document.createElement("div");
            row.className = "jhs-media-details";
            link.href = hit.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = `${hit.serverName} · ${hit.name} · 详情 / 播放`;
            path.textContent = hit.path;
            row.append(link, path);
            root.append(row);
        }
        this.openDialog(root, "媒体库版本", this.scope);
    }
    /** @param {HTMLElement} root @param {string} title @param {LifecycleScope} owner */
    openDialog(root, title, owner) {
        const focused = this.document.activeElement;
        let closed = false, id = 0, release = () => {};
        root.style.display = "none";
        this.document.body.append(root);
        try {
            id = this.dialog.open({ type: 1, title, content: this.ui.jquery(root), ui: { size: "workspace", body: "scroll" }, shadeClose: true, end: () => {
                closed = true;
                if (owner !== this.scope) owner.dispose();
                release();
                root.remove();
                if (focused instanceof this.window.HTMLElement && focused.isConnected) focused.focus();
            } });
            if (!closed) release = this.scope.addCleanup(() => { if (!closed) this.dialog.close(id); root.remove(); if (owner !== this.scope) owner.dispose(); });
        } catch (error) { root.remove(); if (owner !== this.scope) owner.dispose(); throw error; }
    }
}
