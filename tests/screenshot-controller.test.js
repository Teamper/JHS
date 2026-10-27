import { ScreenshotService } from "../src/services/screenshot-service.js";
import jquery from "jquery";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ScreenshotController } from "../src/features/detail/screenshot-controller.js";
import { normalizeJavStoreAssetUrl } from "../src/integrations/javstore/parser.js";

function createHarness({ site = "javdb", route = "detail", resolve = vi.fn(async () => null), carNum = "ABC-123", initialSettings = {} } = {}) {
    const dom = new JSDOM("", { url: "https://javdb.com/v/test-id" });
    vi.stubGlobal("MutationObserver", dom.window.MutationObserver);
    vi.stubGlobal("$", jquery(dom.window));
    vi.stubGlobal("document", dom.window.document);
    const gallery = dom.window.document.createElement("div");
    gallery.className = site === "javbus" ? "row" : "preview-images";
    const firstTile = dom.window.document.createElement("a");
    firstTile.className = site === "javbus" ? "sample-box" : "tile-item";
    gallery.append(firstTile);
    dom.window.document.body.append(gallery);
    const settings = dom.window.document.createElement("div");
    let settingSnapshot = { enableLoadScreenShot: "yes", ...initialSettings };
    settings.snapshot = () => settingSnapshot;
    const screenshot = Object.assign(new ScreenshotService({}), {
        isEnabled: (snapshot) => snapshot.enableLoadScreenShot !== "no",
        normalizeAssetUrl: normalizeJavStoreAssetUrl,
        resolve,
        getSearchUrl: () => "https://javstore.net/search/ABC-123",
    });
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
        patchSettings(values) {
            settingSnapshot = { ...settingSnapshot, ...values };
            settings.dispatchEvent(new dom.window.CustomEvent("settings.changed", { detail: { names: Object.keys(values) } }));
        },
        setScreenshotEnabled(enabled) {
            settingSnapshot = { enableLoadScreenShot: enabled ? "yes" : "no" };
            settings.dispatchEvent(new dom.window.CustomEvent("settings.changed", { detail: { names: ["enableLoadScreenShot"] } }));
        },
    };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
afterEach(() => vi.unstubAllGlobals());

