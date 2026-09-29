// @ts-check

/** Transitional API bridge for settings and manual scan entry points that still use the 6.5.1 TaskPlugin name. */
export class TaskCompatibilityBean {
    constructor() {
        this.service = null;
        this.featureNewVideoScanController = null;
        this.featureBlacklistScanController = null;
        /** @type {Set<{resolve: (service: any) => void, cleanup: () => void}>} */
        this.serviceWaiters = new Set();
        const shellProperties = new Set([
            "service", "featureNewVideoScanController", "featureBlacklistScanController", "serviceWaiters", "waitForService",
            "getName", "connect", "disconnect", "attachFeatureNewVideoScanController",
            "detachFeatureNewVideoScanController", "attachFeatureBlacklistScanController",
            "detachFeatureBlacklistScanController",
        ]);
        return new Proxy(this, {
            get: (target, property, receiver) => {
                const service = target.service;
                if (!shellProperties.has(String(property)) && service && property in service) {
                    const value = service[property];
                    return typeof value === "function" ? value.bind(service) : value;
                }
                return Reflect.get(target, property, receiver);
            },
            set: (target, property, value, receiver) => {
                const service = target.service;
                if (!shellProperties.has(String(property)) && service && property in service) return Reflect.set(service, property, value, service);
                return Reflect.set(target, property, value, receiver);
            },
        });
    }

    getName() { return "TaskPlugin"; }
    get singleTaskKey() { return "checkNewActressActorFilterCar"; }
    get lastCheckFavoriteActressTimeKey() { return "jhs_time_checkFavoriteActress"; }
    get lastCheckBlacklistTimeKey() { return "jhs_time_checkBlacklist"; }
    get lastCheckNewVideoTimeKey() { return "jhs_time_checkNewVideo"; }
    get lastCheckFavoriteActressAttemptKey() { return "jhs_time_checkFavoriteActress_attempt"; }
    get lastCheckFavoriteActressNextKey() { return "jhs_time_checkFavoriteActress_next"; }
    get lastCheckBlacklistAttemptKey() { return "jhs_time_checkBlacklist_attempt"; }
    get lastCheckBlacklistNextKey() { return "jhs_time_checkBlacklist_next"; }
    get lastCheckNewVideoAttemptKey() { return "jhs_time_checkNewVideo_attempt"; }
    get lastCheckNewVideoNextKey() { return "jhs_time_checkNewVideo_next"; }

    /** @param {string} name */
    getTaskStatusSnapshot(name) { return this.service?.getTaskStatusSnapshot(name) ?? { name, state: "idle", completedAt: null, attemptAt: null, nextAt: 0, isPending: false, pendingUntil: null }; }

    /** @param {boolean} [force] */
    async checkBlacklist(force) { return (await this.waitForService()).checkBlacklist(force); }
    /** @param {boolean} [force] */
    checkFavoriteActress(force) { return this.requireService().checkFavoriteActress(force); }
    /** @param {boolean} [force] */
    checkNewVideo(force) { return this.requireService().checkNewVideo(force); }
    /** @param {any} actress */
    checkOneNewVideo(actress) { return this.requireService().checkOneNewVideo(actress); }
    doTask() { return this.requireService().doTask(); }
    /** @param {boolean} [recalculate] */
    invalidateConfig(recalculate) { return this.requireService().invalidateConfig(recalculate); }

    /** @param {any} service */
    connect(service) {
        if (!service) throw new TypeError("TaskExecutionService is required");
        this.service = service;
        for (const waiter of [...this.serviceWaiters]) {
            waiter.cleanup();
            waiter.resolve(service);
        }
        if (this.featureNewVideoScanController) service.attachFeatureNewVideoScanController(this.featureNewVideoScanController);
        if (this.featureBlacklistScanController) service.attachFeatureBlacklistScanController(this.featureBlacklistScanController);
    }

    /** @param {any} service */
    disconnect(service) {
        if (this.service !== service) return;
        this.service = null;
    }

    /** @param {any} controller */
    attachFeatureNewVideoScanController(controller) {
        this.featureNewVideoScanController = controller;
        this.service?.attachFeatureNewVideoScanController(controller);
    }

    /** @param {any} controller */
    detachFeatureNewVideoScanController(controller) {
        if (this.featureNewVideoScanController !== controller) return;
        this.featureNewVideoScanController = null;
        this.service?.detachFeatureNewVideoScanController(controller);
    }

    /** @param {any} controller */
    attachFeatureBlacklistScanController(controller) {
        this.featureBlacklistScanController = controller;
        this.service?.attachFeatureBlacklistScanController(controller);
    }

    /** @param {any} controller */
    detachFeatureBlacklistScanController(controller) {
        if (this.featureBlacklistScanController !== controller) return;
        this.featureBlacklistScanController = null;
        this.service?.detachFeatureBlacklistScanController(controller);
    }

    requireService() {
        if (!this.service) throw new Error("定时扫描 Feature 尚未就绪");
        return this.service;
    }

    /** Wait briefly for the idle scheduler Feature when an entry point is used during startup. */
    /** @param {number} [timeoutMs] @param {AbortSignal} [signal] */
    waitForService(timeoutMs = 10_000, signal) {
        if (signal?.aborted) return Promise.reject(Object.assign(new Error("后台任务等待已取消"), { name: "AbortError" }));
        if (this.service) return Promise.resolve(this.service);
        return new Promise((resolve, reject) => {
            const onAbort = () => {
                waiter.cleanup();
                reject(Object.assign(new Error("后台任务等待已取消"), { name: "AbortError" }));
            };
            const waiter = { resolve, cleanup: () => {
                this.serviceWaiters.delete(waiter);
                clearTimeout(timer);
                signal?.removeEventListener("abort", onAbort);
            } };
            const timer = setTimeout(() => {
                waiter.cleanup();
                reject(new Error("后台任务尚未就绪，请稍后重试"));
            }, timeoutMs);
            this.serviceWaiters.add(waiter);
            signal?.addEventListener("abort", onAbort, { once: true });
            if (signal?.aborted) onAbort();
        });
    }
}
