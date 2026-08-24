import { describe, expect, it, vi } from "vitest";
import { LayerDialogAdapter } from "../src/platform/userscript/layer-dialog-adapter.js";
import { DialogService } from "../src/services/dialog-service.js";

describe("dialog service", () => {
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
        expect(layer.confirm).toHaveBeenCalledWith("confirm", { icon: 3 }, yes);
        expect(layer.alert).toHaveBeenCalledWith("done", undefined);
    });
});
