import { describe, expect, it, vi } from "vitest";
import { ResponsiveShellBridge } from "../src/compat/responsive-shell-bridge.js";

describe("responsive shell compatibility bridge", () => {
    it("retains Feature capabilities attached before the shell starts", () => {
        const bridge = new ResponsiveShellBridge();
        const filter = {}, hub = {};
        const controller = {
            attachFeatureMagnetFilterAdapter: vi.fn(), detachFeatureMagnetFilterAdapter: vi.fn(),
            attachFeatureMagnetHubAdapter: vi.fn(), detachFeatureMagnetHubAdapter: vi.fn(),
        };

        bridge.attachFeatureMagnetFilterAdapter(filter);
        bridge.attachFeatureMagnetHubAdapter(hub);
        bridge.attachController(controller);

        expect(controller.attachFeatureMagnetFilterAdapter).toHaveBeenCalledExactlyOnceWith(filter);
        expect(controller.attachFeatureMagnetHubAdapter).toHaveBeenCalledExactlyOnceWith(hub);
        bridge.detachController(controller);
        expect(controller.detachFeatureMagnetFilterAdapter).toHaveBeenCalledExactlyOnceWith(filter);
        expect(controller.detachFeatureMagnetHubAdapter).toHaveBeenCalledExactlyOnceWith(hub);
    });

    it("forwards capabilities that arrive after the shell is attached and ignores stale detach calls", () => {
        const bridge = new ResponsiveShellBridge();
        const controller = {
            attachFeatureMagnetFilterAdapter: vi.fn(), detachFeatureMagnetFilterAdapter: vi.fn(),
            attachFeatureMagnetHubAdapter: vi.fn(), detachFeatureMagnetHubAdapter: vi.fn(),
        };
        const filter = {}, stale = {}, hub = {};
        bridge.attachController(controller);

        bridge.attachFeatureMagnetFilterAdapter(filter);
        bridge.detachFeatureMagnetFilterAdapter(stale);
        bridge.attachFeatureMagnetHubAdapter(hub);

        expect(controller.attachFeatureMagnetFilterAdapter).toHaveBeenCalledExactlyOnceWith(filter);
        expect(controller.detachFeatureMagnetFilterAdapter).not.toHaveBeenCalled();
        expect(controller.attachFeatureMagnetHubAdapter).toHaveBeenCalledExactlyOnceWith(hub);
    });
});
