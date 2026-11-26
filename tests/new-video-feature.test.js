import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { PORT, SERVICE } from "../src/contracts/tokens.js";
import { newVideoFeature, schedulerFeature } from "../src/features/discovery/new-video-manifests.js";
import { TaskExecutionService } from "../src/features/discovery/task-execution-service.js";
import { NEW_VIDEO_STYLES } from "../src/features/discovery/new-video-styles.js";
import { ListPageService } from "../src/features/list/list-page-service.js";
import { SupplementaryCardsController } from "../src/features/list/supplementary-cards-controller.js";
import { NewVideoWorkspaceService } from "../src/features/discovery/new-video-workspace-service.js";

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function createRuntime(id, plugin, events = { on: vi.fn(() => vi.fn()) }) {
    return {
        enabledContributions: [id],
        scope: new LifecycleScope(`feature:${id}`),
        diagnostics: { recordError: vi.fn() },
        provideCapability: vi.fn(),
        events,
    };
}

describe("new video and scheduler feature lifecycle", () => {
    it("routes scheduler commands to the injected extension task service", async () => {
        const task = { checkNewVideo: vi.fn(async () => ({ completed: true })) };
        const runtime = createRuntime("discovery.scheduler");
        runtime.registerCompatibilityBean = vi.fn(() => vi.fn());
        const result = await schedulerFeature.activate({ [SERVICE.taskExecution]: task }, runtime);
        expect(result.activeContributions).toEqual(["discovery.scheduler"]);
        expect(result.commands["scheduler.service"]()).toBe(task);
        expect(runtime.provideCapability).toHaveBeenCalledWith("discovery.scheduler", task);
        expect(runtime.registerCompatibilityBean).toHaveBeenCalledWith("TaskPlugin", task);
        await expect(result.commands["scheduler.service"]().checkNewVideo(true)).resolves.toEqual({ completed: true });
        expect(task.checkNewVideo).toHaveBeenCalledWith(true);
        runtime.scope.dispose();
    });

    it("declares the storage capability used to construct the workspace service", () => {
        expect(newVideoFeature.requires).toContain(SERVICE.storage);
    });

    it("loads new-video styles with idle activation under a disposable feature scope", async () => {
        const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://javdb.com/" });
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("window", dom.window);
        const releaseStyle = vi.fn(), handlers = new Map(), events = {
            on: vi.fn((type, handler) => { handlers.set(type, handler); return () => handlers.delete(type); }),
        }, plugin = {
            prepareFeatureActivation: vi.fn(),
            initializeLocalState: vi.fn(), showNewVideoCount: vi.fn(),
            openDialog: vi.fn(),
            scheduleWorkspaceReload: vi.fn(), isWorkspaceMounted: vi.fn(() => true), renderTaskStatuses: vi.fn(), dispose: vi.fn(),
        };
        const state = {
            patch: vi.fn(), getNewVideoDecisions: vi.fn(async () => ({})),
            getCarMap: vi.fn(async () => new Map()), getFavoriteActressList: vi.fn(async () => []), getBlacklistCarList: vi.fn(async () => []),
        };
        const settings = { snapshot: vi.fn(() => ({ checkNewVideo_ruleTime: 8760 })) };
        const movie = { externalSiteOrigin: vi.fn(() => "https://javdb.com") };
        const keywordRules = { getTitleKeywords: vi.fn(async () => []) }, actressInfo = { movies: vi.fn(async () => []) }, logger = { html: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const styles = { register: vi.fn(() => releaseStyle) }, runtime = createRuntime("discovery.new-video", plugin, events);

        for (const [method, mock] of Object.entries(plugin)) {
            if (typeof NewVideoWorkspaceService.prototype[method] === "function") {
                vi.spyOn(NewVideoWorkspaceService.prototype, method).mockImplementation(mock);
            }
        }
        expect(Object.hasOwn(NewVideoWorkspaceService.prototype, "initCss")).toBe(false);
        const dependencies = {
            [PORT.style]: styles, [SERVICE.events]: events, [SERVICE.state]: state, [SERVICE.settings]: settings,
            [SERVICE.movie]: movie, [SERVICE.actressInfo]: actressInfo,
            [SERVICE.keywordRules]: keywordRules,
            [SERVICE.domUi]: { jquery: vi.fn(), createImageHoverPreview: vi.fn() },
            [SERVICE.notifications]: { error: vi.fn() }, [SERVICE.clog]: logger,
        };
        const result = await newVideoFeature.activate(dependencies, runtime);
        expect(styles.register).not.toHaveBeenCalled();
        const workspace = runtime.provideCapability.mock.calls.find(([id]) => id === "discovery.new-video")[1];
        await workspace.loadStyles();
        expect(styles.register).toHaveBeenCalledWith("feature-new-video-workspace", NEW_VIDEO_STYLES);
        expect(NEW_VIDEO_STYLES).toContain(".newVideoToolBox");
        expect(plugin.prepareFeatureActivation).toHaveBeenCalledOnce();
        const batchController = workspace.featureNewVideoBatchController;
        await batchController.run("favorite", [{ carNum: "ABC-001" }]);
        expect(state.patch).toHaveBeenCalledWith(["ABC-001"], { favorite: true }, expect.objectContaining({ type: "new-video-batch-state" }));
        const workspaceController = workspace.featureNewVideoWorkspaceController;
        const scanController = runtime.provideCapability.mock.calls.find(([id]) => id === "discovery.new-video-scan")?.[1];
        expect(scanController).toBeDefined();
        await expect(scanController.scanActresses({ baseUrl: "https://javdb.com", concurrency: 2, sleepMs: 0, intervalHours: 12, ruleHours: 8760, force: false, isUnnecessaryCheck: () => false, isNetworkBlocked: () => false, sleep: async () => {} })).resolves.toMatchObject({ actressCount: 0, eligibleCount: 0 });
        expect(await workspaceController.getPendingSummary()).toEqual({ count: 0, decisions: {} });
        expect(await workspaceController.loadWorkspace()).toEqual({ actresses: [], carMap: expect.any(Map), decisions: {}, items: [], measurementsByStarId: expect.any(Map), pendingCount: 0, ruleTime: 8760, javDbUrl: "https://javdb.com" });
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
        const plugin = {}, runtime = createRuntime("discovery.new-video", plugin);
        runtime.enabledContributions = [];
        const styles = { register: vi.fn() };

        expect(await newVideoFeature.activate({ [PORT.style]: styles }, runtime)).toMatchObject({
            activeContributions: [], commands: { "new-video.open": expect.any(Function) },
        });
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
        const eventHandlers = new Map();
        const events = {
            on: vi.fn((name, handler) => {
                eventHandlers.set(name, handler);
                return () => eventHandlers.delete(name);
            }),
        };
        const storage = { getLocal: vi.fn(() => null), setLocal: vi.fn() };
        const keywordRules = {}, settings = { readStoredSnapshot: async () => ({ checkNewVideo_intervalTime: 3 }), snapshot: () => ({}) };
        const logger = { log: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), html: vi.fn(), htmlDebug: vi.fn() };
        const runtime = createRuntime("discovery.scheduler");

        const dependencies = {
            [PORT.javdbHost]: { getListSelectors: vi.fn(() => ({ boxSelector: ".movie-list", requestDomItemSelector: ".movie-list .item" })) },
            [PORT.javbusHost]: { getListSelectors: vi.fn(() => ({ boxSelector: ".masonry", requestDomItemSelector: "#waterfall .item" })) },
            [SERVICE.events]: events, [SERVICE.storage]: storage, [SERVICE.settings]: settings,
            [SERVICE.keywordRules]: keywordRules,
            [SERVICE.http]: { request: vi.fn() }, [SERVICE.actressInfo]: { movies: vi.fn(), collection: vi.fn() },
            [SERVICE.movie]: { externalSiteOrigin: vi.fn(() => "https://javdb.com") }, [SERVICE.state]: {},
            [SERVICE.domUi]: { jquery: vi.fn(() => ({ text: vi.fn(), length: 0 })) }, [SERVICE.clog]: logger,
            [SERVICE.notifications]: { error: vi.fn() },
        };
        const result = await schedulerFeature.activate(dependencies, runtime);
        expect(result.activeContributions).toEqual(["discovery.scheduler"]);
        const taskService = result.commands["scheduler.service"]();
        expect(taskService).toBeInstanceOf(TaskExecutionService);
        expect(taskService.keywordRules).toBe(keywordRules);
        expect(taskService.getRuntimeService("storage")).toBe(storage);
        await expect(taskService.loadConfig()).resolves.toMatchObject({ checkNewVideo_intervalTime: 3 });
        expect(events.on).toHaveBeenCalledWith("settings-changed", expect.any(Function));
        runtime.scope.dispose();
        expect(taskService.disposed).toBe(true);
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
        const service = new ListPageService({
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
                settings: { snapshot: () => settingValues, readStoredSnapshot: async () => settingValues },
                movie: { externalSiteOrigin: vi.fn(() => "https://javdb.com") },
                keywordRules: { getTitleKeywords: async () => [] },
                events,
            },
            resolveDependency: () => null,
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
        taskService.getNewVideoScanner = () => ({ backfillFavoriteProfiles: backfill });

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
        expect(pageWindow.navigator.locks.request).toHaveBeenCalledWith(taskService.profileBackfillLockKey, { ifAvailable: true }, expect.any(Function));

        // When neither favoriteActress nor newVideo is due, doTask skips backfillFavoriteProfiles even when logged in
        const futureNext = String(Date.now() + 3600_000);
        const scheduledStorage = { getLocal: vi.fn((key) => key.endsWith("_next") ? futureNext : null), setLocal: vi.fn() };
        const scheduledService = new TaskExecutionService({
            runtimeServices: {
                storage: scheduledStorage,
                settings: { snapshot: () => settingValues, readStoredSnapshot: async () => ({ enableCheckBlacklist: "no", enableCheckFavoriteActress: "yes", enableCheckNewVideo: "yes" }) },
                movie: { externalSiteOrigin: vi.fn(() => "https://javdb.com") },
                keywordRules: { getTitleKeywords: async () => [] },
                events,
            },
            resolveDependency: () => null,
            utilities: { getNowStr: () => "2026-11-18" },
            logger: { log: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), html: vi.fn(), htmlDebug: vi.fn() },
            jquery: vi.fn((selector) => ({ text: vi.fn(), length: selector === 'a[href*="/users/profile"]' ? 1 : 0 })),
            window: pageWindow,
            notifications: { error: vi.fn() },
        });
        const skippedBackfill = vi.fn();
        scheduledService.getNewVideoScanner = () => ({ backfillFavoriteProfiles: skippedBackfill });
        await scheduledService.doTask();
        expect(skippedBackfill).not.toHaveBeenCalled();
    });
});
