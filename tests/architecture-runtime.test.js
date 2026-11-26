// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime, migrateDisabledPlugins } from "../src/app/feature-runtime.js";
import { ProviderRegistry } from "../src/app/provider-registry.js";
import { defineFeature } from "../src/contracts/manifests.js";
import { PORT, REGISTRY, SERVICE } from "../src/contracts/tokens.js";
import { SettingsRegistry } from "../src/app/settings-registry.js";
import { featureManifests } from "../src/features/catalog.js";
import fc2Catalog from "../src/features/external-bridge/fc2-catalog-manifest.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { openSettingsUi, registerSettingsUiOwner } from "../src/core/settings-ui-owner.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";
import { createIntegrationRequestFacade } from "../src/app/integration-registry.js";

describe("v6.5 architecture runtime contracts", () => {
    it("activates sync through its public API and stops if initialization fails", async () => {
        const feature = featureManifests.find(item => item.id === "webdav-sync");
        const scope = new LifecycleScope("sync-contract"), service = { initialize: vi.fn(async () => {}), start: vi.fn() };
        const dependencies = { [SERVICE.webdavSync]: service, [PORT.host]: { document } };
        await feature.activate(dependencies, { scope });
        expect(service.start).toHaveBeenCalledWith(scope, document);
        service.initialize.mockRejectedValueOnce(new Error("unavailable storage"));
        await expect(feature.activate(dependencies, { scope })).rejects.toThrow("unavailable storage");
        expect(service.start).toHaveBeenCalledTimes(1);
        scope.dispose();
    });

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

    it("injects only declared tokens and rejects duplicate or missing dependencies", () => {
        const diagnostics = new DiagnosticsService();
        const container = new DependencyContainer(diagnostics);
        const movie = { id: "movie" };
        container.register(SERVICE.movie, movie);
        expect(container.resolveDeclared([SERVICE.movie])[SERVICE.movie]).toBe(movie);
        container.register(SERVICE.review, {});
        expect(container.resolveDeclared([SERVICE.movie])[SERVICE.review]).toBeUndefined();
        expect(() => container.register(SERVICE.movie, {})).toThrow(/Duplicate/);
        expect(() => container.resolveDeclared([SERVICE.state])).toThrow(/Missing/);
        expect(() => container.resolveDeclared([SERVICE.movie, SERVICE.movie])).toThrow(/Duplicate declared dependency/);
    });

    it("permits declared optional tokens to be absent without exposing undeclared services", () => {
        const container = new DependencyContainer(new DiagnosticsService()), dialog = { open() {} };
        container.register(SERVICE.dialog, dialog);
        const dependencies = container.resolveDeclared([SERVICE.dialog], [PORT.host]);
        expect(dependencies[SERVICE.dialog]).toBe(dialog);
        expect(dependencies[PORT.host]).toBeUndefined();
        expect(dependencies[SERVICE.state]).toBeUndefined();
    });

    it("declares command owners and platform dependencies in Feature manifests", () => {
        expect(featureManifests.find(item => item.id === "personal-ratings").providesCommands).toContain("library.rating.open");
        expect(featureManifests.find(item => item.id === "movie-lists").providesCommands).toContain("library.lists.open");
        expect(featureManifests.find(item => item.id === "movie-selection")).toMatchObject({ routes: ["list"] });
        expect(featureManifests.find(item => item.id === "privacy").providesCommands).toContain("privacy.toggle");
        expect(featureManifests.find(item => item.id === "enhancement-settings").providesCommands).toContain("media.configure");
        expect(featureManifests.find(item => item.id === "subtitle-workspace")).toMatchObject({ startup: "on-command", providesCommands: ["subtitle.open"], contributes: [] });
        expect(featureManifests.find(item => item.id === "webdav-sync")).toMatchObject({ kind: "system", startup: "eager", disableable: false, requires: [SERVICE.webdavSync, PORT.host] });
        expect(featureManifests.find((item) => item.id === "fc2-workspace")).toMatchObject({ startup: "eager", providesCommands: ["detail.fc2.workspace"], contributes: ["detail.fc2-owned"] });
        expect(featureManifests.find((item) => item.id === "settings-effects")).toMatchObject({ kind: "system", startup: "eager", contributes: [], requires: expect.arrayContaining([SERVICE.clog, SERVICE.settings, SERVICE.busImageLayout]) });
        expect(featureManifests.find((item) => item.id === "settings-entry")).toMatchObject({ kind: "system", startup: "eager", contributes: ["settings.core"], requires: expect.arrayContaining([PORT.style]) });
        expect(featureManifests.find((item) => item.id === "settings")).toMatchObject({ kind: "system", startup: "on-command", providesCommands: ["settings.open"] });
        expect(featureManifests.find((item) => item.id === "discovery")).toMatchObject({ requires: [PORT.host], contributes: ["discovery.hit-show"] });
        expect(featureManifests.find((item) => item.id === "discovery")).toMatchObject({ routes: ["list"] });
        expect(featureManifests.find((item) => item.id === "ranking")).toMatchObject({ routes: ["list"] });
        expect(featureManifests.find((item) => item.id === "list").contributes).toContain("list.actions");
        expect(featureManifests.find((item) => item.id === "list").contributes).toContain("detail.cover-state-actions");
        expect(featureManifests.find((item) => item.id === "compatibility")).toMatchObject({ startup: "eager", requires: expect.arrayContaining([PORT.host, PORT.style, SERVICE.state, SERVICE.domUi]) });
        expect(featureManifests.find((item) => item.id === "external-sites")).toMatchObject({ routes: ["detail", "owned-detail"] });
        expect(featureManifests.find((item) => item.id === "list").contributes).toContain("detail.javbus-images");
        expect(featureManifests.find((item) => item.id === "detail").contributes).not.toContain("detail.javbus-images");
        expect(featureManifests.find((item) => item.id === "external-bridge").contributes).toContain("detail.external-magnets");
        expect(featureManifests.find((item) => item.id === "external-bridge").contributes).toContain("external-bridge.javtrailers");
        expect(featureManifests.find((item) => item.id === "external-bridge")).toMatchObject({ requires: expect.arrayContaining([SERVICE.notifications]), optionalRequires: [PORT.host] });
        expect(featureManifests.find((item) => item.id === "fc2-catalog")).toMatchObject({ sites: ["javdb"], startup: "idle", requires: expect.arrayContaining([PORT.host, SERVICE.movie]), contributes: ["detail.fc2-lookup"], providesCommands: ["fc2-catalog.ensure"] });
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
        expect(featureManifests.find((item) => item.id === "translation")).toMatchObject({ sites: ["javdb", "javbus"], routes: [], providesCommands: [], requires: expect.arrayContaining([PORT.host, SERVICE.translation, SERVICE.privacy]), contributes: ["external-bridge.translation"] });
        expect(featureManifests.find((item) => item.id === "translation").requiresFeaturesByRoute).toEqual({ list: ["list"] });
        expect(featureManifests.find((item) => item.id === "detail").contributes).toContain("detail.screenshot");
        expect(featureManifests.find((item) => item.id === "detail").contributes).not.toContain("detail.external-magnets");
        expect(featureManifests.find((item) => item.id === "list").contributes).toContain("detail.fc2-navigation");
        expect(featureManifests.find((item) => item.id === "detail").contributes).not.toContain("detail.fc2-navigation");
        expect(featureManifests.find((item) => item.id === "identity").requires).toEqual(expect.arrayContaining([PORT.host, PORT.style, SERVICE.movie, SERVICE.navigation, SERVICE.clipboard, SERVICE.dialog, SERVICE.storage, REGISTRY.integration, SERVICE.settings]));
        expect(featureManifests.find((item) => item.id === "detail").requires).toContain(SERVICE.domUi);
        expect(featureManifests.find((item) => item.id === "library").requires).toEqual(expect.arrayContaining([SERVICE.legacyStorage, SERVICE.domUi, SERVICE.events, SERVICE.profile]));
        expect(featureManifests.find((item) => item.id === "identity").contributes).toContain("identity.javdb-navigation");
        expect(featureManifests.find((item) => item.id === "identity").contributes).toContain("identity.javbus-navigation");
        expect(featureManifests.find((item) => item.id === "identity").contributes).toContain("detail.javbus-native");
        expect(featureManifests.find((item) => item.id === "detail").contributes).not.toContain("detail.javbus-native");
    });

    it("gates contributions by site and route while preserving independent disable preferences", () => {
        const createRuntime = (site, route, disabled = []) => {
            const runtime = new FeatureRuntime({ container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics: new DiagnosticsService(), site, route, disabled });
            featureManifests.forEach(manifest => runtime.register(manifest));
            return runtime;
        };
        const list = createRuntime("javdb", "list", ["Fc2Plugin", "CoverButtonPlugin"]);
        expect(list.isContributionEnabled("list", "list.core")).toBe(true);
        expect(list.isContributionEnabled("list", "detail.cover-state-actions")).toBe(false);
        expect(list.isContributionEnabled("list", "detail.fc2-navigation")).toBe(true);
        expect(list.isContributionEnabled("detail", "detail.reviews")).toBe(false);
        const detail = createRuntime("javbus", "detail", ["StatsPlugin"]);
        expect(detail.isContributionEnabled("detail", "detail.javbus-preview")).toBe(true);
        expect(detail.isContributionEnabled("detail", "detail.related")).toBe(false);
        expect(detail.isContributionEnabled("stats", "stats.dashboard")).toBe(true);
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
        runtime.runtimeLookup.register("LegacyAdapter", adapter);
        runtime.register(defineFeature({ id: "migration", kind: "feature", disableable: true, sites: ["javdb"], routes: [], startup: "eager", requires: [], contributes: ["migration.adapter"], providesCommands: [], activate: (_deps, api) => {
            resolvedAdapter = api.resolveCompatibilityBean("LegacyAdapter");
            return {};
        } }));
        expect((await runtime.activate("migration")).enabledContributions).toEqual(["migration.adapter"]);
        expect(resolvedAdapter).toBe(adapter);
    });

    it("registers a legacy-named compatibility bean for a native feature only within its lifetime", async () => {
        const runtime = new FeatureRuntime({ container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics: new DiagnosticsService(), site: "javdb", route: "detail" });
        const controller = { managedByFeature: true };
        runtime.register(defineFeature({
            id: "detail", kind: "feature", disableable: true, sites: ["javdb"], routes: ["detail"], startup: "eager", requires: [],
            contributes: ["detail.javdb-preview"], providesCommands: [],
            activate: (_deps, api) => {
                api.registerCompatibilityBean("PreviewVideoPlugin", controller);
                return {};
            },
        }));
        const activation = await runtime.activate("detail");
        expect(runtime.runtimeLookup.getBean("PreviewVideoPlugin")).toBe(controller);
        activation.dispose();
        expect(runtime.runtimeLookup.getBean("PreviewVideoPlugin")).toBeUndefined();
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

    it("keeps system UI mounting available while automatic library work awaits quiet", async () => {
        const callbacks = [], started = [];
        vi.stubGlobal("requestIdleCallback", callback => { callbacks.push(callback); return callbacks.length; });
        let release;
        const backgroundWork = { waitForTurn: vi.fn(() => new Promise(resolve => { release = resolve; })) };
        const runtime = new FeatureRuntime({ backgroundWork, container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics: new DiagnosticsService(), site: "javdb", route: "list" });
        for (const [id, kind] of [["responsive-shell", "system"], ["library-work", "feature"]]) runtime.register(defineFeature({ id, kind, disableable: kind !== "system", sites: ["javdb"], routes: [], startup: "idle", requires: [], contributes: [], providesCommands: [], activate: () => { started.push(id); return {}; } }));
        try {
            await runtime.start(); runtime.scheduleIdle(); callbacks.forEach(callback => callback());
            await Promise.resolve(); await Promise.resolve();
            expect(started).toEqual(["responsive-shell"]);
            expect(backgroundWork.waitForTurn).toHaveBeenCalledOnce();
        } finally { release?.(); vi.unstubAllGlobals(); }
        await vi.waitFor(() => expect(started).toEqual(["responsive-shell", "library-work"]));
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

    it("keeps ProviderRegistry focused", async () => {
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
