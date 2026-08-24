import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { SelectionModel } from "../src/core/selection-model.js";
import { ProfileService } from "../src/services/profile-service.js";
import { createJhsTable } from "../src/ui/table/create-jhs-table.js";

describe("selection, profile and table primitives", () => {
    it("retains all-filtered selection across pages with explicit exclusions", () => {
        const model = new SelectionModel((item) => item.id);
        const items = Array.from({ length: 120 }, (_, index) => ({ id: String(index) }));
        model.selectAllFiltered();
        model.set(items[42], false);
        expect(model.values(items)).toHaveLength(119);
        expect(model.has(items[42])).toBe(false);
    });

    it("recomputes compact/regular/wide from any-pointer and viewport changes", () => {
        const listeners = new Map();
        const media = new EventTarget();
        Object.defineProperty(media, "matches", { value: true, writable: true });
        const windowRuntime = new EventTarget();
        Object.assign(windowRuntime, { innerWidth: 1000, innerHeight: 700, matchMedia: () => media });
        const scope = new LifecycleScope("profile");
        const service = new ProfileService({ windowRuntime, scope });
        service.addEventListener("profile.changed", (event) => listeners.set("last", event.detail));
        service.start();
        expect(service.current()).toBe("regular");
        windowRuntime.innerWidth = 460;
        windowRuntime.dispatchEvent(new Event("resize"));
        expect(service.current()).toBe("compact");
        expect(listeners.get("last")).toMatchObject({ profile: "compact" });
        scope.dispose();
        expect(scope.snapshot().listeners).toBe(0);
    });

    it("normalizes JhsTable page sizes without Tabulator's blank all option", () => {
        const Tabulator = vi.fn(function(target, options) { this.target = target; this.options = options; });
        const table = createJhsTable(Tabulator, "#table", { paginationSizeSelector: [20, 50, true, 1000] });
        expect(table.options.paginationSizeSelector).toEqual([20, 50, 1000]);
    });
});
