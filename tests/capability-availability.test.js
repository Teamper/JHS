import { describe, expect, it } from "vitest";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime } from "../src/app/feature-runtime.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";
import { defineFeature } from "../src/contracts/manifests.js";

describe("capability availability (无死按钮)", () => {
    it("CommandRegistry tracks owner availability", () => {
        const commands = new CommandRegistry();
        const diagnostics = new DiagnosticsService();
        const runtime = new FeatureRuntime({ container: new DependencyContainer(), commands, diagnostics, disabled: [], site: "javdb", route: "list" });
        runtime.register(defineFeature({ id: "sample", kind: "feature", disableable: true, sites: ["javdb"], routes: ["list"], startup: "on-command", requires: [], contributes: [], providesCommands: [ "sample.open" ], activate: () => ({ commands: { "sample.open": () => "ok" } }) }));
        expect(commands.isAvailable("sample.open")).toBe(true);
        const disabledRuntime = new FeatureRuntime({ container: new DependencyContainer(), commands: new CommandRegistry(), diagnostics, disabled: [ "disabled-feature" ], site: "javdb", route: "list" });
        disabledRuntime.register(defineFeature({ id: "disabled-feature", kind: "feature", disableable: true, sites: ["javdb"], routes: ["list"], startup: "on-command", requires: [], contributes: [], providesCommands: [ "disabled.open" ], activate: () => ({ commands: { "disabled.open": () => "no" } }) }));
        expect(disabledRuntime.commands.isAvailable("disabled.open")).toBe(false);
        expect(commands.isAvailable("unknown.open")).toBe(false);
    });

});
