import { describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime } from "../src/app/feature-runtime.js";
import { defineFeature } from "../src/contracts/manifests.js";
import { LegacyContributionRegistry } from "../src/core/legacy-contribution-registry.js";
import { BasePlugin, PluginManager } from "../src/core/plugin-manager.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";

describe("LegacyContributionRegistry", () => {
    it("resolves feature-owned implementations without putting them in PluginManager", () => {
        class ManagedPlugin extends BasePlugin { getName() { return "ManagedPlugin"; } }
        class SettingsPlugin extends BasePlugin { getName() { return "SettingsPlugin"; } }
        const registry = new LegacyContributionRegistry(), manager = new PluginManager();
        registry.setDependencyDeclarations({});
        manager.setDependencyDeclarations({});
        manager.setCatalogDescriptors([{ name: "ManagedPlugin", disableable: true }, { name: "SettingsPlugin", disableable: true }]);
        manager.attachCompatibilityRegistry(registry);
        registry.register(ManagedPlugin, {}, { managedByFeature: true }, { featureId: "list", contributionId: "list.core" });
        manager.register(SettingsPlugin, {}, { dependencyResolver: registry });

        expect(manager.getOwnBean("ManagedPlugin")).toBeUndefined();
        expect(manager.getBean("ManagedPlugin")).toBe(registry.getOwnBean("ManagedPlugin"));
        expect(registry.getFeaturePlugins("list", ["list.core"])[0].plugin).toBe(registry.getOwnBean("ManagedPlugin"));
        expect(manager.getPluginNames()).toEqual(["ManagedPlugin", "SettingsPlugin"]);
    });

    it("mounts feature-owned legacy styles in the FeatureRuntime scope", async () => {
        class StyledPlugin extends BasePlugin {
            getName() { return "StyledPlugin"; }
            initCss() { return ".styled-plugin { color: red; }"; }
        }
        const release = vi.fn(), styles = { register: vi.fn(() => release) }, registry = new LegacyContributionRegistry();
        registry.register(StyledPlugin, {}, { managedByFeature: true }, { featureId: "styled", contributionId: "styled.css" });
        const runtime = new FeatureRuntime({ container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics: new DiagnosticsService(), site: "javdb", route: "list", styles });
        runtime.setLegacyContributionRegistry(registry);
        runtime.setLegacyResolver((name) => registry.getBean(name));
        runtime.register(defineFeature({ id: "styled", kind: "feature", disableable: true, sites: ["javdb"], routes: ["list"], startup: "eager", requires: [], contributes: ["styled.css"], providesCommands: [], activate: () => ({ api: { ready: true } }) }));

        const activation = await runtime.activate("styled");
        expect(styles.register).toHaveBeenCalledWith("jhs-feature-styled-styled-css", ".styled-plugin { color: red; }");
        activation.dispose();
        expect(release).toHaveBeenCalledOnce();
    });
});
