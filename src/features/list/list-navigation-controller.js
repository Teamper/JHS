// @ts-check

/** Open list cards through the explicit UI capability while preserving 6.5.1 dialog semantics. */
export class ListNavigationController {
    /** @param {{hostAdapter: any, list: any, ui: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.list = options.list;
        this.ui = options.ui;
        this.disposed = false;
    }

    /** @param {any} item @param {{event?: MouseEvent | null, autoplay?: boolean, newTab?: boolean}} [options] */
    openMovieDetail(item, { event = null, autoplay = false, newTab = false } = {}) {
        if (this.disposed || !this.ui?.openPage || !this.list?.findCarNumAndHref) return;
        const card = item?.jquery ? item : this.ui.jquery(item);
        const { carNum, aHref } = this.list.findCarNumAndHref(card);
        if (!carNum || !aHref || carNum.includes("FC2-")) return;
        const shouldOpenTab = newTab || Boolean(event && (event.ctrlKey || event.metaKey || event.button === 1));
        const destination = new URL(aHref, this.hostAdapter.location.origin);
        if (autoplay) destination.searchParams.set("autoPlay", "1");
        return this.ui.openPage(destination.href, carNum, true, { event, newTab: shouldOpenTab });
    }

    dispose() { this.disposed = true; }
}
