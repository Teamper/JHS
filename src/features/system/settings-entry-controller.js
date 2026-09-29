// @ts-check

/** Opens the lazy Settings Feature from the stable desktop entry points. */
export class SettingsEntryController {
    /** @param {{document: Document, scope: import("../../core/lifecycle-scope.js").LifecycleScope, initializeSurface: () => void, executeCommand: (command: string) => Promise<unknown>, closeQuickSettings: () => void, lowZIndex: () => void, onError: (error: unknown) => void}} options */
    constructor(options) {
        this.document = options.document;
        this.scope = options.scope;
        this.initializeSurface = options.initializeSurface;
        this.executeCommand = options.executeCommand;
        this.closeQuickSettings = options.closeQuickSettings;
        this.lowZIndex = options.lowZIndex;
        this.onError = options.onError;
        this.started = false;
    }

    start() {
        if (this.started || this.scope.disposed) return;
        this.started = true;
        queueMicrotask(() => {
            if (this.scope.disposed) return;
            try { this.initializeSurface(); } catch (error) { this.onError(error); }
        });
        this.scope.listen(this.document, "click", (event) => {
            const view = this.document.defaultView;
            const target = view && event.target instanceof view.Element ? event.target.closest("#setting-btn, #mini-setting-btn") : null;
            if (!target) return;
            event.preventDefault();
            try { this.closeQuickSettings(); } catch (error) { this.onError(error); }
            try { this.lowZIndex(); } catch (error) { this.onError(error); }
            void this.executeCommand("settings.open").catch((error) => this.onError(error));
        });
    }
}
