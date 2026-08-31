import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListStateController } from "../src/features/list/list-state-controller.js";

describe("ListStateController", () => {
    it("commits visibility and UI through one filter generation", () => {
        const scope = new LifecycleScope("feature:list"), view = { applyVisibility: vi.fn(), syncQuickFilterUi: vi.fn() }, controller = new ListStateController({ scope, view });

        controller.setQuickFilter("favorite");

        expect(controller.activeQuickFilter).toBe("favorite");
        expect(controller.filterRevision).toBe(1);
        expect(controller.listGeneration).toBe(1);
        expect(view.applyVisibility).toHaveBeenCalledWith(null, "favorite");
        expect(view.syncQuickFilterUi).toHaveBeenCalledWith("favorite");
        expect(controller.reconcileListItems(null, "0:0")).toBe(false);
        scope.dispose();
    });

    it("rejects stale async results after a newer DOM generation", () => {
        const scope = new LifecycleScope("feature:list"), view = { applyVisibility: vi.fn() }, controller = new ListStateController({ scope, view });
        const oldRevision = controller.advanceListGeneration();
        const currentRevision = controller.advanceListGeneration();

        expect(controller.reconcileListItems([], oldRevision)).toBe(false);
        expect(controller.reconcileListItems([], currentRevision)).toBe(true);
        expect(view.applyVisibility).toHaveBeenCalledOnce();
        scope.dispose();
    });

    it("stops committing after disposal", () => {
        const scope = new LifecycleScope("feature:list"), view = { applyVisibility: vi.fn(), syncQuickFilterUi: vi.fn() }, controller = new ListStateController({ scope, view });
        controller.dispose();

        expect(controller.reconcileListItems([], "0:0")).toBe(false);
        expect(controller.applyVisibility([])).toBeUndefined();
        expect(view.applyVisibility).not.toHaveBeenCalled();
        scope.dispose();
    });

    it("creates the filter bar from the injected settings provider", async () => {
        const scope = new LifecycleScope("feature:list"), view = { createQuickFilter: vi.fn(async () => {}) }, controller = new ListStateController({ scope, view, defaultFilter: () => "all" });

        await controller.createQuickFilter();

        expect(view.createQuickFilter).toHaveBeenCalledWith("all");
        scope.dispose();
    });
});
