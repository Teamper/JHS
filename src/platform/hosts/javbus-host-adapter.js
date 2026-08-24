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
    locateDetailRoot() { return this.document.querySelector(".container .row.movie"); }
    locateDetailSlots() { return Object.freeze({ summary: this.locateDetailRoot(), resources: this.locateNativeMagnets(), reviews: this.document.querySelector("#reviews") }); }
    locateNativeGallery() { return this.document.querySelector("#sample-waterfall, .sample-box"); }
    locateNativeMagnets() { return this.document.querySelector("#magnet-table"); }
}
