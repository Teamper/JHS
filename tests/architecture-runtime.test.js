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

    it("notifies current consumers when a scoped capability appears and is released", async () => {
        const runtime = new FeatureRuntime({ container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics: new DiagnosticsService() });
        const observations = [];
        const controller = {};
        runtime.register({ id: "capability-consumer", kind: "feature", disableable: true, sites: [], routes: [], startup: "on-command", requires: [], contributes: [], providesCommands: [], activate: (_deps, api) => {
            api.onCapabilityChanged("surface", () => observations.push(api.getCapability("surface")));
        } });
        runtime.register({ id: "capability-provider", kind: "feature", disableable: true, sites: [], routes: [], startup: "on-command", requires: [], contributes: [], providesCommands: [], activate: (_deps, api) => {
            api.provideCapability("surface", controller);
        } });
        const consumer = await runtime.activate("capability-consumer");
        const provider = await runtime.activate("capability-provider");
        provider.dispose();
        expect(observations).toEqual([controller, undefined]);
        consumer.dispose();
        const replacement = await runtime.activate("capability-provider");
        expect(observations).toHaveLength(2);
        replacement.dispose();
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
