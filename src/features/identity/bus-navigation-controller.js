// @ts-check

/** Own the JavBus image-search entry and its page-lifetime click handler. */
export class BusNavigationController {
    /** @param {{document: Document, openImageSearch?: (() => void) | null}} options */
    constructor(options) {
        this.document = options.document;
        this.openImageSearch = options.openImageSearch ?? null;
        /** @type {HTMLButtonElement[]} */
        this.buttons = [];
        this.disposed = false;
    }

    /** @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
    start(scope) {
        scope.assertActive();
        if (this.disposed || !this.openImageSearch) return false;
        if (this.buttons.length) return true;
        const targets = this.document.querySelectorAll("#navbar > div > div > span");
        for (const target of targets) {
            const button = this.document.createElement("button");
            button.type = "button";
            button.className = "jhs-btn btn btn-default jhs-layout-638cb2c9";
            button.id = "search-img-btn";
            button.textContent = "识图";
            button.addEventListener("click", this.handleClick);
            target.append(button);
            this.buttons.push(button);
        }
        scope.addCleanup(() => this.dispose());
        return this.buttons.length > 0;
    }

    /** @param {MouseEvent} event */
    handleClick = (event) => {
        event.preventDefault();
        if (!this.disposed) this.openImageSearch?.();
    };

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const button of this.buttons) {
            button.removeEventListener("click", this.handleClick);
            button.remove();
        }
        this.buttons = [];
    }
}
