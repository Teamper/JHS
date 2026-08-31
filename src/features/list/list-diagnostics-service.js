// @ts-check

/** Own browser-facing list phase diagnostics without coupling list services to the legacy page plugin. */
export class ListDiagnosticsService {
    /** @param {{scope: any, document?: Document, selectors: Record<string, string>, state: {listGeneration?: number, filterRevision?: number, activeQuickFilter?: unknown}}} options */
    constructor(options) {
        this.scope = options.scope;
        this.document = options.document ?? globalThis.document ?? null;
        this.selectors = Object.freeze({ ...options.selectors });
        this.state = options.state;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    /** Record one bounded phase sample for browser fixture diagnostics. @param {string} phase @param {number | null} [itemCount] */
    recordPhase(phase, itemCount = null) {
        if (this.disposed) return;
        const diagnostics = /** @type {any} */ (globalThis).__jhsBrowserDiagnostics;
        if (!diagnostics) return;
        const phases = diagnostics.listPhases ||= [];
        phases.push({
            phase,
            generation: this.state?.listGeneration ?? 0,
            filterRevision: this.state?.filterRevision ?? 0,
            activeQuickFilter: this.state?.activeQuickFilter || "waitCheck",
            itemCount: itemCount ?? this.document?.querySelectorAll?.(this.selectors.itemSelector)?.length ?? 0,
        });
        if (phases.length > 200) phases.splice(0, phases.length - 200);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
    }
}
