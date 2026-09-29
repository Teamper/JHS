import { describe, expect, it } from "vitest";
import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime } from "../src/app/feature-runtime.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";
import { defineFeature } from "../src/contracts/manifests.js";

const listButtons = readTestFile(join(process.cwd(), "src/features/list/list-actions-controller.js"), "utf8");
const newVideo = readTestFile(join(process.cwd(), "src/plugins/new-video/new-video.js"), "utf8");
const coverButtons = readTestFile(join(process.cwd(), "src/features/list/cover-button-controller.js"), "utf8");
const registrySource = readTestFile(join(process.cwd(), "src/app/command-registry.js"), "utf8");
const runtimeSource = readTestFile(join(process.cwd(), "src/app/feature-runtime.js"), "utf8");

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

    it("legacy list toolbar renders buttons only when the capability exists", () => {
        expect(listButtons).toContain('const newVideoAction = hasNewVideo ?');
        expect(listButtons).toContain('const blacklistAction = hasBlacklist ?');
        expect(listButtons).toContain('this.newVideo = options.newVideo ?? null');
        expect(listButtons).not.toContain("黑名单功能已禁用");
    });

    it("card screenshot action uses the injected ScreenshotService capability", () => {
        expect(coverButtons).toContain("this.screenshot.resolve(");
        expect(coverButtons).toContain("this.screenshotAvailable === true");
        expect(coverButtons).not.toContain("ScreenShotPlugin");
    });

    it("new-video edit dialog is scoped to its layer root", () => {
        expect(newVideo).toContain("editRoot = this.jquery(e);");
        expect(newVideo).toContain("editRoot.find(\"#edit-actress-avatar\")");
        expect(newVideo).not.toContain('this.jquery("#edit-actress-avatar")');
        expect(newVideo).not.toContain('this.jquery("#edit-actress-name")');
    });

    it("feature runtime declares owner availability for provided commands", () => {
        expect(registrySource).toContain("setOwnerEnabled(command, enabled)");
        expect(registrySource).toContain("isAvailable(command)");
        expect(runtimeSource).toContain("this.commands.setOwnerEnabled(command, this.isEligible(validated))");
    });
});
