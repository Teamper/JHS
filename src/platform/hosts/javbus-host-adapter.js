// @ts-check

export class JavBusHostAdapter {
    /** @param {Document} [documentRuntime] @param {Location} [locationRuntime] */
    constructor(documentRuntime = document, locationRuntime = window.location) { this.document = documentRuntime; this.location = locationRuntime; }
    detectRoute() { return this.locateNativeMagnets() ? "detail" : this.locateListRoot() ? "list" : "other"; }
    readMovieRef() {
        const carNum = this.document.querySelector(".info p span, [data-car-number]")?.textContent?.trim() ?? null;
        return carNum ? Object.freeze({ carNum, url: this.location.href, site: "javbus" }) : null;
    }
    locateListRoot() { return this.document.querySelector(".masonry"); }
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
}
