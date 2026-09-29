import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime } from "../src/app/feature-runtime.js";
import { systemFeatureManifests } from "../src/features/system/catalog.js";
import { openSettingsUi } from "../src/core/settings-ui-owner.js";
import { PORT, REGISTRY, SERVICE } from "../src/contracts/tokens.js";
import { SettingsCompatibilityBean } from "../src/compat/settings-compatibility-bean.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";

afterEach(() => vi.unstubAllGlobals());

describe("Settings system Feature UI ownership", () => {
    it("registers the compatibility dialog through the Feature command and releases its owner", async () => {
        const openSettingDialog = vi.fn(async (panel) => panel || "backup-panel");
        const commands = new CommandRegistry();
        const runtime = new FeatureRuntime({
            container: new DependencyContainer()
                .register(SERVICE.diagnostics, new DiagnosticsService())
                .register(SERVICE.profile, { current: () => "regular" }),
            commands,
            diagnostics: new DiagnosticsService(),
            disabled: [],
            site: "javdb",
            route: "list",
        });
        runtime.setCompatibilityBeanResolver((name) => name === "SettingPlugin" ? { openSettingDialog } : undefined);
        runtime.setContributionCatalog([
            { id: "settings.core", featureId: "settings-entry", legacyPluginId: "SettingPlugin", executionOwner: "feature", sites: ["javdb", "javbus"] },
        ]);
        runtime.register(systemFeatureManifests.find((feature) => feature.id === "settings"));
        commands.setActivator((id) => runtime.activate(id));

        expect(() => openSettingsUi()).toThrow("Settings UI owner is not ready");
        await expect(commands.execute("settings.open", "task-panel")).resolves.toBe("task-panel");
        expect(openSettingDialog).toHaveBeenCalledExactlyOnceWith("task-panel");
        await expect(openSettingsUi("backup-panel")).resolves.toBe("backup-panel");

        const activation = await runtime.activate("settings");
        activation.dispose();
        expect(() => openSettingsUi()).toThrow("Settings UI owner is not ready");
    });

    it("keeps Settings command activation usable without a site compatibility bean", async () => {
        const commands = new CommandRegistry();
        const runtime = new FeatureRuntime({
            container: new DependencyContainer()
                .register(SERVICE.diagnostics, new DiagnosticsService())
                .register(SERVICE.profile, { current: () => "regular" }),
            commands,
            diagnostics: new DiagnosticsService(),
            disabled: [],
            site: "unknown",
            route: "other",
        });
        runtime.setCompatibilityBeanResolver(() => undefined);
        runtime.register(systemFeatureManifests.find((feature) => feature.id === "settings"));
        commands.setActivator((id) => runtime.activate(id));

        await expect(commands.execute("settings.open")).rejects.toThrow("Settings UI owner is not ready");
    });

    it("routes the Settings entry through FeatureRuntime command execution", async () => {
        const dom = new JSDOM('<body><button id="setting-btn">设置</button></body>');
        vi.stubGlobal("document", dom.window.document);
        const openSettingDialog = vi.fn(async (panel) => panel || "backup-panel");
        const closeQuickSettings = vi.fn(), activateFeatureSurface = vi.fn(), releaseStyle = vi.fn(), registerStyle = vi.fn(() => releaseStyle), diagnostics = new DiagnosticsService(), commands = new CommandRegistry();
        const runtime = new FeatureRuntime({
            container: new DependencyContainer()
                .register(SERVICE.diagnostics, diagnostics)
                .register(PORT.style, { register: registerStyle })
                .register(PORT.host, { document: dom.window.document })
                .register(SERVICE.profile, { current: () => "regular" })
                .register(SERVICE.webdav, {})
                .register(SERVICE.dialog, {})
                .register(SERVICE.storage, {})
                .register(SERVICE.settings, {})
                .register(SERVICE.cache, {})
                .register(SERVICE.http, {})
                .register(SERVICE.offline, {})
                .register(SERVICE.magnet, {})
                .register(SERVICE.movie, {})
                .register(SERVICE.state, {})
                .register(SERVICE.translation, {})
                .register(SERVICE.busImageLayout, {})
                .register(REGISTRY.settings, {})
                .register(SERVICE.legacyStorage, {})
                .register(SERVICE.legacyUtils, {})
                .register(SERVICE.events, {})
                .register(SERVICE.domUi, { jquery: vi.fn() })
                .register(SERVICE.clog, { lowZIndex: vi.fn(), error: vi.fn() })
                .register(SERVICE.notifications, { error: vi.fn() }),
            commands, diagnostics, disabled: [], site: "javdb", route: "list",
        });
        const service = { openSettingDialog, disposeQuickSettings: closeQuickSettings, activateFeatureSurface, initCss: async () => "<style>.settings-test{color:red}</style>" };
        let serviceOptions;
        const compatibilityBean = new SettingsCompatibilityBean((options) => {
            serviceOptions = options;
            return service;
        });
        runtime.setCompatibilityBeanResolver((name) => name === "SettingPlugin" ? compatibilityBean : undefined);
        runtime.setContributionCatalog([
            { id: "settings.core", featureId: "settings-entry", legacyPluginId: "SettingPlugin", executionOwner: "feature", plugin: null, sites: ["javdb", "javbus"] },
        ]);
        runtime.register(systemFeatureManifests.find((feature) => feature.id === "settings-entry"));
        runtime.register(systemFeatureManifests.find((feature) => feature.id === "settings"));

        await runtime.start();
        expect(compatibilityBean.getName()).toBe("SettingPlugin");
        expect(compatibilityBean.service).toBe(service);
        expect(serviceOptions).toMatchObject({
            runtimeServices: expect.objectContaining({ settings: {}, settingsRegistry: {} }),
            capabilities: expect.objectContaining({ ListPagePlugin: undefined, NewVideoPlugin: undefined }),
            jquery: expect.any(Function),
            utilities: {},
            logger: expect.objectContaining({ lowZIndex: expect.any(Function) }),
            notifications: expect.objectContaining({ error: expect.any(Function) }),
        });
        expect(registerStyle).toHaveBeenCalledExactlyOnceWith("jhs-settings-feature", ".settings-test{color:red}");
        expect(activateFeatureSurface).toHaveBeenCalledOnce();
        expect(activateFeatureSurface.mock.calls[0][1]).toMatchObject({ current: expect.any(Function) });
        dom.window.document.querySelector("#setting-btn").click();
        await vi.waitFor(() => expect(openSettingDialog).toHaveBeenCalledOnce());
        expect(closeQuickSettings).toHaveBeenCalledOnce();
        expect(openSettingDialog).toHaveBeenCalledExactlyOnceWith(undefined);

        (await runtime.activate("settings")).dispose();
        (await runtime.activate("settings-entry")).dispose();
        expect(compatibilityBean.service).toBeNull();
        expect(releaseStyle).toHaveBeenCalledOnce();
        dom.window.close();
    });
});
