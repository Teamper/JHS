// @ts-check

export class JavBusHostAdapter {
    /** @param {Document} [documentRuntime] @param {Location} [locationRuntime] */
    constructor(documentRuntime = document, locationRuntime = window.location) { this.site = "javbus"; this.document = documentRuntime; this.location = locationRuntime; }
    detectRoute() { return this.locateNativeMagnets() ? "detail" : this.locateListRoot() ? "list" : "other"; }
    readMovieRef() {
        const carNum = this.document.querySelector(".info p span, [data-car-number]")?.textContent?.trim() ?? null;
        return carNum ? Object.freeze({ carNum, url: this.location.href, site: "javbus" }) : null;
    }
    locateListRoot() { return this.document.querySelector(".masonry"); }
    locateListItems() { return [...(this.locateListRoot()?.querySelectorAll(":scope > .item, :scope > .movie-box") ?? [])]; }
    getListContainer() { return this.locateListRoot()?.parentElement ?? null; }
    getListLayoutContainer() { return this.document.querySelector(".container-fluid .row"); }
    /** @param {string[]} [classes] */
    createOwnedListRoot(classes = []) {
        const root = this.document.createElement("div");
        root.classList.add("masonry", ...classes);
        return root;
    }
    locateDetailRoot() { return this.locateNativeMagnets()?.closest(".container") ?? this.document.querySelector(".container .row.movie")?.parentElement ?? null; }
    locateDetailSlots() {
        const root = this.locateDetailRoot();
        return Object.freeze({
            summary: root?.querySelector('[data-jhs-slot="summary-actions"]') ?? root?.querySelector(".row.movie") ?? null,
            resources: this.locateNativeMagnets(),
            reviews: root?.querySelector('[data-jhs-slot="reviews"]') ?? this.document.querySelector("#reviews"),
            related: root?.querySelector('[data-jhs-slot="related"]'),
        });
    }
    locateNativeGallery() { return this.document.querySelector("#sample-waterfall, .sample-box"); }
    locateNativeMagnets() { return this.document.querySelector("#magnet-table"); }
    getDetailResourceBoundary() {
        const resourceRoot = this.locateNativeMagnets(), hostRoot = this.locateDetailRoot();
        if (!hostRoot || !resourceRoot) return null;
        return Object.freeze({
            site: "javbus", hostRoot, controller: resourceRoot, observeRoot: resourceRoot.parentElement, resourceRoot,
            resourceRegion: [...hostRoot.children].find((child) => child === resourceRoot || child.contains(resourceRoot)) || resourceRoot,
            rows: () => [...resourceRoot.querySelectorAll("tr")].filter((row) => row.querySelector('td a[href^="magnet:"],td a[href^="ed2k:"]')),
            sortSelect: null,
            getResource: (/** @type {Element} */ row) => row.querySelector('td a[href^="magnet:"],td a[href^="ed2k:"]')?.getAttribute("href") || "",
            getTitleTarget: (/** @type {Element} */ row) => row.querySelector("td:first-child a:first-child"),
            hasSubtitleTag: (/** @type {Element} */ row) => [...row.querySelectorAll("td:first-child a")].slice(1).some((anchor) => anchor.textContent?.includes("字幕")),
            getActionTarget(/** @type {Element} */ row) {
                const stable = [...row.querySelectorAll(".buttons,.actions,.btn-group")].filter((element) => element.closest("td")).at(-1);
                if (stable) return stable;
                const resourceLink = row.querySelector('td a[href^="magnet:"],td a[href^="ed2k:"]'), resourceCell = resourceLink?.closest("td");
                return resourceCell || null;
            },
            actionTargetRequiresWrapper: (/** @type {Element} */ row) => ![...row.querySelectorAll(".buttons,.actions,.btn-group")].some((element) => element.closest("td")),
        });
    }
}
