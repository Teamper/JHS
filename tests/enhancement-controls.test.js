import { ENHANCEMENT_METADATA, subtitleUploadEnabled, initializeEnhancementControls } from "../src/core/enhancement-controls.js";
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { FeatureRuntime } from "../src/app/feature-runtime.js";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";

function setup(activate = () => ({ commands: { "rating.probe": () => "active" } })) {
    const commands = new CommandRegistry();
    const runtime = new FeatureRuntime({ container: new DependencyContainer(), commands, diagnostics: new DiagnosticsService(), site: "javdb", route: "detail" });
    runtime.register({ id: "personal-ratings", kind: "feature", disableable: true, sites: ["javdb"], routes: [], startup: "eager", requires: [], contributes: [], providesCommands: ["rating.probe"], activate });
    return { runtime, commands };
}
describe("enhancement feature control lifecycle", () => {
    it("blocks an already registered command, disposes its owner, and reopens once", async () => {
        const cleanup = vi.fn();
        const activate = vi.fn((_deps, { scope }) => { scope.addCleanup(cleanup); return { commands: { "rating.probe": () => "active" } }; });
        const { runtime, commands } = setup(activate);
        await runtime.start();
        expect(await commands.execute("rating.probe")).toBe("active");
        const off = runtime.reconcileConfiguration({ disabledPlugins: '["personal-ratings"]' });
        await expect(commands.execute("rating.probe")).rejects.toThrow("关闭");
        await off;
        expect(cleanup).toHaveBeenCalledOnce();
        expect(runtime.getActiveFeatureIds()).toEqual([]);
        await runtime.reconcileConfiguration({ disabledPlugins: "[]" });
        expect(await commands.execute("rating.probe")).toBe("active");
        expect(activate).toHaveBeenCalledTimes(2);
        await runtime.reconcileConfiguration({ enhancementsEnabled: false, disabledPlugins: "[]" });
    });
    it("ignores the retired master state and retains independent disabled choices", async () => {
        const { runtime, commands } = setup();
        await runtime.start({ enhancementsEnabled: false, disabledPlugins: "[]" });
        expect(commands.isAvailable("rating.probe")).toBe(true);
        expect(runtime.getFeatureDescriptors()).toContainEqual(expect.objectContaining({ id: "personal-ratings", enabled: true, available: true }));
        await runtime.reconcileConfiguration({ enhancementsEnabled: true, disabledPlugins: '["personal-ratings"]' });
        expect(commands.isAvailable("rating.probe")).toBe(false);
    });
    it("does not install late commands after disabling an asynchronous activation", async () => {
        let release;
        const { runtime, commands } = setup(() => new Promise(resolve => { release = resolve; }));
        const starting = runtime.start();
        await vi.waitFor(() => expect(release).toBeTypeOf("function"));
        const off = runtime.reconcileConfiguration({ disabledPlugins: '["personal-ratings"]' });
        release({ commands: { "rating.probe": () => "late" } });
        await starting;
        await off;
        expect(commands.handlers.has("rating.probe")).toBe(false);
        expect(runtime.getActiveFeatureIds()).toEqual([]);
        await expect(commands.execute("rating.probe")).rejects.toThrow("关闭");
    });
    it("honors disabled cached command handlers without relying on an activation", async () => {
        const registry = new CommandRegistry(), handler = vi.fn();
        registry.registerOwner("probe", "owner");
        registry.registerHandler("probe", handler, "owner");
        registry.setOwnerEnabled("probe", false);
        await expect(registry.execute("probe")).rejects.toThrow("关闭");
        expect(handler).not.toHaveBeenCalled();
    });
});

it("inherits a disabled shared translation owner once without coupling later choices", () => {
    const draft = { disabledPlugins: '["TranslatePlugin","personal-ratings"]' };
    initializeEnhancementControls(draft);
    expect(draft.enhancementsEnabled).toBeUndefined();
    expect(draft.independentControlsInitialized).toBe(true);
    expect(JSON.parse(draft.disabledPlugins)).toContain("translation-tools");
    draft.disabledPlugins = '["TranslatePlugin"]';
    initializeEnhancementControls(draft);
    expect(JSON.parse(draft.disabledPlugins)).not.toContain("translation-tools");
});

it.each([false,"false","no",0,"0"])("honors imported false setting %s at the master and upload gates", value => {
    expect(subtitleUploadEnabled({enableSubtitle115Upload:value})).toBe(false);
    expect(subtitleUploadEnabled({enhancementsEnabled:value,enableSubtitle115Upload:true})).toBe(true);
});

it("maps configuration entries to the existing full settings categories", () => {
    expect(ENHANCEMENT_METADATA["media-library"].settingsEntry).toBe("resources-panel");
    expect(ENHANCEMENT_METADATA.privacy.settingsEntry).toBe("appearance-panel");
    expect(ENHANCEMENT_METADATA["subtitle115-upload"].settingsEntry).toBe("cloud-panel");
});

it("refreshes optional capability consumers and their adapter dependents when configuration changes", async () => {
    const commands = new CommandRegistry();
    const runtime = new FeatureRuntime({container:new DependencyContainer(),commands,diagnostics:new DiagnosticsService(),site:"javdb",route:"list"});
    const parent = vi.fn(), child = vi.fn(), cleanup = vi.fn();
    const base = {kind:"feature",disableable:true,sites:["javdb"],routes:[],startup:"eager",requires:[],contributes:[],providesCommands:[]};
    runtime.register({...base,id:"library",contributes:["library.blacklist"],activate:()=>({})});
    runtime.register({...base,id:"list",configurationDependencies:["library.blacklist"],activate:(_deps,{scope})=>{parent();scope.addCleanup(cleanup);return {};}});
    runtime.register({...base,id:"dependent",requiresFeaturesByRoute:{list:["list"]},activate:()=>{child();return {};}});
    runtime.setContributionCatalog([{id:"library.blacklist",legacyPluginId:"BlacklistPlugin"}]);
    await runtime.start();
    expect(runtime.isCompatibilityBeanAvailable("BlacklistPlugin")).toBe(true);
    await runtime.reconcileConfiguration({disabledPlugins:'["library.blacklist"]'});
    expect(runtime.isCompatibilityBeanAvailable("BlacklistPlugin")).toBe(false);
    expect(parent).toHaveBeenCalledTimes(2);
    expect(child).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledOnce();
    await runtime.reconcileConfiguration({disabledPlugins:"[]"});
    expect(runtime.isCompatibilityBeanAvailable("BlacklistPlugin")).toBe(true);
    expect(parent).toHaveBeenCalledTimes(3);
    expect(child).toHaveBeenCalledTimes(3);
    await runtime.reconcileConfiguration({disabledPlugins:'["list","library","dependent"]'});
    expect(runtime.getActiveFeatureIds()).toEqual([]);
});
