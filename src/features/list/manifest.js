// @ts-check

import { defineFeature } from "../../contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../../contracts/tokens.js";
import { ListController } from "./list-controller.js";
import { ListCategoryFoldController } from "./list-category-fold-controller.js";
import { ListFc2LookupController } from "./list-fc2-lookup-controller.js";
import { ListAutoPageController } from "./list-auto-page-controller.js";
import { ListActionsController } from "./list-actions-controller.js";
import { ListCoverStateActionsController } from "./list-cover-state-actions-controller.js";
import { ListFc2NavigationController } from "./list-fc2-navigation-controller.js";

export default defineFeature({
    id: "list", kind: "feature", disableable: true, failurePolicy: "degraded", sites: ["javdb", "javbus"], routes: ["list", "other"], startup: "eager",
    requires: [PORT.host, PORT.style, SERVICE.translation, SERVICE.http, SERVICE.storage, SERVICE.legacyStorage, SERVICE.storageMutation, SERVICE.state, SERVICE.settings, SERVICE.eventBus, SERVICE.movie, SERVICE.fc2Lookup, SERVICE.fc2OwnedDetail, SERVICE.screenshot, SERVICE.dialog, SERVICE.review, SERVICE.related, SERVICE.magnet, SERVICE.ui, REGISTRY.feature],
    contributes: ["list.core", "list.auto-page", "list.fold-category", "list.actions", "list.fc2-navigation", "list.cover-state-actions", "list.javbus-images", "list.fc2-lookup"],
    providesCommands: [],
    activate: (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        const coreEnabled = runtime.enabledContributions.includes("list.core");
        const autoPagePlugin = runtime.enabledContributions.includes("list.auto-page")
            ? new ListAutoPageController({ hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], http: deps[SERVICE.http], features: deps[REGISTRY.feature], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope })
            : null;
        const foldCategoryController = runtime.enabledContributions.includes("list.fold-category")
            ? new ListCategoryFoldController({ hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], storage: deps[SERVICE.storage], storageMutation: deps[SERVICE.storageMutation], ui: deps[SERVICE.ui], scope: runtime.scope, route: runtime.route })
            : null;
        const actionsPlugin = runtime.enabledContributions.includes("list.actions")
            ? new ListActionsController({ hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], features: deps[REGISTRY.feature], storage: deps[SERVICE.legacyStorage], ui: deps[SERVICE.ui], scope: runtime.scope })
            : null;
        const coverPlugin = runtime.enabledContributions.includes("list.cover-state-actions")
            ? new ListCoverStateActionsController({ hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], storage: deps[SERVICE.storage], movie: deps[SERVICE.movie], screenshot: deps[SERVICE.screenshot], state: deps[SERVICE.state], features: deps[REGISTRY.feature], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope })
            : null;
        const fc2LookupPlugin = runtime.enabledContributions.includes("list.fc2-lookup")
            ? new ListFc2LookupController({ hostAdapter: deps[PORT.host], movie: deps[SERVICE.movie], lookup: deps[SERVICE.fc2Lookup], translation: deps[SERVICE.translation], settings: deps[SERVICE.settings], ui: deps[SERVICE.ui], scope: runtime.scope })
            : null;
        const fc2OwnedEnabled = runtime.isContributionEnabled("detail", "detail.fc2-owned");
        const fc2Controller = runtime.enabledContributions.includes("list.fc2-navigation") && fc2OwnedEnabled
            ? deps[SERVICE.fc2OwnedDetail].create({
                hostAdapter: deps[PORT.host], movie: deps[SERVICE.movie], magnet: deps[SERVICE.magnet], dialog: deps[SERVICE.dialog],
                translation: deps[SERVICE.translation], settings: deps[SERVICE.settings], storage: deps[SERVICE.storage],
                screenshot: deps[SERVICE.screenshot], review: deps[SERVICE.review], related: deps[SERVICE.related], state: deps[SERVICE.state],
                features: deps[REGISTRY.feature], ui: deps[SERVICE.ui], styles: deps[PORT.style], scope: runtime.scope, fc2Lookup: deps[SERVICE.fc2Lookup],
            })
            : null;
        const fc2NavigationPlugin = runtime.enabledContributions.includes("list.fc2-navigation") && fc2OwnedEnabled
            ? new ListFc2NavigationController({ hostAdapter: deps[PORT.host], fc2: fc2Controller, eventBus: deps[SERVICE.eventBus], ui: deps[SERVICE.ui], scope: runtime.scope })
            : null;
        const controller = new ListController(/** @type {any} */ ({ coreEnabled, features: deps[REGISTRY.feature], javbusImagesEnabled: runtime.enabledContributions.includes("list.javbus-images"), autoPagePlugin, foldCategoryController, actionsPlugin, fc2NavigationPlugin, coverPlugin, fc2LookupPlugin, isolateContribution: runtime.isolateContribution, hostAdapter: deps[PORT.host], settings: deps[SERVICE.settings], storage: deps[SERVICE.legacyStorage], eventBus: deps[SERVICE.eventBus], http: deps[SERVICE.http], stateService: deps[SERVICE.state], translation: deps[SERVICE.translation], styles: deps[PORT.style], ui: deps[SERVICE.ui], scope: runtime.scope }));
        return controller.start().then(() => ({ api: controller.getApi(), dispose: () => controller.dispose() }));
    },
});
