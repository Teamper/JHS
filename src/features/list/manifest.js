// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";

export default defineFeature({
    id: "list", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["list"], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.translation, SERVICE.http, SERVICE.storage, SERVICE.legacyStorage, SERVICE.legacyUtils, SERVICE.clog, SERVICE.titleKeywords, SERVICE.state, SERVICE.settings, SERVICE.storageMutation, SERVICE.notifications, SERVICE.dialog, SERVICE.busImageLayout, SERVICE.events, SERVICE.domUi, SERVICE.clipboard, SERVICE.navigation, SERVICE.screenshot, SERVICE.movie],
    contributes: ["list.core", "list.auto-page", "detail.fc2-navigation", "list.fold-category", "list.actions", "detail.javbus-images", "detail.cover-state-actions"],
    providesCommands: ["list.current-page-summary", "list.set-quick-filter"],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const [
            { ListActionsController },
            { AutoPageController, AUTO_PAGE_STYLES },
            { Fc2NavigationController },
            { ListCategoryFoldController },
            { ListController },
            { ListSortController },
            { JavBusImageLayoutController },
            { CoverButtonController },
            { ListBatchUi, LIST_BATCH_UI_STYLES },
            { ListPageCompatibilityService },
            { LifecycleScope },
            { readListItem },
        ] = await Promise.all([
            import("./list-actions-controller.js"),
            import("./auto-page-controller.js"),
            import("./fc2-navigation-controller.js"),
            import("./list-category-fold-controller.js"),
            import("./list-controller.js"),
            import("./list-sort-controller.js"),
            import("./javbus-image-layout-controller.js"),
            import("./cover-button-controller.js"),
            import("./list-batch-ui.js"),
            import("./list-compatibility-service.js"),
            import("../../core/lifecycle-scope.js"),
            import("../../core/list-item-reader.js"),
        ]);
        /** @type {string[]} */ const activeContributions = [];
        /** @type {import("./list-controller.js").ListController | null} */ let controller = null;
        /** @type {import("./auto-page-controller.js").AutoPageController | null} */ let autoPageController = null;
        /** @type {import("./list-category-fold-controller.js").ListCategoryFoldController | null} */ let categoryFoldController = null;
        /** @type {import("./list-actions-controller.js").ListActionsController | null} */ let listActionsController = null;
        /** @type {import("./cover-button-controller.js").CoverButtonController | null} */ let coverButtonController = null;
        const listCompatibilityAdapter = runtime.resolveCompatibilityBean?.("ListPagePlugin") ?? null;
        /** @type {import("./list-compatibility-service.js").ListPageCompatibilityService | null} */ let listCompatibilityService = null;
        if (runtime.enabledContributions.includes("list.core") && listCompatibilityAdapter) {
            listCompatibilityService = new ListPageCompatibilityService({
                runtimeServices: {
                    host: deps[PORT.host], translation: deps[SERVICE.translation], http: deps[SERVICE.http],
                    storage: deps[SERVICE.storage], legacyStorage: deps[SERVICE.legacyStorage],
                    titleKeywords: deps[SERVICE.titleKeywords], state: deps[SERVICE.state], settings: deps[SERVICE.settings],
                    busImageLayout: deps[SERVICE.busImageLayout], events: deps[SERVICE.events], scope: () => Promise.resolve(runtime.scope),
                    jquery: deps[SERVICE.domUi].jquery, utils: deps[SERVICE.legacyUtils], logger: deps[SERVICE.clog],
                },
                resolveDependency: (name) => runtime.resolveCompatibilityBean?.(name) ?? null,
            });
            listCompatibilityAdapter.attachFeatureDelegate(listCompatibilityService);
            runtime.scope.addCleanup(() => listCompatibilityAdapter.detachFeatureDelegate(listCompatibilityService));
        }
        const sortController = new ListSortController({ hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings] });
        if (runtime.enabledContributions.includes("detail.cover-state-actions") && listCompatibilityService) {
            const listAdapter = listCompatibilityAdapter;
            const list = listAdapter?.getCoverButtonCapability?.();
            if (!list) throw new Error("List Feature requires the cover-button list capability");
            let releaseStyle = () => {};
            const coverScope = new LifecycleScope("feature:list:cover-state-actions");
            runtime.scope.addCleanup(() => coverScope.dispose());
            try {
                const coverButtons = new CoverButtonController({
                    document, window, list, settings: deps[SERVICE.settings], state: deps[SERVICE.state], screenshot: deps[SERVICE.screenshot],
                    storage: deps[SERVICE.storage], movie: deps[SERVICE.movie], scope: coverScope, ui: deps[SERVICE.domUi],
                    clipboard: deps[SERVICE.clipboard], notifications: deps[SERVICE.notifications], diagnostics: runtime.diagnostics,
                    navigation: deps[SERVICE.navigation], screenshotAvailable: runtime.isContributionEnabled("detail", "detail.screenshot", "ScreenShotPlugin"),
                    isJavBus: runtime.site === "javbus",
                });
                coverButtonController = coverButtons;
                releaseStyle = deps[PORT.style].register("jhs-cover-button-feature", coverButtons.getStyles().replace(/^\s*<style>|<\/style>\s*$/g, ""));
                coverScope.addCleanup(releaseStyle);
                const consumers = [listAdapter, runtime.resolveCompatibilityBean?.("SettingPlugin")].filter(Boolean);
                for (const consumer of consumers) consumer.attachFeatureCoverButtonAdapter?.(coverButtons);
                coverScope.addCleanup(() => {
                    for (const consumer of consumers) consumer.detachFeatureCoverButtonAdapter?.(coverButtons);
                });
                await coverButtons.start();
                const releaseCompatibility = runtime.registerCompatibilityBean?.("CoverButtonPlugin", coverButtons);
                if (typeof releaseCompatibility === "function") coverScope.addCleanup(releaseCompatibility);
                activeContributions.push("detail.cover-state-actions");
            } catch (error) {
                coverScope.dispose();
                releaseStyle();
                coverButtonController = null;
                runtime.diagnostics.recordError({ source: "list-feature", featureId: "list", contributionId: "detail.cover-state-actions", message: error instanceof Error ? error.message : String(error) });
            }
        }
        if (runtime.enabledContributions.includes("detail.javbus-images")) {
            try {
                const imageLayoutController = new JavBusImageLayoutController({ hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings] });
                const detach = deps[SERVICE.busImageLayout].attach(imageLayoutController);
                runtime.scope.addCleanup(detach);
                activeContributions.push("detail.javbus-images");
            } catch (error) {
                runtime.diagnostics.recordError({ source: "list-feature", featureId: "list", contributionId: "detail.javbus-images", message: error instanceof Error ? error.message : String(error) });
            }
        }
        if (runtime.enabledContributions.includes("list.core")) {
            if (!listCompatibilityAdapter || !listCompatibilityService) throw new Error("List feature requires the ListPagePlugin compatibility service");
            const legacyPlugin = listCompatibilityAdapter.ensureDelegate();
            const batchUi = new ListBatchUi({ dialog: deps[SERVICE.dialog], notifications: deps[SERVICE.notifications], diagnostics: runtime.diagnostics });
            const releaseBatchStyles = deps[PORT.style].register("jhs-list-batch-feature", LIST_BATCH_UI_STYLES);
            runtime.scope.addCleanup(() => { batchUi.dispose(); releaseBatchStyles(); });
            const readFilterSources = async () => {
                const [titleKeywords, blacklistMap, blacklistCars, carMap, activity] = await Promise.all([
                    deps[SERVICE.titleKeywords].getAll(), deps[SERVICE.legacyStorage].getBlacklistMap(),
                    deps[SERVICE.state].getBlacklistCarList(), deps[SERVICE.state].getCarMap(), deps[SERVICE.state].getActivityLog(),
                ]);
                return { titleKeywords, blacklistMap, blacklistCars, settings: deps[SERVICE.settings].snapshot(), carMap, activity };
            };
            controller = new ListController({
                legacyPlugin, hostAdapter: deps[PORT.host], scope: runtime.scope, styles: deps[PORT.style],
                state: deps[SERVICE.state], storage: deps[SERVICE.storage], legacyStorage: deps[SERVICE.legacyStorage], readFilterSources,
                readCardIdentity: (item) => readListItem(deps[SERVICE.domUi].jquery(item)), http: deps[SERVICE.http],
                batchUi, settings: deps[SERVICE.settings], navigation: deps[SERVICE.navigation], sortController,
                events: deps[SERVICE.events], coverButtons: coverButtonController, busImageLayout: deps[SERVICE.busImageLayout], logger: deps[SERVICE.clog],
                ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications], diagnostics: runtime.diagnostics, window,
            });
            try {
                await controller.start();
                activeContributions.push("list.core");
            } catch (error) {
                controller.dispose();
                throw error;
            }
        }
        if (runtime.enabledContributions.includes("list.auto-page")) {
            let releaseStyle = () => {};
            try {
                releaseStyle = deps[PORT.style].register("jhs-auto-page-feature", AUTO_PAGE_STYLES);
                runtime.scope.addCleanup(releaseStyle);
                const list = runtime.resolveCompatibilityBean?.("ListPagePlugin")?.getAutoPageCapability?.() ?? null;
                autoPageController = new AutoPageController({
                    hostAdapter: deps[PORT.host], http: deps[SERVICE.http], settings: deps[SERVICE.settings],
                    list, ui: deps[SERVICE.domUi], eventBus: deps[SERVICE.events], scope: runtime.scope,
                });
                if (await autoPageController.mount()) activeContributions.push("list.auto-page");
            } catch (error) {
                autoPageController?.dispose();
                releaseStyle();
                autoPageController = null;
                runtime.diagnostics.recordError({ source: "list-feature", featureId: "list", contributionId: "list.auto-page", message: error instanceof Error ? error.message : String(error) });
            }
        }
        if (runtime.enabledContributions.includes("detail.fc2-navigation")) {
            const fc2WorkspaceEnabled = runtime.isContributionEnabled("fc2-workspace", "detail.fc2-owned", "Fc2Plugin");
            const fc2Service = fc2WorkspaceEnabled ? await runtime.executeCommand("detail.fc2.workspace") : null;
            const fc2 = fc2Service?.getListNavigationCapability?.();
            if (fc2) {
                const fc2NavigationController = new Fc2NavigationController({
                    hostAdapter: deps[PORT.host], fc2, eventBus: deps[SERVICE.events], ui: deps[SERVICE.domUi], scope: runtime.scope, logger: deps[SERVICE.clog],
                });
                try {
                    if (await fc2NavigationController.start()) activeContributions.push("detail.fc2-navigation");
                } catch (error) {
                    fc2NavigationController.dispose();
                    runtime.diagnostics.recordError({ source: "list-feature", featureId: "list", contributionId: "detail.fc2-navigation", message: error instanceof Error ? error.message : String(error) });
                }
            }
        }
        if (runtime.enabledContributions.includes("list.fold-category")) {
            categoryFoldController = new ListCategoryFoldController({
                hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], storage: deps[SERVICE.storage],
                storageMutation: deps[SERVICE.storageMutation], styles: deps[PORT.style], notifications: deps[SERVICE.notifications],
                diagnostics: runtime.diagnostics, scope: runtime.scope, route: runtime.route,
            });
            try {
                if (await categoryFoldController.start()) activeContributions.push("list.fold-category");
            } catch (error) {
                categoryFoldController.dispose();
                runtime.diagnostics.recordError({ source: "list-feature", featureId: "list", contributionId: "list.fold-category", message: error instanceof Error ? error.message : String(error) });
                categoryFoldController = null;
            }
        }
        if (runtime.enabledContributions.includes("list.actions") && listCompatibilityService) {
            const listAdapter = listCompatibilityAdapter;
            const list = listCompatibilityAdapter.ensureDelegate();
            const scope = new LifecycleScope("feature:list:actions");
            runtime.scope.addCleanup(() => scope.dispose());
            const blacklistEnabled = runtime.isContributionEnabled("library", "library.blacklist", "BlacklistPlugin");
            const blacklist = blacklistEnabled ? {
                getActressPageInfo: () => runtime.executeCommand("library.blacklist.subject-info"),
                openBlacklistDialog: () => runtime.executeCommand("library.blacklist.open"),
                addBlacklist: (/** @type {any} */ event) => runtime.executeCommand("library.blacklist.add", event),
            } : null;
            listActionsController = new ListActionsController({
                hostAdapter: deps[PORT.host], list, batchController: controller?.batchController, settings: deps[SERVICE.settings], storage: deps[SERVICE.storage],
                ui: deps[SERVICE.domUi], notifications: deps[SERVICE.notifications], scope, sortController,
                blacklist, newVideo: runtime.resolveCompatibilityBean?.("NewVideoPlugin"),
                diagnostics: runtime.diagnostics, openNewVideo: () => runtime.executeCommand("new-video.open"),
            });
            try {
                if (await listActionsController.start()) {
                    const releaseCompatibility = runtime.registerCompatibilityBean?.("ListPageButtonPlugin", listActionsController);
                    if (typeof releaseCompatibility === "function") listActionsController.setCompatibilityRelease(scope.addCleanup(releaseCompatibility));
                    activeContributions.push("list.actions");
                }
            } catch (error) {
                scope.dispose();
                listActionsController = null;
                runtime.diagnostics.recordError({ source: "list-feature", featureId: "list", contributionId: "list.actions", message: error instanceof Error ? error.message : String(error) });
            }
        }
        return {
            activeContributions,
            commands: {
                "list.current-page-summary": () => listCompatibilityService?.getCurrentPageSummary?.() ?? { blockedItems: 0 },
                "list.set-quick-filter": (/** @type {string} */ filter) => listCompatibilityService?.setQuickFilter?.(filter),
            },
            dispose: () => { controller?.dispose(); autoPageController?.dispose(); categoryFoldController?.dispose(); listActionsController?.dispose(); sortController.dispose(); },
        };
    },
});
