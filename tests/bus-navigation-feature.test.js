// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { BusNavigationController } from "../src/features/identity/bus-navigation-controller.js";

describe("JavBus navigation Feature", () => {
    it("adds the legacy image-search button and removes its listener with the owner scope", () => {
        document.body.innerHTML = '<div id="navbar"><div><div><span></span></div></div></div>';
        const openImageSearch = vi.fn();
        const scope = new LifecycleScope("identity.javbus-navigation");
        const controller = new BusNavigationController({ document, openImageSearch });

        expect(controller.start(scope)).toBe(true);
        const button = document.querySelector("#search-img-btn");
        expect(button?.textContent).toBe("识图");
        expect(button?.className).toBe("jhs-btn btn btn-default jhs-layout-638cb2c9");
        button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(openImageSearch).toHaveBeenCalledOnce();

        scope.dispose();
        expect(document.querySelector("#search-img-btn")).toBeNull();
        button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(openImageSearch).toHaveBeenCalledOnce();
        controller.dispose();
    });

    it("does not render the entry when the optional image-search capability is disabled", () => {
        document.body.innerHTML = '<div id="navbar"><div><div><span></span></div></div></div>';
        const controller = new BusNavigationController({ document, openImageSearch: null });
        expect(controller.start(new LifecycleScope("identity.javbus-navigation"))).toBe(false);
        expect(document.querySelector("#search-img-btn")).toBeNull();
        controller.dispose();
    });

    it("keeps the route usable when the JavBus navigation slot is absent", () => {
        document.body.replaceChildren();
        const controller = new BusNavigationController({ document, openImageSearch: vi.fn() });
        expect(controller.start(new LifecycleScope("identity.javbus-navigation"))).toBe(false);
        controller.dispose();
    });
});
