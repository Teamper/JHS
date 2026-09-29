// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime, migrateDisabledPlugins } from "../src/app/feature-runtime.js";
import { ProviderRegistry } from "../src/app/provider-registry.js";
import { defineFeature, defineIntegration } from "../src/contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../src/contracts/tokens.js";
import { SettingsRegistry } from "../src/app/settings-registry.js";
import { featureManifests } from "../src/features/catalog.js";
import fc2Catalog from "../src/features/external-bridge/fc2-catalog-manifest.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { openSettingsUi, registerSettingsUiOwner } from "../src/core/settings-ui-owner.js";
import { CompatibilityBeanRegistry } from "../src/core/compatibility-bean-registry.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";
import { createIntegrationRequestFacade } from "../src/app/integration-registry.js";

describe("v6.5 architecture runtime contracts", () => {
    it("keeps the FC2 catalog out of first-ready and activates its compatibility service on demand", async () => {
        document.body.innerHTML = '<nav id="navbar-menu-hero"><a href="/tags/fc2">FC2</a></nav>';
        window.history.replaceState({}, "", "/v/movie-123");
        const diagnostics = new DiagnosticsService();
        const commands = new CommandRegistry();
        const runtime = new FeatureRuntime({
            container: new DependencyContainer()
                .register(PORT.host, { site: "javdb", document, location: window.location })
                .register(SERVICE.movie, { resolve: vi.fn() })
                .register(SERVICE.domUi, { jquery: (value) => jquery(value), loading: vi.fn() })
                .register(SERVICE.notifications, { error: vi.fn() })
                .register(SERVICE.diagnostics, diagnostics),
            commands, diagnostics, site: "javdb", route: "detail",
        });
        runtime.register(fc2Catalog);

        await runtime.start();
        expect(runtime.getActiveFeatureIds()).toEqual([]);
        expect(document.querySelector("#jhs-123av-nav")).toBeNull();

        const controller = await commands.execute("fc2-catalog.ensure");
        expect(controller).toMatchObject({ managedByFeature: true, runtimeStatus: "managed-feature" });
        expect(document.querySelector("#jhs-123av-nav")).not.toBeNull();

        (await runtime.activate("fc2-catalog")).dispose();
        expect(document.querySelector("#jhs-123av-nav")).toBeNull();
    });

    it("exposes only compatibility beans through the retired plugin facade", () => {
        const manager = new CompatibilityBeanRegistry(), facade = { managedByFeature: true };
        manager.registerCompatibilityBean("UnifiedOfflinePlugin", facade);
        expect(manager.getBean("UnifiedOfflinePlugin")).toBe(facade);
        expect(manager.getPluginNames()).toEqual([]);
        expect(manager.getTimings()).toEqual([]);
        expect(manager.getCssTimings()).toEqual([]);
        expect(manager.getStartupReport()).toEqual({ registeredPlugins: 0, registrationMs: 0, cssMs: 0, immediateMs: 0, readyMs: 0, idlePending: 0, idleCompleted: 0 });
        expect(manager.register).toBeUndefined();
        expect(manager.processPlugins).toBeUndefined();
        expect(manager.prepareCss).toBeUndefined();
    });

    it("injects only declared tokens and rejects duplicate or missing dependencies", () => {
        const diagnostics = new DiagnosticsService();
        const container = new DependencyContainer(diagnostics);
        const movie = { id: "movie" };
        container.register(SERVICE.movie, movie);
        expect(container.resolveDeclared([SERVICE.movie])[SERVICE.movie]).toBe(movie);
        expect(() => container.resolveDeclared([SERVICE.movie])[SERVICE.review]).toThrow(/Undeclared dependency access/);
        expect(diagnostics.exportSnapshot().errors.at(-1)).toMatchObject({ code: "UNDECLARED_DEPENDENCY", source: "DependencyContainer" });
        expect(() => container.register(SERVICE.movie, {})).toThrow(/Duplicate/);
        expect(() => container.resolveDeclared([SERVICE.review])).toThrow(/Missing/);
        expect(() => container.resolveDeclared([SERVICE.movie, SERVICE.movie])).toThrow(/Duplicate declared dependency/);
    });

    it("permits declared optional tokens to be absent while rejecting undeclared access", () => {
        const container = new DependencyContainer(new DiagnosticsService()), dialog = { open() {} };
        container.register(SERVICE.dialog, dialog);
        const dependencies = container.resolveDeclared([SERVICE.dialog], [PORT.host]);
        expect(dependencies[SERVICE.dialog]).toBe(dialog);
        expect(dependencies[PORT.host]).toBeUndefined();
        expect(() => dependencies[SERVICE.state]).toThrow(/Undeclared dependency access/);
    });

    it("records zero plugin execution in diagnostics while retaining contribution settings", () => {
        const diagnostics = new DiagnosticsService(), manager = new CompatibilityBeanRegistry({ diagnostics });
        manager.setCatalogDescriptors([{ name: "ListPagePlugin", disableable: true }]);
        expect(diagnostics.exportSnapshot()).toMatchObject({
            legacyPlugins: [],
            legacyPluginDescriptors: [{ name: "ListPagePlugin", disableable: true }],
            legacyStartup: { registeredPlugins: 0, registrationMs: 0, cssMs: 0, immediateMs: 0, readyMs: 0, idlePending: 0, idleCompleted: 0 },
            legacyTimings: [],
        });
    });

    it("registers legacy contributions from manifests without changing site order", async () => {
        expect(featureManifests).toHaveLength(22);
        expect(featureManifests.find((item) => item.id === "fc2-workspace")).toMatchObject({ startup: "eager", providesCommands: ["detail.fc2.workspace"], contributes: ["detail.fc2-owned"] });
        expect(featureManifests.find((item) => item.id === "settings-effects")).toMatchObject({ kind: "system", startup: "eager", contributes: [], requires: expect.arrayContaining([SERVICE.clog, SERVICE.settings, SERVICE.busImageLayout]) });
        expect(featureManifests.find((item) => item.id === "settings-entry")).toMatchObject({ kind: "system", startup: "eager", contributes: ["settings.core"], requires: expect.arrayContaining([PORT.style]) });
        expect(featureManifests.find((item) => item.id === "settings")).toMatchObject({ kind: "system", startup: "on-command", providesCommands: ["settings.open"] });
        window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
        const $ = jquery;
        vi.stubGlobal("$", $);
        vi.stubGlobal("jQuery", $);
        vi.stubGlobal("localforage", { INDEXEDDB: "indexeddb", createInstance: () => ({}) });
        Object.assign(globalThis, { utils: {}, storageManager: {} });
        const { compatibilityContributionCatalog, registerSiteCompatibility } = await import("../src/features/compatibility/contribution-catalog.js");
        expect(new Set(compatibilityContributionCatalog.map((item) => item.id)).size).toBe(compatibilityContributionCatalog.length);
        expect(new Set(compatibilityContributionCatalog.map((item) => item.legacyPluginId)).size).toBe(compatibilityContributionCatalog.length);
        expect(compatibilityContributionCatalog.filter((item) => item.plugin)).toEqual([]);
        expect(compatibilityContributionCatalog.find((item) => item.id === "list.core")).toMatchObject({
            executionOwner: "feature", lifecycleOwner: "feature", plugin: null, legacyPluginId: "ListPagePlugin",
        });
        expect(compatibilityContributionCatalog.find((item) => item.id === "discovery.top250")).toMatchObject({ legacyPluginId: "TOP250Plugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.fc2-owned")).toMatchObject({ featureId: "fc2-workspace", executionOwner: "feature", lifecycleOwner: "feature", legacyPluginId: "Fc2Plugin" });
        expect(compatibilityContributionCatalog.find((item) => item.id === "settings.core")).toMatchObject({ featureId: "settings-entry", executionOwner: "feature", lifecycleOwner: "feature", legacyPluginId: "SettingPlugin", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "library.blacklist")).toMatchObject({ featureId: "library", executionOwner: "feature", plugin: null, legacyPluginId: "BlacklistPlugin" });
        expect(compatibilityContributionCatalog.filter((item) => ["detail.fc2-owned", "library.history", "settings.core", "library.blacklist", "discovery.new-video", "discovery.scheduler"].includes(item.id)).map((item) => [item.id, item.legacyPluginId])).toEqual([
            ["detail.fc2-owned", "Fc2Plugin"], ["library.history", "HistoryPlugin"], ["settings.core", "SettingPlugin"],
            ["library.blacklist", "BlacklistPlugin"], ["discovery.new-video", "NewVideoPlugin"], ["discovery.scheduler", "TaskPlugin"],
        ]);
        expect(compatibilityContributionCatalog.find((item) => item.id === "discovery.hit-show")).toMatchObject({ legacyPluginId: "HitShowPlugin", executionOwner: "feature", plugin: null });
        expect(featureManifests.find((item) => item.id === "discovery")).toMatchObject({ requires: [PORT.host], contributes: ["discovery.hit-show"] });
        expect(featureManifests.find((item) => item.id === "discovery")).toMatchObject({ routes: ["list"] });
        expect(featureManifests.find((item) => item.id === "ranking")).toMatchObject({ routes: ["list"] });
        expect(compatibilityContributionCatalog.find((item) => item.id === "list.actions")).toMatchObject({ legacyPluginId: "ListPageButtonPlugin", executionOwner: "feature", plugin: null });
        expect(featureManifests.find((item) => item.id === "list").contributes).toContain("list.actions");
        expect(compatibilityContributionCatalog.find((item) => item.id === "list.auto-page")).toMatchObject({ featureId: "list", legacyPluginId: "AutoPagePlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "library.keyword-filter")).toMatchObject({ featureId: "library", legacyPluginId: "FilterTitleKeywordPlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "library.keyword-filter")).toMatchObject({ routes: ["list", "detail", "owned-detail"], surfaces: ["list-page", "detail-page"] });
        expect(compatibilityContributionCatalog.find((item) => item.id === "external-bridge.115-match")).toMatchObject({ featureId: "one-one-five", legacyPluginId: "OneOneFiveMatchPlugin", executionOwner: "feature", plugin: null, routes: ["list", "detail"], surfaces: ["list-page", "detail-page"] });
        expect(compatibilityContributionCatalog.find((item) => item.id === "library.blacklist")).toMatchObject({ routes: ["list"], surfaces: ["list-page"] });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.cover-state-actions")).toMatchObject({ featureId: "list", executionOwner: "feature", plugin: null, legacyPluginId: "CoverButtonPlugin", routes: ["list"], surfaces: ["list-card"] });
        expect(featureManifests.find((item) => item.id === "list").contributes).toContain("detail.cover-state-actions");
        expect(compatibilityContributionCatalog.find((item) => item.id === "compatibility.enhancements")).toMatchObject({ featureId: "compatibility", legacyPluginId: "CompatibilityEnhancementsPlugin", executionOwner: "feature", plugin: null });
        expect(featureManifests.find((item) => item.id === "compatibility")).toMatchObject({ startup: "eager", requires: expect.arrayContaining([PORT.host, PORT.style, SERVICE.state, SERVICE.domUi]) });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.fc2-navigation")).toMatchObject({ featureId: "list", legacyPluginId: "Fc2NavigationPlugin", executionOwner: "feature", plugin: null, routes: ["list"], surfaces: ["list-card"] });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.screenshot")).toMatchObject({ featureId: "detail", legacyPluginId: "ScreenShotPlugin", executionOwner: "feature", routes: ["list", "detail"], surfaces: ["list-page", "detail-page"] });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.reviews")).toMatchObject({ featureId: "detail", legacyPluginId: "ReviewPlugin", executionOwner: "feature", plugin: null, requires: expect.arrayContaining([SERVICE.domUi, SERVICE.clipboard, SERVICE.notifications, SERVICE.diagnostics]) });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.related")).toMatchObject({ featureId: "detail", legacyPluginId: "RelatedPlugin", executionOwner: "feature", plugin: null, requires: expect.arrayContaining([SERVICE.domUi, SERVICE.notifications, SERVICE.diagnostics]) });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.external-sites")).toMatchObject({ featureId: "external-sites", legacyPluginId: "OtherSitePlugin", executionOwner: "feature", plugin: null, routes: ["detail", "owned-detail"], surfaces: ["detail-page"] });
        expect(featureManifests.find((item) => item.id === "external-sites")).toMatchObject({ routes: ["detail", "owned-detail"] });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.native-magnets")).toMatchObject({ featureId: "detail", legacyPluginId: "HighlightMagnetPlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.javdb-preview")).toMatchObject({ featureId: "detail", legacyPluginId: "PreviewVideoPlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "external-bridge.123pan")).toMatchObject({ featureId: "external-bridge", legacyPluginId: "OneTwoThreeOfflinePlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "external-bridge.offline")).toMatchObject({ featureId: "external-bridge", legacyPluginId: "UnifiedOfflinePlugin", executionOwner: "feature", lifecycleOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "external-bridge.javtrailers")).toMatchObject({ featureId: "external-bridge", legacyPluginId: "JavTrailersPlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "external-bridge.subtitle")).toMatchObject({ featureId: "external-bridge", legacyPluginId: "SubTitleCatPlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "external-bridge.translation")).toMatchObject({ featureId: "translation", legacyPluginId: "TranslatePlugin", executionOwner: "feature", plugin: null, routes: ["list", "detail"] });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.javbus-preview")).toMatchObject({ featureId: "detail", legacyPluginId: "BusPreviewVideoPlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.javbus-images")).toMatchObject({
            featureId: "list", legacyPluginId: "BusImgPlugin", executionOwner: "feature", plugin: null, routes: ["list"], surfaces: ["list-page"],
        });
        expect(featureManifests.find((item) => item.id === "list").contributes).toContain("detail.javbus-images");
        expect(featureManifests.find((item) => item.id === "detail").contributes).not.toContain("detail.javbus-images");
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.external-magnets")).toMatchObject({ featureId: "external-bridge", legacyPluginId: "MagnetHubPlugin", executionOwner: "feature", plugin: null, routes: [], surfaces: [] });
        expect(featureManifests.find((item) => item.id === "external-bridge").contributes).toContain("detail.external-magnets");
        expect(featureManifests.find((item) => item.id === "external-bridge").contributes).toContain("external-bridge.javtrailers");
        expect(featureManifests.find((item) => item.id === "external-bridge")).toMatchObject({ requires: expect.arrayContaining([SERVICE.notifications]), optionalRequires: [PORT.host] });
        expect(featureManifests.find((item) => item.id === "fc2-catalog")).toMatchObject({ sites: ["javdb"], startup: "idle", requires: expect.arrayContaining([PORT.host, SERVICE.movie]), contributes: ["detail.fc2-lookup"], providesCommands: ["fc2-catalog.ensure"] });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.fc2-lookup")).toMatchObject({ featureId: "fc2-catalog", legacyPluginId: "Fc2By123AvPlugin", executionOwner: "feature", plugin: null, routes: ["list", "detail", "owned-detail"], surfaces: ["list-card", "detail-page"] });
        expect(featureManifests.find((item) => item.id === "detail").contributes).not.toContain("detail.fc2-lookup");
        expect(featureManifests.find((item) => item.id === "external-bridge").contributes).not.toContain("external-bridge.115-match");
        expect(featureManifests.find((item) => item.id === "one-one-five")).toMatchObject({
            sites: ["javdb", "javbus"], routes: ["list", "detail"], startup: "idle", requires: expect.arrayContaining([PORT.host, SERVICE.offline, SERVICE.settings]),
            contributes: ["external-bridge.115-match"],
        });
        expect(featureManifests.find((item) => item.id === "actress-info").startup).toBe("idle");
        expect(featureManifests.find((item) => item.id === "new-video").startup).toBe("idle");
        expect(featureManifests.find((item) => item.id === "new-video").requires).toContain(SERVICE.events);
        expect(featureManifests.find((item) => item.id === "scheduler").startup).toBe("idle");
        expect(featureManifests.find((item) => item.id === "translation")).toMatchObject({ sites: ["javdb", "javbus"], requires: expect.arrayContaining([PORT.host, SERVICE.translation]), contributes: ["external-bridge.translation"] });
        expect(featureManifests.find((item) => item.id === "translation").requiresFeaturesByRoute).toEqual({ list: ["list"] });
        expect(featureManifests.find((item) => item.id === "detail").contributes).toContain("detail.screenshot");
        expect(featureManifests.find((item) => item.id === "detail").contributes).not.toContain("detail.external-magnets");
        expect(featureManifests.find((item) => item.id === "list").contributes).toContain("detail.fc2-navigation");
        expect(featureManifests.find((item) => item.id === "detail").contributes).not.toContain("detail.fc2-navigation");
        expect(compatibilityContributionCatalog.find((item) => item.id === "library.favorite-actresses")).toMatchObject({ legacyPluginId: "FavoriteActressesPlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "library.history")).toMatchObject({ legacyPluginId: "HistoryPlugin", executionOwner: "feature", lifecycleOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "identity.actress-info")).toMatchObject({ legacyPluginId: "ActressInfoPlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "identity.javdb-navigation")).toMatchObject({ featureId: "identity", legacyPluginId: "NavBarPlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "identity.javbus-navigation")).toMatchObject({ featureId: "identity", legacyPluginId: "BusNavBarPlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.javdb-native")).toMatchObject({ featureId: "detail", legacyPluginId: "DetailPagePlugin", executionOwner: "feature", plugin: null });
        expect(compatibilityContributionCatalog.find((item) => item.id === "detail.javbus-native")).toMatchObject({ featureId: "identity", legacyPluginId: "BusDetailPagePlugin", executionOwner: "feature", plugin: null });
        expect(featureManifests.find((item) => item.id === "identity").requires).toEqual(expect.arrayContaining([PORT.host, PORT.style, SERVICE.movie, SERVICE.navigation, SERVICE.clipboard, SERVICE.dialog, SERVICE.storage, SERVICE.imageSearch, SERVICE.settings]));
        expect(featureManifests.find((item) => item.id === "detail").requires).toContain(SERVICE.domUi);
        expect(featureManifests.find((item) => item.id === "library").requires).toEqual(expect.arrayContaining([SERVICE.titleKeywords, SERVICE.domUi, SERVICE.events, SERVICE.profile]));
        expect(featureManifests.find((item) => item.id === "identity").contributes).toContain("identity.javdb-navigation");
        expect(featureManifests.find((item) => item.id === "identity").contributes).toContain("identity.javbus-navigation");
        expect(featureManifests.find((item) => item.id === "identity").contributes).toContain("detail.javbus-native");
        expect(featureManifests.find((item) => item.id === "detail").contributes).not.toContain("detail.javbus-native");
        expect(compatibilityContributionCatalog.filter((item) => ["discovery.new-video", "discovery.scheduler"].includes(item.id)).map((item) => [item.id, item.lifecycleOwner])).toEqual([
            ["discovery.new-video", "feature"], ["discovery.scheduler", "feature"],
        ]);
        const createRuntime = (site, disabled = [], route = "list") => {
            const diagnostics = new DiagnosticsService();
            const container = new DependencyContainer().register(PORT.host, { locateDetailSlots: () => ({}) }).register(PORT.style, { register: () => () => {} }).register(SERVICE.navigation, { assign() {}, open() {} }).register(SERVICE.diagnostics, diagnostics).register(SERVICE.dialog, {}).register(SERVICE.webdav, {}).register(SERVICE.credential, {}).register(SERVICE.pan123Credential, { getStoredToken: async () => "token" }).register(SERVICE.review, {}).register(SERVICE.related, {}).register(SERVICE.movie, { externalNavigationLinks: () => [] }).register(SERVICE.actressInfo, {}).register(SERVICE.imageSearch, {}).register(SERVICE.magnet, {}).register(SERVICE.resourceSettings, {}).register(SERVICE.screenshot, {}).register(SERVICE.translation, {}).register(SERVICE.subtitle, {}).register(SERVICE.account, {}).register(SERVICE.settings, {}).register(SERVICE.domUi, {}).register(SERVICE.titleKeywords, {}).register(SERVICE.notifications, { error() {}, info() {} }).register(SERVICE.clipboard, { copyText: async () => true }).register(SERVICE.profile, { current: () => "regular" }).register(SERVICE.storage, {}).register(SERVICE.libraryStats, {}).register(SERVICE.cache, {}).register(SERVICE.http, {}).register(SERVICE.events, { on: () => () => {}, emit: async () => {} }).register(SERVICE.offline, {}).register(SERVICE.state, {}).register(SERVICE.busImageLayout, { logImageHeightsByRow: async () => {} }).register(REGISTRY.settings, new SettingsRegistry());
            const runtime = new FeatureRuntime({ container, commands: new CommandRegistry(), diagnostics, disabled, site, route });
            featureManifests.forEach((manifest) => runtime.register(manifest));
            return runtime;
        };
        const javdb = new CompatibilityBeanRegistry();
        registerSiteCompatibility(javdb, createRuntime("javdb"), "javdb");
        expect(javdb.getPluginNames()).toEqual([]);
        expect(javdb.getBean("ListPagePlugin")).toMatchObject({ managedByFeature: true, runtimeStatus: "managed-feature", delegate: null });
        expect(javdb.getBean("SettingPlugin")).toMatchObject({ getName: expect.any(Function), createFeatureService: expect.any(Function), connect: expect.any(Function) });
        expect(javdb.getPluginNames()).not.toContain("HistoryPlugin");
        expect(javdb.getBean("HistoryPlugin")).toMatchObject({ getName: expect.any(Function), openHistory: expect.any(Function) });
        expect(javdb.getBean("BlacklistPlugin")).toMatchObject({ getName: expect.any(Function), addBlacklist: expect.any(Function), filterAllVideo: expect.any(Function) });
        expect(javdb.getPluginNames()).not.toContain("MobileBottomBarPlugin");
        expect(javdb.getBean("MobileBottomBarPlugin")).toMatchObject({ magnetFilterAdapter: null, magnetHubAdapter: null });
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "MobileBottomBarPlugin", disableable: false });
        expect(javdb.getPluginNames()).not.toContain("WantAndWatchedVideosPlugin");
        expect(javdb.getPluginNames()).not.toContain("ReviewPlugin");
        expect(javdb.getPluginNames()).not.toContain("RelatedPlugin");
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "WantAndWatchedVideosPlugin", disableable: true });
        expect(javdb.getPluginNames()).not.toContain("ScreenShotPlugin");
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "ScreenShotPlugin", disableable: true });
        const screenshotDisabledManager = new CompatibilityBeanRegistry();
        registerSiteCompatibility(screenshotDisabledManager, createRuntime("javdb", ["ScreenShotPlugin"]), "javdb");
        expect(screenshotDisabledManager.getBean("CoverButtonPlugin")).toBeUndefined();
        expect(javdb.getPluginNames()).not.toContain("TOP250Plugin");
        expect(javdb.getBean("CompatibilityEnhancementsPlugin")).toBeUndefined();
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "CompatibilityEnhancementsPlugin", disableable: true });
        expect(javdb.getPluginNames()).not.toContain("HitShowPlugin");
        expect(javdb.getBean("NewVideoPlugin")).toMatchObject({ getName: expect.any(Function), connect: expect.any(Function), disconnect: expect.any(Function), openDialog: expect.any(Function) });
        expect(javdb.getPluginNames()).not.toContain("TaskPlugin");
        expect(javdb.getBean("TaskPlugin")).toMatchObject({ getName: expect.any(Function), connect: expect.any(Function) });
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "TaskPlugin", disableable: true });
        expect(javdb.getBean("AutoPagePlugin")).toBeUndefined();
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "AutoPagePlugin", disableable: true });
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "TranslatePlugin", disableable: true });
        expect(javdb.getPluginNames()).not.toContain("TranslatePlugin");
        expect(javdb.getBean("FilterTitleKeywordPlugin")).toBeUndefined();
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "FilterTitleKeywordPlugin", disableable: true });
        expect(javdb.getBean("ListPageButtonPlugin")).toBeUndefined();
        expect(javdb.getPluginNames()).not.toContain("ListPageButtonPlugin");
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "ListPageButtonPlugin", disableable: true });
        expect(javdb.getBean("Fc2NavigationPlugin")).toBeUndefined();
        expect(javdb.getBean("OneTwoThreeOfflinePlugin")).toBeUndefined();
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "OneTwoThreeOfflinePlugin", disableable: true });
        expect(javdb.getBean("UnifiedOfflinePlugin")).toBeUndefined();
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "UnifiedOfflinePlugin", disableable: true });
        expect(javdb.getBean("OneOneFiveMatchPlugin")).toBeUndefined();
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "OneOneFiveMatchPlugin", disableable: true });
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "TOP250Plugin", disableable: true });
        expect(javdb.getPluginNames()).not.toContain("SearchByImagePlugin");
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "SearchByImagePlugin", disableable: true });
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "HitShowPlugin", disableable: true });
        expect(javdb.getPluginNames()).not.toContain("FoldCategoryPlugin");
        expect(javdb.getPluginDescriptors()).toContainEqual({ name: "FoldCategoryPlugin", disableable: true });
        const javdbDetail = new CompatibilityBeanRegistry();
        registerSiteCompatibility(javdbDetail, createRuntime("javdb", [], "detail"), "javdb");
        expect(javdbDetail.getPluginNames()).not.toContain("DetailPagePlugin");
        expect(javdbDetail.getPluginNames()).not.toContain("CoverButtonPlugin");
        expect(javdbDetail.getPluginNames()).not.toContain("BlacklistPlugin");
        expect(javdbDetail.getBean("BlacklistPlugin")).toBeUndefined();
        expect(javdbDetail.getPluginNames()).not.toContain("TranslatePlugin");
        expect(javdbDetail.getPluginDescriptors()).toContainEqual({ name: "DetailPagePlugin", disableable: true });
        expect(javdbDetail.getBean("ReviewPlugin").managedByFeature).toBe(true);
        expect(javdbDetail.getBean("RelatedPlugin").managedByFeature).toBe(true);
        expect(javdbDetail.getPluginNames()).not.toContain("ReviewPlugin");
        expect(javdbDetail.getPluginNames()).not.toContain("RelatedPlugin");
        expect(javdbDetail.getBean("HighlightMagnetPlugin")).toBeUndefined();
        expect(javdbDetail.getPluginNames()).not.toContain("HighlightMagnetPlugin");
        expect(javdbDetail.getPluginDescriptors()).toContainEqual({ name: "HighlightMagnetPlugin", disableable: true });
        expect(javdbDetail.getBean("MagnetHubPlugin")).toBeUndefined();
        expect(javdbDetail.getPluginNames()).not.toContain("MagnetHubPlugin");
        expect(javdbDetail.getPluginDescriptors()).toContainEqual({ name: "MagnetHubPlugin", disableable: true });
        const javbus = new CompatibilityBeanRegistry();
        registerSiteCompatibility(javbus, createRuntime("javbus", ["ReviewPlugin"]), "javbus");
        expect(javbus.getPluginNames()).not.toContain("BusNavBarPlugin");
        expect(javbus.getPluginDescriptors()).toContainEqual({ name: "BusNavBarPlugin", disableable: true });
        expect(javbus.getPluginNames()).not.toContain("BusDetailPagePlugin");
        expect(javbus.getPluginDescriptors()).toContainEqual({ name: "BusDetailPagePlugin", disableable: true });
        expect(javbus.getPluginNames()).not.toContain("ReviewPlugin");
        expect(javbus.getBean("ReviewPlugin")).toBeUndefined();
        expect(javbus.getPluginNames()).not.toContain("DetailWorkspacePlugin");
        expect(javbus.getPluginDescriptors()).toContainEqual({ name: "DetailWorkspacePlugin", disableable: true });
        expect(javbus.getPluginNames()).not.toContain("WantAndWatchedVideosPlugin");
        const javbusDetail = new CompatibilityBeanRegistry();
        registerSiteCompatibility(javbusDetail, createRuntime("javbus", [], "detail"), "javbus");
        expect(javbusDetail.getBean("BusPreviewVideoPlugin")).toBeUndefined();
        expect(javbusDetail.getPluginNames()).not.toContain("BusPreviewVideoPlugin");
        expect(javbusDetail.getPluginDescriptors()).toContainEqual({ name: "BusPreviewVideoPlugin", disableable: true });

        const javdbWithCoverDisabled = new CompatibilityBeanRegistry();
        registerSiteCompatibility(javdbWithCoverDisabled, createRuntime("javdb", ["CoverButtonPlugin"]), "javdb");
        expect(javdbWithCoverDisabled.getPluginNames()).not.toContain("CoverButtonPlugin");
        expect(javdbWithCoverDisabled.getPluginNames()).not.toContain("ListPagePlugin");
        expect(javdbWithCoverDisabled.getBean("ListPagePlugin")).toMatchObject({ managedByFeature: true, delegate: null });
        expect(javdbWithCoverDisabled.getPluginDescriptors()).toContainEqual({ name: "CoverButtonPlugin", disableable: true });

        const javdbWithExternalSitesDisabled = new CompatibilityBeanRegistry();
        registerSiteCompatibility(javdbWithExternalSitesDisabled, createRuntime("javdb", ["OtherSitePlugin"], "detail"), "javdb");
        expect(javdbWithExternalSitesDisabled.getPluginNames()).not.toContain("OtherSitePlugin");
        expect(javdbWithExternalSitesDisabled.getPluginDescriptors()).toContainEqual({ name: "OtherSitePlugin", disableable: true });

        const javbusWithImagesDisabled = new CompatibilityBeanRegistry();
        registerSiteCompatibility(javbusWithImagesDisabled, createRuntime("javbus", ["BusImgPlugin"]), "javbus");
        expect(javbusWithImagesDisabled.getPluginNames()).not.toContain("BusImgPlugin");
        expect(javbusWithImagesDisabled.getPluginNames()).not.toContain("BusPreviewVideoPlugin");
        expect(javbusWithImagesDisabled.getPluginDescriptors()).toContainEqual({ name: "BusImgPlugin", disableable: true });

        const javbusWithNavDisabled = new CompatibilityBeanRegistry();
        registerSiteCompatibility(javbusWithNavDisabled, createRuntime("javbus", ["BusNavBarPlugin"]), "javbus");
        expect(javbusWithNavDisabled.getPluginNames()).not.toContain("BusNavBarPlugin");
        expect(javbusWithNavDisabled.getPluginDescriptors()).toContainEqual({ name: "BusNavBarPlugin", disableable: true });

        for (const [site, disabledPlugin, survivingPlugin] of [
            ["javdb", "Fc2Plugin", "ListPagePlugin"],
            ["javdb", "ListPageButtonPlugin", "ListPagePlugin"],
            ["javdb", "HighlightMagnetPlugin", "ListPagePlugin"],
            ["javdb", "MagnetHubPlugin", "ListPagePlugin"],
        ]) {
            const manager = new CompatibilityBeanRegistry();
            registerSiteCompatibility(manager, createRuntime(site, [disabledPlugin]), site);
            expect(manager.getPluginNames(), `${survivingPlugin} must survive disabled ${disabledPlugin}`).not.toContain(disabledPlugin);
            expect(manager.getPluginNames(), `${survivingPlugin} must stay out of PluginManager execution`).not.toContain(survivingPlugin);
            expect(manager.getBean(survivingPlugin), `${survivingPlugin} compatibility lookup must survive disabled ${disabledPlugin}`).toBeDefined();
        }
        expect(migrateDisabledPlugins(["AutoPagePlugin"])).toContain("list.auto-page");
        expect(migrateDisabledPlugins(["TranslatePlugin"])).toEqual(["external-bridge.translation"]);

        const legacyDiagnostics = new DiagnosticsService();
        const javdbWithStaleSystemDisables = new CompatibilityBeanRegistry({ diagnostics: legacyDiagnostics });
        registerSiteCompatibility(javdbWithStaleSystemDisables, createRuntime("javdb", ["settings.core", "stats.dashboard", "responsive-shell.bottom-bar"]), "javdb");
        expect(javdbWithStaleSystemDisables.getPluginNames()).not.toContain("SettingPlugin");
        expect(javdbWithStaleSystemDisables.getBean("SettingPlugin")).toBeDefined();
        expect(javdbWithStaleSystemDisables.getPluginNames()).not.toContain("MobileBottomBarPlugin");
        expect(javdbWithStaleSystemDisables.getBean("MobileBottomBarPlugin")).toBeDefined();
        expect(javdbWithStaleSystemDisables.getPluginNames()).not.toContain("StatsPlugin");
        expect(javdbWithStaleSystemDisables.getPluginDescriptors()).toContainEqual({ name: "StatsPlugin", disableable: false });
        expect(javdbWithStaleSystemDisables.getPluginDescriptors().filter((plugin) => plugin.disableable === false).map((plugin) => plugin.name)).toEqual([
            "SettingPlugin", "StatsPlugin", "MobileBottomBarPlugin",
        ]);
        expect(legacyDiagnostics.exportSnapshot().legacyPluginDescriptors.filter((plugin) => plugin.disableable === false).map((plugin) => plugin.name)).toEqual([
            "SettingPlugin", "StatsPlugin", "MobileBottomBarPlugin",
        ]);
        expect(migrateDisabledPlugins(["StatsPlugin"])).toContain("stats.dashboard");
    }, 15_000);

    it("keeps every contribution Feature-owned with an explicit compatibility ID", async () => {
        const { compatibilityContributionCatalog } = await import("../src/features/compatibility/contribution-catalog.js");
        for (const contribution of compatibilityContributionCatalog) {
            expect(contribution.executionOwner, contribution.id).toBe("feature");
            expect(contribution.plugin, contribution.id).toBeNull();
            expect(contribution.legacyPluginId, contribution.id).toBeTruthy();
        }
    });

    it("preserves each stable disable ID through the compatibility mapping", async () => {
        const { compatibilityContributionCatalog } = await import("../src/features/compatibility/contribution-catalog.js");
        const { LEGACY_PLUGIN_CONTRIBUTION_MAP } = await import("../src/core/legacy-plugin-contributions.js");
        for (const contribution of compatibilityContributionCatalog) {
            expect(LEGACY_PLUGIN_CONTRIBUTION_MAP[contribution.legacyPluginId], contribution.id).toBe(contribution.id);
        }
    });

    it("exports measured and redacted diagnostics", () => {
        const diagnostics = new DiagnosticsService();
        diagnostics.updateScope({ id: "app:root", listeners: 3, observers: 1 });
        diagnostics.recordError({ message: "failed https://user:pass@example.com/x", authorization: "Bearer secret" });
        const snapshot = diagnostics.exportSnapshot();
        expect(snapshot.globalListeners).toBe(3);
        expect(snapshot.observers).toBe(1);
        expect(snapshot.errors[0]).toMatchObject({ authorization: "[redacted]" });
        expect(snapshot.errors[0].message).not.toContain("user:pass");
    });

    it("lazily activates a command owner and preserves contribution-level disabling", async () => {
        const commands = new CommandRegistry();
        const diagnostics = new DiagnosticsService();
        const runtime = new FeatureRuntime({
            container: new DependencyContainer().register(SERVICE.movie, { open: vi.fn() }),
            commands, diagnostics, disabled: ["ReviewPlugin"], site: "javdb", route: "detail",
        });
        const activate = vi.fn((deps, api) => ({
            commands: { "detail.open": () => deps[SERVICE.movie].open() },
            enabled: api.enabledContributions,
        }));
        runtime.register(defineFeature({
            id: "detail", kind: "feature", disableable: true, sites: ["javdb"], routes: ["detail"],
            startup: "on-command", requires: [SERVICE.movie], contributes: ["detail.reviews", "detail.related"],
            providesCommands: ["detail.open"], activate,
        }));
        await commands.execute("detail.open");
        expect(activate).toHaveBeenCalledOnce();
        expect(diagnostics.exportSnapshot().activeContributions).toEqual(["detail.related"]);
        expect(migrateDisabledPlugins(["ReviewPlugin", "UnknownPlugin"])).toEqual(["detail.reviews", "UnknownPlugin"]);
        expect(migrateDisabledPlugins(["CoverButtonPlugin", "DetailPageButtonPlugin", "BusImgPlugin", "BusPreviewVideoPlugin"])).toEqual([
            "detail.cover-state-actions", "detail.page-state-actions", "detail.javbus-images", "detail.javbus-preview",
        ]);
        expect(migrateDisabledPlugins(["HighlightMagnetPlugin"])).toEqual(["detail.native-magnets"]);
        expect(migrateDisabledPlugins(["detail.native", "detail.state-actions", "detail.gallery"])).toEqual([
            "detail.javdb-native", "detail.javbus-native", "detail.cover-state-actions", "detail.page-state-actions",
            "detail.javdb-preview", "detail.javbus-images", "detail.javbus-preview",
        ]);
        expect(migrateDisabledPlugins(["SubTitleCatPlugin", "detail.subtitle"])).toEqual(["external-bridge.subtitle"]);

        expect(() => runtime.register(defineFeature({
            id: "duplicate-owner", kind: "feature", disableable: true, sites: ["javdb"], routes: ["detail"],
            startup: "on-demand", requires: [], contributes: ["detail.related"], providesCommands: [], activate: () => ({}),
        }))).toThrow(/Duplicate contribution ownership/);
    });

    it("forwards arguments through a Feature command context", async () => {
        const commands = new CommandRegistry();
        const runtime = new FeatureRuntime({
            container: new DependencyContainer(), commands, diagnostics: new DiagnosticsService(), site: "javdb", route: "list",
        });
        runtime.register(defineFeature({
            id: "command-arguments", kind: "system", disableable: false, sites: [], routes: [], startup: "on-command",
            requires: [], contributes: [], providesCommands: ["command.forward", "command.receive"],
            activate: (_deps, api) => ({ commands: {
                "command.forward": () => api.executeCommand("command.receive", "task-panel"),
                "command.receive": (panel) => panel,
            } }),
        }));

        await expect(commands.execute("command.forward")).resolves.toBe("task-panel");
    });

    it("keeps diagnostics export available while deferring its command Feature until first use", async () => {
        const commands = new CommandRegistry(), diagnostics = new DiagnosticsService();
        const container = new DependencyContainer().register(SERVICE.diagnostics, diagnostics);
        const runtime = new FeatureRuntime({ container, commands, diagnostics, site: "javdb", route: "detail" });
        const manifest = featureManifests.find((item) => item.id === "diagnostics");
        runtime.register(manifest);

        await runtime.start();
        expect(diagnostics.exportSnapshot().activeFeatures).not.toContain("diagnostics");
        await expect(commands.execute("diagnostics.export")).resolves.toMatchObject({ errors: [] });
        expect(diagnostics.exportSnapshot().activeFeatures).toContain("diagnostics");
    });

    it("resolves compatibility beans directly through the injected lookup boundary", async () => {
        const runtime = new FeatureRuntime({ container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics: new DiagnosticsService(), site: "javdb", route: "list" });
        const adapter = {};
        let resolvedAdapter = null;
        runtime.setCompatibilityBeanResolver((name) => name === "LegacyAdapter" ? adapter : null);
        runtime.register(defineFeature({ id: "migration", kind: "feature", disableable: true, sites: ["javdb"], routes: [], startup: "eager", requires: [], contributes: ["migration.adapter"], providesCommands: [], activate: (_deps, api) => {
            resolvedAdapter = api.resolveCompatibilityBean("LegacyAdapter");
            return {};
        } }));
        expect((await runtime.activate("migration")).enabledContributions).toEqual(["migration.adapter"]);
        expect(resolvedAdapter).toBe(adapter);
    });

    it("registers a legacy-named compatibility bean for a native feature only within its lifetime", async () => {
        const beans = new Map();
        const runtime = new FeatureRuntime({ container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics: new DiagnosticsService(), site: "javdb", route: "detail" });
        runtime.setCompatibilityBeanRegistrar((name, bean) => {
            beans.set(name, bean);
            return () => { if (beans.get(name) === bean) beans.delete(name); };
        });
        const controller = { managedByFeature: true };
        runtime.register(defineFeature({
            id: "detail", kind: "feature", disableable: true, sites: ["javdb"], routes: ["detail"], startup: "eager", requires: [],
            contributes: ["detail.javdb-preview"], providesCommands: [],
            activate: (_deps, api) => {
                const release = api.registerCompatibilityBean("PreviewVideoPlugin", controller);
                if (typeof release === "function") api.scope.addCleanup(release);
                return {};
            },
        }));
        const activation = await runtime.activate("detail");
        expect(beans.get("PreviewVideoPlugin")).toBe(controller);
        activation.dispose();
        expect(beans.has("PreviewVideoPlugin")).toBe(false);
    });

    it("starts independent eager Features concurrently and isolates optional startup failures", async () => {
        const runtime = new FeatureRuntime({ container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics: new DiagnosticsService(), site: "javdb", route: "detail" });
        let releaseFirst, secondStarted = false, firstFinished = false;
        const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
        runtime.register(defineFeature({
            id: "first", kind: "feature", disableable: true, sites: ["javdb"], routes: [], startup: "eager", requires: [],
            contributes: [], providesCommands: [], activate: async () => { await firstGate; firstFinished = true; return {}; },
        }));
        runtime.register(defineFeature({
            id: "optional", kind: "feature", disableable: true, sites: ["javdb"], routes: [], startup: "eager", requires: [],
            contributes: [], providesCommands: [], activate: () => { secondStarted = true; releaseFirst(); throw new Error("optional startup failed"); },
        }));

        await runtime.start();
        expect(secondStarted).toBe(true);
        expect(firstFinished).toBe(true);
        expect(runtime.getActiveFeatureIds()).toContain("first");
        expect(runtime.getActiveFeatureIds()).not.toContain("optional");
    });

    it("schedules idle Features only after the caller marks first-ready", async () => {
        let idleCallback = null, idleStarted = false;
        const scheduleIdle = vi.fn((callback, options) => { idleCallback = callback; expect(options).toEqual({ timeout: 1500 }); return 1; });
        vi.stubGlobal("requestIdleCallback", scheduleIdle);
        const runtime = new FeatureRuntime({ container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics: new DiagnosticsService(), site: "javdb", route: "detail" });
        runtime.register(defineFeature({ id: "background", kind: "feature", disableable: true, sites: ["javdb"], routes: [], startup: "idle", requires: [], contributes: [], providesCommands: [], activate: () => { idleStarted = true; return {}; } }));

        await runtime.start();
        expect(idleStarted).toBe(false);
        expect(scheduleIdle).not.toHaveBeenCalled();
        runtime.scheduleIdle();
        expect(scheduleIdle).toHaveBeenCalledOnce();
        idleCallback();
        await vi.waitFor(() => expect(idleStarted).toBe(true));
        runtime.scheduleIdle();
        expect(scheduleIdle).toHaveBeenCalledOnce();
        vi.unstubAllGlobals();
    });

    it("disposes successful eager Features when a system Feature fails", async () => {
        const runtime = new FeatureRuntime({ container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics: new DiagnosticsService(), site: "javdb", route: "detail" });
        let releaseFirst;
        const cleanup = vi.fn();
        const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
        runtime.register(defineFeature({
            id: "first", kind: "feature", disableable: true, sites: ["javdb"], routes: [], startup: "eager", requires: [],
            contributes: [], providesCommands: [], activate: async (_deps, api) => { api.scope.addCleanup(cleanup); await firstGate; return {}; },
        }));
        runtime.register(defineFeature({
            id: "system", kind: "system", disableable: false, sites: [], routes: [], startup: "eager", requires: [],
            contributes: [], providesCommands: [], activate: () => { releaseFirst(); throw new Error("system startup failed"); },
        }));

        await expect(runtime.start()).rejects.toThrow("system startup failed");
        expect(cleanup).toHaveBeenCalledOnce();
        expect(runtime.getActiveFeatureIds()).toEqual([]);
    });

    it("gives a legacy contribution a route-independent scope without activating its owner feature", async () => {
        const diagnostics = new DiagnosticsService(), runtime = new FeatureRuntime({
            container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics,
            site: "javdb", route: "list",
        });
        runtime.register(defineFeature({
            id: "detail", kind: "feature", disableable: true, sites: ["javdb"], routes: ["detail"],
            startup: "on-demand", requires: [], contributes: ["detail.fc2"], providesCommands: [], activate: () => ({}),
        }));
        await expect(runtime.getScope("detail")).rejects.toThrow(/ineligible/);
        const scope = await runtime.getContributionScope("detail", "detail.fc2", "Fc2Plugin");
        expect(scope.id).toBe("contribution:detail.fc2");
        expect(runtime.getActiveFeatureIds()).not.toContain("detail");
    });

    it("disposes contribution scopes when the owning feature is disposed", async () => {
        const diagnostics = new DiagnosticsService(), runtime = new FeatureRuntime({
            container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics,
            site: "javdb", route: "detail",
        });
        runtime.register(defineFeature({
            id: "detail", kind: "feature", disableable: true, sites: ["javdb"], routes: ["detail"],
            startup: "eager", requires: [], contributes: ["detail.fc2", "detail.related"], providesCommands: [], activate: () => ({}),
        }));
        const scope = await runtime.getContributionScope("detail", "detail.fc2", "Fc2Plugin");
        const activation = await runtime.activate("detail");
        activation.dispose();
        expect(scope.disposed).toBe(true);
        // contribution scopes are recreated lazily after disposal (activate -> dispose -> activate cycle)
        const scope2 = await runtime.getContributionScope("detail", "detail.fc2", "Fc2Plugin");
        expect(scope2.disposed).toBe(false);
        expect(scope2).not.toBe(scope);
    });

    it("opens Settings through its registered owner without a DOM trigger", async () => {
        const owner = vi.fn(async () => "opened"), cleanup = registerSettingsUiOwner(owner);
        await expect(openSettingsUi("filter-panel")).resolves.toBe("opened");
        expect(owner).toHaveBeenCalledWith("filter-panel");
        cleanup();
        expect(() => openSettingsUi()).toThrow(/not ready/);
    });

    it("disposes all scope-owned resources and blocks stale generations", () => {
        const target = new EventTarget();
        const listener = vi.fn();
        const observer = { disconnect: vi.fn() };
        const consumer = { release: vi.fn() };
        const scope = new LifecycleScope("test");
        scope.listen(target, "change", listener);
        scope.ownObserver(observer);
        scope.ownRequestConsumer(consumer);
        const generation = scope.nextGeneration();
        expect(scope.canCommit(generation)).toBe(true);
        scope.dispose();
        target.dispatchEvent(new Event("change"));
        expect(listener).not.toHaveBeenCalled();
        expect(observer.disconnect).toHaveBeenCalledOnce();
        expect(consumer.release).toHaveBeenCalledOnce();
        expect(scope.snapshot()).toMatchObject({ listeners: 0, observers: 0, requestConsumers: 0, disposed: true });
        expect(scope.canCommit(generation)).toBe(false);
    });

    it("validates integration manifests and keeps ProviderRegistry focused", async () => {
        expect(() => defineIntegration({ id: "bad", trustClass: "builtin-public", hosts: [], capabilities: [], requires: [], cachePolicy: "none", quality: "bronze", createClient() {}, createAdapter() {} })).toThrow();
        expect(() => defineIntegration({ id: "bad-host", trustClass: "builtin-public", hosts: ["HTTPS://EXAMPLE.COM"], capabilities: ["movie.detail"], requires: [], cachePolicy: "none", quality: "bronze", createClient() {}, createAdapter() {} })).toThrow(/host is invalid/);
        expect(() => defineIntegration({ id: "bad-cache", trustClass: "builtin-public", hosts: ["example.com"], capabilities: ["movie.detail", "movie.images"], requires: [], cachePolicy: { "movie.detail": "none" }, quality: "bronze", createClient() {}, createAdapter() {} })).toThrow(/cachePolicy mismatch/);
        expect(() => defineIntegration({ id: "bad-deps", trustClass: "builtin-public", hosts: ["example.com"], capabilities: ["movie.detail"], requires: [SERVICE.http, SERVICE.http], cachePolicy: "none", quality: "bronze", createClient() {}, createAdapter() {} })).toThrow(/duplicate tokens/);
        expect(() => defineIntegration({ id: "bad-host-adapter", trustClass: "builtin-public", hosts: ["example.com"], capabilities: ["movie.detail"], requires: [], cachePolicy: "none", quality: "bronze", createClient() {}, createAdapter() {}, createHostAdapter: undefined })).toThrow(/createHostAdapter/);
        const registry = new ProviderRegistry();
        registry.register({ id: "slow", capabilities: ["magnet"], priority: 1 });
        registry.register({ id: "fast", capabilities: ["magnet"], priority: 2, isAvailable: async () => true });
        expect((await registry.getAvailable("magnet", {})).map((provider) => provider.id)).toEqual(["fast", "slow"]);
        registry.updateHealth("fast", { ok: true });
        expect(registry.getHealth("fast")).toMatchObject({ ok: true });
    });

    it("derives transport cache policy from the requested manifest capability", async () => {
        const request = vi.fn(async (options, scope) => ({ options, scope }));
        const facade = createIntegrationRequestFacade({ request }, {
            id: "fixture", capabilities: ["movie.detail", "movie.state"],
            cachePolicy: { "movie.detail": "external-detail-v1", "movie.state": "none" },
        });
        const detail = await facade.request({ capability: "movie.detail", providerId: "fixture", method: "GET", url: "https://example.test/detail", cacheScope: "session", ttlMs: 1 }, "scope");
        const state = await facade.request("movie.state", { providerId: "fixture", method: "GET", url: "https://example.test/state", cacheScope: "public", ttlMs: 1 }, "scope");
        expect(detail.options).toMatchObject({ cacheScope: "public", ttlMs: 604800000, cacheNamespace: "external-detail-v1" });
        expect(state.options).toMatchObject({ cacheScope: "none", ttlMs: 0 });
        expect(detail.options).not.toHaveProperty("capability");
        expect(request).toHaveBeenNthCalledWith(1, expect.any(Object), "scope");

        const sourceFacade = createIntegrationRequestFacade({ request }, {
            id: "sources", capabilities: ["magnet.search"], cachePolicy: { "magnet.search": "source-configured" },
        });
        const post = await sourceFacade.request("magnet.search", { method: "POST", providerId: "btsow", url: "https://example.test/search", body: "{}" }, "scope");
        expect(post.options).toMatchObject({ cacheScope: "none", ttlMs: 0 });
    });
});
