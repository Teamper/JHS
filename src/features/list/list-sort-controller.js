// @ts-check

import { classifyJavDbPage } from "../../core/site-context.js";

/** Feature-owned list ordering; the legacy contribution keeps only its menu presentation. */
export class ListSortController {
    /** @param {{hostAdapter: any, settings: any, document?: Document, location?: Location}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.settings = options.settings;
        this.document = options.document ?? options.hostAdapter?.document ?? globalThis.document;
        this.location = options.location ?? options.hostAdapter?.location ?? globalThis.location;
        this.ownedRankingSortOverride = null;
        this.disposed = false;
    }

    getPageContext() { return this.hostAdapter?.getPageContext?.() ?? classifyJavDbPage(this.location); }
    isOwnedRankingPage() { return this.hostAdapter?.site === "javdb" && ["movie-ranking", "playback-ranking", "top250-ranking"].includes(this.getPageContext()?.kind); }
    isExternalFc2CatalogPage() { return this.hostAdapter?.site === "javdb" && this.getPageContext()?.kind === "external-fc2-catalog"; }
    isFc2ListPage() { return this.hostAdapter?.site === "javdb" && this.location?.pathname === "/search_advanced" && new URLSearchParams(this.location.search).get("type") === "3"; }
    supportsLiveSorting() { return this.isOwnedRankingPage() || this.isFc2ListPage(); }

    isRestrictedContext() {
        const href = this.location?.href ?? "";
        return href.includes("/search?q") || href.includes("/search/") || href.includes("/users/");
    }

    supportsSorting() {
        if (this.supportsLiveSorting()) return true;
        if (this.hostAdapter?.site === "javdb" && this.location?.pathname === "/search_advanced") return false;
        return true;
    }

    activeSortMethod() {
        return this.isOwnedRankingPage() ? this.ownedRankingSortOverride || "default" : this.settings.snapshot().sortMethod || "default";
    }

    /** @param {string} method */
    async selectSortMethod(method) {
        if (this.disposed) return;
        if (this.isOwnedRankingPage()) {
            this.ownedRankingSortOverride = method;
            await this.sortItems(method);
            return;
        }
        await this.settings.set("sortMethod", method);
        await this.sortItems();
    }

    /** Keep historical sort keys and stable tie ordering while retaining card nodes and handlers. */
    /** @param {string} [methodOverride] */
    async sortItems(methodOverride) {
        if (this.disposed || !this.supportsSorting() || this.isRestrictedContext()) return;
        const live = this.supportsLiveSorting();
        const autoPage = this.settings.snapshot().autoPage ?? "yes";
        if (autoPage === "yes" && !live && methodOverride !== "default") return;
        const method = methodOverride || this.activeSortMethod();
        if (!method) return;
        const selectors = this.hostAdapter?.getListSelectors?.();
        if (!selectors?.boxSelector || !selectors?.itemSelector) return;
        const container = this.document.querySelector(selectors.boxSelector);
        if (!container) return;
        const elements = [...this.document.querySelectorAll(selectors.itemSelector)];
        elements.forEach((element, index) => {
            if (!element.hasAttribute("data-original-index")) element.setAttribute("data-original-index", String(index));
        });
        const items = elements.map((element, index) => {
            const originalIndex = Number(element.getAttribute("data-original-index")) || 0;
            if (method === "default") return { element, key: originalIndex, originalIndex, index };
            if (method === "rateCount") {
                const explicitValue = element.getAttribute("data-jhs-rate-count");
                const explicit = explicitValue == null ? Number.NaN : Number(explicitValue);
                const scoreText = element.querySelector(".score")?.textContent?.replaceAll(",", "") ?? "";
                const match = scoreText.match(/(?:由\s*)?(\d+)\s*人(?:评价)?/);
                return { element, key: Number.isFinite(explicit) ? explicit : match ? Number(match[1]) : 0, originalIndex, index };
            }
            const dateNode = [...element.querySelectorAll("date")].find((node) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(node.textContent?.trim() ?? ""));
            const value = element.getAttribute("data-jhs-publish-time") || element.querySelector(".meta")?.textContent?.trim() || dateNode?.textContent?.trim() || "";
            const timestamp = Date.parse(value);
            return { element, key: Number.isFinite(timestamp) ? timestamp : 0, originalIndex, index };
        });
        items.sort((left, right) => method === "default"
            ? left.key - right.key
            : right.key - left.key || left.originalIndex - right.originalIndex || left.index - right.index);
        const sorted = items.map((item) => item.element);
        if (method === "default") sorted.forEach((element) => container.append(element));
        else container.replaceChildren(...sorted);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.ownedRankingSortOverride = null;
    }
}
