// @vitest-environment jsdom

import jquery from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { IdentityNavigationController } from "../src/features/identity/identity-navigation-controller.js";

const $ = jquery;

describe("IdentityNavigationController", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.replaceChildren();
    });

    it("mounts the JavDB search surface through the feature scope", async () => {
        document.body.innerHTML = '<div id="navbar-menu-hero"></div><div id="search-bar-container"></div><div><a class="navbar-link" href="/makers">片商</a></div><div class="search-image"><button id="button-search-image" type="button">旧识图</button></div>';
        vi.stubGlobal("$", $);
        const scope = new LifecycleScope("feature:identity"), openSearchByImage = vi.fn();
        const styles = { register: vi.fn(() => () => {}) };
        const controller = new IdentityNavigationController({
            hostAdapter: { site: "javdb", document, location: window.location },
            movie: { externalNavigationLinks: () => [{ url: "https://example.test", label: "外部站点" }] }, styles, scope,
        });

        await controller.start({ identityApi: { hasSearchByImage: true, openSearchByImage } });

        expect(styles.register).toHaveBeenCalledWith("identity-navigation", expect.stringContaining(".highlight-red"));
        expect(document.querySelector("#search-box")).not.toBeNull();
        expect(document.querySelector("#search-img-btn")).not.toBeNull();
        expect(document.querySelector(".jhs-identity-other-nav")).not.toBeNull();
        $("#search-img-btn").trigger("click");
        expect(openSearchByImage).toHaveBeenCalledOnce();
        scope.dispose();
        expect(document.querySelector("#search-box")).toBeNull();
        expect(document.querySelector(".jhs-identity-other-nav")).toBeNull();
    });

    it("leaves the host untouched on JavBus", async () => {
        vi.stubGlobal("$", $);
        const scope = new LifecycleScope("feature:identity"), styles = { register: vi.fn() };
        const controller = new IdentityNavigationController({ hostAdapter: { site: "javbus", document, location: window.location }, styles, scope });

        await controller.start({ identityApi: { hasSearchByImage: true } });

        expect(styles.register).not.toHaveBeenCalled();
        expect(controller.started).toBe(false);
        scope.dispose();
    });
});
