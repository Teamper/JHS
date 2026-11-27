// @ts-check
import { getNowStr } from "../../core/ui-date-time.js";

import { ActorSourceHealth } from "./actor-source-health.js";
import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { escapeHtml } from "../../core/constants.js";

/** @param {any} styles */
async function registerNewVideoStyles(styles) {
    const { NEW_VIDEO_STYLES } = await import("./new-video-styles.js");
    return styles.register("feature-new-video-workspace", NEW_VIDEO_STYLES);
}

export const newVideoFeature = defineFeature({
    optionalRequires: [SERVICE.taskExecution],
    id: "new-video", kind: "feature", disableable: true, sites: ["javdb"], routes: [], startup: "idle",
    requires: [PORT.style, SERVICE.dialog, SERVICE.events, SERVICE.state, SERVICE.settings, SERVICE.profile, SERVICE.storage, SERVICE.movie, SERVICE.actressInfo, SERVICE.keywordRules, SERVICE.domUi, SERVICE.notifications, SERVICE.clog], contributes: ["discovery.new-video"], providesCommands: ["new-video.open"],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const id = "discovery.new-video";
        if (!runtime.enabledContributions.includes(id)) return { activeContributions: [], commands: { "new-video.open": () => undefined } };
        const [
            { NewVideoLifecycleController },
            { NewVideoBatchController },
            { NewVideoWorkspaceController },
            { NewVideoScanController },
            { NewVideoWorkspaceService },
        ] = await Promise.all([
            import("./new-video-lifecycle-controller.js"),
            import("./new-video-batch-controller.js"),
            import("./new-video-workspace-controller.js"),
            import("./new-video-scan-controller.js"),
            import("./new-video-workspace-service.js"),
        ]);
        const sourceHealth = new ActorSourceHealth(deps[SERVICE.storage], Date.now, error => runtime.diagnostics.recordError({ source: "actor-source-health", message: error.message }));
        const schedulerEnabled = () => runtime.isContributionEnabled("scheduler", "discovery.scheduler", "TaskPlugin");
        const remoteTask = deps[SERVICE.taskExecution];
        const activateScheduler = () => remoteTask ? Promise.resolve(remoteTask) : runtime.executeCommand("scheduler.service");
        const batchController = new NewVideoBatchController({ state: deps[SERVICE.state] });
        const workspaceController = new NewVideoWorkspaceController({
            state: deps[SERVICE.state], settings: deps[SERVICE.settings], movie: deps[SERVICE.movie],
        });
        const scanController = new NewVideoScanController({
            sourceHealth, backgroundWork: runtime.backgroundWork,
            state: deps[SERVICE.state],
            readTitleKeywords: () => deps[SERVICE.keywordRules].getTitleKeywords(),
            actressInfo: deps[SERVICE.actressInfo],
            scope: runtime.scope,
            events: deps[SERVICE.events], jquery: deps[SERVICE.domUi].jquery, window,
            logger: deps[SERVICE.clog],
            getTimestamp: getNowStr,
            onNewItems: (name, count) => deps[SERVICE.clog].html(`<span class="jhs-task-emphasis">检测出新作品, ${escapeHtml(name)}, 共${count}部</span>`),
        });
        runtime.provideCapability?.("discovery.new-video-scan", scanController);
        runtime.scope.addCleanup(() => scanController.dispose());
        runtime.scope.addCleanup(() => {
            batchController.dispose();
            workspaceController.dispose();
        });
        /** @type {Promise<void> | null} */
        let stylePromise = null;
        const ensureStyles = () => {
            if (runtime.scope.disposed) return Promise.resolve();
            if (!stylePromise) stylePromise = registerNewVideoStyles(deps[PORT.style]).then((releaseStyles) => {
                if (runtime.scope.disposed) releaseStyles();
                else runtime.scope.addCleanup(releaseStyles);
            }).catch((error) => {
                stylePromise = null;
                runtime.diagnostics.recordError({ source: "new-video-feature", featureId: "new-video", contributionId: id, message: error instanceof Error ? error.message : String(error) });
            });
            return stylePromise;
        };
        const plugin = new NewVideoWorkspaceService({
            runtimeServices: {
                sourceHealth, dialog: deps[SERVICE.dialog], storage: deps[SERVICE.storage], actressInfo: deps[SERVICE.actressInfo],
                movie: deps[SERVICE.movie], state: deps[SERVICE.state], settings: deps[SERVICE.settings], profile: deps[SERVICE.profile],
                scope: () => runtime.scope,
            },
            task: {
                available: () => schedulerEnabled() && (Boolean(remoteTask) || runtime.isCommandAvailable("scheduler.service")),
                current: () => remoteTask ?? runtime.getCapability?.("discovery.scheduler"),
                activate: activateScheduler,
            },
            requestProfileBackfill: (/** @type {Record<string, any>} */ options) => {
                if (!schedulerEnabled()) return;
                return remoteTask ? remoteTask.triggerProfileBackfill(options) : scanController.triggerProfileBackfill(options);
            },
            batchController, workspaceController, loadStyles: ensureStyles,
            openTaskSettings: (callback) => runtime.getCapability?.("settings.core")?.openSettingDialog("task-panel", callback),
            jquery: deps[SERVICE.domUi].jquery,
            utilities: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications],
            logger: deps[SERVICE.clog], events: deps[SERVICE.events], startLoading: deps[SERVICE.domUi].loading,
            createImageHoverPreview: (/** @type {Record<string, any>} */ config) => deps[SERVICE.domUi].createImageHoverPreview(config),
            document, window,
        });
        const controller = new NewVideoLifecycleController({
            plugin, events: deps[SERVICE.events], scope: runtime.scope,
            onError: (error) => runtime.diagnostics.recordError({
                source: "new-video-feature", featureId: "new-video", contributionId: id,
                message: error instanceof Error ? error.message : String(error),
            }),
        });
        if (!controller.start()) return { activeContributions: [] };
        runtime.provideCapability?.("discovery.new-video", plugin);
        runtime.inspect?.("newVideo", plugin);
        const release = runtime.registerCompatibilityBean?.("NewVideoPlugin", plugin);
        if (release) runtime.scope.addCleanup(release);
        return { activeContributions: [id], commands: { "new-video.open": () => plugin.openDialog() } };
    },
});

