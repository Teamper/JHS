import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListEventController } from "../src/features/list/list-event-controller.js";

describe("ListEventController", () => {
    it("owns settings and event-bus subscriptions while refreshing through feature state", async () => {
        const scope = new LifecycleScope("feature:list"), settings = new EventTarget(), handlers = new Map(), eventBus = { on: vi.fn((type, handler) => { handlers.set(type, handler); return () => handlers.delete(type); }) }, state = { advanceListGeneration: vi.fn(() => "2:0"), captureListRevision: vi.fn(() => "2:0"), reconcileListItems: vi.fn() }, index = { getIndexedItems: vi.fn(() => ["card"]) }, legacyPlugin = { filterContext: {}, doFilter: vi.fn(async () => {}), doFilterItems: vi.fn(async () => {}) }, filter = { doFilter: vi.fn(async () => {}), doFilterItems: vi.fn(async () => {}) }, storage = { car_list_key: "car-list", _invalidateCache: vi.fn() }, evaluation = { invalidate: vi.fn() }, onHoverSettingChanged = vi.fn(), onReloadHistory = vi.fn(async () => {}), controller = new ListEventController({ scope, settings, eventBus, state, index, legacyPlugin, filter, storage, evaluation, onHoverSettingChanged, onReloadHistory });

        controller.start();
        settings.dispatchEvent(Object.assign(new Event("settings.changed"), { detail: { names: ["hoverBigImg"] } }));
        await handlers.get("legacy-refresh")({ changedNames: ["defaultQuickFilterTab"] });
        await handlers.get("car-state-changed")({ carNums: ["ABC-123"] });

        expect(onHoverSettingChanged).toHaveBeenCalledOnce();
        expect(filter.doFilter).toHaveBeenCalledWith("2:0");
        expect(filter.doFilterItems).toHaveBeenCalledWith(["card"], "2:0");
        expect(legacyPlugin.doFilter).not.toHaveBeenCalled();
        expect(legacyPlugin.doFilterItems).not.toHaveBeenCalled();
        expect(legacyPlugin.filterContext).toEqual({});
        expect(storage._invalidateCache).toHaveBeenCalledTimes(2);
        expect(evaluation.invalidate).toHaveBeenCalledTimes(2);
        expect(state.reconcileListItems).toHaveBeenCalledTimes(2);
        expect(onReloadHistory).toHaveBeenCalledTimes(2);
        controller.dispose();
        expect(scope.snapshot().listeners).toBe(0);
        expect(eventBus.on).toHaveBeenCalledTimes(5);
        scope.dispose();
    });

    it("ignores non-list setting changes", async () => {
        const scope = new LifecycleScope("feature:list"), eventBus = { on: vi.fn(() => () => {}) }, legacyPlugin = { filterContext: {}, doFilter: vi.fn() }, controller = new ListEventController({ scope, settings: new EventTarget(), eventBus, state: { advanceListGeneration: vi.fn() }, index: {}, legacyPlugin });

        controller.start();
        await controller.refreshAll({ changedNames: ["theme"] });

        expect(legacyPlugin.doFilter).not.toHaveBeenCalled();
        scope.dispose();
    });

    it("invalidates the legacy filter cache only when the feature filter is absent", async () => {
        const scope = new LifecycleScope("feature:list"), legacyPlugin = { filterContext: { cached: true }, doFilter: vi.fn(async () => {}) }, state = { advanceListGeneration: vi.fn(() => "1:0"), captureListRevision: vi.fn(() => "1:0"), reconcileListItems: vi.fn() }, controller = new ListEventController({ scope, state, legacyPlugin });

        await controller.refreshAll({ changedNames: ["defaultQuickFilterTab"] });

        expect(legacyPlugin.filterContext).toBeNull();
        expect(legacyPlugin.doFilter).toHaveBeenCalledWith("1:0");
        scope.dispose();
    });
});
