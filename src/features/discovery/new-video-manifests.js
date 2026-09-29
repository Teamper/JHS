// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { escapeHtml } from "../../core/constants.js";

/** @param {any} styles */
async function registerNewVideoStyles(styles) {
    const { NEW_VIDEO_STYLES } = await import("./new-video-styles.js");
    return styles.register("feature-new-video-workspace", NEW_VIDEO_STYLES);
}

export const newVideoFeature = defineFeature({
    id: "new-video", kind: "feature", disableable: true, sites: ["javdb"], routes: [], startup: "idle",
    requires: [PORT.style, SERVICE.dialog, SERVICE.events, SERVICE.state, SERVICE.settings, SERVICE.storage, SERVICE.movie, SERVICE.actressInfo, SERVICE.titleKeywords, SERVICE.legacyUtils, SERVICE.legacyStorage, SERVICE.domUi, SERVICE.notifications, SERVICE.clog], contributes: ["discovery.new-video"], providesCommands: ["new-video.open"],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const id = "discovery.new-video";
        if (!runtime.enabledContributions.includes(id)) return { activeContributions: [], commands: { "new-video.open": () => undefined } };
        const [
            { NewVideoLifecycleController },
            { NewVideoBatchController },
            { NewVideoWorkspaceController },
            { NewVideoScanController },
        ] = await Promise.all([
            import("./new-video-lifecycle-controller.js"),
            import("./new-video-batch-controller.js"),
            import("./new-video-workspace-controller.js"),
            import("./new-video-scan-controller.js"),
        ]);
        const compatibilityBean = runtime.resolveCompatibilityBean("NewVideoPlugin");
        /** @type {any} */ let plugin = null;
        if (compatibilityBean?.createFeatureService && compatibilityBean?.connect) {
            plugin = await compatibilityBean.createFeatureService({
                runtimeServices: {
                    dialog: deps[SERVICE.dialog], storage: deps[SERVICE.storage], actressInfo: deps[SERVICE.actressInfo],
                    movie: deps[SERVICE.movie], state: deps[SERVICE.state], settings: deps[SERVICE.settings],
                    scope: () => runtime.scope,
                },
                resolveDependency: (/** @type {string} */ name) => runtime.resolveCompatibilityBean(name),
                jquery: deps[SERVICE.domUi].jquery, legacyStorage: deps[SERVICE.legacyStorage],
                utilities: deps[SERVICE.legacyUtils], notifications: deps[SERVICE.notifications],
                logger: deps[SERVICE.clog], events: deps[SERVICE.events],
                createImageHoverPreview: (/** @type {Record<string, any>} */ config) => deps[SERVICE.domUi].createImageHoverPreview(config),
                document, window,
            });
            compatibilityBean.connect(plugin);
            runtime.scope.addCleanup(() => compatibilityBean.disconnect(plugin));
        }
        if (!plugin) throw new Error("New-video feature requires its workspace service or compatibility adapter");
        const batchController = new NewVideoBatchController({ state: deps[SERVICE.state] });
        const workspaceController = new NewVideoWorkspaceController({
            state: deps[SERVICE.state], settings: deps[SERVICE.settings], movie: deps[SERVICE.movie],
        });
        const taskPlugin = runtime.resolveCompatibilityBean("TaskPlugin");
        const scanController = new NewVideoScanController({
            state: deps[SERVICE.state],
            titleKeywords: deps[SERVICE.titleKeywords],
            actressInfo: deps[SERVICE.actressInfo],
            scope: runtime.scope,
            logger: deps[SERVICE.clog],
            getTimestamp: () => deps[SERVICE.legacyUtils].getNowStr(),
            onNewItems: (name, count) => deps[SERVICE.clog].html(`<span class="jhs-task-emphasis">检测出新作品, ${escapeHtml(name)}, 共${count}部</span>`),
        });
        plugin.attachFeatureNewVideoBatchController?.(batchController);
        plugin.attachFeatureNewVideoWorkspaceController?.(workspaceController);
        taskPlugin?.attachFeatureNewVideoScanController?.(scanController);
        runtime.scope.addCleanup(() => {
            taskPlugin?.detachFeatureNewVideoScanController?.(scanController);
            scanController.dispose();
        });
        runtime.scope.addCleanup(() => {
            plugin.detachFeatureNewVideoBatchController?.(batchController);
            plugin.detachFeatureNewVideoWorkspaceController?.(workspaceController);
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
        plugin.attachFeatureNewVideoStyleLoader?.(ensureStyles);
        runtime.scope.addCleanup(() => plugin.detachFeatureNewVideoStyleLoader?.(ensureStyles));
        const controller = new NewVideoLifecycleController({
            plugin, events: deps[SERVICE.events], scope: runtime.scope,
            onError: (error) => runtime.diagnostics.recordError({
                source: "new-video-feature", featureId: "new-video", contributionId: id,
                message: error instanceof Error ? error.message : String(error),
            }),
        });
        if (!controller.start()) return { activeContributions: [] };
        return { activeContributions: [id], commands: { "new-video.open": () => plugin.openDialog?.() } };
    },
});

export const schedulerFeature = defineFeature({
    id: "scheduler", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["list"], startup: "idle",
    requires: [PORT.javdbHost, PORT.javbusHost, SERVICE.events, SERVICE.storage, SERVICE.settings, SERVICE.legacyStorage, SERVICE.legacyUtils, SERVICE.http, SERVICE.actressInfo, SERVICE.movie, SERVICE.state, SERVICE.domUi, SERVICE.hostListParser, SERVICE.clog, SERVICE.notifications],
    contributes: ["discovery.scheduler"], providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const id = "discovery.scheduler";
        if (!runtime.enabledContributions.includes(id)) return { activeContributions: [] };
        return Promise.all([import("./task-scheduler-controller.js"), import("./task-execution-service.js")]).then(([
            { TaskSchedulerController },
            { TaskExecutionService },
        ]) => {
        const taskAdapter = runtime.resolveCompatibilityBean("TaskPlugin");
        if (!taskAdapter?.connect) throw new Error("Scheduler feature requires the TaskPlugin compatibility bean");
        const taskService = new TaskExecutionService({
            runtimeServices: {
                storage: deps[SERVICE.storage], http: deps[SERVICE.http], actressInfo: deps[SERVICE.actressInfo],
                movie: deps[SERVICE.movie], state: deps[SERVICE.state], events: deps[SERVICE.events], scope: () => runtime.scope,
                hostAdapters: { javdb: deps[PORT.javdbHost], javbus: deps[PORT.javbusHost] }, hostListParser: deps[SERVICE.hostListParser],
            },
            resolveDependency: (name) => runtime.resolveCompatibilityBean(name),
            legacyStorage: deps[SERVICE.legacyStorage], utilities: deps[SERVICE.legacyUtils], logger: deps[SERVICE.clog],
            jquery: deps[SERVICE.domUi].jquery, window, notifications: deps[SERVICE.notifications],
        });
        taskAdapter.connect(taskService);
        runtime.scope.addCleanup(() => {
            taskAdapter.disconnect(taskService);
            taskService.dispose();
        });
        const controller = new TaskSchedulerController({
            window,
            document,
            events: deps[SERVICE.events],
            storage: deps[SERVICE.storage],
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
        return { activeContributions: [id] };
        });
    },
});
