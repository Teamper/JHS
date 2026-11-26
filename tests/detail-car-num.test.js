import { assertPageInfoContract, normalizeCarNum as normalize, firstValidCarNum as first } from "../src/core/constants.js";
import { fetchDmmPreview } from "../src/services/preview-service.js";
import { createPageDialogs } from "../src/platform/browser/page-dialogs.js";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ScreenshotController } from "../src/features/detail/screenshot-controller.js";
import { ScreenshotService } from "../src/services/screenshot-service.js";
import { HttpService } from "../src/services/http-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { normalizeJavStoreAssetUrl } from "../src/integrations/javstore/parser.js";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { JavBusHostAdapter } from "../src/platform/hosts/javbus-host-adapter.js";

function getPageInfo({ url, javdb = false, javbus = false, copyCarNum = null, fallbackCarNum = null } = {}) {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { url });
    const { document } = dom.window;
    const add = (parent, tag, className, text) => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        element.textContent = text;
        parent.append(element);
        return element;
    };
    if (javdb) {
        const detail = add(document.body, "div", "video-detail", "");
        const info = add(detail, "div", "column-video-info", "");
        if (copyCarNum) {
            const anchor = add(info, "a", "", "");
            anchor.title = "複製番号";
            anchor.setAttribute("data-clipboard-text", copyCarNum);
        }
        if (fallbackCarNum) add(detail, "div", "video-id", fallbackCarNum);
        add(detail, "span", "", "女优甲");
        add(detail, "span", "female", "");
        add(detail, "span", "", "男优乙");
        add(detail, "span", "male", "");
        const datePanel = add(detail, "div", "panel-block", "");
        add(datePanel, "strong", "", "日期:");
        add(datePanel, "span", "value", "2026-08-11");
    } else if (javbus) {
        add(document.body, "span", "", "女优丙");
        const actress = add(document.body, "span", "", "");
        actress.setAttribute("onmouseover", "star_1");
        add(actress, "a", "", "女优丙");
        const release = add(document.body, "p", "", "");
        add(release, "span", "header", "發行日期:");
        release.append(" 2026-08-10");
    }
    const host = javdb ? new JavDbHostAdapter(document, dom.window.location) : new JavBusHostAdapter(document, dom.window.location);
    const info = host.readMovieInfo() ?? { carNum: null, url, actress: "", actors: "", publishTime: "" };
    dom.window.close();
    return { carNum: info.carNum, url: info.url, actress: info.actress ?? "", actors: info.actors ?? "", publishTime: info.publishTime ?? "" };
}

function loadUtils(url = "https://javdb.example/search?q=ABF-142") {
    const layer = { open: vi.fn() }, openTab = vi.fn();
    const utils = createPageDialogs({
        window: { location: new URL(url), innerWidth: 1440, innerHeight: 900 },
        dialog: layer, navigation: { open: openTab }, settings: { snapshot: () => ({}) },
        esc: { setupEscClose: vi.fn(), releaseEscClose: vi.fn() }, logger: console,
    });
    return { utils, layer, openTab };
}

function createScreenshotController(overrides = {}) {
    const dom = new JSDOM("", { url: "https://javdb.com/v/test-id" });
    const settings = overrides.settings ?? { snapshot: () => ({ enableLoadScreenShot: "yes" }) };
    const screenshot = overrides.screenshot ?? { isEnabled: () => true, resolve: vi.fn(async () => null), getSearchUrl: () => null, normalizeAssetUrl: normalizeJavStoreAssetUrl };
    const controller = new ScreenshotController({
        document: dom.window.document, window: dom.window,
        hostAdapter: overrides.hostAdapter ?? { site: "javdb", readMovieRef: () => ({ carNum: "ABC-123" }), locateNativeGallery: () => null },
        route: "detail", settings, screenshot, styles: { register: vi.fn(() => vi.fn()) }, ui: { openImageViewer: vi.fn() },
        diagnostics: { recordError: vi.fn() }, scope: overrides.scope ?? new LifecycleScope("detail"),
    });
    return { controller, dom, screenshot, settings };
}

