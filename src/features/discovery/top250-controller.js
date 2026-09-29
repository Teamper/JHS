// @ts-check

/** Test only the native magnet tag; a playable subtitle badge has a different meaning. */
/** @param {Element} item */
export function hasChineseSubtitleMagnet(item) {
    return [...item.querySelectorAll(".tags .tag")].some((tag) => /中字磁[链鏈]/u.test(tag.textContent || ""));
}

/** Add the subtitle-magnet filter without taking ownership of JavDB's native ranking controls. */
export class Top250Controller {
    /** @param {{hostAdapter: any, styles: any, scope: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? null;
        this.styles = options.styles;
        this.scope = options.scope;
        this.controls = null;
        this.started = false;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    start() {
        this.scope.assertActive();
        if (this.started || this.disposed || !this.document) return;
        this.started = true;
        if (this.hostAdapter?.getPageContext?.().kind !== "top250-ranking") return;
        const listRoot = this.hostAdapter.locateListRoot?.(), container = this.hostAdapter.getTop250FilterContainer?.();
        if (!listRoot || !container || container.querySelector(".jhs-top250-subtitle")) return;

        const releaseStyle = this.styles.register("jhs-top250-subtitle-feature", ".jhs-top250-subtitle{display:flex;gap:var(--jhs-space-2);max-width:100%;overflow-x:auto;margin:var(--jhs-space-3) 0}.jhs-top250-subtitle .jhs-btn{flex-shrink:0;white-space:nowrap}.jhs-top250-subtitle-hidden{display:none!important}");
        this.scope.addCleanup(releaseStyle);

        const controls = this.document.createElement("div");
        controls.className = "jhs-top250-subtitle";
        controls.setAttribute("role", "group");
        controls.setAttribute("aria-label", "TOP250 已加载条目筛选");
        for (const [value, label] of [["all", "已加载条目：全部"], ["with", "已加载条目：含中字磁链"], ["without", "已加载条目：无中字磁链"]]) {
            const button = this.document.createElement("button");
            button.type = "button";
            button.className = "jhs-btn jhs-btn--secondary";
            button.dataset.jhsSubtitle = value;
            button.textContent = label;
            controls.append(button);
        }
        this.hostAdapter.mountTop250SubtitleControls(controls);
        this.controls = controls;
        this.scope.addCleanup(() => {
            controls.remove();
            if (this.controls === controls) this.controls = null;
        });
        this.scope.listen(controls, "click", this.handleClick);

        const fromUrl = new URL(this.hostAdapter.location.href).searchParams.get("jhs_subtitle");
        const initialFilter = fromUrl === "with" || fromUrl === "without" ? fromUrl : "all";
        this.applySubtitleFilter(initialFilter, controls);
    }

    /** @param {string} value @param {Element} controls */
    applySubtitleFilter(value, controls) {
        for (const item of this.hostAdapter.locateTop250SubtitleCards()) {
            const hasSubtitleMagnet = hasChineseSubtitleMagnet(item);
            item.classList.toggle("jhs-top250-subtitle-hidden", value === "with" ? !hasSubtitleMagnet : value === "without" && hasSubtitleMagnet);
        }
        controls.querySelectorAll("button[data-jhs-subtitle]").forEach((button) => {
            const selected = button.getAttribute("data-jhs-subtitle") === value;
            button.setAttribute("aria-pressed", String(selected));
            button.classList.toggle("active", selected);
        });
        this.hostAdapter.syncTop250SubtitleLinks?.(value);
    }

    handleClick = (/** @type {Event} */ event) => {
        const target = /** @type {Element | null} */ (event.target), value = target?.closest?.("button[data-jhs-subtitle]")?.getAttribute("data-jhs-subtitle");
        if (!["all", "with", "without"].includes(value || "") || !this.controls || this.disposed) return;
        const url = new URL(this.hostAdapter.location.href), history = this.document?.defaultView?.history;
        if (!history) return;
        value === "all" ? url.searchParams.delete("jhs_subtitle") : url.searchParams.set("jhs_subtitle", /** @type {string} */ (value));
        history.replaceState(history.state, "", url.href);
        this.applySubtitleFilter(/** @type {string} */ (value), this.controls);
    };

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.controls?.remove();
        this.controls = null;
    }
}
