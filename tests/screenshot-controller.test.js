import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ScreenshotController } from "../src/features/detail/screenshot-controller.js";
import { normalizeJavStoreAssetUrl } from "../src/integrations/javstore/parser.js";

function createHarness({ site = "javdb", route = "detail", resolve = vi.fn(async () => null), carNum = "ABC-123" } = {}) {
    const dom = new JSDOM("", { url: "https://javdb.com/v/test-id" });
    const gallery = dom.window.document.createElement("div");
    gallery.className = site === "javbus" ? "row" : "preview-images";
    const firstTile = dom.window.document.createElement("a");
    firstTile.className = site === "javbus" ? "sample-box" : "tile-item";
    gallery.append(firstTile);
    dom.window.document.body.append(gallery);
    const settings = dom.window.document.createElement("div");
    let settingSnapshot = { enableLoadScreenShot: "yes" };
    settings.snapshot = () => settingSnapshot;
    const screenshot = {
        isEnabled: (snapshot) => snapshot.enableLoadScreenShot !== "no",
        normalizeAssetUrl: normalizeJavStoreAssetUrl,
        resolve,
        getSearchUrl: () => "https://javstore.net/search/ABC-123",
    };
    const scope = new LifecycleScope("detail-test");
    const styles = { register: vi.fn(() => vi.fn()) };
    const ui = { openImageViewer: vi.fn() };
    const controller = new ScreenshotController({
        document: dom.window.document,
        window: dom.window,
        hostAdapter: { site, readMovieRef: () => ({ carNum }), locateNativeGallery: () => gallery },
        route, settings, screenshot, styles, ui, diagnostics: { recordError: vi.fn() }, scope,
    });
    return {
        dom, gallery, firstTile, settings, screenshot, scope, styles, ui, controller,
        setScreenshotEnabled(enabled) {
            settingSnapshot = { enableLoadScreenShot: enabled ? "yes" : "no" };
            settings.dispatchEvent(new dom.window.CustomEvent("settings.changed", { detail: { names: ["enableLoadScreenShot"] } }));
        },
    };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ScreenshotController", () => {
    it("mounts the native JavDB tile and opens the image viewer through the injected UI", async () => {
        const { dom, firstTile, controller, ui } = createHarness({ resolve: vi.fn(async () => [{ url: "https://img.javstore.net/preview.jpg" }]) });
        expect(controller.start()).toBe(true);
        await tick();
        const tile = dom.window.document.querySelector(".screen-container");
        expect(tile?.nextElementSibling).toBe(firstTile);
        expect(tile?.querySelector("img")?.src).toBe("https://img.javstore.net/preview.jpg");
        tile.querySelector("img").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(ui.openImageViewer).toHaveBeenCalledWith(tile);
    });

    it("keeps the JavBus screenshot out of the native gallery and opens its own viewer", async () => {
        const { dom, gallery, firstTile, controller, ui } = createHarness({ site: "javbus", resolve: vi.fn(async () => [{ url: "https://img.javstore.net/preview.jpg" }]) });
        firstTile.href = "https://example.com/native-1.jpg";
        const secondTile = dom.window.document.createElement("a");
        secondTile.className = "sample-box";
        secondTile.href = "https://example.com/native-2.jpg";
        gallery.append(secondTile);
        controller.start();
        await tick();
        const tile = firstTile.nextElementSibling;
        expect(tile?.classList.contains("screen-container")).toBe(true);
        expect(tile?.tagName).toBe("DIV");
        expect([...gallery.querySelectorAll("a.sample-box")]).toEqual([firstTile, secondTile]);
        const open = tile.querySelector("button.jhs-screenshot-open");
        expect(open?.type).toBe("button");
        expect(open?.querySelector("img")?.title).toBe("缩略图");
        open.click();
        expect(ui.openImageViewer).toHaveBeenCalledWith(tile);
    });

    it("keeps JavBus screenshot fallback links independently clickable", async () => {
        const { dom, controller } = createHarness({ site: "javbus" });
        controller.start();
        await tick();
        const tile = dom.window.document.querySelector(".screen-container");
        expect(tile?.tagName).toBe("DIV");
        expect(tile?.querySelector("a.check-link")?.href).toBe("https://javstore.net/search/ABC-123");
        expect(tile?.querySelector("a.retry-link")?.closest("a.sample-box")).toBeNull();
    });

    it("cancels an active request and removes owned UI when the setting turns off", async () => {
        let finishRequest;
        const resolve = vi.fn(() => new Promise((done) => { finishRequest = done; }));
        const harness = createHarness({ resolve });
        harness.controller.start();
        await tick();
        const requestScope = resolve.mock.calls[0][1].scope;
        expect(requestScope.disposed).toBe(false);
        harness.setScreenshotEnabled(false);
        expect(requestScope.disposed).toBe(true);
        expect(harness.dom.window.document.querySelector(".screen-container")).toBeNull();
        finishRequest([{ url: "https://img.javstore.net/late.jpg" }]);
        await tick();
        expect(harness.dom.window.document.querySelector("img[src$='late.jpg']")).toBeNull();
    });

    it("shows a safe fallback and retries without duplicating the tile", async () => {
        const resolve = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce([{ url: "https://img.javstore.net/retry.jpg" }]);
        const { dom, controller } = createHarness({ resolve });
        controller.start();
        await tick();
        const tile = dom.window.document.querySelector(".screen-container");
        expect(tile.textContent).toContain("暂无缩略图结果");
        expect(tile.querySelector(".check-link")?.href).toBe("https://javstore.net/search/ABC-123");
        tile.querySelector(".retry-link").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
        await tick();
        expect(dom.window.document.querySelectorAll(".screen-container")).toHaveLength(1);
        expect(tile.querySelector("img")?.src).toBe("https://img.javstore.net/retry.jpg");
    });

    it("does not mount for an ineligible route and disposes all listeners/styles", () => {
        const { dom, controller, scope, styles } = createHarness({ route: "owned-detail" });
        expect(controller.start()).toBe(false);
        expect(dom.window.document.querySelector(".screen-container")).toBeNull();
        expect(styles.register).not.toHaveBeenCalled();
        scope.dispose();
        expect(scope.listenerCount).toBe(0);
    });
});