describe("detail car number propagation", () => {
    it("normalizes invalid values and keeps candidate priority", () => {
        expect(normalize(" ABF-142 ")).toBe("ABF-142");
        expect(normalize("ipx_001")).toBe("IPX-001");
        expect(normalize("ABC123")).toBe("ABC-123");
        expect(normalize("UNLISTED123")).toBe("UNLISTED123");
        expect(normalize("undefined")).toBeNull();
        expect(normalize(null)).toBeNull();
        expect(first(" ", "ABF-142", "IPX-001")).toBe("ABF-142");
        expect(first(undefined, "null", "")).toBeNull();
        expect(() => assertPageInfoContract("ABC-123")).toThrow(TypeError);
        const detail = { carNum: null };
        expect(assertPageInfoContract(detail)).toBe(detail);
    });

    it("returns the complete JavDB contract for normal and iframe detail pages", () => {
        const normal = getPageInfo({ url: "https://javdb.example/v/abc", javdb: true, copyCarNum: "ABF-142" });
        expect(JSON.parse(JSON.stringify(normal))).toEqual({
            carNum: "ABF-142", url: "https://javdb.example/v/abc", actress: "女优甲", actors: "男优乙", publishTime: "2026-08-11"
        });
        const iframe = getPageInfo({
            url: "https://javdb.example/v/abc?hideNav=1&jhsCarNum=IPX-001", javdb: true, copyCarNum: "ABF-142"
        });
        expect(iframe.carNum).toBe("ABF-142");
        expect(typeof iframe).toBe("object");
    });

    it("returns the complete JavBus contract and preserves null as a parse failure", () => {
        const bus = getPageInfo({ url: "https://javbus.example/ABF-142", javbus: true });
        expect(JSON.parse(JSON.stringify(bus))).toEqual({
            carNum: "ABF-142", url: "https://javbus.example/ABF-142", actress: "女优丙", actors: "", publishTime: "2026-08-10"
        });
        const missing = getPageInfo({ url: "https://javdb.example/v/abc", javdb: true });
        expect(missing).not.toBeUndefined();
        expect(missing.carNum).toBeNull();
    });

    it("adds an encoded car number to iframe detail URLs without losing existing query", () => {
        const { utils, layer } = loadUtils();
        utils.openPage("/v/movie-id?foo=1", "ABF-142", true, {});
        const content = new URL(layer.open.mock.calls[0][0].content);
        expect(content.searchParams.get("foo")).toBe("1");
        expect(content.searchParams.get("hideNav")).toBe("1");
        expect(content.searchParams.get("jhsCarNum")).toBe("ABF-142");
    });

    it("keeps jhsCarNum but omits hideNav for ctrl-click and never leaks it to external searches", () => {
        const { utils, layer, openTab } = loadUtils();
        utils.openPage("/v/movie-id", "ABF 142", true, { ctrlKey: true });
        const opened = new URL(openTab.mock.calls[0][0]);
        expect(opened.searchParams.get("jhsCarNum")).toBe("ABF-142");
        expect(opened.searchParams.has("hideNav")).toBe(false);
        utils.openPage("https://subtitle.example/search?q=ABF-142", "ABF-142", true, {});
        const external = new URL(layer.open.mock.calls[0][0].content);
        expect(external.searchParams.has("jhsCarNum")).toBe(false);
    });

    it("opens an explicit new tab or middle-click without manufacturing mouse events", () => {
        const { utils, layer, openTab } = loadUtils();
        utils.openPage("/v/movie-id", "ABF-142", true, { newTab: true });
        utils.openPage("/v/movie-id", "ABF-142", true, { event: { button: 1 } });
        expect(openTab).toHaveBeenCalledTimes(2);
        expect(layer.open).not.toHaveBeenCalled();
    });

    it("skips DMM locally when the car number is unavailable", async () => {
        const logger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() }, preview = vi.fn();
        await expect(fetchDmmPreview(undefined, {}, { preview }, undefined, logger)).resolves.toEqual({ sources: null, error: null });
        expect(logger.warn).toHaveBeenCalledWith("跳过 DMM 解析：番号不可用");
        expect(logger.error).not.toHaveBeenCalled();
        expect(preview).not.toHaveBeenCalled();
    });

    it("rejects an unavailable screenshot number before calling ScreenshotService", async () => {
        const { controller, screenshot } = createScreenshotController();
        await expect(controller.getScreenshot("undefined")).rejects.toThrow("缩略图番号不可用");
        expect(screenshot.resolve).not.toHaveBeenCalled();
    });

    it("resolves screenshots through the declared ScreenshotService", async () => {
        const resolve = vi.fn(async () => [{ url: "https://img.javstore.net/preview.jpg", providerId: "javstore" }]);
        const settings = { snapshot: () => ({ enableLoadScreenShot: "yes" }) };
        const scope = { id: "detail" }, { controller } = createScreenshotController({ screenshot: { resolve, isEnabled: () => true }, settings, scope });
        await expect(controller.getScreenshot("IPZZ-479")).resolves.toBe("https://img.javstore.net/preview.jpg");
        expect(resolve).toHaveBeenCalledWith({ carNum: "IPZZ-479" }, { scope: { id: "detail" }, settings: { enableLoadScreenShot: "yes" }, allowWhenDisabled: false });
    });

    it("normalizes a legacy JavStore URL before reusing the loaded image in the detail tile", async () => {
        const { controller, dom } = createScreenshotController(), container = dom.window.document.createElement("a");
        const service = new ScreenshotService({ getAvailable: async () => [] }, {
            list: () => [{ id: "javstore" }],
            getAdapter: () => ({ getImages: async () => [{ url: "http://img.javstore.net/legacy.jpg" }] }),
        });
        const preview = await service.resolvePreview({ carNum: "ABC-123" }, {
            loadImage: async url => Object.assign(dom.window.document.createElement("img"), { src: url }),
        });
        expect(controller.renderImage(container, "缩略图", preview.image)).toBe(true);
        expect(container.querySelector("img")).toBe(preview.image);
        expect(container.querySelector("img")?.src).toBe("https://img.javstore.net/legacy.jpg");
    });
});

describe("detail request error handling", () => {

    it("treats opted-in HTTP 404 responses as neutral results without a retry", async () => {
        const request = vi.fn(async () => ({ status: 404, data: "<title>Page not found</title> incidental challenge-platform" }));
        const http = new HttpService({ request }, new ExternalUrlPolicy());
        await expect(http.request({
            providerId: "av123", url: "https://123av.com/cn/missing", retryCount: 3, acceptableStatuses: [404],
            urlPolicy: { trustClass: "builtin-public", hosts: ["123av.com"] },
        })).resolves.toMatchObject({ status: 404 });
        expect(request).toHaveBeenCalledOnce();
        expect(http.getCircuitBreakerStatus()["123av.com"]?.failCount ?? 0).toBe(0);
    });
});
