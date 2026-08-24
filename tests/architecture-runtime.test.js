// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime, migrateDisabledPlugins } from "../src/app/feature-runtime.js";
import { ProviderRegistry } from "../src/app/provider-registry.js";
import { defineFeature, defineIntegration } from "../src/contracts/manifests.js";
import { PORT, SERVICE } from "../src/contracts/tokens.js";
import { featureManifests } from "../src/features/catalog.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { BasePlugin, PluginManager } from "../src/core/plugin-manager.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";

describe("v6.5 architecture runtime contracts", () => {
    it("injects only declared tokens and rejects duplicate or missing dependencies", () => {
        const container = new DependencyContainer();
        const movie = { id: "movie" };
        container.register(SERVICE.movie, movie);
        expect(container.resolveDeclared([SERVICE.movie])[SERVICE.movie]).toBe(movie);
        expect(container.resolveDeclared([SERVICE.movie])[SERVICE.review]).toBeUndefined();
        expect(() => container.register(SERVICE.movie, {})).toThrow(/Duplicate/);
        expect(() => container.resolveDeclared([SERVICE.review])).toThrow(/Missing/);
    });

    it("limits transitional legacy plugins to explicitly declared dependencies", () => {
        class DependencyPlugin extends BasePlugin { getName() { return "DependencyPlugin"; } }
        class ConsumerPlugin extends BasePlugin {
            getName() { return "ConsumerPlugin"; }
            dependency(name) { return this.getDependency(name); }
        }
        const manager = new PluginManager();
        manager.setDependencyDeclarations({ ConsumerPlugin: ["DependencyPlugin"] });
        manager.register(DependencyPlugin);
        manager.register(ConsumerPlugin);
        const consumer = manager.getBean("ConsumerPlugin");
        expect(consumer.dependency("DependencyPlugin")).toBe(manager.getBean("DependencyPlugin"));
        expect(() => consumer.dependency("UndeclaredPlugin")).toThrow(/未声明依赖/);
    });

    it("registers legacy contributions from manifests without changing site order", async () => {
        expect(featureManifests).toHaveLength(11);
        window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
        const $ = jquery;
        vi.stubGlobal("$", $);
        vi.stubGlobal("jQuery", $);
        vi.stubGlobal("localforage", { INDEXEDDB: "indexeddb", createInstance: () => ({}) });
        Object.assign(globalThis, { utils: {}, storageManager: {} });
        const { registerSitePlugins } = await import("../src/plugins/registry.js");
        const createRuntime = (site, disabled = []) => {
            const diagnostics = new DiagnosticsService();
            const container = new DependencyContainer().register(PORT.host, { locateDetailSlots: () => ({}) }).register(SERVICE.diagnostics, diagnostics).register(SERVICE.dialog, {}).register(SERVICE.webdav, {}).register(SERVICE.review, {}).register(SERVICE.related, {}).register(SERVICE.movie, {}).register(SERVICE.actressInfo, {}).register(SERVICE.imageSearch, {}).register(SERVICE.magnet, {}).register(SERVICE.screenshot, {}).register(SERVICE.translation, {}).register(SERVICE.subtitle, {}).register(SERVICE.account, {}).register(SERVICE.settings, {}).register(SERVICE.storage, {}).register(SERVICE.cache, {}).register(SERVICE.http, {}).register(SERVICE.offline, {}).register(SERVICE.state, {});
            const runtime = new FeatureRuntime({ container, commands: new CommandRegistry(), diagnostics, disabled, site, route: "list" });
            featureManifests.forEach((manifest) => runtime.register(manifest));
            return runtime;
        };
        const javdb = new PluginManager();
        registerSitePlugins(javdb, createRuntime("javdb"), "javdb");
        expect(javdb.getPluginNames()).toEqual([
            "OneTwoThreeOfflinePlugin", "ListPagePlugin", "AutoPagePlugin", "Fc2Plugin", "FoldCategoryPlugin", "ListPageButtonPlugin",
            "HistoryPlugin", "SettingPlugin", "NavBarPlugin", "HitShowPlugin", "TOP250Plugin", "SearchByImagePlugin", "CoverButtonPlugin",
            "Fc2By123AvPlugin", "DetailPagePlugin", "DetailWorkspacePlugin", "ReviewPlugin", "RelatedPlugin", "DetailPageButtonPlugin",
            "HighlightMagnetPlugin", "PreviewVideoPlugin", "FilterTitleKeywordPlugin", "ActressInfoPlugin", "OtherSitePlugin", "TranslatePlugin",
            "WantAndWatchedVideosPlugin", "MagnetHubPlugin", "ScreenShotPlugin", "BlacklistPlugin", "FavoriteActressesPlugin", "NewVideoPlugin",
            "TaskPlugin", "StatsPlugin", "MobileBottomBarPlugin", "OneOneFiveMatchPlugin", "UnifiedOfflinePlugin", "CompatibilityEnhancementsPlugin",
        ]);
        const javbus = new PluginManager();
        registerSitePlugins(javbus, createRuntime("javbus", ["ReviewPlugin"]), "javbus");
        expect(javbus.getPluginNames()).not.toContain("ReviewPlugin");
        expect(javbus.getPluginNames()).toContain("DetailWorkspacePlugin");
    }, 15_000);

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
        const registry = new ProviderRegistry();
        registry.register({ id: "slow", capabilities: ["magnet"], priority: 1 });
        registry.register({ id: "fast", capabilities: ["magnet"], priority: 2, isAvailable: async () => true });
        expect((await registry.getAvailable("magnet", {})).map((provider) => provider.id)).toEqual(["fast", "slow"]);
        registry.updateHealth("fast", { ok: true });
        expect(registry.getHealth("fast")).toMatchObject({ ok: true });
    });
});
