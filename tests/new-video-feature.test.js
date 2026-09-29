import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { PORT, SERVICE } from "../src/contracts/tokens.js";
import { newVideoFeature, schedulerFeature } from "../src/features/discovery/new-video-manifests.js";
import { TaskExecutionService } from "../src/features/discovery/task-execution-service.js";
import { TaskCompatibilityBean } from "../src/compat/task-compatibility-bean.js";
import { NewVideoCompatibilityBean } from "../src/compat/new-video-compatibility-bean.js";
import { NEW_VIDEO_STYLES } from "../src/features/discovery/new-video-styles.js";
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
        expect(await workspaceController.loadWorkspace()).toEqual({ actresses: [], carMap: expect.any(Map), decisions: {}, items: [], ruleTime: 8760, javDbUrl: "https://javdb.com" });
        expect(movie.externalSiteOrigin).toHaveBeenCalledWith("javDbBtn", { checkNewVideo_ruleTime: 8760 });
        expect(plugin.initializeLocalState).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(plugin.showNewVideoCount).toHaveBeenCalledOnce());
        expect(events.on).toHaveBeenCalledWith("new-video-changed", expect.any(Function));
        expect(events.on).toHaveBeenCalledWith("task-status-changed", expect.any(Function));
        handlers.get("new-video-changed")();
        expect(plugin.scheduleWorkspaceReload).toHaveBeenCalledOnce();
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
});
