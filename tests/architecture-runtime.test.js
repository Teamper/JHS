// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime, migrateDisabledPlugins } from "../src/app/feature-runtime.js";
import { ProviderRegistry } from "../src/app/provider-registry.js";
import { defineFeature, defineIntegration } from "../src/contracts/manifests.js";
import { SERVICE } from "../src/contracts/tokens.js";
import { featureManifests } from "../src/features/catalog.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { openSettingsUi, registerSettingsUiOwner } from "../src/core/settings-ui-owner.js";
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

    it("owns all migrated contributions in Feature manifests", () => {
        expect(featureManifests).toHaveLength(11);
        expect(featureManifests.find((manifest) => manifest.id === "list")?.contributes).toContain("list.core");
        expect(featureManifests.find((manifest) => manifest.id === "library")?.contributes).toContain("library.history");
        expect(featureManifests.find((manifest) => manifest.id === "identity")?.contributes).toContain("identity.image-search");
        expect(featureManifests.find((manifest) => manifest.id === "external-bridge")?.contributes).toContain("external-bridge.offline");
        expect(featureManifests.find((manifest) => manifest.id === "discovery")?.contributes).toContain("discovery.scheduler");
        expect(featureManifests.find((manifest) => manifest.id === "compatibility")?.contributes).toContain("compatibility.enhancements");
        expect(featureManifests.find((manifest) => manifest.id === "stats")?.contributes).toContain("stats.dashboard");
        const contributions = featureManifests.flatMap((manifest) => manifest.contributes);
        expect(new Set(contributions).size).toBe(contributions.length);
        expect(contributions).toEqual(expect.arrayContaining([
            "list.core", "list.auto-page", "list.fold-category", "list.actions", "list.fc2-navigation", "list.cover-state-actions", "list.javbus-images", "list.fc2-lookup",
            "detail.fc2-owned", "detail.page-state-actions", "detail.javdb-preview", "detail.javdb-native", "detail.javbus-native", "detail.workspace", "detail.reviews", "detail.related", "detail.screenshot", "detail.native-magnets", "detail.external-magnets", "detail.external-sites", "detail.javbus-preview",
            "settings.core", "responsive-shell.bottom-bar",
        ]));
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
        expect(migrateDisabledPlugins(["FilterTitleKeywordPlugin", "CompatibilityEnhancementsPlugin"])).toEqual(["library.keyword-filter", "compatibility.enhancements"]);

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

    it("opens Settings through its registered owner without a DOM trigger", async () => {
        const owner = vi.fn(async () => "opened"), cleanup = registerSettingsUiOwner(owner), onReady = vi.fn();
        await expect(openSettingsUi("filter-panel", onReady)).resolves.toBe("opened");
        expect(owner).toHaveBeenCalledWith("filter-panel", onReady);
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
