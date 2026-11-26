// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { mountContribution } from "../../core/feature-helpers.js";

export default defineFeature({
    id: "list", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["list"], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.translation, SERVICE.http, SERVICE.storage, SERVICE.legacyStorage, SERVICE.legacyUtils, SERVICE.clog, SERVICE.titleKeywords, SERVICE.state, SERVICE.settings, SERVICE.storageMutation, SERVICE.notifications, SERVICE.dialog, SERVICE.busImageLayout, SERVICE.events, SERVICE.domUi, SERVICE.clipboard, SERVICE.navigation, SERVICE.screenshot, SERVICE.movie],
    contributionAvailability: {
        "detail.fc2-navigation": { sites: ["javdb"], routes: ["list"] },
        "list.fold-category": { sites: ["javdb"] },
        "detail.javbus-images": { sites: ["javbus"], routes: ["list"] },
        "detail.cover-state-actions": { routes: ["list"] },
    },
    contributes: ["list.core", "list.auto-page", "detail.fc2-navigation", "list.fold-category", "list.actions", "detail.javbus-images", "detail.cover-state-actions"],
    configurationDependencies: ["new-video", "discovery.new-video", "library", "library.blacklist", "library.favorite-actresses"],
    providesCommands: ["list.current-page-summary", "list.set-quick-filter", "list.get-page-actions", "list.execute-page-action"],
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
        /** @type {import("./list-actions-controller.js").ListActionsController | null} */ let listActionsController = null;
        /** @type {import("./cover-button-controller.js").CoverButtonController | null} */ let coverButtonController = null;
        /** @type {import("./list-compatibility-service.js").ListPageCompatibilityService | null} */ let listCompatibilityService = null;
        /** @type {Record<string, any>} */ const listControllers = {};
        if (runtime.enabledContributions.includes("list.core")) {
            listCompatibilityService = new ListPageCompatibilityService({
                controllers: listControllers,
                readTranslation: () => runtime.getCapability?.("external-bridge.translation"),
                runtimeServices: {
                    host: deps[PORT.host], translation: deps[SERVICE.translation], http: deps[SERVICE.http], diagnostics: runtime.diagnostics,
                    storage: deps[SERVICE.storage], legacyStorage: deps[SERVICE.legacyStorage],
                    titleKeywords: deps[SERVICE.titleKeywords], state: deps[SERVICE.state], settings: deps[SERVICE.settings],
                    busImageLayout: deps[SERVICE.busImageLayout], events: deps[SERVICE.events], scope: () => Promise.resolve(runtime.scope),
                    jquery: deps[SERVICE.domUi].jquery, utils: deps[SERVICE.legacyUtils], logger: deps[SERVICE.clog],
                },
                refreshHistory: () => runtime.isCommandAvailable("library.history.refresh") ? runtime.executeCommand("library.history.refresh") : Promise.resolve(),
            });
            runtime.provideCapability?.("list.core", listCompatibilityService);
            runtime.inspect?.("list.core", listCompatibilityService);
        }
        const sortController = new ListSortController({ hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings] });
        if (runtime.enabledContributions.includes("detail.cover-state-actions") && listCompatibilityService) {
            const list = listCompatibilityService.getCoverButtonCapability();
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
                listControllers.coverButtons = coverButtons;
                coverScope.addCleanup(() => { delete listControllers.coverButtons; });
                await coverButtons.start();
                const releaseCapability = runtime.provideCapability?.("detail.cover-state-actions", coverButtons);
                if (releaseCapability) coverScope.addCleanup(releaseCapability);
                const releaseInspection = runtime.inspect?.("detail.cover-state-actions", coverButtons);
                if (releaseInspection) coverScope.addCleanup(releaseInspection);
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
        if (listCompatibilityService) {
            const legacyPlugin = listCompatibilityService;
            const batchUi = new ListBatchUi({ dialog: deps[SERVICE.dialog], notifications: deps[SERVICE.notifications], diagnostics: runtime.diagnostics });
            const releaseBatchStyles = deps[PORT.style].register("jhs-list-batch-feature", LIST_BATCH_UI_STYLES);
            runtime.scope.addCleanup(() => { batchUi.dispose(); releaseBatchStyles(); });
            const isFavoriteActressesFeatureEnabled = () => runtime.isContributionPreferenceEnabled?.("library", "library.favorite-actresses", "FavoriteActressesPlugin") ?? true;
            const readFilterSources = async ({ stateOnly = false } = {}) => {
                if (stateOnly) {
                    const [carMap, activity] = await Promise.all([deps[SERVICE.state].getCarMap(), deps[SERVICE.state].getListActivity()]);
                    return { carMap, activity };
                }
                const [titleKeywords, blacklistMap, blacklistCars, carMap, activity, favoriteActresses] = await Promise.all([
                    deps[SERVICE.titleKeywords].getAll(), deps[SERVICE.legacyStorage].getBlacklistMap(),
                    deps[SERVICE.state].getBlacklistCarList(), deps[SERVICE.state].getCarMap(), deps[SERVICE.state].getListActivity(),
                    deps[SERVICE.state].getFavoriteActressList?.() ?? deps[SERVICE.legacyStorage]?.getFavoriteActressList?.() ?? [],
                ]);
                return { titleKeywords, blacklistMap, blacklistCars, settings: deps[SERVICE.settings].snapshot(), carMap, activity, favoriteActresses, favoriteActressesEnabled: isFavoriteActressesFeatureEnabled() };
            };
            controller = new ListController({
                legacyPlugin, controllers: listControllers, hostAdapter: deps[PORT.host], scope: runtime.scope, styles: deps[PORT.style],
                state: deps[SERVICE.state], storage: deps[SERVICE.storage], legacyStorage: deps[SERVICE.legacyStorage], readFilterSources,
                isFavoriteActressesFeatureEnabled,
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
            const mounted = await mountContribution(runtime, "list", "list.auto-page", (scope) => {
                scope.addCleanup(deps[PORT.style].register("jhs-auto-page-feature", AUTO_PAGE_STYLES));
                const autoPage = new AutoPageController({
                    hostAdapter: deps[PORT.host], http: deps[SERVICE.http], settings: deps[SERVICE.settings],
                    list: listCompatibilityService?.getAutoPageCapability() ?? null,
                    ui: deps[SERVICE.domUi], eventBus: deps[SERVICE.events], scope,
                });
                scope.addCleanup(() => autoPage.dispose());
                return autoPage.mount();
            });
            if (mounted) activeContributions.push(mounted);
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
            const mounted = await mountContribution(runtime, "list", "list.fold-category", (scope) => {
                const categoryFold = new ListCategoryFoldController({
                    hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], storage: deps[SERVICE.storage],
                    storageMutation: deps[SERVICE.storageMutation], styles: deps[PORT.style], notifications: deps[SERVICE.notifications],
                    diagnostics: runtime.diagnostics, scope, route: runtime.route,
                });
                scope.addCleanup(() => categoryFold.dispose());
                return categoryFold.start();
            });
            if (mounted) activeContributions.push(mounted);
        }
        if (runtime.enabledContributions.includes("list.actions") && listCompatibilityService) {
            const list = listCompatibilityService;
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
                blacklist, diagnostics: runtime.diagnostics,
                openNewVideo: runtime.isContributionEnabled("new-video", "discovery.new-video", "NewVideoPlugin") ? () => runtime.executeCommand("new-video.open") : undefined,
            });
            try {
                if (await listActionsController.start()) {
                    const releaseCapability = runtime.provideCapability?.("list.actions", listActionsController);
                    if (releaseCapability) scope.addCleanup(releaseCapability);
                    const releaseInspection = runtime.inspect?.("list.actions", listActionsController);
                    if (releaseInspection) scope.addCleanup(releaseInspection);
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
                "list.get-page-actions": () => listActionsController?.getPageActions() ?? [],
                "list.execute-page-action": (/** @type {string} */ action, /** @type {any} */ event) => listActionsController?.executePageAction(action, event),
                "list.current-page-summary": () => listCompatibilityService?.getCurrentPageSummary?.() ?? { blockedItems: 0 },
                "list.set-quick-filter": (/** @type {string} */ filter) => listCompatibilityService?.setQuickFilter?.(filter),
            },
            dispose: () => { controller?.dispose(); listActionsController?.dispose(); sortController.dispose(); },
        };
    },
});
