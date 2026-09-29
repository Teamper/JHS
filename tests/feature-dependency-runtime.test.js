import { describe, expect, it } from "vitest";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime } from "../src/app/feature-runtime.js";
import { defineFeature } from "../src/contracts/manifests.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";

function createFeature(id, { routes, requiresFeaturesByRoute, activate }) {
    return defineFeature({
        id, kind: "feature", disableable: true, sites: ["javdb"], routes, startup: "eager",
        requiresFeaturesByRoute, requires: [], contributes: [], providesCommands: [], activate,
    });
}

function createRuntime(route) {
    return new FeatureRuntime({
        container: new DependencyContainer(), commands: new CommandRegistry(),
        diagnostics: new DiagnosticsService(), site: "javdb", route,
    });
}

describe("route-scoped feature dependencies", () => {
    it("waits for the required list feature before activating list translation", async () => {
        const runtime = createRuntime("list"), order = [];
        runtime.register(createFeature("translation", {
            routes: ["list", "detail"], requiresFeaturesByRoute: { list: ["list"] },
            activate: () => { order.push("translation"); return {}; },
        }));
        runtime.register(createFeature("list", {
            routes: ["list"],
            activate: async () => { order.push("list:start"); await Promise.resolve(); order.push("list:ready"); return {}; },
        }));

        await runtime.start();

        expect(order).toEqual(["list:start", "list:ready", "translation"]);
    });

    it("does not activate the list dependency on a detail route", async () => {
        const runtime = createRuntime("detail"), order = [];
        runtime.register(createFeature("list", {
            routes: ["list"], activate: () => { order.push("list"); return {}; },
        }));
        runtime.register(createFeature("translation", {
            routes: ["list", "detail"], requiresFeaturesByRoute: { list: ["list"] },
            activate: () => { order.push("translation"); return {}; },
        }));

        await runtime.start();

        expect(order).toEqual(["translation"]);
    });
});
