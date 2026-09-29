// @ts-check

/** Owns the list-page lifecycle for delayed background task batches. */
export class TaskSchedulerController {
    /** @param {{window: Window & typeof globalThis, document: Document, events: any, storage: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, isListPage: () => boolean, runTask: () => Promise<unknown>, refreshConfiguration: () => Promise<unknown>, onError: (error: unknown) => void}} options */
    constructor(options) {
        this.window = options.window;
        this.document = options.document;
        this.events = options.events;
        this.storage = options.storage;
        this.scope = options.scope;
        this.isListPage = options.isListPage;
        this.runTask = options.runTask;
        this.refreshConfiguration = options.refreshConfiguration;
        this.onError = options.onError;
        /** @type {ReturnType<typeof setTimeout> | null} */
        this.timer = null;
        this.running = false;
        this.started = false;
        this.disposed = false;
    }

    /** Bind list-page listeners once and start the first eligible batch. */
    start() {
        if (this.started || this.disposed || this.scope.disposed || !this.isListPage()) return;
        this.scope.assertActive();
        this.started = true;
        this.scope.addCleanup(() => this.dispose());
        this.scope.listen(this.document, "visibilitychange", () => {
            if (this.document.hidden) this.clearSchedule();
            else this.scheduleTask(0);
        });
        this.scope.listen(this.window, "pagehide", () => this.clearSchedule());
        const unsubscribe = this.events?.on?.("settings-changed", () => this.refreshSchedule());
        if (typeof unsubscribe === "function") this.scope.addCleanup(unsubscribe);
        if (!this.document.hidden) void this.runAndSchedule();
    }

    /** Refresh due times after settings change, then run eligible work promptly. */
    async refreshSchedule() {
        try {
            this.storage.invalidateSettingCache?.();
            await this.refreshConfiguration();
            this.scheduleTask(0);
        } catch (error) {
            this.onError(error);
        }
    }

    clearSchedule() {
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
    }

    /** @param {number} [delay] */
    scheduleTask(delay = 3e5) {
        if (this.disposed || this.scope.disposed || !this.isListPage() || this.document.hidden) {
            this.clearSchedule();
            return;
        }
        this.clearSchedule();
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.runAndSchedule();
        }, delay);
    }

    async runAndSchedule() {
        if (this.disposed || this.scope.disposed || this.running || !this.isListPage() || this.document.hidden) return;
        this.running = true;
        try {
            await this.runTask();
        } catch (error) {
            this.onError(error);
        } finally {
            this.running = false;
            this.scheduleTask();
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.clearSchedule();
    }
}
