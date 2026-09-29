import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { CompatibilityController } from "../src/features/compatibility/compatibility-controller.js";

function createHarness({ html, route = "detail", url = "https://javdb.com/v/fixture", carNum = "ABC-1", favorites = [], blacklist = [] }) {
    const dom = new JSDOM(html, { url });
    dom.window.requestIdleCallback = vi.fn(() => 5);
    dom.window.cancelIdleCallback = vi.fn();
    let confirmAction = null;
    let confirmRender = null;
    const style = { register: vi.fn(() => vi.fn()) };
    const notifications = { ok: vi.fn(), error: vi.fn() };
    const ui = {
        confirm: vi.fn((_event, message, accept) => {
            confirmAction = accept;
            const surface = dom.window.document.createElement("div");
            surface.innerHTML = String(message);
            confirmRender = { html: String(message), imageCount: surface.querySelectorAll("img").length, visibleText: surface.textContent };
        }),
        openImageViewer: vi.fn(),
    };
    const state = {
        getFavoriteActressList: vi.fn(async () => favorites),
        getBlacklist: vi.fn(async () => blacklist),
        getState: vi.fn(async (key) => key === carNum ? { carNum } : null),
        remove: vi.fn(async () => ({ changed: [carNum] })),
    };
    const host = {
        readMovieRef: () => ({ carNum }),
        locateListItems: () => [...dom.window.document.querySelectorAll(".movie-list > .item")],
    };
    const scope = new LifecycleScope("compatibility-controller-test");
    const diagnostics = { recordError: vi.fn() };
    const controller = new CompatibilityController({
        document: dom.window.document, window: dom.window, location: dom.window.location,
        site: "javdb", route, host, style, state, notifications, ui, scope, diagnostics,
    });
    return { dom, controller, state, style, notifications, ui, scope, diagnostics, confirmAction: () => confirmAction, confirmRender: () => confirmRender };
}

describe("CompatibilityController", () => {
    it("keeps actress badges current, links only safe numbered comment text, and removes all owned UI", async () => {
        const harness = createHarness({
            html: '<div class="actor-section-name">演员</div><div class="actor-box"><a href="/actors/a">演员 A</a></div><div class="toolbar"><a href="/actors/a?sort=score">筛选</a></div><div class="movie-list"><div class="item" data-hide="yes" style="display:none"><div class="video-title"><strong>ABC-1</strong></div></div></div><div class="jhs-detail-btn-row"></div><div class="preview-images"><img id="image-1"><img id="image-2"></div><div class="review-content">请看图1和图片2，再看图9。<code>图1</code><a href="#">图2</a></div>',
            url: "https://javdb.com/actors/a",
            favorites: [{ starId: "a" }], blacklist: [{ starId: "a" }],
        });
        const { document } = harness.dom.window;
        harness.controller.start();
        expect(harness.state.getFavoriteActressList).not.toHaveBeenCalled();
        await harness.controller.initializePage();

        expect(document.querySelectorAll(".actor-section-name .jhs-badge--fav")).toHaveLength(1);
        expect(document.querySelectorAll(".actor-section-name .jhs-badge--danger")).toHaveLength(1);
        expect(document.querySelector(".toolbar").textContent).toBe("筛选");
        expect(document.querySelectorAll(".review-content .jhs-comment-image-link")).toHaveLength(2);
        expect(document.querySelector(".review-content").textContent).toContain("图9");
        expect(document.querySelector(".review-content code").textContent).toBe("图1");
        expect(document.querySelector('.review-content > a[href="#"]:not(.jhs-comment-image-link)').textContent).toBe("图2");
        document.querySelector(".jhs-comment-image-link").dispatchEvent(new harness.dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(harness.ui.openImageViewer).toHaveBeenCalledWith(document.querySelector("#image-1"));

        document.querySelector(".jhs-remove-car").click();
        expect(harness.ui.confirm).toHaveBeenCalledOnce();
        await harness.confirmAction()();
        await vi.waitFor(() => expect(harness.notifications.ok).toHaveBeenCalledWith("鉴定记录已移除"));
        const card = document.querySelector(".movie-list > .item");
        expect(card.hasAttribute("data-hide")).toBe(false);
        expect(card.style.display).toBe("");
        expect(harness.state.remove).toHaveBeenCalledWith("ABC-1");

        harness.scope.dispose();
        expect(document.querySelectorAll(".jhs-actress-state-container")).toHaveLength(0);
        expect(document.querySelectorAll(".jhs-comment-image-link")).toHaveLength(0);
        expect(document.querySelector(".review-content").textContent).toContain("请看图1和图片2");
        expect(document.querySelector(".jhs-remove-car")).toBeNull();
        expect(harness.dom.window.cancelIdleCallback).toHaveBeenCalledWith(5);
    });

    it("uses the host page identity and reports a failed removal without dropping the action", async () => {
        const harness = createHarness({ html: '<div class="jhs-detail-btn-row"></div>' });
        harness.state.remove.mockRejectedValueOnce(new Error("storage failed"));
        harness.controller.start();
        await harness.controller.addRemoveRecord();
        const button = harness.dom.window.document.querySelector(".jhs-remove-car");
        await harness.controller.removeRecord("ABC-1", button);
        expect(harness.notifications.error).toHaveBeenCalledWith("移除鉴定记录失败");
        expect(button.isConnected).toBe(true);
        expect(harness.diagnostics.recordError).toHaveBeenCalledWith(expect.objectContaining({ contributionId: "compatibility.enhancements" }));
    });

    it("escapes the removed record ID before it reaches the HTML interpreting confirmation layer", async () => {
        const carNum = 'ABC-<img src=x onerror="alert(1)">';
        const harness = createHarness({ html: '<div class="jhs-detail-btn-row"></div>', carNum });
        harness.controller.start();
        await harness.controller.addRemoveRecord();
        harness.dom.window.document.querySelector(".jhs-remove-car").click();
        expect(harness.confirmRender().html).toContain('&lt;img src=x onerror="alert(1)"&gt;');
        expect(harness.confirmRender().imageCount).toBe(0);
        expect(harness.confirmRender().visibleText).toContain(carNum);
        harness.scope.dispose();
    });
});
