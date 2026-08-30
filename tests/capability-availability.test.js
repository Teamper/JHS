import { describe, expect, it } from "vitest";
import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime } from "../src/app/feature-runtime.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";
import { defineFeature } from "../src/contracts/manifests.js";

const listButtons = readTestFile(join(process.cwd(), "src/plugins/status/list-page-button.js"), "utf8");
const newVideo = readTestFile(join(process.cwd(), "src/plugins/new-video/new-video.js"), "utf8");
const coverButtons = readTestFile(join(process.cwd(), "src/plugins/image-viewer/cover-button.js"), "utf8");
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
        expect(listButtons).toContain('${hasNewVideo ? `<button type="button" id="newVideoBtn"');
        expect(listButtons).toContain('${hasBlacklist ? `<button type="button" id="blacklistBtn"');
        expect(listButtons).toContain("const hasNewVideo = Boolean(this.discoveryFeatureApi?.hasNewVideo)");
        expect(listButtons).not.toContain("黑名单功能已禁用");
    });

    it("card screenshot button is gated on both the setting and the plugin", () => {
        expect(coverButtons).toContain('Boolean(this.getBean("ScreenShotPlugin"))');
    });

    it("new-video edit dialog is scoped to its layer root", () => {
        expect(newVideo).toContain("editRoot = $(e);");
        expect(newVideo).toContain("editRoot.find(\"#edit-actress-avatar\")");
        expect(newVideo).not.toContain('$("#edit-actress-avatar")');
        expect(newVideo).not.toContain('$("#edit-actress-name")');
    });

    it("feature runtime declares owner availability for provided commands", () => {
        expect(registrySource).toContain("setOwnerEnabled(command, enabled)");
        expect(registrySource).toContain("isAvailable(command)");
        expect(runtimeSource).toContain("this.commands.setOwnerEnabled(command, this.isEligible(validated))");
    });
});
