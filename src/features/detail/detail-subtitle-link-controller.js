// @ts-check

export class DetailSubtitleLinkController {
    /** @param {{document: Document, hostAdapter: any, movie: {sourceUrls: (movieRef: {carNum: string}, providers: string[]) => Array<{url: string}>}, ui: {openPage: (...args: any[]) => unknown}, scope: import("../../core/lifecycle-scope.js").LifecycleScope, onError?: (error: unknown) => void}} options */
    constructor(options) {
        this.document = options.document;
        this.hostAdapter = options.hostAdapter;
        this.movie = options.movie;
        this.ui = options.ui;
        this.scope = options.scope;
        this.onError = options.onError ?? null;
        this.started = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return false;
        this.started = true;
        this.scope.listen(this.document, "click", (event) => this.handleClick(event));
        return true;
    }

    /** @param {Event} event */
    handleClick(event) {
        const ElementConstructor = this.document.defaultView?.Element;
        if (!ElementConstructor || !(event.target instanceof ElementConstructor) || !event.target.closest("#search-subtitle-btn")) return;
        try {
            const carNum = this.hostAdapter.readMovieRef()?.carNum;
            if (!carNum) return;
            const url = this.movie.sourceUrls({ carNum }, ["subtitlecat"])[0]?.url;
            if (url) this.ui.openPage(url, carNum, false, event);
        } catch (error) {
            this.onError?.(error);
        }
    }
}
