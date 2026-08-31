// @ts-check

/** Own the optional list-page jump control and its lifecycle listeners. */
export class ListPaginationController {
    /** @param {{scope: any, document?: Document, location?: Location, navigate?: (href: string) => void}} options */
    constructor(options) {
        this.scope = options.scope;
        this.document = options.document ?? globalThis.document ?? null;
        this.location = options.location ?? this.document?.defaultView?.location ?? globalThis.window?.location ?? null;
        this.navigate = options.navigate ?? ((href) => {
            if (this.location) this.location.href = href;
        });
        this.started = false;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    start() {
        this.scope.assertActive();
        if (this.started || this.disposed || !this.document) return;
        const list = this.document.querySelector(".pagination-list");
        if (!list || !this.document.querySelector(".pagination-link.is-current")) return;
        if (this.document.getElementById("gemini-jump-page-control")) {
            this.started = true;
            return;
        }
        const input = this.document.createElement("input");
        input.type = "number";
        input.className = "jhs-field jhs-jump-page-input";
        input.id = "jumpPageInput";
        input.placeholder = "页码";
        input.min = "1";
        input.value = String(Number.parseInt(new URLSearchParams(this.location?.search ?? "").get("page") ?? "1", 10) + 1);
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--secondary jhs-jump-page-btn";
        button.textContent = "跳转";
        const container = this.document.createElement("li");
        container.id = "gemini-jump-page-control";
        container.append(input, button);
        list.append(container);
        const navigate = () => {
            const page = Number.parseInt(input.value, 10);
            if (!Number.isInteger(page) || page < 1) {
                input.focus();
                return;
            }
            const current = this.location?.href;
            if (!current) return;
            const url = new URL(current);
            url.searchParams.set("page", String(page));
            this.navigate(url.toString());
        };
        this.scope.listen(button, "click", navigate);
        this.scope.listen(input, "keypress", (/** @type {KeyboardEvent} */ event) => {
            if (event.key !== "Enter" && event.keyCode !== 13) return;
            event.preventDefault();
            navigate();
        });
        this.started = true;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
    }
}
