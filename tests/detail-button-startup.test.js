import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailController } from "../src/features/detail/detail-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

afterEach(() => vi.unstubAllGlobals());

function createController({ settings = {}, enabled = true, carNum = "ABC-123", remove = vi.fn(async () => {}), diagnostics = { recordError: vi.fn() } } = {}) {
    const hostAdapter = {
        locateDetailRoot: () => null,
        locateDetailSlots: () => ({}),
        readMovieRef: vi.fn(() => carNum ? { carNum, url: "https://javdb.com/v/test", site: "javdb" } : null),
    };
    const state = { removeFromNewVideoList: remove };
    const settingService = { snapshot: vi.fn(() => settings) };
    const scope = new LifecycleScope("detail-browse-lifecycle:test");
    const controller = new DetailController({
        hostAdapter, scope, enabledContributions: enabled ? ["detail.page-state-actions"] : [],
        state, settings: settingService, diagnostics,
    });
    return { controller, hostAdapter, state, settings: settingService, scope, diagnostics };
}

describe("detail browse lifecycle", () => {
    it("uses the disabled default without reading storage or mutating state", () => {
        const storage = { getSetting: vi.fn(async () => "yes") };
        vi.stubGlobal("storageManager", storage);
        const { controller, state, settings } = createController();

        controller.start();

        expect(settings.snapshot).toHaveBeenCalledOnce();
        expect(storage.getSetting).not.toHaveBeenCalled();
        expect(state.removeFromNewVideoList).not.toHaveBeenCalled();
        controller.dispose();
    });

    it("removes the current movie mark only when the setting is enabled", () => {
        const { controller, hostAdapter, state } = createController({ settings: { autoRemoveNewVideoMarkAfterBrowse: "yes" } });

        controller.start();

        expect(hostAdapter.readMovieRef).toHaveBeenCalledOnce();
        expect(state.removeFromNewVideoList).toHaveBeenCalledWith(["ABC-123"], "browse");
        controller.dispose();
    });

    it("respects the disabled detail contribution and missing movie identity", () => {
        const disabled = createController({ enabled: false, settings: { autoRemoveNewVideoMarkAfterBrowse: "yes" } });
        disabled.controller.start();
        expect(disabled.settings.snapshot).not.toHaveBeenCalled();
        expect(disabled.state.removeFromNewVideoList).not.toHaveBeenCalled();
        disabled.controller.dispose();

        const missing = createController({ settings: { autoRemoveNewVideoMarkAfterBrowse: "yes" }, carNum: null });
        missing.controller.start();
        expect(missing.state.removeFromNewVideoList).not.toHaveBeenCalled();
        missing.controller.dispose();
    });

    it("reports persistence failures through Feature diagnostics without throwing", async () => {
        const error = new Error("write failed"), diagnostics = { recordError: vi.fn() };
        const { controller } = createController({ settings: { autoRemoveNewVideoMarkAfterBrowse: "yes" }, remove: vi.fn(async () => { throw error; }), diagnostics });

        controller.start();
        await Promise.resolve();

        expect(diagnostics.recordError).toHaveBeenCalledWith(expect.objectContaining({
            source: "detail-browse-lifecycle", featureId: "detail", contributionId: "detail.page-state-actions",
            message: "自动移除新作品标记失败: write failed",
        }));
        controller.dispose();
    });
});
