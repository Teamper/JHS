// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { CoverButtonController } from "../src/features/list/cover-button-controller.js";

function createSettings(initial) {
    let values = { ...initial };
    const listeners = new Set();
    return {
        snapshot: () => ({ ...values }),
        addEventListener: (_name, handler) => listeners.add(handler),
        removeEventListener: (_name, handler) => listeners.delete(handler),
        listeners,
        update: (patch) => {
            values = { ...values, ...patch };
            for (const handler of listeners) handler({ detail: { names: Object.keys(patch) } });
        },
    };
}

function createController({ screenshotAvailable = true, settings: settingValues = {} } = {}) {
    const win = /** @type {any} */ (window);
    const doc = window.document;
    doc.body.innerHTML = `<div class="movie-list"><div class="item"><a href="/v/abc-123"><img class="cover-image" src="https://images.example.test/cover.jpg"><div class="video-title"><strong>ABC-123</strong> Test title</div><div class="meta">2026-08-25</div></a><div class="tags"></div></div></div>`;
    const $ = jqueryFactory;
    const settings = createSettings({ enableScreenSvg: "yes", enableVideoSvg: "yes", enablePreviewVideo: "no", enableLoadPreviewVideo: "yes", enableHandleSvg: "yes", enableSiteSvg: "yes", enableCopySvg: "yes", ...settingValues });
    const state = { patch: vi.fn(async () => {}) };
    const ui = {
        jquery: $,
        confirm: vi.fn(),
        loading: () => ({ close: vi.fn() }),
        openImageViewer: vi.fn(),
    };
    const notifications = { error: vi.fn(), ok: vi.fn() };
    const diagnostics = { recordError: vi.fn() };
    const navigation = { open: vi.fn() };
    const list = {
        getSelector: () => ({ itemSelector: ".movie-list .item" }),
        findCarNumAndHref: (item) => {
            const card = item?.jquery ? item : $(item);
            return { carNum: card.find(".video-title strong").text(), title: card.find(".video-title").text(), url: card.find("a").attr("href"), publishTime: card.find(".meta").text(), fc2Source: null };
        },
        parseActressName: vi.fn(async () => "测试演员"),
    };
    const scope = new LifecycleScope("cover-button-test");
    const controller = new CoverButtonController({
        document: doc, window: win, list, settings, state,
        screenshot: { resolve: vi.fn(async () => ({ url: "https://images.example.test/screenshot.jpg" })) },
        storage: {}, movie: { externalSiteOrigin: (key) => `https://${key}.example.test`, providerOrigin: () => "https://123av.example.test" },
        scope, ui, clipboard: { copyText: vi.fn(async () => true) }, notifications, diagnostics, navigation,
        screenshotAvailable, isJavBus: false,
    });
    return { window: win, document: doc, $, settings, state, ui, notifications, diagnostics, navigation, list, scope, controller };
}

