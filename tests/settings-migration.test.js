import { describe, expect, it } from "vitest";
import { SettingsService } from "../src/services/settings-service.js";
import { normalizeScreenshotSetting } from "../src/core/settings-migration.js";

function createService(initial = {}) {
    const stored = { setting: { ...initial } };
    const service = new SettingsService({ get: async (key) => stored[key], set: async (key, value) => { stored[key] = value; } });
    return service;
}

describe("enableScreenSvg → enableLoadScreenShot migration", () => {
    it("keeps the master switch when both are yes", async () => {
        const service = createService({ enableLoadScreenShot: "yes", enableScreenSvg: "yes" });
        await service.load();
        await normalizeScreenshotSetting(service);
        expect(service.snapshot().enableLoadScreenShot).toBe("yes");
    });

    it("NO 优先：旧 enableScreenSvg=no 关闭总开关", async () => {
        const service = createService({ enableLoadScreenShot: "yes", enableScreenSvg: "no" });
        await service.load();
        await normalizeScreenshotSetting(service);
        expect(service.snapshot().enableLoadScreenShot).toBe("no");
    });

    it("NO 优先：enableLoadScreenShot=no 保持不变", async () => {
        const service = createService({ enableLoadScreenShot: "no", enableScreenSvg: "yes" });
        await service.load();
        await normalizeScreenshotSetting(service);
        expect(service.snapshot().enableLoadScreenShot).toBe("no");
    });

    it("no-op when neither key exists", async () => {
        const service = createService({});
        await service.load();
        await normalizeScreenshotSetting(service);
        expect(service.snapshot()).toEqual({});
    });
});

describe("one-shot screenshot migration", () => {
    it("writes master and deletes legacy in the same update", async () => {
        const service = createService({ enableLoadScreenShot: "yes", enableScreenSvg: "no", keep: 1 });
        await service.load();
        await normalizeScreenshotSetting(service);
        expect(service.snapshot().enableLoadScreenShot).toBe("no");
        expect(service.snapshot().enableScreenSvg).toBeUndefined();
        expect(service.snapshot().keep).toBe(1);
    });

    it("does not touch enableLoadScreenShot after legacy key is gone", async () => {
        const service = createService({ enableLoadScreenShot: "yes" });
        await service.load();
        await normalizeScreenshotSetting(service);
        expect(service.snapshot()).toEqual({ enableLoadScreenShot: "yes" });
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
        expect(service.snapshot().enableScreenSvg).toBeUndefined();
    });
});
