import { afterEach, describe, expect, it, vi } from "vitest";
import { ListPageCompatibilityService } from "../src/features/list/list-compatibility-service.js";

describe("List Feature event ownership", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("starts list refresh listeners using the injected event service without a global bus", async () => {
        vi.stubGlobal("window", { isListPage: true });
        const cleanup = [], scope = { addCleanup: vi.fn(fn => cleanup.push(fn)) };
        const settings = { snapshot: () => ({ hoverBigImg: "no" }), addEventListener: vi.fn(), removeEventListener: vi.fn() };
        const events = { on: vi.fn(() => () => {}) };
        const list = new ListPageCompatibilityService({ runtimeServices: { scope: () => scope, settings, events } });

        await list.handle({ scope, featureOwnsStartup: true });

        expect(events.on.mock.calls.map(([name]) => name)).toEqual([
            "legacy-refresh", "blacklist-rules-changed", "filter-rules-changed", "settings-changed", "car-state-changed",
        ]);
        expect(scope.addCleanup).toHaveBeenCalled();
    });

    it("reports a failed quick-filter refresh through the injected logger without a global logger", async () => {
        vi.stubGlobal("clog", undefined);
        const logger = { error: vi.fn() };
        const list = new ListPageCompatibilityService({ runtimeServices: { logger } });
        const failure = new Error("refresh failed");
        list.requestListRefresh = vi.fn(() => Promise.reject(failure));
        list.reconcileListItems = vi.fn();
        list.recordListPhase = vi.fn();

        list.setQuickFilter("favorite", { syncUi: false });
        await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith("列表筛选刷新失败", failure));
    });
});
