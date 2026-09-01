import { describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime } from "../src/app/feature-runtime.js";
import { defineFeature } from "../src/contracts/manifests.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";

function createRuntime() {
  return new FeatureRuntime({
    container: new DependencyContainer(),
    commands: new CommandRegistry(),
    diagnostics: new DiagnosticsService(),
    site: "javdb",
    route: "list",
  });
}

describe("7.0 Feature failure isolation", () => {
  it("continues eager Feature startup after a degraded Feature fails", async () => {
    const runtime = createRuntime();
    const healthyActivate = vi.fn(() => ({ api: { ready: true } }));
    runtime.register(defineFeature({
      id: "broken", kind: "feature", disableable: true, failurePolicy: "degraded", sites: ["javdb"], routes: ["list"], startup: "eager",
      requires: [], contributes: ["broken.contribution"], providesCommands: [], activate: async () => { throw new Error("broken feature"); },
    }));
    runtime.register(defineFeature({
      id: "healthy", kind: "feature", disableable: true, failurePolicy: "degraded", sites: ["javdb"], routes: ["list"], startup: "eager",
      requires: [], contributes: ["healthy.contribution"], providesCommands: [], activate: healthyActivate,
    }));

    await expect(runtime.start()).resolves.toBeUndefined();
    expect(healthyActivate).toHaveBeenCalledOnce();
    expect(runtime.getActiveFeatureIds()).toEqual(["healthy"]);
    expect(runtime.diagnostics.exportSnapshot().featureStates).toMatchObject({
      broken: { state: "degraded", message: "broken feature" },
      healthy: { state: "active" },
    });
  });

  it("does not let one optional contribution failure escape its Feature", async () => {
    const runtime = createRuntime();
    const result = await runtime.isolateContribution("broken.contribution", () => { throw new Error("broken contribution"); });

    expect(result).toBeNull();
    expect(runtime.diagnostics.exportSnapshot().errors.at(-1)).toMatchObject({
      source: "feature-runtime", contribution: "broken.contribution", status: "degraded", message: "broken contribution",
    });
  });

  it("still rejects a fatal eager Feature after all eager activations settle", async () => {
    const runtime = createRuntime();
    const healthyActivate = vi.fn(() => ({}));
    runtime.register(defineFeature({
      id: "fatal", kind: "system", disableable: false, failurePolicy: "fatal", sites: [], routes: [], startup: "eager",
      requires: [], contributes: [], providesCommands: [], activate: async () => { throw new Error("fatal feature"); },
    }));
    runtime.register(defineFeature({
      id: "healthy", kind: "feature", disableable: true, failurePolicy: "degraded", sites: ["javdb"], routes: ["list"], startup: "eager",
      requires: [], contributes: [], providesCommands: [], activate: healthyActivate,
    }));

    await expect(runtime.start()).rejects.toThrow("fatal feature");
    expect(healthyActivate).toHaveBeenCalledOnce();
  });
});
