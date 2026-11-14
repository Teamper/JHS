// @ts-check
import { ListCardStatePresenter } from "./list-card-state-presenter.js";
import { ListItemIndex } from "./list-item-index.js";
import { ListView } from "./list-view.js";
import { ListContextMenuController } from "./list-context-menu-controller.js";
import { ListFilterContextProvider } from "./list-filter-context.js";
import { ListRefreshCoordinator } from "./list-refresh-coordinator.js";

/** Decorate supplementary cards without admitting them to result sorting, counts or pagination. */
export class SupplementaryCardsController {
    /** @param {{owner: any, ui: any, notifications: any, diagnostics: any}} options */
    constructor(options) {
        this.owner = options.owner;
        this.options = options;
        /** @type {Map<Element, {view: ListView, menu: ListContextMenuController}>} */
        this.roots = new Map();
        this.index = new ListItemIndex({ readCarNum: item => this.owner.readCardIdentity(item)?.carNum });
        this.presenter = new ListCardStatePresenter({ hostAdapter: this.owner.hostAdapter, readCardIdentity: item => this.owner.readCardIdentity(item) });
        /** @type {any} */ this.context = null;
        /** @type {Map<HTMLElement, string>} */ this.displays = new Map();
        /** @type {Set<Element>} */ this.cards = new Set();
        this.generation = 0;
        this.started = false;
        this.disposed = false;
        this.refreshQueue = new ListRefreshCoordinator({
            advanceGeneration: () => { this.generation++; },
            captureRevision: () => String(this.generation),
            isCurrent: revision => !this.disposed && revision === String(this.generation),
            filterAll: () => this.refresh(),
            filterItems: items => this.refresh(items),
            reconcile: () => true,
        });
    }