describe("native list card actions Feature", () => {
    let current;
    afterEach(() => {
        current?.scope.dispose();
        if (current) current.document.body.innerHTML = "";
        current = null;
    });

    it("gates screenshot and DMM controls while applying card settings live", async () => {
        current = createController({ screenshotAvailable: false });
        await current.controller.start();
        const card = current.document.querySelector(".item");
        const display = (selector) => card.querySelector(selector).style.display;
        expect(card.querySelectorAll(".jhs-cover-tools")).toHaveLength(1);
        expect(display(".screenSvg")).toBe("none");
        expect(display(".videoSvg")).toBe("none");
        expect(display(".handleSvg")).not.toBe("none");

        current.settings.update({ enableHandleSvg: "no", enablePreviewVideo: "yes" });
        expect(display(".handleSvg")).toBe("none");
        expect(display(".videoSvg")).not.toBe("none");
        current.settings.update({ enablePreviewVideo: "no", enableHandleSvg: "yes" });
        expect(display(".videoSvg")).toBe("none");
        expect(display(".handleSvg")).not.toBe("none");
    });

    it("applies the list long-screenshot switch live", async () => {
        current = createController({ screenshotAvailable: true, settings: { enableScreenSvg: "yes" } });
        await current.controller.start();
        const card = current.document.querySelector(".item");
        const display = () => card.querySelector(".screenSvg").style.display;
        expect(display()).not.toBe("none");

        current.settings.update({ enableScreenSvg: "no" });
        expect(display()).toBe("none");
        current.settings.update({ enableScreenSvg: "yes" });
        expect(display()).not.toBe("none");
    });

    it("opens the screenshot viewer when the enabled card action is clicked", async () => {
        current = createController({ screenshotAvailable: true });
        await current.controller.start();

        current.document.querySelector(".screenSvg").click();

        await vi.waitFor(() => expect(current.controller.screenshot.resolve).toHaveBeenCalledWith(
            { carNum: "ABC-123" },
            expect.objectContaining({ allowWhenDisabled: true, scope: current.scope }),
        ));
        expect(current.ui.openImageViewer).toHaveBeenCalledOnce();
        expect(current.ui.openImageViewer.mock.calls[0][0].src).toBe("https://images.example.test/screenshot.jpg");
    });

    it("applies third-party and copy card switches live", async () => {
        current = createController();
        await current.controller.start();
        const card = current.document.querySelector(".item");
        const display = (selector) => card.querySelector(selector).style.display;
        expect(display(".siteSvg")).not.toBe("none");
        expect(display(".copySvg")).not.toBe("none");

        current.settings.update({ enableSiteSvg: "no", enableCopySvg: "no" });
        expect(display(".siteSvg")).toBe("none");
        expect(display(".copySvg")).toBe("none");

        current.settings.update({ enableSiteSvg: "yes", enableCopySvg: "yes" });
        expect(display(".siteSvg")).not.toBe("none");
        expect(display(".copySvg")).not.toBe("none");
    });

    it("applies the DMM-only video button switch live when preview is available", async () => {
        current = createController({ settings: { enableVideoSvg: "yes", enablePreviewVideo: "yes", enableLoadPreviewVideo: "yes" } });
        await current.controller.start();
        const card = current.document.querySelector(".item");
        const display = () => card.querySelector(".videoSvg").style.display;
        expect(display()).not.toBe("none");

        current.settings.update({ enableVideoSvg: "no" });
        expect(display()).toBe("none");
        current.settings.update({ enableVideoSvg: "yes" });
        expect(display()).not.toBe("none");

        current.settings.update({ enablePreviewVideo: "no" });
        expect(display()).toBe("none");
        current.settings.update({ enablePreviewVideo: "yes", enableLoadPreviewVideo: "no" });
        expect(display()).toBe("none");
        current.settings.update({ enableLoadPreviewVideo: "yes" });
        expect(display()).not.toBe("none");
    });

    it("records the existing list-card state operation with the parsed page identity", async () => {
        current = createController();
        await current.controller.start();
        current.document.querySelector(".favoriteBtn").click();
        await vi.waitFor(() => expect(current.state.patch).toHaveBeenCalledOnce());
        expect(current.state.patch).toHaveBeenCalledWith("ABC-123", { favorite: true }, {
            type: "list-card-state",
            record: { carNum: "ABC-123", url: "/v/abc-123", names: "测试演员", publishTime: "2026-08-25", fc2Source: null },
        });
        expect(current.notifications.ok).toHaveBeenCalledWith("操作成功");
    });

    it("escapes card numbers before the confirmation reaches an HTML renderer", async () => {
        current = createController();
        await current.controller.start();
        const untrusted = 'ABC-123<img id="jhs-cover-xss" src=x onerror="window.__jhsXss=true">';
        current.document.querySelector(".video-title strong").textContent = untrusted;
        current.document.querySelector(".filterBtn").click();

        const message = current.ui.confirm.mock.calls[0][1];
        const rendered = current.document.createElement("div");
        rendered.innerHTML = message;
        expect(rendered.querySelector("#jhs-cover-xss")).toBeNull();
        expect(rendered.textContent).toContain(untrusted);
    });

    it("keeps keyboard menu behavior and modifier-click background navigation", async () => {
        current = createController();
        await current.controller.start();
        const trigger = current.document.querySelector(".handleSvg .jhs-card-menu-trigger");
        trigger.click();
        expect(trigger.getAttribute("aria-expanded")).toBe("true");
        const first = current.document.querySelector(".jhs-card-menu [role='menuitem']");
        first.dispatchEvent(new current.window.KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
        expect(current.document.activeElement.textContent).toContain("屏蔽");

        const siteLink = current.document.querySelector(".site-jable");
        siteLink.dispatchEvent(new current.window.MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
        expect(current.navigation.open).toHaveBeenCalledWith("https://jableBtn.example.test/search/ABC-123/", { newTab: true, background: true });
    });

    it("removes delegated handlers, listeners, and transient players when its scope closes", async () => {
        current = createController();
        await current.controller.start();
        expect(current.settings.listeners.size).toBe(1);
        current.scope.dispose();
        expect(current.settings.listeners.size).toBe(0);
        expect(current.document.querySelectorAll(".jhs-card-menu.is-open, .loading-spinner, [id$='_preview_video']")).toHaveLength(0);
    });
});
