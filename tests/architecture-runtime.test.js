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
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { openSettingsUi, registerSettingsUiOwner } from "../src/core/settings-ui-owner.js";
import { BasePlugin, PluginManager } from "../src/core/plugin-manager.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";

describe("v6.5 architecture runtime contracts", () => {
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

    it("limits transitional legacy plugins to explicitly declared dependencies", () => {
        class DependencyPlugin extends BasePlugin { getName() { return "DependencyPlugin"; } }
        class ConsumerPlugin extends BasePlugin {
            getName() { return "ConsumerPlugin"; }
            dependency(name) { return this.getDependency(name); }
            optionalDependency(name) { return this.getOptionalDependency(name); }
        }
        const diagnostics = new DiagnosticsService();
        const manager = new PluginManager({ diagnostics });
        manager.setDependencyDeclarations({ ConsumerPlugin: ["DependencyPlugin", "MissingPlugin"] });
        manager.register(DependencyPlugin);
        manager.register(ConsumerPlugin);
        const consumer = manager.getBean("ConsumerPlugin");
        expect(consumer.dependency("DependencyPlugin")).toBe(manager.getBean("DependencyPlugin"));
        expect(consumer.optionalDependency("MissingPlugin")).toBeUndefined();
        expect(() => consumer.dependency("MissingPlugin")).toThrow("Missing dependency: ConsumerPlugin -> MissingPlugin");
        expect(diagnostics.exportSnapshot().errors.at(-1)).toMatchObject({ plugin: "ConsumerPlugin", phase: "dependency" });
        expect(() => consumer.dependency("UndeclaredPlugin")).toThrow(/未声明依赖/);
    });

    it("registers legacy contributions from manifests without changing site order", async () => {
        expect(featureManifests).toHaveLength(11);
        expect(featureManifests.find((manifest) => manifest.id === "list")?.contributes).toContain("list.core");
        expect(featureManifests.find((manifest) => manifest.id === "library")?.contributes).toContain("library.history");
        expect(featureManifests.find((manifest) => manifest.id === "identity")?.contributes).toContain("identity.image-search");
        expect(featureManifests.find((manifest) => manifest.id === "external-bridge")?.contributes).toContain("external-bridge.offline");
        expect(featureManifests.find((manifest) => manifest.id === "discovery")?.contributes).toContain("discovery.scheduler");
        expect(featureManifests.find((manifest) => manifest.id === "compatibility")?.contributes).toContain("compatibility.enhancements");
        expect(featureManifests.find((manifest) => manifest.id === "stats")?.contributes).toContain("stats.dashboard");
        window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
        const $ = jquery;
        vi.stubGlobal("$", $);
        vi.stubGlobal("jQuery", $);
        vi.stubGlobal("localforage", { INDEXEDDB: "indexeddb", createInstance: () => ({}) });
        Object.assign(globalThis, { utils: {}, storageManager: {} });
        const { legacyContributionManifests, registerSitePlugins } = await import("../src/plugins/registry.js");
        expect(new Set(legacyContributionManifests.map((item) => item.id)).size).toBe(legacyContributionManifests.length);
        expect(new Set(legacyContributionManifests.map((item) => item.legacyPluginId)).size).toBe(legacyContributionManifests.length);
        expect(legacyContributionManifests.find((item) => item.id === "discovery.top250")?.legacyPluginId).toBe("TOP250Plugin");
        expect(legacyContributionManifests.find((item) => item.id === "library.history")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "library.state-actions")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "library.keyword-filter")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "library.blacklist")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "library.favorite-actresses")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "list.auto-page")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "list.fold-category")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "list.actions")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "list.fc2-navigation")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "list.fc2-navigation")?.featureId).toBe("list");
        expect(legacyContributionManifests.find((item) => item.id === "list.cover-state-actions")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "list.javbus-images")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "list.fc2-lookup")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.workspace")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.javdb-native")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.javbus-native")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.reviews")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.related")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.screenshot")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.native-magnets")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.external-magnets")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.page-state-actions")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.javdb-preview")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.javbus-preview")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.external-sites")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.fc2-owned")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.find((item) => item.id === "detail.fc2-owned")?.managedRoutes).toEqual(["detail", "owned-detail"]);
        expect(legacyContributionManifests.filter((item) => !item.managedByFeature).map((item) => item.id)).toEqual(["settings.core"]);
        expect(legacyContributionManifests.find((item) => item.id === "responsive-shell.bottom-bar")?.managedByFeature).toBe(true);
        expect(legacyContributionManifests.filter((item) => item.featureId === "identity").every((item) => item.managedByFeature)).toBe(true);
        expect(legacyContributionManifests.filter((item) => item.featureId === "external-bridge").every((item) => item.managedByFeature)).toBe(true);
        expect(legacyContributionManifests.filter((item) => item.featureId === "discovery").every((item) => item.managedByFeature)).toBe(true);
        expect(legacyContributionManifests.filter((item) => item.featureId === "compatibility").every((item) => item.managedByFeature)).toBe(true);
        expect(legacyContributionManifests.filter((item) => item.featureId === "stats").every((item) => item.managedByFeature)).toBe(true);
        const createRuntime = (site, disabled = [], route = "list") => {
            const diagnostics = new DiagnosticsService();
            const container = new DependencyContainer().register(PORT.host, { locateDetailSlots: () => ({}) }).register(SERVICE.diagnostics, diagnostics).register(SERVICE.dialog, {}).register(SERVICE.webdav, {}).register(SERVICE.review, {}).register(SERVICE.related, {}).register(SERVICE.movie, {}).register(SERVICE.actressInfo, {}).register(SERVICE.imageSearch, {}).register(SERVICE.magnet, {}).register(SERVICE.screenshot, {}).register(SERVICE.translation, {}).register(SERVICE.subtitle, {}).register(SERVICE.account, {}).register(SERVICE.settings, {}).register(SERVICE.profile, { current: () => "regular" }).register(SERVICE.storage, {}).register(SERVICE.cache, {}).register(SERVICE.http, {}).register(SERVICE.offline, {}).register(SERVICE.state, {}).register(REGISTRY.settings, new SettingsRegistry());
            const runtime = new FeatureRuntime({ container, commands: new CommandRegistry(), diagnostics, disabled, site, route });
            container.register(REGISTRY.feature, runtime);
            featureManifests.forEach((manifest) => runtime.register(manifest));
            return runtime;
        };
        const javdb = new PluginManager();
        registerSitePlugins(javdb, createRuntime("javdb"), "javdb");
        expect(javdb.getBean("Fc2Plugin").managedByFeature).toBe(false);
        const javdbDetail = new PluginManager();
        registerSitePlugins(javdbDetail, createRuntime("javdb", [], "detail"), "javdb");
        expect(javdbDetail.getBean("Fc2Plugin").managedByFeature).toBe(true);
        expect(javdb.getPluginNames()).toEqual([
            "OneTwoThreeOfflinePlugin", "ListPagePlugin", "AutoPagePlugin", "Fc2Plugin", "Fc2NavigationPlugin", "FoldCategoryPlugin", "ListPageButtonPlugin",
            "HistoryPlugin", "SettingPlugin", "NavBarPlugin", "HitShowPlugin", "TOP250Plugin", "SearchByImagePlugin", "CoverButtonPlugin",
            "Fc2By123AvPlugin", "DetailPagePlugin", "DetailWorkspacePlugin", "ReviewPlugin", "RelatedPlugin", "DetailPageButtonPlugin",
            "HighlightMagnetPlugin", "PreviewVideoPlugin", "FilterTitleKeywordPlugin", "ActressInfoPlugin", "OtherSitePlugin", "TranslatePlugin",
            "WantAndWatchedVideosPlugin", "MagnetHubPlugin", "ScreenShotPlugin", "BlacklistPlugin", "FavoriteActressesPlugin", "NewVideoPlugin",
            "TaskPlugin", "MobileBottomBarPlugin", "OneOneFiveMatchPlugin", "UnifiedOfflinePlugin",
        ]);
        const javbus = new PluginManager();
        registerSitePlugins(javbus, createRuntime("javbus", ["ReviewPlugin"]), "javbus");
        expect(javbus.getPluginNames()).not.toContain("ReviewPlugin");
        expect(javbus.getPluginNames()).toContain("DetailWorkspacePlugin");

        const javdbWithCoverDisabled = new PluginManager();
        registerSitePlugins(javdbWithCoverDisabled, createRuntime("javdb", ["CoverButtonPlugin"]), "javdb");
        expect(javdbWithCoverDisabled.getPluginNames()).not.toContain("CoverButtonPlugin");
        expect(javdbWithCoverDisabled.getPluginNames()).toContain("DetailPageButtonPlugin");
        expect(javdbWithCoverDisabled.getPluginDescriptors()).toContainEqual({ name: "CoverButtonPlugin", disableable: true });

        const javdbWithExternalSitesDisabled = new PluginManager();
        registerSitePlugins(javdbWithExternalSitesDisabled, createRuntime("javdb", ["OtherSitePlugin"]), "javdb");
        expect(javdbWithExternalSitesDisabled.getPluginNames()).not.toContain("OtherSitePlugin");
        expect(javdbWithExternalSitesDisabled.getPluginDescriptors()).toContainEqual({ name: "OtherSitePlugin", disableable: true });

        const javbusWithImagesDisabled = new PluginManager();
        registerSitePlugins(javbusWithImagesDisabled, createRuntime("javbus", ["BusImgPlugin"]), "javbus");
        expect(javbusWithImagesDisabled.getPluginNames()).not.toContain("BusImgPlugin");
        expect(javbusWithImagesDisabled.getPluginNames()).toContain("BusPreviewVideoPlugin");

        for (const [site, disabledPlugin, survivingPlugin] of [
            ["javdb", "Fc2Plugin", "ListPagePlugin"],
            ["javdb", "AutoPagePlugin", "ListPagePlugin"],
            ["javdb", "CoverButtonPlugin", "ListPagePlugin"],
            ["javdb", "ListPageButtonPlugin", "ListPagePlugin"],
            ["javdb", "HighlightMagnetPlugin", "DetailPageButtonPlugin"],
            ["javdb", "MagnetHubPlugin", "DetailPageButtonPlugin"],
        ]) {
            const manager = new PluginManager();
            registerSitePlugins(manager, createRuntime(site, [disabledPlugin]), site);
            expect(manager.getPluginNames(), `${survivingPlugin} must survive disabled ${disabledPlugin}`).not.toContain(disabledPlugin);
            expect(manager.getPluginNames(), `${survivingPlugin} must survive disabled ${disabledPlugin}`).toContain(survivingPlugin);
        }

        const legacyDiagnostics = new DiagnosticsService();
        const javdbWithStaleSystemDisables = new PluginManager({ diagnostics: legacyDiagnostics });
        registerSitePlugins(javdbWithStaleSystemDisables, createRuntime("javdb", ["settings.core", "stats.dashboard", "responsive-shell.bottom-bar"]), "javdb");
        expect(javdbWithStaleSystemDisables.getPluginNames()).toEqual(expect.arrayContaining(["SettingPlugin", "MobileBottomBarPlugin"]));
        expect(javdbWithStaleSystemDisables.getPluginDescriptors().filter((plugin) => plugin.disableable === false).map((plugin) => plugin.name)).toEqual([
            "SettingPlugin", "MobileBottomBarPlugin",
        ]);
        expect(legacyDiagnostics.exportSnapshot().legacyPluginDescriptors.filter((plugin) => plugin.disableable === false).map((plugin) => plugin.name)).toEqual([
            "SettingPlugin", "MobileBottomBarPlugin",
        ]);
    }, 15_000);

    it("declares every literal runtime service used by a legacy contribution", async () => {
        const { legacyContributionManifests } = await import("../src/plugins/registry.js");
        const runtimeTokens = new Map([
            ["host", PORT.host], ["diagnostics", SERVICE.diagnostics], ["review", SERVICE.review],
            ["related", SERVICE.related], ["movie", SERVICE.movie], ["magnet", SERVICE.magnet],
            ["settings", SERVICE.settings], ["cache", SERVICE.cache], ["http", SERVICE.http],
            ["profile", SERVICE.profile], ["actressInfo", SERVICE.actressInfo], ["imageSearch", SERVICE.imageSearch],
            ["screenshot", SERVICE.screenshot], ["translation", SERVICE.translation], ["subtitle", SERVICE.subtitle],
            ["account", SERVICE.account], ["webdav", SERVICE.webdav], ["storage", SERVICE.storage], ["features", REGISTRY.feature],
            ["state", SERVICE.state], ["offline", SERVICE.offline], ["dialog", SERVICE.dialog],
            ["settingsRegistry", REGISTRY.settings],
        ]);
        for (const contribution of legacyContributionManifests) {
            const source = contribution.plugin.toString();
            const usedNames = [...source.matchAll(/getRuntimeService\(["']([^"']+)["']\)/g)].map((match) => match[1]).filter((name) => name !== "scope");
            for (const name of new Set(usedNames)) {
                expect(runtimeTokens.has(name), `${contribution.id} uses unknown runtime service ${name}`).toBe(true);
                expect(contribution.requires, `${contribution.id} must declare runtime service ${name}`).toContain(runtimeTokens.get(name));
            }
        }
    });

    it("keeps independently disableable legacy contributions out of the hard dependency graph", async () => {
        const { legacyContributionManifests } = await import("../src/plugins/registry.js");
        for (const contribution of legacyContributionManifests) {
            expect(contribution.plugin.toString(), `${contribution.id} must use optional plugin dependencies`).not.toContain("this.getDependency(");
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
        expect(migrateDisabledPlugins(["CoverButtonPlugin", "DetailPageButtonPlugin", "BusImgPlugin", "BusPreviewVideoPlugin", "Fc2NavigationPlugin", "detail.fc2-navigation", "detail.fc2-lookup"])).toEqual([
            "list.cover-state-actions", "detail.page-state-actions", "list.javbus-images", "detail.javbus-preview", "list.fc2-navigation", "list.fc2-lookup",
        ]);
        expect(migrateDisabledPlugins(["detail.native", "detail.state-actions", "detail.gallery"])).toEqual([
            "detail.javdb-native", "detail.javbus-native", "list.cover-state-actions", "detail.page-state-actions",
            "detail.javdb-preview", "list.javbus-images", "detail.javbus-preview",
        ]);
        expect(migrateDisabledPlugins(["SubTitleCatPlugin", "detail.subtitle"])).toEqual(["external-bridge.subtitle"]);

        expect(() => runtime.register(defineFeature({
            id: "duplicate-owner", kind: "feature", disableable: true, sites: ["javdb"], routes: ["detail"],
            startup: "on-demand", requires: [], contributes: ["detail.related"], providesCommands: [], activate: () => ({}),
        }))).toThrow(/Duplicate contribution ownership/);
    });

    it("exposes optional feature APIs only after an eligible activation", async () => {
        const runtime = new FeatureRuntime({
            container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics: new DiagnosticsService(),
            disabled: [], site: "javdb", route: "list",
        });
        runtime.register(defineFeature({
            id: "list-api", kind: "feature", disableable: true, sites: ["javdb"], routes: ["list"], startup: "on-demand",
            requires: [], contributes: [], providesCommands: [], activate: () => ({ api: { ready: true } }),
        }));

        await expect(runtime.getFeatureApi("list-api")).resolves.toEqual({ ready: true });
        await expect(runtime.getFeatureApi("missing-api")).resolves.toBeNull();
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
});
