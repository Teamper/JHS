// @ts-check

/** Own actor-page tag expansion persistence and its lifecycle listener. */
export class ListTagExpandController {
    /** @param {{scope: any, document?: Document, location?: Location, storage?: any}} options */
    constructor(options) {
        this.scope = options.scope;
        this.document = options.document ?? globalThis.document ?? null;
        this.location = options.location ?? this.document?.defaultView?.location ?? globalThis.window?.location ?? null;
        this.storage = options.storage ?? null;
        this.started = false;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    start() {
        this.scope.assertActive();
        if (this.started || this.disposed || !this.document || !this.location?.href.includes("actors")) return;
        const button = this.document.querySelector(".tag-expand");
        const content = this.document.querySelector(".actor-tags .content");
        if (!button || !content || !this.storage) return;
        this.started = true;
        this.scope.listen(button, "click", () => {
            this.storage.setLocal("jhs_tag_expand", String(!content.classList.contains("collapse")));
        });
        if (this.storage.getLocal("jhs_tag_expand") === "true" && content.classList.contains("collapse")) {
            /** @type {any} */ (button).click?.();
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
    }
}
