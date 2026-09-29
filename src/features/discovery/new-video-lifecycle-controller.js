// @ts-check

/** Owns new-video startup events while the legacy adapter retains its data and dialog behavior. */
export class NewVideoLifecycleController {
    /** @param {{plugin: any, events: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, onError: (error: unknown) => void}} options */
    constructor(options) {
        this.plugin = options.plugin;
        this.events = options.events;
        this.scope = options.scope;
        this.onError = options.onError;
        this.started = false;
        this.disposed = false;
    }

    start() {
        if (this.started || this.disposed || this.scope.disposed) return false;
        this.scope.assertActive();
        this.started = true;
        this.scope.addCleanup(() => this.dispose());
        this.listen("new-video-changed", () => this.plugin.scheduleWorkspaceReload?.());
        this.listen("task-status-changed", () => {
            if (this.plugin.isWorkspaceMounted?.()) this.plugin.renderTaskStatuses?.();
        });
        try {
            this.plugin.prepareFeatureActivation?.();
            this.plugin.initializeLocalState?.();
        } catch (error) {
            this.onError(error);
        }
        Promise.resolve().then(() => this.plugin.showNewVideoCount?.()).catch((error) => {
            if (!this.disposed && !this.scope.disposed) this.onError(error);
        });
        return true;
    }

    /** Subscribe through the injected event service and let the Feature scope own cleanup. */
    /** @param {string} type @param {() => void} handler */
    listen(type, handler) {
        const unsubscribe = this.events?.on?.(type, handler);
        if (typeof unsubscribe === "function") this.scope.addCleanup(unsubscribe);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.plugin.dispose?.();
    }
}
