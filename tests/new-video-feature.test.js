import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { createActressProfileBackfillState } from "../src/core/actress-profile-backfill-state.js";
import { PORT, SERVICE } from "../src/contracts/tokens.js";
import { newVideoFeature, schedulerFeature } from "../src/features/discovery/new-video-manifests.js";
import { NewVideoScanController } from "../src/features/discovery/new-video-scan-controller.js";
import { TaskExecutionService } from "../src/features/discovery/task-execution-service.js";
import { TaskCompatibilityBean } from "../src/compat/task-compatibility-bean.js";
import { NewVideoCompatibilityBean } from "../src/compat/new-video-compatibility-bean.js";
import { NEW_VIDEO_STYLES } from "../src/features/discovery/new-video-styles.js";
import { ListPageCompatibilityService } from "../src/features/list/list-compatibility-service.js";
import { SupplementaryCardsController } from "../src/features/list/supplementary-cards-controller.js";
import { NewVideoWorkspaceService } from "../src/plugins/new-video/new-video.js";

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

function createRuntime(id, plugin, events = { on: vi.fn(() => vi.fn()) }) {
    const compatibilityBean = id === "discovery.new-video" ? {
        createFeatureService: () => plugin,
        connect: vi.fn(),
        disconnect: vi.fn(),
    } : null;
    return {
        enabledContributions: [id],
        scope: new LifecycleScope(`feature:${id}`),
        diagnostics: { recordError: vi.fn() },
        resolveCompatibilityBean: vi.fn((name) => name === "NewVideoPlugin" ? compatibilityBean : name === "TaskPlugin" ? plugin : null),
        events,
    };
}

