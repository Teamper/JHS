// @ts-check

/**
 * Own discovery surfaces while their legacy plugins are being moved behind
 * the Discovery Feature API.
 */
export class DiscoveryController {
    /** @param {{hitShowController?: any, hitShowPlugin?: any, top250Controller?: any, top250Plugin?: any, newVideoPlugin?: any, taskPlugin?: any, scope: any}} options */
    constructor(options) {
        this.hitShowController = options.hitShowController ?? options.hitShowPlugin ?? null;
        this.top250Controller = options.top250Controller ?? options.top250Plugin ?? null;
        this.newVideoPlugin = options.newVideoPlugin ?? null;
        this.taskPlugin = options.taskPlugin ?? null;
        this.scope = options.scope;
        this.started = false;
        this.idleHandle = null;
        this.idleIsCallback = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        const taskApi = this.getApi();
        this.newVideoPlugin?.setTaskApi?.(taskApi);
        return Promise.resolve()
            .then(() => this.hitShowController?.start ? this.hitShowController.start({ discoveryApi: this.getApi() }) : this.hitShowController?.handle?.({ scope: this.scope, discoveryApi: this.getApi() }))
            .then(() => this.top250Controller?.start ? this.top250Controller.start({ discoveryApi: this.getApi() }) : this.top250Controller?.handle?.({ scope: this.scope, discoveryApi: this.getApi() }))
            .then(() => {
                if (!this.newVideoPlugin && !this.taskPlugin) return;
                const runIdle = () => {
                    this.idleHandle = null;
                    this.idleIsCallback = false;
                    if (this.scope.disposed || !this.started) return;
                    Promise.resolve()
                        .then(() => this.newVideoPlugin?.handle?.({ scope: this.scope, taskApi }))
                        .then(() => this.taskPlugin?.handle?.({ scope: this.scope }))
                        .catch((error) => {
                            clog.error("Discovery 空闲初始化失败", error);
                            this.dispose();
                        });
                };
                if (typeof requestIdleCallback === "function") {
                    this.idleIsCallback = true;
                    this.idleHandle = requestIdleCallback(runIdle, { timeout: 1500 });
                } else {
                    this.idleHandle = setTimeout(runIdle, 100);
                }
            })
            .catch((error) => {
                this.dispose();
                throw error;
            });
    }

    /** Expose only discovery capabilities needed by other Features. */
    getApi() {
        /** @param {any} plugin @param {string} method @param {any[]} args */
        const invoke = (plugin, method, args) => plugin?.[method]?.(...args);
        /** @param {any} plugin @param {string} method @returns {((...args: any[]) => any) | undefined} */
        const expose = (plugin, method) => plugin ? /** @type {(...args: any[]) => any} */ ((...args) => invoke(plugin, method, args)) : undefined;
        return Object.freeze({
            hasHitShow: Boolean(this.hitShowController),
            markDataListHtml: expose(this.hitShowController, "markDataListHtml"),
            initializeRenderedList: expose(this.hitShowController, "initializeRenderedList"),
            loadScore: expose(this.hitShowController, "loadScore"),
            hasTop250: Boolean(this.top250Controller),
            openLoginDialog: expose(this.top250Controller, "openLoginDialog"),
            hasNewVideo: Boolean(this.newVideoPlugin),
            openNewVideoDialog: expose(this.newVideoPlugin, "openDialog"),
            getPendingNewVideoTotal: expose(this.newVideoPlugin, "getPendingNewVideoTotal"),
            resetNewVideoButtonTip: expose(this.newVideoPlugin, "resetBtnTip"),
            resetBtnTip: expose(this.newVideoPlugin, "resetBtnTip"),
            hasTask: Boolean(this.taskPlugin),
            lastCheckFavoriteActressTimeKey: this.taskPlugin?.lastCheckFavoriteActressTimeKey ?? null,
            lastCheckNewVideoTimeKey: this.taskPlugin?.lastCheckNewVideoTimeKey ?? null,
            getTaskSchedule: expose(this.taskPlugin, "getTaskSchedule"),
            getTaskStatusSnapshot: expose(this.taskPlugin, "getTaskStatusSnapshot"),
            checkBlacklist: expose(this.taskPlugin, "checkBlacklist"),
            checkFavoriteActress: expose(this.taskPlugin, "checkFavoriteActress"),
            checkNewVideo: expose(this.taskPlugin, "checkNewVideo"),
            checkOneNewVideo: expose(this.taskPlugin, "checkOneNewVideo"),
            isNetworkBlocked: expose(this.taskPlugin, "isNetworkBlocked"),
            singleTaskKey: this.taskPlugin?.singleTaskKey ?? null,
        });
    }

    dispose() {
        this.started = false;
        if (this.idleHandle === null) return;
        if (this.idleIsCallback && typeof cancelIdleCallback === "function") cancelIdleCallback(this.idleHandle);
        else clearTimeout(this.idleHandle);
        this.idleHandle = null;
        this.idleIsCallback = false;
    }
}
