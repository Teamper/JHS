// @ts-check

import { OwnedPopover } from "../../core/owned-popover.js";
import { normalizeStateFlags } from "../../core/state-model.js";
import { safePlay } from "../../core/feature-helpers.js";
import { getIcon } from "../../core/icons.js";
import { PRIMARY_QUICK_FILTERS, QUICK_FILTER_LABELS, SECONDARY_QUICK_FILTERS, normalizeQuickFilterKey, shouldShowItem } from "./list-filters.js";

/** @param {string} value @param {any} fallback */
function parseData(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
}

/** Own list visibility, quick-filter controls, and card navigation. */
export class ListView {
    /** @param {{hostAdapter: any, selectors: Record<string, string>, logger?: Pick<Console, "error">, onFilterChange?: (filter: unknown, options?: any) => any, onOpenMovieDetail?: (item: any, options?: any) => any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.selectors = Object.freeze({ ...options.selectors });
        this.logger = options.logger ?? console;
        this.onFilterChange = options.onFilterChange ?? (() => {});
        this.onOpenMovieDetail = options.onOpenMovieDetail ?? (() => {});
        /** @type {ReturnType<typeof normalizeQuickFilterKey>} */ this.activeFilter = "waitCheck";
        /** @type {any} */ this.quickFilterRoot = null;
        /** @type {OwnedPopover | null} */ this.filterPopover = null;
        /** @type {any} */ this.navigationRoot = null;
        /** @type {any} */ this.videoRoot = null;
        /** @type {WeakMap<Element, string>} */ this.cardDisplays = new WeakMap();
    }

    /** @param {Element[] | null} items @param {unknown} filter @param {(element: Element, visible: boolean) => void} [onVisibility] */
    applyVisibility(items, filter, onVisibility) {
        const elements = (items ? $(items) : $(this.selectors.itemSelector)).toArray(), normalizedFilter = normalizeQuickFilterKey(filter);
        // Read attributes before writing styles. jQuery show() can force layout
        // for every previously hidden card while restoring its display value.
        const changes = elements.map((/** @type {Element} */ element) => {
            const flags = normalizeStateFlags(parseData(element.getAttribute("data-jhs-flags") || "{}", {}));
            const visibilityReasons = parseData(element.getAttribute("data-jhs-visibility") || "{}", {}), recent = element.getAttribute("data-jhs-recent") === "yes";
            const visible = shouldShowItem({ filter: normalizedFilter, flags, visibilityReasons, recent });
            const style = /** @type {HTMLElement} */ (element).style;
            if (style.display !== "none") this.cardDisplays.set(element, style.display);
            return { element, visible, display: visible ? this.cardDisplays.get(element) || "" : "none" };
        });
        for (const { element, visible, display } of changes) {
            const style = /** @type {HTMLElement} */ (element).style;
            if (style.display !== display) style.display = display;
            onVisibility?.(element, visible);
        }
    }

    /** @param {unknown} initialFilter */
    createQuickFilter(initialFilter) {
        this.setActiveFilter(initialFilter);
        if (this.quickFilterRoot?.length) {
            this.syncQuickFilterUi(initialFilter);
            this.applyVisibility(null, initialFilter);
            return;
        }
        const primaryHtml = PRIMARY_QUICK_FILTERS.map((filter => `<button type="button" role="tab" class="jhs-btn jhs-segmented__item" aria-selected="false" tabindex="-1" data-jhs-filter="${filter}">${QUICK_FILTER_LABELS[filter]}</button>`)).join(""),
            secondaryHtml = SECONDARY_QUICK_FILTERS.map(((filter, index) => `${1 === index ? '<div class="jhs-filter-menu__separator" role="separator"></div>' : ""}<button type="button" role="menuitemradio" class="jhs-btn jhs-btn--ghost jhs-filter-option" aria-checked="false" tabindex="-1" data-jhs-filter="${filter}">${QUICK_FILTER_LABELS[filter]}</button>`)).join(""),
            markup = `<div id="jhs-quick-filter" class="jhs-quick-filter">
                <div class="jhs-quick-filter__primary jhs-segmented" role="tablist" aria-label="状态筛选">${primaryHtml}</div>
                <div class="jhs-quick-filter__more">
                    <button type="button" class="jhs-btn jhs-btn--secondary jhs-quick-filter__toggle" aria-haspopup="menu" aria-expanded="false"><span class="jhs-quick-filter__label">更多筛选</span>${getIcon("chevron-down")}</button>
                    <div class="jhs-popover jhs-commandbar__menu jhs-quick-filter__menu" role="menu" aria-label="更多筛选">${secondaryHtml}</div>
                </div>
            </div>`,
            box = $(this.selectors.boxSelector).first();
        if (!box.length) return;
        box.before(markup);
        const root = $("#jhs-quick-filter"), toggle = root.find(".jhs-quick-filter__toggle"), menu = root.find(".jhs-quick-filter__menu");
        const popover = new OwnedPopover(toggle[0], menu[0]);
        this.filterPopover = popover;
        const closeMenu = (restoreFocus = false) => popover.close(restoreFocus);
        root.off(".jhsListView")
            .on("click.jhsListView", ".jhs-segmented__item", ((/** @type {any} */ event) => this.selectFilter($(event.currentTarget).data("jhs-filter"))))
            .on("keydown.jhsListView", ".jhs-segmented__item", ((/** @type {any} */ event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const tabs = root.find(".jhs-segmented__item"), index = tabs.index(event.currentTarget), next = "Home" === event.key ? 0 : "End" === event.key ? tabs.length - 1 : "ArrowRight" === event.key ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
                tabs.eq(next).trigger("click").trigger("focus");
            }));
        menu.off(".jhsListView").on("click.jhsListView", ".jhs-filter-option", ((/** @type {any} */ event) => {
                this.selectFilter($(event.currentTarget).data("jhs-filter"));
                closeMenu(true);
            }))
            .on("keydown.jhsListView", ".jhs-filter-option", ((/** @type {any} */ event) => {
                const items = menu.find(".jhs-filter-option"), index = items.index(event.currentTarget);
                if ("Escape" === event.key) return event.preventDefault(), closeMenu(true);
                if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
                items.eq(next).trigger("focus");
            }));
        toggle.off(".jhsListView").on("click.jhsListView", ((/** @type {any} */ event) => {
            event.preventDefault(), event.stopPropagation();
            if (popover.opened) closeMenu();
            else popover.open((menu.find('[aria-checked="true"]').first().length ? menu.find('[aria-checked="true"]').first() : menu.find(".jhs-filter-option").first())[0]);
        }));
        this.quickFilterRoot = root;
        this.syncQuickFilterUi(initialFilter);
        this.applyVisibility(null, initialFilter);
    }

    /** @param {unknown} filter */
    syncQuickFilterUi(filter) {
        const normalizedFilter = normalizeQuickFilterKey(filter), isPrimary = PRIMARY_QUICK_FILTERS.includes(normalizedFilter), root = this.quickFilterRoot?.length ? this.quickFilterRoot : $("#jhs-quick-filter"), tabs = root.find(".jhs-segmented__item"), options = this.filterPopover ? $(this.filterPopover.menu).find(".jhs-filter-option") : root.find(".jhs-filter-option");
        this.activeFilter = normalizedFilter;
        tabs.removeClass("active").attr({ "aria-selected": "false", tabindex: "-1" });
        isPrimary ? tabs.filter(`[data-jhs-filter="${normalizedFilter}"]`).addClass("active").attr({ "aria-selected": "true", tabindex: "0" }) : tabs.first().attr("tabindex", "0");
        options.attr("aria-checked", "false").filter(`[data-jhs-filter="${normalizedFilter}"]`).attr("aria-checked", "true");
        root.find(".jhs-quick-filter__label").text(isPrimary ? "更多筛选" : `筛选：${QUICK_FILTER_LABELS[normalizedFilter]}`);
        $(".jhs-mobile-filter-label").text(`筛选：${QUICK_FILTER_LABELS[normalizedFilter]}`), $(".jhs-mobile-filter-option").attr("aria-checked", "false").filter(`[data-jhs-filter="${normalizedFilter}"]`).attr("aria-checked", "true");
    }

    /** @param {unknown} filter @returns {ReturnType<typeof normalizeQuickFilterKey>} */
    setActiveFilter(filter) {
        this.activeFilter = normalizeQuickFilterKey(filter);
        return this.activeFilter;
    }

    getActiveFilter() { return this.activeFilter; }

    /** @param {unknown} filter */
    selectFilter(filter) {
        const normalized = this.setActiveFilter(filter);
        void Promise.resolve(this.onFilterChange(normalized, { syncUi: false })).catch((error) => this.logger.error("列表筛选刷新失败", error));
        this.syncQuickFilterUi(normalized);
    }

    /** @param {any} container */
    bindMovieDetailNavigation(container) {
        const root = $(container), selector = ".item img, .item .video-title";
        root.off("click.jhsMovieDetail auxclick.jhsMovieDetail", selector).on("click.jhsMovieDetail auxclick.jhsMovieDetail", selector, ((/** @type {any} */ event) => {
            if ("auxclick" === event.type && 1 !== event.button || "click" === event.type && event.button && 0 !== event.button) return;
            if (event.shiftKey || event.altKey || $(event.target).closest("div.meta-buttons,[class^='jhs-match-']").length) return;
            event.preventDefault(), event.stopPropagation();
            void Promise.resolve(this.onOpenMovieDetail($(event.currentTarget).closest(".item"), { event })).catch((error => this.logger.error("打开影片详情失败", error)));
        }));
        this.navigationRoot = root;
    }

    /** Bind native card video playback to the List Feature lifecycle. */
    /** @param {any} container */
    bindCardVideoPlayback(container) {
        const root = $(container);
        root.off("click.jhsListVideo", ".item video").on("click.jhsListVideo", ".item video", (async (/** @type {any} */ event) => {
            event.preventDefault();
            event.stopPropagation();
            const video = /** @type {HTMLVideoElement} */ (event.currentTarget);
            if (video.paused) await safePlay(video, { context: "列表视频", notify: true });
            else video.pause();
        }));
        this.videoRoot = root;
    }

    dispose() {
        this.filterPopover?.close();
        if (this.filterPopover) $(this.filterPopover.menu).off(".jhsListView");
        this.filterPopover = null;
        this.quickFilterRoot?.off(".jhsListView"), this.navigationRoot?.off("click.jhsMovieDetail auxclick.jhsMovieDetail", ".item img, .item .video-title");
        this.videoRoot?.off("click.jhsListVideo", ".item video");
        typeof document !== "undefined" && typeof $ === "function" && $(document).off("click.jhsQuickFilter");
        this.quickFilterRoot = null, this.navigationRoot = null, this.videoRoot = null;
    }
}
