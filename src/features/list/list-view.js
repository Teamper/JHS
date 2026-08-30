// @ts-check

import { PRIMARY_QUICK_FILTERS, QUICK_FILTER_LABELS, SECONDARY_QUICK_FILTERS, normalizeQuickFilterKey, shouldShowItem } from "./list-filters.js";

/** @param {string} value @param {any} fallback */
function parseData(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
}

/** Own list-item visibility, quick-filter controls, and list navigation. */
export class ListView {
    /** @param {{hostAdapter: any, selectors: Record<string, string>, onFilterChange?: (filter: unknown, options?: any) => any, onOpenMovieDetail?: (item: any, options?: any) => any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.selectors = Object.freeze({ ...options.selectors });
        this.onFilterChange = options.onFilterChange ?? (() => {});
        this.onOpenMovieDetail = options.onOpenMovieDetail ?? (() => {});
        /** @type {any} */ this.quickFilterRoot = null;
        /** @type {any} */ this.navigationRoot = null;
    }

    /** @param {Element[] | null} items @param {unknown} filter */
    applyVisibility(items, filter) {
        const elements = items ? $(items) : $(this.selectors.itemSelector), normalizedFilter = normalizeQuickFilterKey(filter);
        elements.each(((/** @type {number} */ _index, /** @type {Element} */ element) => {
            const item = $(element), flags = parseData(item.attr("data-jhs-flags") || "{}", {}), visibilityReasons = parseData(item.attr("data-jhs-visibility") || "{}", {}), recent = item.attr("data-jhs-recent") === "yes";
            shouldShowItem({ filter: normalizedFilter, flags, visibilityReasons, recent }) ? item.show() : item.hide();
        }));
    }

    /** @param {unknown} initialFilter */
    async createQuickFilter(initialFilter) {
        if (this.quickFilterRoot?.length) {
            this.syncQuickFilterUi(initialFilter);
            return;
        }
        const primaryHtml = PRIMARY_QUICK_FILTERS.map((filter => `<button type="button" role="tab" class="jhs-btn jhs-segmented__item" aria-selected="false" tabindex="-1" data-jhs-filter="${filter}">${QUICK_FILTER_LABELS[filter]}</button>`)).join(""),
            secondaryHtml = SECONDARY_QUICK_FILTERS.map(((filter, index) => `${1 === index ? '<div class="jhs-filter-menu__separator" role="separator"></div>' : ""}<button type="button" role="menuitemradio" class="jhs-btn jhs-btn--ghost jhs-filter-option" aria-checked="false" tabindex="-1" data-jhs-filter="${filter}">${QUICK_FILTER_LABELS[filter]}</button>`)).join(""),
            markup = `<div id="jhs-quick-filter" class="jhs-quick-filter">
                <div class="jhs-quick-filter__primary jhs-segmented" role="tablist" aria-label="状态筛选">${primaryHtml}</div>
                <div class="jhs-quick-filter__more">
                    <button type="button" class="jhs-btn jhs-btn--secondary jhs-quick-filter__toggle" aria-haspopup="menu" aria-expanded="false"><span class="jhs-quick-filter__label">更多筛选</span> ▾</button>
                    <div class="jhs-popover jhs-commandbar__menu jhs-quick-filter__menu" role="menu" aria-label="更多筛选">${secondaryHtml}</div>
                </div>
            </div>`,
            box = $(this.selectors.boxSelector).first();
        if (!box.length) return;
        box.before(markup);
        const root = $("#jhs-quick-filter"), toggle = root.find(".jhs-quick-filter__toggle"), menu = root.find(".jhs-quick-filter__menu"), closeMenu = (restoreFocus = !1) => {
            menu.removeClass("is-open"), toggle.attr("aria-expanded", "false"), restoreFocus && toggle.trigger("focus");
        };
        root.off(".jhsListView").on("click.jhsListView", ".jhs-segmented__item", ((/** @type {any} */ event) => void this.onFilterChange($(event.currentTarget).data("jhs-filter"))))
            .on("keydown.jhsListView", ".jhs-segmented__item", ((/** @type {any} */ event) => {
                if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(event.key)) return;
                event.preventDefault();
                const tabs = root.find(".jhs-segmented__item"), index = tabs.index(event.currentTarget), next = "Home" === event.key ? 0 : "End" === event.key ? tabs.length - 1 : "ArrowRight" === event.key ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
                tabs.eq(next).trigger("click").trigger("focus");
            })).on("click.jhsListView", ".jhs-filter-option", ((/** @type {any} */ event) => {
                void this.onFilterChange($(event.currentTarget).data("jhs-filter")), closeMenu(!0);
            })).on("keydown.jhsListView", ".jhs-filter-option", ((/** @type {any} */ event) => {
                const items = menu.find(".jhs-filter-option"), index = items.index(event.currentTarget);
                if ("Escape" === event.key) return event.preventDefault(), closeMenu(!0);
                if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
                event.preventDefault();
                const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
                items.eq(next).trigger("focus");
            }));
        toggle.off(".jhsListView").on("click.jhsListView", ((/** @type {any} */ event) => {
            event.preventDefault(), event.stopPropagation();
            const open = !menu.hasClass("is-open");
            menu.toggleClass("is-open", open), toggle.attr("aria-expanded", String(open)), open && (menu.find('[aria-checked="true"]').first().length ? menu.find('[aria-checked="true"]').first() : menu.find(".jhs-filter-option").first()).trigger("focus");
        })), $(document).off("click.jhsQuickFilter").on("click.jhsQuickFilter", ((/** @type {any} */ event) => {
            $(event.target).closest(root).length || closeMenu();
        }));
        this.quickFilterRoot = root;
        await this.onFilterChange(initialFilter);
    }

    /** @param {unknown} filter */
    syncQuickFilterUi(filter) {
        const normalizedFilter = normalizeQuickFilterKey(filter), isPrimary = PRIMARY_QUICK_FILTERS.includes(normalizedFilter), root = this.quickFilterRoot?.length ? this.quickFilterRoot : $("#jhs-quick-filter"), tabs = root.find(".jhs-segmented__item"), options = root.find(".jhs-filter-option");
        tabs.removeClass("active").attr({ "aria-selected": "false", tabindex: "-1" });
        isPrimary ? tabs.filter(`[data-jhs-filter="${normalizedFilter}"]`).addClass("active").attr({ "aria-selected": "true", tabindex: "0" }) : tabs.first().attr("tabindex", "0");
        options.attr("aria-checked", "false").filter(`[data-jhs-filter="${normalizedFilter}"]`).attr("aria-checked", "true");
        root.find(".jhs-quick-filter__label").text(isPrimary ? "更多筛选" : `筛选：${QUICK_FILTER_LABELS[normalizedFilter]}`);
        $(".jhs-mobile-filter-label").text(`筛选：${QUICK_FILTER_LABELS[normalizedFilter]}`), $(".jhs-mobile-filter-option").attr("aria-checked", "false").filter(`[data-jhs-filter="${normalizedFilter}"]`).attr("aria-checked", "true");
    }

    /** @param {any} container */
    bindMovieDetailNavigation(container) {
        const root = $(container), selector = ".item img, .item .video-title";
        root.off("click.jhsMovieDetail auxclick.jhsMovieDetail", selector).on("click.jhsMovieDetail auxclick.jhsMovieDetail", selector, ((/** @type {any} */ event) => {
            if ("auxclick" === event.type && 1 !== event.button || "click" === event.type && event.button && 0 !== event.button) return;
            if (event.shiftKey || event.altKey || $(event.target).closest("div.meta-buttons,[class^='jhs-match-']").length) return;
            event.preventDefault(), event.stopPropagation();
            void Promise.resolve(this.onOpenMovieDetail($(event.currentTarget).closest(".item"), { event })).catch((error => clog.error("打开影片详情失败", error)));
        }));
        this.navigationRoot = root;
    }

    dispose() {
        this.quickFilterRoot?.off(".jhsListView"), this.navigationRoot?.off("click.jhsMovieDetail auxclick.jhsMovieDetail", ".item img, .item .video-title");
        typeof document !== "undefined" && typeof $ === "function" && $(document).off("click.jhsQuickFilter");
        this.quickFilterRoot = null, this.navigationRoot = null;
    }
}
