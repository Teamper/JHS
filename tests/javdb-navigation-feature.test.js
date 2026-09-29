// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { JavDbNavigationController } from "../src/features/identity/javdb-navigation-controller.js";

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
});

function createController({ href = "https://javdb.com/search?q=ABC-123&f=code", searchImage = {}, feedback = true } = {}) {
    document.body.innerHTML = `
      <nav id="navbar-menu-hero"></nav>
      <div class="navbar-menu"><a class="navbar-link" href="/makers">片商</a>${feedback ? '<a id="old-feedback" href="/feedbacks/new">旧反馈</a>' : ""}<a id="porn-link" href="https://theporndude.com">站外</a></div>
      <div id="search-bar-container" style="display:none"></div>
      <a class="search-image" id="button-search-image"><span>原生识图</span></a>
      <div class="video-title"><strong>ABC-123</strong></div>
      <div class="actor-box"><strong>演员甲</strong></div>`;
    const $ = jquery;
    vi.stubGlobal("$", $);
    vi.stubGlobal("jQuery", $);
    const navigation = { assign: vi.fn(), open: vi.fn() };
    const movie = { externalNavigationLinks: vi.fn(() => [{ url: "https://catalog.example/path", label: "<外部目录>" }]) };
    const notifications = { info: vi.fn() };
    const location = new URL(href);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1701 });
    const controller = new JavDbNavigationController({ document, location, movie, navigation, searchImage, notifications, jquery: $ });
    const scope = new LifecycleScope("identity.javdb-navigation");
    return { controller, scope, navigation, movie, notifications, location, searchImage };
}

describe("JavDB navigation Feature", () => {
    it("preserves search state, safe external links, and responsive host-search handoff", () => {
        const loaded = createController();
        loaded.controller.start(loaded.scope);

        expect(document.querySelector("#search-keyword")?.value).toBe("ABC-123");
        expect(document.querySelector("#search-type")?.value).toBe("code");
        expect(document.querySelector('#search-box a[title="高级检索"]')?.getAttribute("href")).toBe("/search_advanced?noFold=1");
        expect(document.querySelector(".video-title strong")?.classList.contains("highlight-red")).toBe(true);
        expect(document.querySelector(".actor-box strong")?.classList.contains("highlight-red")).toBe(false);
        expect(document.querySelector("#old-feedback")).toBeNull();
        expect(document.querySelector("#porn-link")).toBeNull();
        expect(document.querySelector(".navbar-item.has-dropdown .navbar-item")?.textContent).toBe("反饋");
        const external = document.querySelector('.navbar-item.has-dropdown a[href="https://catalog.example/path"]');
        expect(external?.textContent).toBe("<外部目录>");
        expect(external?.rel).toBe("nofollow noopener");

        document.querySelector("#search-keyword").value = "A&B/# +";
        document.querySelector("#search-type").value = "actor";
        document.querySelector("#search-type").dispatchEvent(new Event("change", { bubbles: true }));
        document.querySelector("#search-btn").click();
        expect(loaded.navigation.assign).toHaveBeenCalledWith("/search?q=A%26B%2F%23%20%2B&f=actor");

        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1599 });
        window.dispatchEvent(new Event("resize"));
        expect(document.querySelector("#search-box").style.display).toBe("none");
        expect(document.querySelector("#search-bar-container").style.display).not.toBe("none");
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1601 });
        window.dispatchEvent(new Event("resize"));
        expect(document.querySelector("#search-box").style.display).not.toBe("none");
        expect(document.querySelector("#search-bar-container").style.display).toBe("none");

        loaded.scope.dispose();
        expect(document.querySelector("#search-box")).toBeNull();
        expect(document.querySelector(".navbar-item.has-dropdown")).toBeNull();
        expect(document.querySelector("#old-feedback")?.textContent).toBe("旧反馈");
        expect(document.querySelector("#porn-link")).not.toBeNull();
        expect(document.querySelector(".video-title strong")?.classList.contains("highlight-red")).toBe(false);
        expect(document.querySelector("#search-bar-container").getAttribute("style")).toBe("display:none");
    });

    it("uses injected navigation for a new-tab search away from search results", () => {
        const loaded = createController({ href: "https://javdb.com/" });
        loaded.controller.start(loaded.scope);
        document.querySelector("#search-keyword").value = "movie 01";
        document.querySelector("#search-type").value = "maker";
        document.querySelector("#search-btn").click();
        expect(loaded.navigation.open).toHaveBeenCalledWith("/search?q=movie%2001&f=maker", { newTab: true });
        loaded.scope.dispose();
    });

    it("connects old and new image-search entries and restores the host handler on cleanup", () => {
        const hostHandler = vi.fn();
        const imageFile = new Blob(["image"], { type: "image/png" });
        const searchImage = { open: vi.fn() };
        const loaded = createController({ searchImage });
        const hostLink = document.querySelector(".search-image");
        hostLink.addEventListener("click", (event) => { event.preventDefault(); hostHandler(event); });
        loaded.controller.start(loaded.scope);

        document.querySelector("#search-img-btn").click();
        expect(searchImage.open).toHaveBeenCalledTimes(1);
        document.querySelector(".search-image").click();
        expect(searchImage.open).toHaveBeenCalledTimes(2);
        expect(hostHandler).not.toHaveBeenCalled();

        const paste = new Event("paste", { bubbles: true, cancelable: true });
        Object.defineProperty(paste, "clipboardData", { value: { items: [{ type: "image/png", getAsFile: () => imageFile }] } });
        document.querySelector("#search-keyword").dispatchEvent(paste);
        expect(paste.defaultPrevented).toBe(false);
        expect(searchImage.open).toHaveBeenCalledWith({ file: imageFile });

        loaded.scope.dispose();
        expect(document.querySelector("#search-img-btn")).toBeNull();
        expect(document.querySelector(".search-image")).toBe(hostLink);
        hostLink.click();
        expect(hostHandler).toHaveBeenCalledOnce();
    });

    it("keeps text search and reports a disabled image-search capability on paste", () => {
        const loaded = createController({ searchImage: null });
        loaded.controller.start(loaded.scope);
        expect(document.querySelector("#search-img-btn")).toBeNull();
        const paste = new Event("paste", { bubbles: true, cancelable: true });
        Object.defineProperty(paste, "clipboardData", { value: { items: [{ type: "image/png", getAsFile: () => new Blob(["x"]) }] } });
        document.querySelector("#search-keyword").dispatchEvent(paste);
        expect(loaded.notifications.info).toHaveBeenCalledWith("以图识图功能已禁用");
        loaded.scope.dispose();
    });
});