describe("new video and scheduler feature lifecycle", () => {
    it("declares the storage capability used to construct the workspace service", () => {
        expect(newVideoFeature.requires).toContain(SERVICE.storage);
    });

    it("keeps the old bean name as a forwarding-only Feature compatibility surface", async () => {
        const executeCommand = vi.fn(async (command, ...args) => ({ command, args }));
        const service = { openDialog: vi.fn(async () => "opened"), getPendingNewVideoTotal: vi.fn(async () => 4), getNewVideoFlatList: vi.fn(async () => []) };
        const bean = new NewVideoCompatibilityBean(executeCommand, () => service);
        expect(bean.getName()).toBe("NewVideoPlugin");
        await expect(bean.openDialog("from-legacy")).resolves.toEqual({ command: "new-video.open", args: ["from-legacy"] });

        bean.getNewVideoFlatList = vi.fn(async () => ["early override"]);
        bean.connect(service);
        expect(bean.createFeatureService({})).toBe(service);
        await expect(bean.openDialog()).resolves.toBe("opened");
        await expect(bean.getPendingNewVideoTotal()).resolves.toBe(4);
        await expect(bean.getNewVideoFlatList()).resolves.toEqual(["early override"]);
        bean.getNewVideoFlatList = vi.fn(async () => ["feature override"]);
        await expect(service.getNewVideoFlatList()).resolves.toEqual(["feature override"]);
        bean.disconnect(service);
        expect(bean.service).toBeNull();
    });

    it("loads new-video styles with idle activation under a disposable feature scope", async () => {
        const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://javdb.com/" });
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("window", dom.window);
        let loadFeatureStyles;
        const releaseStyle = vi.fn(), handlers = new Map(), events = {
            on: vi.fn((type, handler) => { handlers.set(type, handler); return () => handlers.delete(type); }),
        }, plugin = {
            prepareFeatureActivation: vi.fn(), attachFeatureNewVideoStyleLoader: vi.fn((loader) => { loadFeatureStyles = loader; }),
            detachFeatureNewVideoStyleLoader: vi.fn(), initializeLocalState: vi.fn(), showNewVideoCount: vi.fn(),
            attachFeatureNewVideoBatchController: vi.fn(), detachFeatureNewVideoBatchController: vi.fn(),
            attachFeatureNewVideoWorkspaceController: vi.fn(), detachFeatureNewVideoWorkspaceController: vi.fn(),
            attachFeatureNewVideoScanController: vi.fn(), detachFeatureNewVideoScanController: vi.fn(),
            openDialog: vi.fn(),
            scheduleWorkspaceReload: vi.fn(), isWorkspaceMounted: vi.fn(() => true), renderTaskStatuses: vi.fn(), dispose: vi.fn(),
        };
        const state = {
            patch: vi.fn(), getNewVideoDecisions: vi.fn(async () => ({})),
            getCarMap: vi.fn(async () => new Map()), getFavoriteActressList: vi.fn(async () => []), getBlacklistCarList: vi.fn(async () => []),
        };
        const settings = { snapshot: vi.fn(() => ({ checkNewVideo_ruleTime: 8760 })) };
        const movie = { externalSiteOrigin: vi.fn(() => "https://javdb.com") };
        const titleKeywords = { getAll: vi.fn(async () => []) }, actressInfo = { movies: vi.fn(async () => []) }, logger = { html: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const styles = { register: vi.fn(() => releaseStyle) }, runtime = createRuntime("discovery.new-video", plugin, events);

        expect(Object.hasOwn(NewVideoWorkspaceService.prototype, "initCss")).toBe(false);
        const dependencies = {
            [PORT.style]: styles, [SERVICE.events]: events, [SERVICE.state]: state, [SERVICE.settings]: settings,
            [SERVICE.movie]: movie, [SERVICE.titleKeywords]: titleKeywords, [SERVICE.actressInfo]: actressInfo,
            [SERVICE.legacyUtils]: { getNowStr: () => "2026-08-01 00:00:00" }, [SERVICE.legacyStorage]: {},
            [SERVICE.domUi]: { jquery: vi.fn(), createImageHoverPreview: vi.fn() },
            [SERVICE.notifications]: { error: vi.fn() }, [SERVICE.clog]: logger,
        };
        const result = await newVideoFeature.activate(dependencies, runtime);
        expect(styles.register).not.toHaveBeenCalled();
        await loadFeatureStyles();
        expect(styles.register).toHaveBeenCalledWith("feature-new-video-workspace", NEW_VIDEO_STYLES);
        expect(NEW_VIDEO_STYLES).toContain(".newVideoToolBox");
        expect(plugin.prepareFeatureActivation).toHaveBeenCalledOnce();
        expect(plugin.attachFeatureNewVideoBatchController).toHaveBeenCalledOnce();
        const batchController = plugin.attachFeatureNewVideoBatchController.mock.calls[0][0];
        await batchController.run("favorite", [{ carNum: "ABC-001" }]);
        expect(state.patch).toHaveBeenCalledWith(["ABC-001"], { favorite: true }, expect.objectContaining({ type: "new-video-batch-state" }));
        const workspaceController = plugin.attachFeatureNewVideoWorkspaceController.mock.calls[0][0];
        const scanController = plugin.attachFeatureNewVideoScanController.mock.calls[0][0];
        expect(scanController).toBeDefined();
        await expect(scanController.scanActresses({ baseUrl: "https://javdb.com", concurrency: 2, sleepMs: 0, intervalHours: 12, ruleHours: 8760, force: false, isUnnecessaryCheck: () => false, isNetworkBlocked: () => false, sleep: async () => {} })).resolves.toMatchObject({ actressCount: 0, eligibleCount: 0 });
        expect(await workspaceController.getPendingSummary()).toEqual({ count: 0, decisions: {} });
        expect(await workspaceController.loadWorkspace()).toEqual({ actresses: [], carMap: expect.any(Map), decisions: {}, items: [], measurementsByStarId: expect.any(Map), ruleTime: 8760, javDbUrl: "https://javdb.com" });
        expect(movie.externalSiteOrigin).toHaveBeenCalledWith("javDbBtn", { checkNewVideo_ruleTime: 8760 });
        expect(plugin.initializeLocalState).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(plugin.showNewVideoCount).toHaveBeenCalledOnce());
        expect(events.on).toHaveBeenCalledWith("new-video-changed", expect.any(Function));
        expect(events.on).toHaveBeenCalledWith("task-status-changed", expect.any(Function));
        const removal = { reason: "browse", carNums: ["ABC-123"] };
        handlers.get("new-video-changed")(removal);
        expect(plugin.scheduleWorkspaceReload).toHaveBeenCalledExactlyOnceWith(removal);
        handlers.get("task-status-changed")();
        expect(plugin.renderTaskStatuses).toHaveBeenCalledOnce();
        expect(result.activeContributions).toEqual(["discovery.new-video"]);
        await result.commands["new-video.open"]();
        expect(plugin.openDialog).toHaveBeenCalledOnce();

        expect(styles.register).toHaveBeenCalledWith("feature-new-video-workspace", NEW_VIDEO_STYLES);
        runtime.scope.dispose();
        expect(plugin.detachFeatureNewVideoStyleLoader).toHaveBeenCalledOnce();
        expect(plugin.detachFeatureNewVideoBatchController).toHaveBeenCalledWith(batchController);
        expect(plugin.detachFeatureNewVideoWorkspaceController).toHaveBeenCalledWith(workspaceController);
        expect(plugin.detachFeatureNewVideoScanController).toHaveBeenCalledWith(scanController);
        await expect(batchController.run("favorite", [{ carNum: "ABC-001" }])).rejects.toMatchObject({ name: "AbortError" });
        await expect(workspaceController.loadWorkspace()).rejects.toMatchObject({ name: "AbortError" });
        await expect(scanController.parseActorMovies([{ carNum: "ABC-123" }], "actor-1", "Actor One", [], new Set())).rejects.toMatchObject({ name: "AbortError" });
        expect(plugin.dispose).toHaveBeenCalledOnce();
        expect(releaseStyle).toHaveBeenCalledOnce();
        expect(handlers.size).toBe(0);

        const nextRuntime = createRuntime("discovery.new-video", plugin, events);
        await newVideoFeature.activate(dependencies, nextRuntime);
        expect(plugin.prepareFeatureActivation).toHaveBeenCalledTimes(2);
        await vi.waitFor(() => expect(plugin.showNewVideoCount).toHaveBeenCalledTimes(2));
        nextRuntime.scope.dispose();
        dom.window.close();
    });

    it("does not resolve, style, or schedule a disabled contribution", async () => {
        const plugin = { attachFeatureNewVideoStyleLoader: vi.fn() }, runtime = createRuntime("discovery.new-video", plugin);
        runtime.enabledContributions = [];
        const styles = { register: vi.fn() };

        expect(await newVideoFeature.activate({ [PORT.style]: styles }, runtime)).toMatchObject({
            activeContributions: [], commands: { "new-video.open": expect.any(Function) },
        });
        expect(runtime.resolveCompatibilityBean).not.toHaveBeenCalled();
        expect(styles.register).not.toHaveBeenCalled();
        expect(plugin.initializeLocalState).toBeUndefined();
    });

    it("does not update the new-video count after its Feature is disposed", async () => {
        let resolveCount;
        const text = vi.fn(), plugin = Object.create(NewVideoWorkspaceService.prototype);
        plugin.disposed = false;
        plugin.getPendingNewVideoTotal = () => new Promise((resolve) => { resolveCount = resolve; });
        plugin.jquery = () => ({ text });

        const pending = plugin.showNewVideoCount();
        plugin.disposed = true;
        resolveCount(3);
        await pending;

        expect(text).not.toHaveBeenCalled();
    });

    it("owns scheduler startup and connects an injected execution service behind the legacy facade", async () => {
        const pageWindow = Object.assign(new EventTarget(), { isListPage: true });
        const pageDocument = Object.assign(new EventTarget(), { hidden: true });
        vi.stubGlobal("window", pageWindow);
        vi.stubGlobal("document", pageDocument);
        const taskBean = new TaskCompatibilityBean();
        const eventHandlers = new Map();
        const events = {
            on: vi.fn((name, handler) => {
                eventHandlers.set(name, handler);
                return () => eventHandlers.delete(name);
            }),
        };
        const storage = { invalidateSettingCache: vi.fn(), getLocal: vi.fn(() => null), setLocal: vi.fn() };
        const legacyStorage = { getSetting: vi.fn(async () => ({})) };
        const legacyUtils = { getNowStr: vi.fn(() => "2026-08-01 00:00:00"), sleep: vi.fn(async () => {}), getHourDifference: vi.fn(() => 100) };
        const logger = { log: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), html: vi.fn(), htmlDebug: vi.fn() };
        const runtime = createRuntime("discovery.scheduler", taskBean);

        const dependencies = {
            [PORT.javdbHost]: { getListSelectors: vi.fn(() => ({ boxSelector: ".movie-list", requestDomItemSelector: ".movie-list .item" })) },
            [PORT.javbusHost]: { getListSelectors: vi.fn(() => ({ boxSelector: ".masonry", requestDomItemSelector: "#waterfall .item" })) },
            [SERVICE.events]: events, [SERVICE.storage]: storage, [SERVICE.settings]: { snapshot: () => ({}) },
            [SERVICE.legacyStorage]: legacyStorage, [SERVICE.legacyUtils]: legacyUtils,
            [SERVICE.http]: { request: vi.fn() }, [SERVICE.actressInfo]: { movies: vi.fn(), collection: vi.fn() },
            [SERVICE.movie]: { externalSiteOrigin: vi.fn(async () => "https://javdb.com") }, [SERVICE.state]: {},
            [SERVICE.domUi]: { jquery: vi.fn(() => ({ text: vi.fn(), length: 0 })) }, [SERVICE.clog]: logger,
            [SERVICE.hostListParser]: { parseDetailPage: vi.fn() }, [SERVICE.notifications]: { error: vi.fn() },
        };
        const result = await schedulerFeature.activate(dependencies, runtime);
        expect(result.activeContributions).toEqual(["discovery.scheduler"]);
        expect(taskBean.service).toBeInstanceOf(TaskExecutionService);
        expect(taskBean.service.legacyStorage).toBe(legacyStorage);
        expect(taskBean.service.getRuntimeService("storage")).toBe(storage);
        const taskService = taskBean.service;
        expect(events.on).toHaveBeenCalledWith("settings-changed", expect.any(Function));
        runtime.scope.dispose();
        expect(taskService.disposed).toBe(true);
        expect(taskBean.service).toBeNull();
        expect(eventHandlers.has("settings-changed")).toBe(false);
    });

    it("ignores favorite-profile-backfill events in list compatibility and supplementary cards", async () => {
        const dom = new JSDOM('<!doctype html><html><body><div class="movie-list"></div></body></html>', { url: "https://javdb.com/" });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("MutationObserver", dom.window.MutationObserver);
        vi.stubGlobal("$", () => ({ off: vi.fn() }));
        dom.window.isListPage = true;
        const handlers = new Map();
        const events = {
            originId: "origin-1",
            on: vi.fn((type, handler) => { handlers.set(type, handler); return () => handlers.delete(type); }),
            emit: vi.fn(async () => {}),
        };
        const scope = new LifecycleScope("test:list-ignore-backfill");
        const service = new ListPageCompatibilityService({
            runtimeServices: {
                scope: () => scope,
                settings: Object.assign(new dom.window.EventTarget(), { snapshot: () => ({ hoverBigImg: "no" }) }),
                events,
                host: { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item" }) },
                logger: { debug: vi.fn(), error: vi.fn(), html: vi.fn(), warn: vi.fn() },
            },
        });
        service.requestListRefresh = vi.fn(async () => true);
        await service.handle({ scope, featureOwnsStartup: true });
        await handlers.get("new-video-changed")({ reason: "favorite-profile-backfill", carNums: [] });
        expect(service.requestListRefresh).not.toHaveBeenCalled();
        await handlers.get("new-video-changed")({ reason: "task-completed", carNums: [] });
        expect(service.requestListRefresh).toHaveBeenCalledOnce();

        const suppHandlers = new Map();
        const root = dom.window.document.querySelector(".movie-list");
        const supp = new SupplementaryCardsController({
            owner: {
                scope,
                hostAdapter: { locateCardEnhancementRoots: () => [root], getListSelectors: () => ({ boxSelector: ".movie-list" }), getLiveListSelectors: () => ({ boxSelector: ".movie-list" }) },
                boundListRoot: root,
                readFilterSources: async () => ({ settings: {} }),
                readCardIdentity: () => null,
                events: { on: (type, fn) => { suppHandlers.set(type, fn); return () => suppHandlers.delete(type); } },
                coverImageController: { replace: vi.fn() },
                logger: { error: vi.fn() },
                legacyPlugin: {},
            },
            ui: {}, notifications: {}, diagnostics: {},
        });
        await supp.start();
        supp.refreshQueue.request = vi.fn(async () => true);
        suppHandlers.get("new-video-changed")({ reason: "favorite-profile-backfill", carNums: [] });
        expect(supp.refreshQueue.request).not.toHaveBeenCalled();
        suppHandlers.get("new-video-changed")({ reason: "task-completed", carNums: [] });
        expect(supp.refreshQueue.request).toHaveBeenCalledOnce();
        scope.dispose();
        dom.window.close();
    });

    it("gates backfillFavoriteProfiles in TaskExecutionService.doTask, requires JavDB login for favoriteActress, and classifies AbortError as blocked", async () => {
        const msgEl = { text: vi.fn() };
        const events = { emit: vi.fn(async () => {}) };
        let settingValues = { enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" };
        let loggedIn = false;
        const pageWindow = {
            location: { href: "https://javdb.com/" },
            isListPage: true,
            navigator: { locks: { request: vi.fn(async (_k, _opts, fn) => fn({})) } },
        };
        const taskService = new TaskExecutionService({
            runtimeServices: {
                storage: { getLocal: vi.fn(() => null), setLocal: vi.fn() },
                movie: { externalSiteOrigin: vi.fn(async () => "https://javdb.com") },
                events,
            },
            resolveDependency: () => null,
            legacyStorage: { getSetting: vi.fn(async () => settingValues) },
            utilities: { getNowStr: () => "2026-11-18" },
            logger: { log: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), html: vi.fn(), htmlDebug: vi.fn() },
            jquery: vi.fn((selector) => selector === "#checkNewVideoMsg" ? msgEl : { length: loggedIn && selector === 'a[href*="/users/profile"]' ? 1 : 0 }),
            window: pageWindow,
            notifications: { error: vi.fn() },
        });
        const backfill = vi.fn(async ({ onProgress }) => {
            onProgress?.({ processed: 1, total: 1 });
            return { total: 1, updated: 0, unchanged: 1, failed: 0, rateLimited: 0 };
        });
        const scanController = new NewVideoScanController({
            state: { getActressProfileBackfillState: async () => createActressProfileBackfillState() },
            events,
            jquery: vi.fn((selector) => selector === "#checkNewVideoMsg" ? msgEl : { length: 0 }),
            window: pageWindow,
            logger: { warn: vi.fn(), error: vi.fn() },
            getTimestamp: () => "2026-11-18",
            onNewItems: vi.fn(),
        });
        scanController.backfillFavoriteProfiles = backfill;
        taskService.attachFeatureNewVideoScanController(scanController);

        expect(taskService.isNetworkBlocked(new DOMException("Scan disposed", "AbortError"))).toBe(true);

        // Both tasks disabled -> skipped
        await taskService.doTask();
        expect(backfill).not.toHaveBeenCalled();

        // Only favoriteActress enabled while logged out -> skipped (does not spam every page load)
        settingValues = { enableCheckBlacklist: "no", enableCheckFavoriteActress: "yes", enableCheckNewVideo: "no" };
        await taskService.invalidateConfig();
        await taskService.doTask();
        expect(backfill).not.toHaveBeenCalled();

        // favoriteActress enabled while logged in -> runs backfill, no event when updated=0
        loggedIn = true;
        await taskService.doTask();
        expect(backfill).toHaveBeenCalledTimes(1);
        expect(events.emit).not.toHaveBeenCalledWith("new-video-changed", expect.anything());
        expect(msgEl.text).toHaveBeenCalledWith("演员资料补齐：更新 0，未变 1，失败 0");

        // newVideo enabled (even logged out) -> runs backfill and emits new-video-changed when updated > 0
        loggedIn = false;
        backfill.mockResolvedValueOnce({ total: 1, updated: 1, unchanged: 0, failed: 0, rateLimited: 0 });
        settingValues = { enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "yes" };
        await taskService.invalidateConfig();
        await taskService.doTask();
        expect(backfill).toHaveBeenCalledTimes(2);
        expect(events.emit).toHaveBeenCalledWith("new-video-changed", { reason: "favorite-profile-backfill", carNums: [] });
        expect(pageWindow.navigator.locks.request).toHaveBeenCalledWith("jhsBackfillActressProfiles", { ifAvailable: true }, expect.any(Function));

        // The first sweep can resume even while the regular checks are scheduled for later.
        const futureNext = String(Date.now() + 3600_000);
        let initialized = true;
        const scheduledStorage = {
            getLocal: vi.fn(key => key.endsWith("_next") ? futureNext : null),
            setLocal: vi.fn(),
        };
        const scheduledService = new TaskExecutionService({
            runtimeServices: {
                storage: scheduledStorage,
                movie: { externalSiteOrigin: vi.fn(async () => "https://javdb.com") },
                events,
            },
            resolveDependency: () => null,
            legacyStorage: { getSetting: vi.fn(async () => ({ enableCheckBlacklist: "no", enableCheckFavoriteActress: "yes", enableCheckNewVideo: "yes" })) },
            utilities: { getNowStr: () => "2026-11-18" },
            logger: { log: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), html: vi.fn(), htmlDebug: vi.fn() },
            jquery: vi.fn((selector) => ({ text: vi.fn(), length: selector === 'a[href*="/users/profile"]' ? 1 : 0 })),
            window: pageWindow,
            notifications: { error: vi.fn() },
        });
        const scheduledController = new NewVideoScanController({
            state: { getActressProfileBackfillState: async () => ({ ...createActressProfileBackfillState(), initialized }) },
            events,
            window: pageWindow,
            logger: { warn: vi.fn(), error: vi.fn() },
            getTimestamp: () => "2026-11-18",
            onNewItems: vi.fn(),
        });
        const skippedBackfill = vi.fn(async () => ({ total: 0, updated: 0, unchanged: 0, failed: 0, rateLimited: 0 }));
        scheduledController.backfillFavoriteProfiles = skippedBackfill;
        scheduledService.attachFeatureNewVideoScanController(scheduledController);
        await scheduledService.doTask();
        expect(skippedBackfill).not.toHaveBeenCalled();

        initialized = false;
        await scheduledService.doTask();
        expect(skippedBackfill).toHaveBeenCalledTimes(1);

        // Manual backfill also works on a non-list page.
        pageWindow.isListPage = false;
        const manualBackfill = vi.fn(async () => ({ total: 1, updated: 1, unchanged: 0, failed: 0, rateLimited: 0 }));
        scheduledController.backfillFavoriteProfiles = manualBackfill;
        await expect(scheduledService.triggerProfileBackfill({ starIds: ["a1"], force: true, refresh: true })).resolves.toMatchObject({ updated: 1 });
        expect(manualBackfill).toHaveBeenCalledWith(expect.objectContaining({ starIds: ["a1"], force: true, refresh: true }));
        await expect(scheduledService.triggerProfileBackfill({ requireListPage: true })).resolves.toBeNull();
    });

    it("serializes targeted profile backfill behind active Web Lock, suppresses abort status text, and forwards non-list TaskCompatibilityBean calls", async () => {
        const createLockManager = () => {
            let held = false;
            const queue = [];
            return {
                request: vi.fn(async (name, options, callback) => {
                    if (options?.ifAvailable) {
                        if (held) return callback(null);
                        held = true;
                        try { return await callback({ name }); }
                        finally { held = false; queue.shift()?.(); }
                    }
                    if (options?.signal?.aborted) {
                        throw Object.assign(new Error("Lock aborted"), { name: "AbortError" });
                    }
                    if (held) {
                        await new Promise((resolve, reject) => {
                            const onAbort = () => {
                                const index = queue.indexOf(wake);
                                if (index >= 0) queue.splice(index, 1);
                                reject(Object.assign(new Error("Lock aborted"), { name: "AbortError" }));
                            };
                            const wake = () => {
                                options?.signal?.removeEventListener?.("abort", onAbort);
                                resolve(undefined);
                            };
                            queue.push(wake);
                            options?.signal?.addEventListener?.("abort", onAbort, { once: true });
                        });
                    }
                    held = true;
                    try { return await callback({ name }); }
                    finally { held = false; queue.shift()?.(); }
                }),
            };
        };

        // 1) TaskExecutionService forwards to NewVideoScanController: untargeted and empty starIds skip while locked; targeted waits in queue and preserves caller onProgress
        const locks = createLockManager();
        const msgEl = { text: vi.fn() };
        const events = { emit: vi.fn(async () => {}) };
        const scope = new LifecycleScope("test:lock-queue");
        const pageWindow = { location: { href: "https://javdb.com/" }, isListPage: true, navigator: { locks } };
        const taskService = new TaskExecutionService({
            runtimeServices: {
                storage: { getLocal: vi.fn(() => null), setLocal: vi.fn() },
                movie: { externalSiteOrigin: vi.fn(async () => "https://javdb.com") },
                events,
                scope: () => scope,
            },
            resolveDependency: () => null,
            legacyStorage: { getSetting: vi.fn(async () => ({})) },
            utilities: { getNowStr: () => "2026-11-23" },
            logger: { log: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), html: vi.fn(), htmlDebug: vi.fn() },
            jquery: vi.fn(() => msgEl),
            window: pageWindow,
            notifications: { error: vi.fn() },
        });
        let releaseBackground;
        const backgroundPending = new Promise((resolve) => { releaseBackground = resolve; });
        const executionOrder = [];
        const backfillSpy = vi.fn(async (opts) => {
            executionOrder.push(opts.starIds ? `targeted:${opts.starIds.join(",")}` : "background");
            if (!opts.starIds) await backgroundPending;
            opts.onProgress?.({ processed: 1, total: 1, updated: 1, unchanged: 0, failed: 0, rateLimited: 0 });
            return { total: 1, updated: 1, unchanged: 0, failed: 0, rateLimited: 0 };
        });
        const queueController = new NewVideoScanController({
            state: {},
            events,
            jquery: vi.fn(() => msgEl),
            window: pageWindow,
            logger: { warn: vi.fn(), error: vi.fn() },
            getTimestamp: () => "2026-11-23",
            onNewItems: vi.fn(),
        });
        queueController.backfillFavoriteProfiles = backfillSpy;
        taskService.attachFeatureNewVideoScanController(queueController);

        const callerProgress = vi.fn();
        const bgRun = taskService.triggerProfileBackfill();
        await vi.waitFor(() => expect(backfillSpy).toHaveBeenCalledTimes(1));

        // Untargeted and empty starIds do not wait behind the lock
        await expect(taskService.triggerProfileBackfill()).resolves.toBeNull();
        await expect(taskService.triggerProfileBackfill({ starIds: [] })).resolves.toBeNull();

        // Targeted waits until background lock releases, then runs and preserves caller onProgress
        const targetedRun = taskService.triggerProfileBackfill({ starIds: ["a1"], force: true, refresh: true, onProgress: callerProgress });
        expect(executionOrder).toEqual(["background"]);
        releaseBackground();
        await expect(bgRun).resolves.toMatchObject({ updated: 1 });
        await expect(targetedRun).resolves.toMatchObject({ updated: 1 });
        expect(executionOrder).toEqual(["background", "targeted:a1"]);
        expect(callerProgress).toHaveBeenCalledOnce();
        expect(msgEl.text).toHaveBeenCalledWith("正在补齐演员资料 (1/1)…");
        scope.dispose();

        // 2) Non-list page TaskCompatibilityBean forwarding (service === null): emits new-video-changed, acquires lock, suppresses abort failure text, catches errors
        const nonListWindow = { navigator: { locks: createLockManager() } };
        vi.stubGlobal("window", nonListWindow);
        const bean = new TaskCompatibilityBean();

        const nonListEvents = { emit: vi.fn(async () => {}) };
        const nonListMsgEl = { text: vi.fn() };
        const nonListScope = new LifecycleScope("test:non-list-bean");
        const scanController = new NewVideoScanController({
            state: {
                getActressProfileBackfillSnapshot: vi.fn(async () => ({
                    actresses: [{ starId: "a1", name: "Alice" }], state: createActressProfileBackfillState(),
                })),
                batchUpdateFavoriteActressProfiles: vi.fn(async (batch) => batch.length),
            },
            actressInfo: {
                lookupAny: vi.fn(async () => ({ info: { url: "https://ja.wikipedia.org/wiki/Alice", height: "160cm" }, matchedName: "Alice" })),
            },
            storage: { getLocal: vi.fn(() => null), setLocal: vi.fn() },
            scope: nonListScope,
            events: nonListEvents,
            jquery: vi.fn(() => nonListMsgEl),
            window: nonListWindow,
            logger: { warn: vi.fn(), error: vi.fn() },
            getTimestamp: () => "2026-11-23",
            onNewItems: vi.fn(),
        });
        bean.attachFeatureNewVideoScanController(scanController);

        await expect(bean.triggerProfileBackfill({ requireListPage: true })).resolves.toBeNull();
        await expect(bean.triggerProfileBackfill({ starIds: ["a1"], force: true, refresh: true })).resolves.toMatchObject({ updated: 1 });
        expect(nonListWindow.navigator.locks.request).toHaveBeenCalledWith(
            "jhsBackfillActressProfiles",
            { signal: nonListScope.signal },
            expect.any(Function)
        );
        expect(nonListEvents.emit).toHaveBeenCalledWith("new-video-changed", { reason: "favorite-profile-backfill", carNums: [] });
        expect(nonListMsgEl.text).toHaveBeenCalledWith("演员资料补齐：更新 1，未变 0，失败 0");

        // AbortError after partial batch commit does NOT write "演员资料补齐失败", and still emits new-video-changed
        nonListMsgEl.text.mockClear();
        nonListEvents.emit.mockClear();
        const origBackfill = scanController.backfillFavoriteProfiles.bind(scanController);
        scanController.backfillFavoriteProfiles = vi.fn(async ({ onBatchCommitted }) => {
            onBatchCommitted?.(1);
            throw Object.assign(new Error("aborted"), { name: "AbortError", code: "ABORTED" });
        });
        await expect(bean.triggerProfileBackfill({ starIds: ["a1"], force: true })).resolves.toBeNull();
        expect(nonListMsgEl.text).not.toHaveBeenCalledWith("演员资料补齐失败");
        expect(nonListEvents.emit).toHaveBeenCalledWith("new-video-changed", { reason: "favorite-profile-backfill", carNums: [] });
        scanController.backfillFavoriteProfiles = origBackfill;

        // Error inside non-list forwarding is caught cleanly (no unhandled rejection) and sets failure status
        scanController.state.getActressProfileBackfillSnapshot.mockRejectedValueOnce(new Error("DB offline"));
        await expect(bean.triggerProfileBackfill({ starIds: ["a1"], force: true })).resolves.toBeNull();
        expect(nonListMsgEl.text).toHaveBeenCalledWith("演员资料补齐失败");
        expect(scanController.logger.error).toHaveBeenCalled();
        nonListScope.dispose();

        // 3) TaskExecutionService returns null on non-blocked error and aborts lock wait if feature controller disposes
        const failLocks = createLockManager();
        const failScope = new LifecycleScope("test:exec-error");
        const failWindow = { location: { href: "https://javdb.com/" }, isListPage: true, navigator: { locks: failLocks } };
        const failService = new TaskExecutionService({
            runtimeServices: {
                storage: { getLocal: vi.fn(() => null), setLocal: vi.fn() },
                movie: { externalSiteOrigin: vi.fn(async () => "https://javdb.com") },
                events: { emit: vi.fn(async () => {}) },
                scope: () => failScope,
            },
            resolveDependency: () => null,
            legacyStorage: { getSetting: vi.fn(async () => ({})) },
            utilities: { getNowStr: () => "2026-11-23" },
            logger: { log: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), html: vi.fn(), htmlDebug: vi.fn() },
            jquery: vi.fn(() => ({ text: vi.fn() })),
            window: failWindow,
            notifications: { error: vi.fn() },
        });
        const ctrlScope = new LifecycleScope("test:ctrl-dispose");
        const ctrlLogger = { warn: vi.fn(), error: vi.fn() };
        const ctrlInstance = new NewVideoScanController({
            state: {},
            scope: ctrlScope,
            window: failWindow,
            logger: ctrlLogger,
            getTimestamp: () => "2026-11-23",
            onNewItems: vi.fn(),
        });
        ctrlInstance.backfillFavoriteProfiles = vi.fn(async () => { throw new Error("IDB quota exceeded"); });
        failService.attachFeatureNewVideoScanController(ctrlInstance);
        await expect(failService.triggerProfileBackfill({ starIds: ["a1"], force: true })).resolves.toBeNull();
        expect(ctrlLogger.error).toHaveBeenCalledWith("演员身材资料补齐出现错误:", expect.any(Error));

        // While holding the lock, disposing the feature controller's scope aborts the queued lock wait immediately
        let releaseFirst;
        const holdLock = new Promise((resolve) => { releaseFirst = resolve; });
        const holder = failLocks.request("jhsBackfillActressProfiles", {}, async () => { await holdLock; });
        const queuedRun = failService.triggerProfileBackfill({ starIds: ["a1"], force: true });
        await vi.waitFor(() => expect(failLocks.request).toHaveBeenCalledTimes(3));
        ctrlInstance.dispose();
        ctrlScope.dispose();
        await expect(queuedRun).resolves.toBeNull();
        releaseFirst();
        await holder;
        failScope.dispose();
    });
});