    async start() {
        const owner = this.owner, host = owner.hostAdapter;
        if (this.started || !host.locateCardEnhancementRoots || !owner.boundListRoot || !owner.readFilterSources) return;
        this.started = true;
        owner.scope.addCleanup(() => this.dispose());
        const refresh = (/** @type {any} */ payload = {}, type = "structure") => {
            if (type === "settings-changed") {
                const names = Array.isArray(payload?.names) ? payload.names : Array.isArray(payload?.changedKeys) ? payload.changedKeys : null;
                if (names && !names.some((/** @type {string} */ name) => name === "tagPosition" || name === "defaultQuickFilterTab")) return;
            }
            const context = this.getFilterContext();
            const scoped = type === "car-state-changed" && payload?.scope !== "all"
                && Array.isArray(payload?.carNums) && payload.carNums.length > 0
                && !payload.changedDomains?.some((/** @type {string} */ key) => ["setting", "blacklist", "blacklist_car_list", "filter_keyword_title"].includes(key));
            if (context !== owner.filterContextProvider) {
                if (scoped) context.invalidateState(); else context.invalidate();
            }
            void this.refreshQueue.request(scoped ? { items: this.index.get(payload.carNums) } : { full: true })
                .catch(error => owner.logger.error("推荐卡片刷新失败", error));
        };
        for (const type of ["car-state-changed", "legacy-refresh", "blacklist-rules-changed", "filter-rules-changed", "settings-changed"]) {
            const release = owner.events?.on?.(type, (/** @type {any} */ payload) => refresh(payload, type));
            if (release) owner.scope.addCleanup(release);
        }
        await this.refreshQueue.request({ full: true });
        if (this.disposed) return;
        const container = owner.boundListRoot.closest("section .container") ?? owner.boundListRoot.parentElement;
        const rootSelector = host.getListSelectors().boxSelector;
        if (container) owner.scope.observe(container, (/** @type {MutationRecord[]} */ records) => {
            if (this.disposed) return;
            const structural = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => {
                if (node.nodeType !== 1) return false;
                const element = /** @type {Element} */ (node);
                return element.matches(rootSelector) || !!element.querySelector(rootSelector)
                    || this.roots.has(/** @type {Element} */ (record.target)) && element.matches(".item");
            }));
            if (!structural) return;
            const roots = host.locateCardEnhancementRoots().filter((/** @type {Element} */ root) => root !== owner.boundListRoot);
            const cards = roots.flatMap((/** @type {Element} */ root) => [...root.querySelectorAll(":scope > .item")]);
            const indexed = [...this.cards];
            if (roots.length !== this.roots.size || roots.some((/** @type {Element} */ root) => !this.roots.has(root)) || cards.length !== indexed.length || cards.some((/** @type {Element} */ card) => !this.cards.has(card))) refresh();
        }, { childList: true, subtree: true });
    }

    getFilterContext() {
        return this.owner.filterContextProvider ?? (this.context ??= new ListFilterContextProvider({ readSources: options => this.owner.readFilterSources(options) }));
    }

    /** @param {Element[] | null} [items] */
    async refresh(items = null) {
        const owner = this.owner, host = owner.hostAdapter;
        if (this.disposed || owner.scope.disposed) return;
        const generation = this.generation;
        const roots = items ? [...this.roots.keys()] : host.locateCardEnhancementRoots().filter((/** @type {Element} */ root) => root !== owner.boundListRoot);
        for (const [root, binding] of this.roots) if (!roots.includes(root)) {
            binding.view.dispose(); binding.menu.dispose(); this.roots.delete(root);
        }
        for (const root of roots) if (!this.roots.has(root)) {
            const view = new ListView({ hostAdapter: host, selectors: host.getLiveListSelectors(), onOpenMovieDetail: (item, options) => owner.listNavigationController.openMovieDetail(item, options) });
            view.bindMovieDetailNavigation(root); view.bindCardVideoPlayback(root);
            const menu = new ListContextMenuController({ ...this.options, hostAdapter: { ...host, locateListRoot: () => root }, list: owner.legacyPlugin, state: owner.state, scope: owner.scope });
            menu.start(); this.roots.set(root, { view, menu });
        }
        const cards = items ? items.filter(card => card.isConnected && roots.some((/** @type {Element} */ root) => card.parentElement === root)) : roots.flatMap((/** @type {Element} */ root) => [...root.querySelectorAll(":scope > .item")]);
        if (!items) {
            for (const card of cards) if (!this.cards.has(card)) card.removeAttribute("data-jhs-state-signature");
            this.cards = new Set(cards);
            this.index.rebuild(cards);
            this.presenter.resetSummary();
            for (const [card, display] of this.displays) if (!this.cards.has(card)) { card.style.display = display; this.displays.delete(card); }
        }
        if (!cards.length) return true;
        const context = await this.getFilterContext().get();
        const isCurrent = () => !this.disposed && !owner.scope.disposed && generation === this.generation && owner.boundListRoot?.isConnected && roots.every((/** @type {Element} */ root) => root.isConnected);
        if (!isCurrent()) return false;
        const visible = await this.presenter.processItems(cards, { context, filter: "all", tagPosition: context.settings?.tagPosition, isCurrent });
        if (!visible || !isCurrent()) return false;
        const shown = new Set(visible);
        for (const card of cards) {
            const element = /** @type {HTMLElement} */ (card);
            if (!this.displays.has(element)) this.displays.set(element, element.style.display);
            element.style.display = shown.has(card) ? this.displays.get(element) ?? "" : "none";
        }
        owner.coverImageController.replace(cards.flatMap((/** @type {Element} */ card) => [...card.querySelectorAll(".cover img")]));
        await owner.coverButtons?.addSvgBtn(cards);
        if (isCurrent()) void Promise.resolve(owner.legacyPlugin.translateListItems?.(visible)).catch(error => owner.logger.error("推荐标题翻译失败", error));
        return isCurrent();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.generation++; this.refreshQueue.dispose();
        for (const binding of this.roots.values()) { binding.view.dispose(); binding.menu.dispose(); }
        this.roots.clear(); this.cards.clear(); this.index.clear();
        if (this.context && this.context !== this.owner.filterContextProvider) this.context.dispose();
        /** @type {any} */ this.context = null;
        this.presenter.dispose();
        for (const [card, display] of this.displays) card.style.display = display;
        this.displays.clear();
    }
}
