// @ts-check

export class JavDbHostAdapter {
    /** @param {Document} [documentRuntime] @param {Location} [locationRuntime] */
    constructor(documentRuntime = document, locationRuntime = window.location) { this.document = documentRuntime; this.location = locationRuntime; }
    detectRoute() {
        if (this.location.pathname.startsWith("/v/") || this.location.pathname.startsWith("/movies/")) return "detail";
        const listPath = /^\/(?:$|search|tags|actors|users\/|lists|series)/.test(this.location.pathname);
        return listPath && this.locateListRoot() ? "list" : "other";
    }
    readMovieRef() {
        const carNum = this.document.querySelector(".panel-block.first-block .value, [data-car-number]")?.textContent?.trim() ?? null;
        return carNum ? Object.freeze({ carNum, url: this.location.href, site: "javdb" }) : null;
    }
    locateListRoot() { return this.document.querySelector(".movie-list"); }
    locateDetailRoot() { return this.document.querySelector(".video-detail") ?? this.document.querySelector(".movie-panel-info")?.closest(".container") ?? this.document.querySelector("main"); }
    locateDetailSlots() {
        const root = this.locateDetailRoot();
        return Object.freeze({
            summary: root?.querySelector('[data-jhs-slot="summary-actions"]') ?? this.document.querySelector(".movie-panel-info"),
            resources: this.document.querySelector("#magnets-content"),
            reviews: root?.querySelector('[data-jhs-slot="reviews"]') ?? this.document.querySelector("#reviews"),
            related: root?.querySelector('[data-jhs-slot="related"]'),
        });
    }
    locateNativeGallery() { return this.document.querySelector(".tile-images, .preview-images"); }
    locateNativeMagnets() { return this.document.querySelector("#magnets-content"); }
}
