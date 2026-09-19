// @ts-check

export class ProfileService extends EventTarget {
    /** @param {{windowRuntime?: Window, scope: import("../core/lifecycle-scope.js").LifecycleScope, settings?: import("./settings-service.js").SettingsService}} options */
    constructor(options) {
        super();
        this.window = options.windowRuntime ?? window;
        this.scope = options.scope;
        this.settings = options.settings ?? null;
        this.coarseQuery = this.window.matchMedia("(any-pointer: coarse)");
        this.profile = this.calculate();
        this.started = false;
    }

    calculate() {
        const width = this.window.innerWidth;
        const mobileMode = /** @type {Readonly<Record<string, unknown>>} */ (this.settings?.snapshot() ?? {}).mobileMode;
        if (mobileMode === "on") return "compact";
        if (mobileMode === "off") return width >= 1200 ? "wide" : "regular";
        const shortSide = Math.min(this.window.innerWidth, this.window.innerHeight);
        if (width <= 767 || this.coarseQuery.matches && shortSide <= 480) return "compact";
        if (width >= 1200) return "wide";
        return "regular";
    }

    start() {
        if (this.started) return;
        this.started = true;
        const update = () => {
            const next = this.calculate();
            if (next === this.profile) return;
            const previous = this.profile;
            this.profile = next;
            this.dispatchEvent(new CustomEvent("profile.changed", { detail: Object.freeze({ previous, profile: next }) }));
        };
        this.scope.listen(this.window, "resize", update, { passive: true });
        this.scope.listen(this.window, "orientationchange", update, { passive: true });
        this.scope.listen(this.coarseQuery, "change", update);
        if (this.settings) this.scope.listen(this.settings, "settings.changed", update);
        update();
    }

    current() { return this.profile; }
}
