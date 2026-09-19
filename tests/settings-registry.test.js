import { describe, expect, it } from "vitest";
import { SettingsRegistry, normalizeSettingDescriptor } from "../src/app/settings-registry.js";
import { registerDefaultSettings } from "../src/app/settings-catalog.js";

describe("SettingsRegistry canonical descriptors", () => {
    it("normalizes a minimal descriptor with defaults", () => {
        const descriptor = normalizeSettingDescriptor({ id: "autoPage", owner: "AutoPageFeature", label: "瀑布流" });
        expect(descriptor.key).toBe("autoPage");
        expect(descriptor.type).toBe("text");
        expect(descriptor.effect).toBe("live");
        expect(descriptor.surfaces).toEqual([]);
        expect(descriptor.validate).toBeNull();
        expect(Object.isFrozen(descriptor)).toBe(true);
    });

    it("accepts the full 6.5 descriptor shape", () => {
        const descriptor = normalizeSettingDescriptor({
            key: "enableLoadScreenShot", owner: "ScreenshotFeature", label: "长缩略图",
            description: "总开关", type: "boolean", defaultValue: "yes", effect: "live",
            surfaces: ["full", "quick"], validate: (value) => value === "yes" || value === "no",
        });
        expect(descriptor.key).toBe("enableLoadScreenShot");
        expect(descriptor.description).toBe("总开关");
        expect(descriptor.surfaces).toEqual(["full", "quick"]);
        expect(descriptor.validate("no")).toBe(true);
    });

    it("rejects descriptors without key/owner", () => {
        expect(() => normalizeSettingDescriptor({ owner: "X" })).toThrow(/key/);
        expect(() => normalizeSettingDescriptor({ key: "x" })).toThrow(/owner/);
        expect(() => normalizeSettingDescriptor(null)).toThrow(/object/);
    });

    it("rejects invalid type/effect/surfaces", () => {
        expect(() => normalizeSettingDescriptor({ key: "x", owner: "X", type: "magic" })).toThrow(/type/);
        expect(() => normalizeSettingDescriptor({ key: "x", owner: "X", effect: "now" })).toThrow(/effect/);
        expect(() => normalizeSettingDescriptor({ key: "x", owner: "X", surfaces: "quick" })).toThrow(/array/);
    });

    it("registers, lists with surface filters and rejects duplicates", () => {
        const registry = new SettingsRegistry();
        registry.register({ key: "a", owner: "A", surfaces: ["quick"] });
        registry.register({ key: "b", owner: "B", surfaces: ["full"] });
        registry.register({ key: "c", owner: "C", surfaces: [] });
        expect(registry.get("a").key).toBe("a");
        expect(registry.list({ surfaces: ["quick"] }).map((item) => item.key)).toEqual(["a"]);
        expect(registry.list({ surfaces: ["full"] }).map((item) => item.key)).toEqual(["b"]);
        expect(registry.list({ surfaces: ["quick", "full"] }).map((item) => item.key)).toEqual(["a", "b"]);
        expect(() => registry.register({ key: "a", owner: "A2" })).toThrow(/Duplicate/);
    });

    it("filters disabled contributions and validates values", () => {
        const registry = new SettingsRegistry();
        registry.register({ key: "x", owner: "X", contribution: "feature.x", validate: (value) => value !== "bad" });
        expect(registry.list({ disabledContributions: new Set(["feature.x"]) })).toEqual([]);
        expect(registry.isValid("x", "good")).toBe(true);
        expect(registry.isValid("x", "bad")).toBe(false);
        expect(registry.isValid("unknown", "anything")).toBe(true);
    });

    it("declares cloud controls once and normalizes persisted numeric values", () => {
        const registry = new SettingsRegistry();
        registerDefaultSettings(registry);
        const cloud = registry.list({ surfaces: ["full"] }).filter((descriptor) => descriptor.section === "cloud");
        expect(cloud.map((descriptor) => descriptor.key)).toEqual([
            "enable123Offline", "enable115Offline", "offlineProviderMode", "enable115Match",
            "enable115LoginRedirect", "oneOneFiveConcurrency", "oneOneFiveCacheMinutes",
        ]);
        const normalizers = registry.normalizers();
        expect(normalizers.oneOneFiveConcurrency(99)).toBe(10);
        expect(normalizers.oneOneFiveConcurrency(-5)).toBe(1);
        expect(normalizers.oneOneFiveCacheMinutes("4.8")).toBe(5);
        expect(normalizers.offlineProviderMode("invalid")).toBe("ask");
    });
});