export const schedulerFeature = defineFeature({
    optionalRequires: [SERVICE.taskExecution],
    id: "scheduler", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["list"], startup: "idle",
    requires: [PORT.javdbHost, PORT.javbusHost, SERVICE.events, SERVICE.storage, SERVICE.settings, SERVICE.keywordRules, SERVICE.http, SERVICE.actressInfo, SERVICE.movie, SERVICE.state, SERVICE.domUi, SERVICE.clog, SERVICE.notifications],
    contributes: ["discovery.scheduler"], providesCommands: ["scheduler.service"],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const id = "discovery.scheduler";
        if (!runtime.enabledContributions.includes(id)) return { activeContributions: [], commands: { "scheduler.service": () => null } };
        const remoteTask = deps[SERVICE.taskExecution];
        if (remoteTask) {
            runtime.provideCapability?.(id, remoteTask);
            runtime.inspect?.("scheduler", remoteTask);
            const release = runtime.registerCompatibilityBean?.("TaskPlugin", remoteTask);
            if (release) runtime.scope.addCleanup(release);
            return { activeContributions: [id], commands: { "scheduler.service": () => remoteTask } };
        }
        return Promise.all([import("./task-scheduler-controller.js"), import("./task-execution-service.js")]).then(([
            { TaskSchedulerController },
            { TaskExecutionService },
        ]) => {
        const taskService = new TaskExecutionService({
            runtimeServices: {
                storage: deps[SERVICE.storage], settings: deps[SERVICE.settings], keywordRules: deps[SERVICE.keywordRules], http: deps[SERVICE.http], actressInfo: deps[SERVICE.actressInfo],
                movie: deps[SERVICE.movie], state: deps[SERVICE.state], events: deps[SERVICE.events], scope: () => runtime.scope,
                hostAdapters: { javdb: deps[PORT.javdbHost], javbus: deps[PORT.javbusHost] },
            },
            blacklist: {
                available: () => runtime.isContributionEnabled("library", "library.blacklist", "BlacklistPlugin"),
                parseAndSave: (page, name, starId, site) => runtime.executeCommand("library.blacklist.parse-and-save", page, name, starId, site),
                resetStatus: () => runtime.executeCommand("library.blacklist.reset-tooltip"),
            },
            getNewVideoScanner: () => runtime.getCapability?.("discovery.new-video-scan"),
            getBlacklistScanner: () => runtime.getCapability?.("library.blacklist-scan"),
            logger: deps[SERVICE.clog],
            jquery: deps[SERVICE.domUi].jquery, window, notifications: deps[SERVICE.notifications],
        });
        runtime.provideCapability?.(id, taskService);
        runtime.inspect?.("scheduler", taskService);
        const release = runtime.registerCompatibilityBean?.("TaskPlugin", taskService);
        if (release) runtime.scope.addCleanup(release);
        runtime.scope.addCleanup(() => taskService.dispose());
        const controller = new TaskSchedulerController({
            backgroundWork: runtime.backgroundWork,
            window,
            document,
            events: deps[SERVICE.events],
            scope: runtime.scope,
            isListPage: () => window.isListPage,
            runTask: () => taskService.doTask(),
            refreshConfiguration: () => taskService.invalidateConfig(true),
            onError: (error) => runtime.diagnostics.recordError({
                source: "scheduler-feature", featureId: "scheduler", contributionId: id,
                message: error instanceof Error ? error.message : String(error),
            }),
        });
        controller.start();
        return { activeContributions: [id], commands: { "scheduler.service": () => taskService } };
        });
    },
});
