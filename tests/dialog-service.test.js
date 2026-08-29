import { describe, expect, it, vi } from "vitest";
import { LayerDialogAdapter } from "../src/platform/userscript/layer-dialog-adapter.js";
import { DialogService } from "../src/services/dialog-service.js";
import { JHS_Z_INDEX } from "../src/core/theme.js";

describe("dialog service", () => {
    it("keeps the image viewer above ordinary Layer dialogs", () => {
        expect(JHS_Z_INDEX.viewer).toBeGreaterThan(JHS_Z_INDEX.layer);
        expect(JHS_Z_INDEX.loading).toBeGreaterThan(JHS_Z_INDEX.viewer);
        expect(JHS_Z_INDEX.debug).toBeGreaterThan(JHS_Z_INDEX.loading);
    });

    it("forwards open, close, confirm and alert through the DialogPort", () => {
        const layer = {
            open: vi.fn(() => 1), close: vi.fn(), confirm: vi.fn(() => 2), alert: vi.fn(() => 3),
        };
        const service = new DialogService(new LayerDialogAdapter(layer)), yes = vi.fn();
        expect(service.open({ title: "dialog" })).toBe(1);
        service.close(1);
        expect(service.confirm("confirm", { icon: 3 }, yes)).toBe(2);
        expect(service.alert("done")).toBe(3);
        expect(layer.close).toHaveBeenCalledWith(1);
        expect(layer.open).toHaveBeenCalledWith({ title: "dialog", zIndex: JHS_Z_INDEX.layer });
        expect(layer.confirm).toHaveBeenCalledWith("confirm", { icon: 3, zIndex: JHS_Z_INDEX.layer }, yes);
        expect(layer.alert).toHaveBeenCalledWith("done", { zIndex: JHS_Z_INDEX.layer });
    });

    it("preserves an explicit caller z-index", () => {
        const layer = { open: vi.fn(() => 1), close: vi.fn(), confirm: vi.fn(), alert: vi.fn() };
        const service = new DialogService(new LayerDialogAdapter(layer));
        service.open({ zIndex: 42 });
        expect(layer.open).toHaveBeenCalledWith({ zIndex: 42 });
    });
});
