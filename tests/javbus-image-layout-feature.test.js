// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { JavBusImageLayoutController } from "../src/features/list/javbus-image-layout-controller.js";
import { BusImageLayoutService } from "../src/services/bus-image-layout-service.js";

function imageItem(height, { hidden = false, inlineHeight = "" } = {}) {
    const item = document.createElement("div");
    item.className = "item";
    if (hidden) item.style.display = "none";
    Object.defineProperty(item, "offsetWidth", { configurable: true, get: () => hidden ? 0 : 120 });
    Object.defineProperty(item, "offsetHeight", { configurable: true, get: () => hidden ? 0 : 200 });
    const image = document.createElement("img");
    if (inlineHeight) image.style.setProperty("height", inlineHeight, "important");
    Object.defineProperty(image, "offsetHeight", { configurable: true, get: () => height });
    item.append(image);
    document.body.append(item);
    return { item, image };
}

function createController(settings = { enableVerticalModel: "no", containerColumns: 3 }) {
    return new JavBusImageLayoutController({
        hostAdapter: { getListSelectors: () => ({ itemSelector: ".item" }) },
        settings: { snapshot: () => settings }, document,
    });
}

describe("List Feature JavBus image layout", () => {
    it("normalizes only rows whose visible image heights differ by more than 50px", async () => {
        document.body.replaceChildren();
        const first = imageItem(100), hidden = imageItem(80, { hidden: true }), second = imageItem(230), third = imageItem(150), fourth = imageItem(210);
        const controller = createController();

        await controller.logImageHeightsByRow();

        expect(first.image.style.getPropertyValue("height")).toBe("");
        expect(second.image.style.getPropertyValue("height")).toBe("100px");
        expect(second.image.style.getPropertyPriority("height")).toBe("important");
        expect(third.image.style.getPropertyValue("height")).toBe("100px");
        expect(fourth.image.style.getPropertyValue("height")).toBe("");
        expect(hidden.image.style.getPropertyValue("height")).toBe("");
        controller.dispose();
    });

    it("restores previous inline heights on disposal and preserves later external changes", async () => {
        document.body.replaceChildren();
        const first = imageItem(220, { inlineHeight: "77px" }), second = imageItem(100), third = imageItem(160);
        const controller = createController();
        await controller.logImageHeightsByRow();
        expect(first.image.style.getPropertyValue("height")).toBe("100px");
        second.image.style.setProperty("height", "31px");

        controller.dispose();
        controller.dispose();

        expect(first.image.style.getPropertyValue("height")).toBe("77px");
        expect(first.image.style.getPropertyPriority("height")).toBe("important");
        expect(second.image.style.getPropertyValue("height")).toBe("31px");
        expect(third.image.style.getPropertyValue("height")).toBe("");
        await expect(controller.logImageHeightsByRow()).resolves.toBeUndefined();
    });

    it("leaves row images to the vertical cover mode when that setting is active", async () => {
        document.body.replaceChildren();
        const first = imageItem(100), second = imageItem(240);
        const controller = createController({ enableVerticalModel: "yes", containerColumns: 2 });

        await controller.logImageHeightsByRow();

        expect(first.image.style.getPropertyValue("height")).toBe("");
        expect(second.image.style.getPropertyValue("height")).toBe("");
        controller.dispose();
    });

    it("attaches one feature controller and makes detach idempotent", async () => {
        const service = new BusImageLayoutService();
        const controller = { logImageHeightsByRow: vi.fn(async () => {}), dispose: vi.fn() };
        await expect(service.logImageHeightsByRow()).resolves.toBeUndefined();
        const detach = service.attach(controller);
        expect(() => service.attach({ logImageHeightsByRow: async () => {} })).toThrow(/already has an active controller/);
        await service.logImageHeightsByRow({ columns: 4 });
        expect(controller.logImageHeightsByRow).toHaveBeenCalledWith({ columns: 4 });

        detach();
        detach();
        await service.logImageHeightsByRow();
        expect(controller.dispose).toHaveBeenCalledOnce();
        expect(controller.logImageHeightsByRow).toHaveBeenCalledOnce();
    });
});
