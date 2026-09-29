import { describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime } from "../src/app/feature-runtime.js";
import { defineFeature } from "../src/contracts/manifests.js";
import { PORT, SERVICE } from "../src/contracts/tokens.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";
import fc2Workspace from "../src/features/detail/fc2-workspace-manifest.js";

describe("FC2 workspace Feature ownership", () => {
    it("resolves the FC2 service through its owner command during concurrent eager startup", async () => {
        const diagnostics = new DiagnosticsService();
        const styleRelease = vi.fn(), style = { register: vi.fn(() => styleRelease) };
        const movie = { id: "injected-movie-service" };
        const logger = { warn: vi.fn(), error: vi.fn() };
        const container = new DependencyContainer()
            .register(PORT.style, style)
            .register(SERVICE.movie, movie)
            .register(SERVICE.magnet, {})
            .register(SERVICE.dialog, {})
            .register(SERVICE.account, {})
            .register(SERVICE.credential, {})
            .register(SERVICE.translation, {})
            .register(SERVICE.settings, {})
            .register(SERVICE.storage, {})
            .register(SERVICE.screenshot, {})
            .register(SERVICE.review, {})
            .register(SERVICE.related, {})
            .register(SERVICE.state, {})
            .register(SERVICE.domUi, {})
            .register(SERVICE.notifications, {})
            .register(SERVICE.clog, logger);
        const commands = new CommandRegistry();
        const runtime = new FeatureRuntime({ container, commands, diagnostics, site: "javdb", route: "list" });
        runtime.setContributionCatalog([{
            id: "detail.fc2-owned", featureId: "fc2-workspace", legacyPluginId: "Fc2Plugin",
            executionOwner: "feature", sites: ["javdb"], routes: ["list", "detail", "owned-detail"], surfaces: ["list-card", "detail-page"],
        }]);
        let registeredBean;
        runtime.setCompatibilityBeanRegistrar((_name, bean) => {
            registeredBean = bean;
            return vi.fn();
        });
        runtime.setCompatibilityBeanResolver(() => null);

        /** @type {any} */ let consumedService = null;
        const consumer = defineFeature({
            id: "fc2-consumer-test", kind: "feature", disableable: true, sites: ["javdb"], routes: ["list"], startup: "eager",
            requires: [], contributes: [], providesCommands: ["test.fc2.consumer"],
            activate: async (_deps, api) => {
                consumedService = await api.executeCommand("detail.fc2.workspace");
                return { activeContributions: [], commands: { "test.fc2.consumer": () => consumedService } };
            },
        });
        runtime.register(fc2Workspace);
        runtime.register(consumer);

        await runtime.start();

        expect(consumedService).toBe(registeredBean);
        expect(consumedService.getRuntimeService("movie")).toBe(movie);
        expect(consumedService.getRuntimeService("logger")).toBe(logger);
        expect(consumedService.managedByFeature).toBe(true);
        expect(style.register).toHaveBeenCalledOnce();
        expect(runtime.getActiveFeatureIds()).toEqual(["fc2-workspace", "fc2-consumer-test"]);

        const active = await runtime.activate("fc2-workspace");
        active.dispose();
        expect(styleRelease).toHaveBeenCalledOnce();
    });
});