describe("ScreenshotController", () => {
    it("ignores errors from replaced images and offers retry for the current image", () => {
        const {dom,controller,gallery,scope} = createHarness();
        const container=dom.window.document.createElement('a');gallery.append(container);
        controller.renderImage(container,'缩略图','https://img.javstore.net/old.jpg');
        const old=container.querySelector('img');
        controller.renderImage(container,'缩略图','https://img.javstore.net/current.jpg');
        old.dispatchEvent(new dom.window.Event('error'));
        expect(container.querySelector('img').src).toContain('current.jpg');
        container.querySelector('img').dispatchEvent(new dom.window.Event('error'));
        expect(container.querySelector('.retry-link').textContent).toBe('重试');
        expect(container.textContent).toContain('缩略图加载失败');
        scope.dispose();dom.window.close();
    });

    it("mounts the native JavDB tile and opens the image viewer through the injected UI", async () => {
        const { dom, firstTile, controller, ui } = createHarness({ resolve: vi.fn(async () => [{ url: "https://img.javstore.net/preview.jpg" }]) });
        expect(controller.start()).toBe(true);
        await tick();
        const tile = dom.window.document.querySelector(".screen-container");
        expect(tile?.tagName).toBe("DIV");
        expect(tile?.nextElementSibling).toBe(firstTile);
        expect(tile?.querySelector("img")?.src).toBe("https://img.javstore.net/preview.jpg");
        tile.querySelector("img").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(ui.openImageViewer).toHaveBeenCalledWith(tile, { imageKind:"contact-sheet", trigger:tile.querySelector('button'), owner: tile, scope: controller.scope });
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
        expect(ui.openImageViewer).toHaveBeenCalledWith(tile, { imageKind:"contact-sheet", trigger: open, owner: tile, scope: controller.scope });
    });

    it("keeps JavBus screenshot fallback links independently clickable", async () => {
        const { dom, controller } = createHarness({ site: "javbus" });
        controller.start();
        await tick();
        const tile = dom.window.document.querySelector(".screen-container");
        expect(tile?.tagName).toBe("DIV");
        expect(tile?.querySelector("a.check-link")?.href).toBe("https://javstore.net/search/ABC-123");
        expect(tile?.querySelector("button.retry-link")?.type).toBe("button");
        expect(tile?.querySelector(".retry-link")?.hasAttribute("href")).toBe(false);
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
        expect(tile.textContent).toContain("暂无缩略图");
        expect(tile.querySelector(".check-link")?.href).toBe("https://javstore.net/search/ABC-123");
        tile.querySelector(".retry-link").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
        await tick();
        expect(resolve.mock.calls[1][1].refreshCache).toBe(true);
        expect(dom.window.document.querySelectorAll(".screen-container")).toHaveLength(1);
        expect(tile.querySelector("img")?.src).toBe("https://img.javstore.net/retry.jpg");
    });

    it.each(["javdb", "javbus"])("keeps %s retry feedback and focus in place while rejecting repeated clicks", async (site) => {
        let finish;
        const resolve = vi.fn().mockResolvedValueOnce(null).mockImplementationOnce(() => new Promise(done => { finish = done; })).mockRejectedValueOnce(new Error("offline"));
        const {dom,controller,scope} = createHarness({site,resolve});
        controller.start(); await tick();
        const tile = dom.window.document.querySelector(".screen-container"), retry = tile.querySelector(".retry-link");
        retry.focus(); retry.click(); retry.click();
        expect(resolve).toHaveBeenCalledTimes(2);
        expect(tile.getAttribute("aria-busy")).toBe("true");
        expect(tile.querySelector('[role="status"]').textContent).toBe("正在重试…");
        expect(tile.querySelector(".retry-link")).toBe(retry);
        expect(retry.getAttribute("aria-disabled")).toBe("true");
        expect(dom.window.document.activeElement).toBe(retry);
        expect(dom.window.location.hash).toBe("");
        finish([{url:"https://img.javstore.net/retry.jpg"}]); await tick();
        expect(tile.getAttribute("aria-busy")).toBe("false");
        expect(dom.window.document.activeElement).toBe(tile.querySelector(".jhs-screenshot-open"));
        tile.querySelector("img").dispatchEvent(new dom.window.Event("error"));
        expect(dom.window.document.activeElement).toBe(tile.querySelector(".retry-link"));
        tile.querySelector(".retry-link").click(); await tick();
        expect(tile.textContent).toContain("缩略图加载失败");
        expect(tile.querySelector(".retry-link").getAttribute("aria-disabled")).toBeNull();
        expect(dom.window.document.activeElement).toBe(tile.querySelector(".retry-link"));
        scope.dispose(); dom.window.close();
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

it("manual detail mode sends no initial request and removes disabled-source results", async () => {
    const resolve = vi.fn(async () => [{ url: "https://img.javstore.net/current.jpg" }]);
    const h = createHarness({ resolve, initialSettings: { screenshotMode: "manual" } });
    h.controller.start(); await tick();
    expect(resolve).not.toHaveBeenCalled();
    h.dom.window.document.querySelector('[role="tab"]').click(); await tick();
    expect(h.dom.window.document.querySelector(".screen-container img").src).toContain("current.jpg");
    h.patchSettings({ screenshotProviders: [{ id: "javstore", enabled: false }] }); await tick();
    expect(h.dom.window.document.querySelector(".screen-container img")).toBeNull();
    expect(resolve).toHaveBeenCalledOnce();
    h.scope.dispose(); h.dom.window.close();
});
it("switching an ordinary detail to manual cancels and ignores the old automatic response", async () => {
    let finish; const resolve = vi.fn(() => new Promise(done => { finish = done; }));
    const h = createHarness({ resolve }); h.controller.start(); await tick();
    const requestScope = resolve.mock.calls[0][1].scope;
    h.patchSettings({ screenshotMode: "manual" });
    expect(requestScope.disposed).toBe(true);
    finish([{ url: "https://img.javstore.net/late.jpg" }]); await tick();
    expect(h.dom.window.document.querySelector(".screen-container img")).toBeNull();
    expect(h.dom.window.document.querySelector('[role="tablist"]')).not.toBeNull();
    h.scope.dispose(); h.dom.window.close();
});
