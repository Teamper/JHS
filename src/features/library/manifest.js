// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";

export default defineFeature({
    id: "library", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: [], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.http, SERVICE.storage, SERVICE.state, SERVICE.settings, SERVICE.movie, SERVICE.titleKeywords, SERVICE.domUi, SERVICE.notifications, SERVICE.events, SERVICE.profile, SERVICE.dialog, SERVICE.clipboard, SERVICE.clog],
    contributes: ["library.history", "library.keyword-filter", "library.state-actions", "library.blacklist", "library.favorite-actresses"],
    providesCommands: ["library.history.open", "library.history.refresh", "library.blacklist.open", "library.blacklist.add", "library.blacklist.subject-info", "library.blacklist.parse", "library.blacklist.parse-and-save", "library.blacklist.scan-pages", "library.blacklist.reset-tooltip"],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        /** @param {string} id */ const needs = (id) => runtime.enabledContributions.includes(id);
        /** @type {any[]} */ const modules = await Promise.all([
            needs("library.history") ? import("./history-controller.js") : Promise.resolve(null),
            needs("library.history") ? import("./history-entry-controller.js") : Promise.resolve(null),
            needs("library.history") ? import("./history-styles.js") : Promise.resolve(null),
            needs("library.favorite-actresses") ? import("./favorite-actresses-controller.js") : Promise.resolve(null),
            needs("library.state-actions") ? import("./want-watch-import-controller.js") : Promise.resolve(null),
            needs("library.keyword-filter") ? import("./title-keyword-controller.js") : Promise.resolve(null),
            needs("library.blacklist") ? import("./blacklist-scan-controller.js") : Promise.resolve(null),
            needs("library.blacklist") ? import("./blacklist-workspace-controller.js") : Promise.resolve(null),
            needs("library.blacklist") ? import("./blacklist-entry-controller.js") : Promise.resolve(null),
            needs("library.blacklist") ? import("./blacklist-styles.js") : Promise.resolve(null),
        ]);
        const HistoryController = modules[0]?.HistoryController;
        const HistoryEntryController = modules[1]?.HistoryEntryController;
        const HISTORY_STYLES = modules[2]?.HISTORY_STYLES;
        const FavoriteActressesController = modules[3]?.FavoriteActressesController;
        const WantWatchImportController = modules[4]?.WantWatchImportController;
        const TitleKeywordController = modules[5]?.TitleKeywordController;
        const BlacklistScanController = modules[6]?.BlacklistScanController;
        const BlacklistWorkspaceController = modules[7]?.BlacklistWorkspaceController;
        const BlacklistEntryController = modules[8]?.BlacklistEntryController;
        const BLACKLIST_STYLES = modules[9]?.BLACKLIST_STYLES;
        const disposers = /** @type {Array<() => void>} */ ([]);
        /** @type {import("./history-dialog-controller.js").HistoryDialogController | null} */ let historyDialog = null;
        /** @type {Promise<import("./history-dialog-controller.js").HistoryDialogController | null> | null} */ let historyDialogPromise = null;
        /** @type {any} */ let historyController = null;
        /** @type {any} */ let historyAdapter = null;
        /** @type {any} */ let blacklistWorkspace = null;
        /** @type {any} */ let blacklistEntry = null;
        let featureDisposed = false;
        const ensureHistoryDialog = () => {
            if (historyDialog) return Promise.resolve(historyDialog);
            if (historyDialogPromise) return historyDialogPromise;
            historyDialogPromise = import("./history-dialog-controller.js").then(({ HistoryDialogController }) => {
                if (featureDisposed || !historyController) return null;
                const controller = new HistoryDialogController({
                    document, window, jquery: deps[SERVICE.domUi].jquery, domUi: deps[SERVICE.domUi],
                    dialog: deps[SERVICE.dialog], notifications: deps[SERVICE.notifications], logger: deps[SERVICE.clog],
                    clipboard: deps[SERVICE.clipboard], movie: deps[SERVICE.movie], settings: deps[SERVICE.settings],
                    storage: deps[SERVICE.storage], state: deps[SERVICE.state], repository: historyController.repository,
                    selectionModel: historyController.selectionModel, site: runtime.site,
                    resolveLegacy: (name) => runtime.resolveCompatibilityBean(name),
                    fc2WorkspaceAvailable: runtime.isContributionEnabled("fc2-workspace", "detail.fc2-owned", "Fc2Plugin"),
                    getFc2Workspace: () => runtime.executeCommand("detail.fc2.workspace"),
                });
                if (featureDisposed) {
                    controller.dispose();
                    return null;
                }
                historyDialog = controller;
                historyAdapter?.attachFeatureController?.(controller);
                return controller;
            }).finally(() => { historyDialogPromise = null; });
            return historyDialogPromise;
        };
        if (runtime.enabledContributions.includes("library.history")) {
            try {
                runtime.scope.addCleanup(deps[PORT.style].register("jhs-library-history-feature", HISTORY_STYLES));
            } catch (error) {
                runtime.diagnostics.recordError({
                    source: "history-feature", featureId: "library", contributionId: "library.history",
                    message: error instanceof Error ? error.message : String(error),
                });
            }
            historyController = new HistoryController({ storage: deps[SERVICE.storage], state: deps[SERVICE.state] });
            historyAdapter = runtime.resolveCompatibilityBean("HistoryPlugin");
            historyAdapter?.attachFeatureDataController?.(historyController);
            const entry = new HistoryEntryController({
                document, window, jquery: /** @type {any} */ (globalThis).$, profile: deps[SERVICE.profile],
                site: runtime.site, openHistory: () => runtime.executeCommand("library.history.open"), scope: runtime.scope,
                onError: /** @type {(error: unknown) => void} */ ((error) => runtime.diagnostics.recordError({
                    source: "history-entry-feature", featureId: "library", contributionId: "library.history",
                    message: error instanceof Error ? error.message : String(error),
                })),
            });
            entry.start();
            disposers.push(() => {
                featureDisposed = true;
                entry.dispose();
                historyAdapter?.detachFeatureController?.(historyDialog);
                historyDialog?.dispose();
                historyDialog = null;
                historyAdapter?.detachFeatureDataController?.(historyController);
                historyController?.dispose();
                historyController = null;
            });
        }
        if (runtime.enabledContributions.includes("library.state-actions")) {
            const controller = new WantWatchImportController({
                document, window, href: location.href, hostAdapter: deps[PORT.host], http: deps[SERVICE.http], state: deps[SERVICE.state],
                ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications], diagnostics: runtime.diagnostics, scope: runtime.scope,
            });
            controller.start();
        }
        if (runtime.enabledContributions.includes("library.favorite-actresses")) {
            const controller = new FavoriteActressesController({
                document, location, jquery: /** @type {any} */ (globalThis).$,
                state: deps[SERVICE.state], settings: deps[SERVICE.settings],
                scope: runtime.scope, diagnostics: runtime.diagnostics, isDetailPage: runtime.route === "detail",
            });
            controller.start();
        }
        if (runtime.enabledContributions.includes("library.keyword-filter")) {
            const controller = new TitleKeywordController({
                document, window, site: runtime.site, route: runtime.route,
                settings: deps[SERVICE.settings], keywords: deps[SERVICE.titleKeywords],
                events: deps[SERVICE.events], ui: deps[SERVICE.domUi], scope: runtime.scope, diagnostics: runtime.diagnostics,
            });
            if (controller.start()) disposers.push(() => controller.dispose());
        }
        const activeContributions = [...runtime.enabledContributions];
        if (runtime.enabledContributions.includes("library.blacklist")) {
            let stylesReady = true;
            try {
                runtime.scope.addCleanup(deps[PORT.style].register("jhs-library-blacklist-feature", BLACKLIST_STYLES));
            } catch (error) {
                activeContributions.splice(activeContributions.indexOf("library.blacklist"), 1);
                stylesReady = false;
                runtime.diagnostics.recordError({ source: "library-feature", featureId: "library", contributionId: "library.blacklist", message: error instanceof Error ? error.message : String(error) });
            }
            const taskPlugin = runtime.resolveCompatibilityBean?.("TaskPlugin");
            if (stylesReady) {
                const jquery = deps[SERVICE.domUi].jquery;
                const getSubjectInfo = () => deps[PORT.host].getBlacklistSubjectInfo();
                const entryController = new BlacklistEntryController({
                    document, window, location: window.location, jquery, site: runtime.site, state: deps[SERVICE.state], http: deps[SERVICE.http],
                    ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications], logger: deps[SERVICE.clog],
                    scope: runtime.scope, task: taskPlugin, getSubjectInfo,
                    parsePage: /** @type {(page: any, name: string, starId: string, site: string) => any} */ ((page, name, starId, site) => deps[PORT.host].parseBlacklistFilterPage(page, name, starId, site)),
                });
                blacklistEntry = entryController;
                const controller = new BlacklistScanController({
                    state: deps[SERVICE.state], http: deps[SERVICE.http], settings: deps[SERVICE.settings], movie: deps[SERVICE.movie], scope: runtime.scope,
                    parsePage: /** @type {(html: string, item: any, site: string) => any} */ ((html, item, site) => entryController.parseBlacklistFilterInfo(
                        item.name, item.starId, jquery(new window.DOMParser().parseFromString(html, "text/html")), site,
                    )),
                });
                if (taskPlugin?.attachFeatureBlacklistScanController) taskPlugin.attachFeatureBlacklistScanController(controller);
                runtime.scope.addCleanup(() => {
                    taskPlugin?.detachFeatureBlacklistScanController?.(controller);
                    controller.dispose();
                });
                blacklistWorkspace = new BlacklistWorkspaceController({
                    document, window, jquery: deps[SERVICE.domUi].jquery, site: runtime.site,
                    state: deps[SERVICE.state], settings: deps[SERVICE.settings], storage: deps[SERVICE.storage],
                    events: deps[SERVICE.events], dialog: deps[SERVICE.dialog], ui: deps[SERVICE.domUi],
                    notifications: deps[SERVICE.notifications], logger: deps[SERVICE.clog], scope: runtime.scope,
                    task: taskPlugin, openSettings: () => runtime.executeCommand("settings.open", "task-panel"),
                });
                runtime.scope.addCleanup(() => {
                    blacklistWorkspace?.dispose();
                    blacklistEntry?.dispose();
                });
            }
        }
        return {
            activeContributions,
            commands: {
                "library.history.open": async () => (await ensureHistoryDialog())?.openHistory(),
                "library.history.refresh": async () => (await ensureHistoryDialog())?.refresh(),
                "library.blacklist.open": () => blacklistWorkspace?.openBlacklistDialog() ?? undefined,
                /** @param {any} event */
                "library.blacklist.add": (event) => blacklistEntry?.addBlacklist(event),
                "library.blacklist.subject-info": () => deps[PORT.host].getBlacklistSubjectInfo(),
                /** @param {any} page @param {string} name @param {string} starId @param {string} site */
                "library.blacklist.parse": (page, name, starId, site) => deps[PORT.host].parseBlacklistFilterPage(page, name, starId, site),
                /** @param {any} page @param {string} name @param {string} starId @param {string} site */
                "library.blacklist.parse-and-save": async (page, name, starId, site) => {
                    const parsed = deps[PORT.host].parseBlacklistFilterPage(page, name, starId, site);
                    await deps[SERVICE.state].batchSaveBlacklistCarList(parsed.records);
                    return { nextPageLink: parsed.nextPageLink, lastPublishTime: parsed.lastPublishTime, recordCount: parsed.recordCount };
                },
                /** @param {string} name @param {string} starId @param {any} page @param {string} [site] */
                "library.blacklist.scan-pages": (name, starId, page, site) => blacklistEntry?.filterActorVideo(name, starId, page, site),
                "library.blacklist.reset-tooltip": () => blacklistWorkspace?.resetBtnTip(),
            },
            dispose: () => disposers.reverse().forEach((dispose) => dispose()),
        };
    },
});
