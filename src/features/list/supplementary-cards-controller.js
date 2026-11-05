// @ts-check
import { ListCardStatePresenter } from "./list-card-state-presenter.js";
import { ListItemIndex } from "./list-item-index.js";
import { ListView } from "./list-view.js";
import { ListContextMenuController } from "./list-context-menu-controller.js";
import { ListFilterContextProvider } from "./list-filter-context.js";

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
        this.context = new ListFilterContextProvider({ readSources: options => this.owner.readFilterSources(options) });
        /** @type {Map<HTMLElement, string>} */ this.displays = new Map();
        /** @type {Set<Element>} */ this.cards = new Set();
        this.generation = 0;
        this.started = false;
        this.disposed = false;
    }

    async start() {
        const owner = this.owner, host = owner.hostAdapter;
        if (this.started || !host.locateCardEnhancementRoots || !owner.boundListRoot || !owner.readFilterSources) return;
        this.started = true;
        owner.scope.addCleanup(() => this.dispose());
        const refresh = () => { this.context.invalidate(); void this.refresh().catch(error => owner.logger.error("推荐卡片刷新失败", error)); };
        for (const type of ["car-state-changed", "legacy-refresh", "blacklist-rules-changed", "filter-rules-changed", "settings-changed"]) {
            const release = owner.events?.on?.(type, refresh);
            if (release) owner.scope.addCleanup(release);
        }
        await this.refresh();
        if (this.disposed) return;
        const container = owner.boundListRoot.closest("section .container") ?? owner.boundListRoot.parentElement;
        if (container) owner.scope.observe(container, () => {
            if (this.disposed) return;
            const roots = host.locateCardEnhancementRoots().filter((/** @type {Element} */ root) => root !== owner.boundListRoot);
            const cards = roots.flatMap((/** @type {Element} */ root) => [...root.querySelectorAll(":scope > .item")]);
            const indexed = [...this.cards];
            if (roots.length !== this.roots.size || roots.some((/** @type {Element} */ root) => !this.roots.has(root)) || cards.length !== indexed.length || cards.some((/** @type {Element} */ card) => !indexed.includes(card))) refresh();
        }, { childList: true, subtree: true });
    }

    async refresh() {
        const owner = this.owner, host = owner.hostAdapter;
        if (this.disposed || owner.scope.disposed) return;
        const generation = ++this.generation;
        const roots = host.locateCardEnhancementRoots().filter((/** @type {Element} */ root) => root !== owner.boundListRoot);
        for (const [root, binding] of this.roots) if (!roots.includes(root)) {
            binding.view.dispose(); binding.menu.dispose(); this.roots.delete(root);
        }
        for (const root of roots) if (!this.roots.has(root)) {
            const view = new ListView({ hostAdapter: host, selectors: host.getLiveListSelectors(), onOpenMovieDetail: (item, options) => owner.listNavigationController.openMovieDetail(item, options) });
            view.bindMovieDetailNavigation(root); view.bindCardVideoPlayback(root);
            const menu = new ListContextMenuController({ ...this.options, hostAdapter: { ...host, locateListRoot: () => root }, list: owner.legacyPlugin, state: owner.state, scope: owner.scope });
            menu.start(); this.roots.set(root, { view, menu });
        }
        const cards = roots.flatMap((/** @type {Element} */ root) => [...root.querySelectorAll(":scope > .item")]);
        for (const card of cards) if (!this.cards.has(card)) card.removeAttribute("data-jhs-state-signature");
        this.cards = new Set(cards);
        this.index.rebuild(cards);
        this.presenter.resetSummary();
        for (const [card, display] of this.displays) if (!cards.includes(card)) { card.style.display = display; this.displays.delete(card); }
        if (!cards.length) return;
        const context = await this.context.get();
        const isCurrent = () => !this.disposed && !owner.scope.disposed && generation === this.generation && owner.boundListRoot?.isConnected && roots.every((/** @type {Element} */ root) => root.isConnected);
        if (!isCurrent()) return;
        const visible = await this.presenter.processItems(cards, { context, filter: "all", tagPosition: context.settings?.tagPosition, isCurrent });
        if (!visible || !isCurrent()) return;
        const shown = new Set(visible);
        for (const card of cards) {
            const element = /** @type {HTMLElement} */ (card);
            if (!this.displays.has(element)) this.displays.set(element, element.style.display);
            element.style.display = shown.has(card) ? this.displays.get(element) ?? "" : "none";
        }
        owner.coverImageController.replace(cards.flatMap((/** @type {Element} */ card) => [...card.querySelectorAll(".cover img")]));
        await owner.coverButtons?.addSvgBtn(cards);
        if (isCurrent()) void Promise.resolve(owner.legacyPlugin.translateListItems?.(visible)).catch(error => owner.logger.error("推荐标题翻译失败", error));
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.generation++;
        for (const binding of this.roots.values()) { binding.view.dispose(); binding.menu.dispose(); }
        this.roots.clear(); this.cards.clear(); this.index.clear(); this.context.dispose(); this.presenter.dispose();
        for (const [card, display] of this.displays) card.style.display = display;
        this.displays.clear();
    }
}
