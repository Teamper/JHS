// @ts-check

import { applyThemeMode } from "../../core/theme.js";
import { applyLayoutFromSettings } from "../../services/layout-settings-service.js";

/** Keep global settings effects alive independently of the lazy Settings UI. */
export class SettingsEffectsController {
    /** @param {{settings: any, profile?: any, imageLayout: any, hostAdapter?: any, diagnostics: any, logger: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, applyLayout?: typeof applyLayoutFromSettings, applyTheme?: typeof applyThemeMode}} options */
    constructor(options) {
        this.settings = options.settings;
        this.profile = options.profile ?? null;
        this.imageLayout = options.imageLayout;
        this.hostAdapter = options.hostAdapter ?? null;
        this.diagnostics = options.diagnostics;
        this.logger = options.logger;
        this.scope = options.scope;
        this.applyLayout = options.applyLayout ?? applyLayoutFromSettings;
        this.applyTheme = options.applyTheme ?? applyThemeMode;
    }

    start() {
        const snapshot = this.settings.snapshot();
        if ((snapshot.enableClog ?? "yes") === "yes") this.logger?.show?.();
        this.applyLayoutSafely();
        this.scope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => this.handleSettingsChanged(event));
        if (this.profile) this.scope.listen(this.profile, "profile.changed", () => this.applyLayoutSafely());
    }

    /** @param {any} event */
    handleSettingsChanged(event) {
        const names = /** @type {string[] | undefined} */ (event.detail?.names) ?? [];
        if (!names.length) return;
        const snapshot = this.settings.snapshot();
        if (names.includes("themeMode")) this.applyTheme(snapshot.themeMode);
        if (names.includes("enableClog")) {
            if (snapshot.enableClog === "yes") this.logger?.show?.();
            else this.logger?.hide?.();
        }
        if (names.some((name) => ["mobileMode", "enableVerticalModel", "containerColumns", "containerWidth"].includes(name))) {
            this.applyLayoutSafely();
        }
    }

    applyLayoutSafely() {
        Promise.resolve(this.applyLayout(this.settings.snapshot(), {
            imageLayout: this.imageLayout,
            hostAdapter: this.hostAdapter,
            ...(this.profile ? { mobile: this.profile.current() === "compact" } : {}),
        })).catch((error) => this.diagnostics.recordError({
            source: "settings-effects",
            message: error instanceof Error ? error.message : String(error),
        }));
    }
}
