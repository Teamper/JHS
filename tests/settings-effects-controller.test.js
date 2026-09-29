import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { SettingsEffectsController } from "../src/features/system/settings-effects-controller.js";

class SettingsHarness extends EventTarget {
    value = { themeMode: "light", mobileMode: "auto", containerWidth: 100 };

    snapshot() { return { ...this.value }; }

    change(names, patch = {}) {
        this.value = { ...this.value, ...patch };
        const event = new Event("settings.changed");
        Object.defineProperty(event, "detail", { value: { names } });
        this.dispatchEvent(event);
    }
}

describe("SettingsEffectsController", () => {
    it("reapplies saved layout when the responsive profile crosses a breakpoint", () => {
        const settings = new SettingsHarness(), profile = new EventTarget();
        let current = "compact";
        profile.current = () => current;
        const scope = new LifecycleScope("settings-profile-layout-test"), applyLayout = vi.fn(async () => {});
        const controller = new SettingsEffectsController({
            settings, profile, imageLayout: null, scope, applyLayout,
            applyTheme: vi.fn(), logger: {}, diagnostics: { recordError: vi.fn() },
        });

        controller.start();
        expect(applyLayout).toHaveBeenLastCalledWith(settings.snapshot(), { imageLayout: null, hostAdapter: null, mobile: true });
        current = "wide";
        profile.dispatchEvent(new Event("profile.changed"));
        expect(applyLayout).toHaveBeenLastCalledWith(settings.snapshot(), { imageLayout: null, hostAdapter: null, mobile: false });
        scope.dispose();
        profile.dispatchEvent(new Event("profile.changed"));
        expect(applyLayout).toHaveBeenCalledTimes(2);
    });

    it("applies live theme, logger, and layout changes and releases its listener", () => {
        const settings = new SettingsHarness();
        const scope = new LifecycleScope("settings-effects-test");
        const imageLayout = { id: "bus-layout" }, hostAdapter = { id: "host" };
        const applyLayout = vi.fn(async () => {}), applyTheme = vi.fn();
        const logger = { show: vi.fn(), hide: vi.fn() }, diagnostics = { recordError: vi.fn() };
        const controller = new SettingsEffectsController({ settings, imageLayout, hostAdapter, scope, applyLayout, applyTheme, logger, diagnostics });

        controller.start();
        expect(logger.show).toHaveBeenCalledOnce();
        expect(applyLayout).toHaveBeenCalledOnce();
        expect(applyLayout).toHaveBeenLastCalledWith(settings.snapshot(), { imageLayout, hostAdapter });

        settings.change(["unrelated"], { unrelated: true });
        expect(applyLayout).toHaveBeenCalledOnce();
        settings.change(["themeMode"], { themeMode: "dark" });
        expect(applyTheme).toHaveBeenCalledWith("dark");
        settings.change(["enableClog"], { enableClog: "no" });
        expect(logger.hide).toHaveBeenCalledOnce();
        settings.change(["containerWidth", "mobileMode"], { containerWidth: 85, mobileMode: "force" });
        expect(applyLayout).toHaveBeenCalledTimes(2);

        scope.dispose();
        settings.change(["themeMode", "enableVerticalModel"], { themeMode: "light", enableVerticalModel: "yes" });
        expect(applyTheme).toHaveBeenCalledTimes(1);
        expect(applyLayout).toHaveBeenCalledTimes(2);
        expect(diagnostics.recordError).not.toHaveBeenCalled();
    });

    it("reports initial layout failure without rejecting Feature startup", async () => {
        const error = new Error("layout unavailable");
        const diagnostics = { recordError: vi.fn() };
        const controller = new SettingsEffectsController({
            settings: new SettingsHarness(), imageLayout: null, diagnostics, logger: {}, scope: new LifecycleScope("settings-effects-error-test"),
            applyLayout: vi.fn(() => Promise.reject(error)), applyTheme: vi.fn(),
        });

        expect(() => controller.start()).not.toThrow();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(diagnostics.recordError).toHaveBeenCalledWith({ source: "settings-effects", message: "layout unavailable" });
    });
});
