import { describe, expect, it } from "vitest";
import { SettingsService } from "../src/services/settings-service.js";
import { normalizeScreenshotSetting } from "../src/core/settings-migration.js";

function createService(initial = {}) {
    const stored = { setting: { ...initial } };
    const service = new SettingsService({ get: async (key) => stored[key], set: async (key, value) => { stored[key] = value; } });
    return service;
}

describe("独立截图设置迁移", () => {
    it("keeps both values when both keys already exist", async () => {
        const service = createService({ enableLoadScreenShot: "yes", enableScreenSvg: "yes" });
        await service.load();
        await normalizeScreenshotSetting(service);
        expect(service.snapshot().enableLoadScreenShot).toBe("yes");
        expect(service.snapshot().enableScreenSvg).toBe("yes");
    });

    it("preserves an explicitly disabled list button", async () => {
        const service = createService({ enableLoadScreenShot: "yes", enableScreenSvg: "no" });
        await service.load();
        await normalizeScreenshotSetting(service);
        expect(service.snapshot().enableLoadScreenShot).toBe("yes");
        expect(service.snapshot().enableScreenSvg).toBe("no");
    });

    it("preserves an explicitly disabled detail loader", async () => {
        const service = createService({ enableLoadScreenShot: "no", enableScreenSvg: "yes" });
        await service.load();
        await normalizeScreenshotSetting(service);
        expect(service.snapshot().enableLoadScreenShot).toBe("no");
        expect(service.snapshot().enableScreenSvg).toBe("yes");
    });

    it("seeds both defaults for a fresh settings object", async () => {
        const service = createService({});
        await service.load();
        await normalizeScreenshotSetting(service);
        expect(service.snapshot()).toEqual({ enableLoadScreenShot: "yes", enableScreenSvg: "yes" });
    });
});

describe("兼容缺失值", () => {
    it("copies the current detail value when the list key was removed", async () => {
        const service = createService({ enableLoadScreenShot: "yes", enableScreenSvg: "no", keep: 1 });
        await service.load();
        await normalizeScreenshotSetting(service);
        expect(service.snapshot().enableLoadScreenShot).toBe("yes");
        expect(service.snapshot().enableScreenSvg).toBe("no");
        expect(service.snapshot().keep).toBe(1);
    });

    it("adds only the missing list value", async () => {
        const service = createService({ enableLoadScreenShot: "yes" });
        await service.load();
        await normalizeScreenshotSetting(service);
        expect(service.snapshot()).toEqual({ enableLoadScreenShot: "yes", enableScreenSvg: "yes" });
    });

    it("user can re-enable after migration and bootstrap never flips it back", async () => {
        const stored = { setting: { enableLoadScreenShot: "yes", enableScreenSvg: "no" } };
        const service = new SettingsService({ get: async (key) => stored[key], set: async (key, value) => { stored[key] = value; } });
        await service.load();
        await normalizeScreenshotSetting(service);
        await service.set("enableLoadScreenShot", "yes");
        expect(service.snapshot().enableLoadScreenShot).toBe("yes");
        await normalizeScreenshotSetting(service);
        expect(service.snapshot().enableLoadScreenShot).toBe("yes");
        expect(service.snapshot().enableScreenSvg).toBe("no");
    });
});
