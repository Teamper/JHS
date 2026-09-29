import { prepareDialogOptions } from "../src/core/dialog-shell.js";
import { JHS_Z_INDEX } from "../src/core/theme.js";
import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { ScreenshotController } from "../src/features/detail/screenshot-controller.js";
import { normalizeJavStoreAssetUrl } from "../src/integrations/javstore/parser.js";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { JavBusHostAdapter } from "../src/platform/hosts/javbus-host-adapter.js";

const repoRoot = join(import.meta.dirname, "..");

function loadCarNumHelpers() {
    const source = readTestFile(join(repoRoot, "src/core/constants.js"), "utf8"), start = source.indexOf("function normalizeCarNum"), end = source.indexOf("let M =", start);
    const context = vm.createContext({});
    vm.runInContext(`${source.slice(start, end)}; globalThis.normalize = normalizeCarNum; globalThis.first = firstValidCarNum; globalThis.assertContract = assertPageInfoContract;`, context);
    return context;
}

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
    const layer = { open: vi.fn() }, openTab = vi.fn(), location = new URL(url), context = vm.createContext({
        console,
        URL,
        window: { location, innerWidth: 1440, innerHeight: 900 },
        document: {},
        layer,
        GM_openInTab: openTab,
        prepareDialogOptions,
        JHS_Z_INDEX,
        normalizeCarNum: loadCarNumHelpers().normalize,
        i: (target, key, value) => (target[key] = value)
    });
    const source = readTestFile(join(repoRoot, "src/core/utils.js"), "utf8");
    vm.runInContext(`${source}; globalThis.TestUtils = Utils;`, context);
    return { utils: new context.TestUtils(), layer, openTab };
}

function loadDmmParser() {
    const warn = vi.fn(), error = vi.fn(), request = vi.fn(), storage = new Map(), context = vm.createContext({
        console,
        URLSearchParams,
        L: [],
        normalizeCarNum: loadCarNumHelpers().normalize,
        clog: { warn, error, debug: vi.fn() },
        gmHttp: { get: request },
        localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        $: () => ({ attr: vi.fn().mockReturnThis(), css: vi.fn().mockReturnThis(), append: vi.fn().mockReturnThis() }),
        show: { error: vi.fn() }
    });
    const source = readTestFile(join(repoRoot, "src/services/preview-service.js"), "utf8"), start = source.indexOf("const Z ="), end = source.indexOf("async function fetchDmmPreview", start);
    vm.runInContext(`${source.slice(start, end)}; globalThis.TestDmmParser = DmmPreviewParser;`, context);
    return { Parser: context.TestDmmParser, warn, error, request };
}

function createScreenshotController(overrides = {}) {
    const dom = new JSDOM("", { url: "https://javdb.com/v/test-id" });
    const settings = overrides.settings ?? { snapshot: () => ({ enableLoadScreenShot: "yes" }) };
    const screenshot = overrides.screenshot ?? { isEnabled: () => true, resolve: vi.fn(async () => null), getSearchUrl: () => null, normalizeAssetUrl: normalizeJavStoreAssetUrl };
    const controller = new ScreenshotController({
        document: dom.window.document, window: dom.window,
        hostAdapter: overrides.hostAdapter ?? { site: "javdb", readMovieRef: () => ({ carNum: "ABC-123" }), locateNativeGallery: () => null },
        route: "detail", settings, screenshot, styles: { register: vi.fn(() => vi.fn()) }, ui: { openImageViewer: vi.fn() },
        diagnostics: { recordError: vi.fn() }, scope: overrides.scope ?? { id: "detail", disposed: false },
    });
    return { controller, dom, screenshot, settings };
}

describe("detail car number propagation", () => {
    it("normalizes invalid values and keeps candidate priority", () => {
        const { normalize, first } = loadCarNumHelpers();
        expect(normalize(" ABF-142 ")).toBe("ABF-142");
        expect(normalize("ipx_001")).toBe("IPX-001");
        expect(normalize("ABC123")).toBe("ABC-123");
        expect(normalize("UNLISTED123")).toBe("UNLISTED123");
        expect(normalize("undefined")).toBeNull();
        expect(normalize(null)).toBeNull();
        expect(first(" ", "ABF-142", "IPX-001")).toBe("ABF-142");
        expect(first(undefined, "null", "")).toBeNull();
    });

    it("returns the complete JavDB contract for normal and iframe detail pages", () => {
        const normal = getPageInfo({ url: "https://javdb.example/v/abc", javdb: true, copyCarNum: "ABF-142" });
        expect(JSON.parse(JSON.stringify(normal))).toEqual({
            carNum: "ABF-142", url: "https://javdb.example/v/abc", actress: "女优甲", actors: "男优乙", publishTime: "2026-08-11"
        });
        const iframe = getPageInfo({
            url: "https://javdb.example/v/abc?hideNav=1&jhsCarNum=IPX-001", javdb: true, copyCarNum: "ABF-142"
        });
        expect(iframe.carNum).toBe("IPX-001");
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
        const { Parser, warn, error, request } = loadDmmParser();
        await expect(new Parser(undefined, false).fetchVideo()).resolves.toBeNull();
        expect(warn).toHaveBeenCalledWith("跳过 DMM 解析：番号不可用");
        expect(error).not.toHaveBeenCalled();
        expect(request).not.toHaveBeenCalled();
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

    it("normalizes a legacy JavStore URL again at the image rendering boundary", () => {
        const { controller, dom } = createScreenshotController(), container = dom.window.document.createElement("a");
        expect(controller.renderImage(container, "缩略图", "http://img.javstore.net/legacy.jpg")).toBe(true);
        expect(container.querySelector("img")?.src).toBe("https://img.javstore.net/legacy.jpg");
    });
});

describe("source regression contracts", () => {
    it("keeps detail consumers on the strict getPageInfo object contract", () => {
        for (const file of [
            "src/features/detail/detail-page-actions-controller.js",
            "src/features/detail/javdb-preview-controller.js"
        ]) {
            const source = readTestFile(join(repoRoot, file), "utf8");
            expect(source).toContain("getPageInfo()");
            expect(source).not.toContain("getPageInfo()?.carNum");
        }
        const screenshot = readTestFile(join(repoRoot, "src/features/detail/screenshot-controller.js"), "utf8");
        expect(screenshot).toContain("this.hostAdapter.readMovieRef?.()?.carNum");
        const translate = readTestFile(join(repoRoot, "src/features/translation/translation-controller.js"), "utf8");
        expect(translate).toContain("this.translation.translate(sourceText, { cacheAlias: carNum");
        expect(translate).toContain("this.hostAdapter?.readMovieRef?.()?.carNum");
        expect(translate).not.toContain("getPageInfo()?.carNum");
    });

    it("routes detail state-action dialogs through the declared DialogService", () => {
        const source = readTestFile(join(repoRoot, "src/features/detail/detail-page-actions-controller.js"), "utf8");
        expect(source).toContain("this.dialog.open(");
        expect(source).not.toContain("layer.open");
    });

    it("treats opted-in HTTP 404 responses as neutral results before retry accounting", () => {
        const source = readTestFile(join(repoRoot, "src/core/http.js"), "utf8");
        expect(source).toMatch(/404 === e\.status && requestOptions\.ignoreNotFound[\s\S]{0,80}a\(null\)/);
        expect(source.indexOf("404 === e.status && requestOptions.ignoreNotFound")).toBeLessThan(source.indexOf("this._isCloudflareChallenge(e.responseText, e.status)"));
    });

    it("uses readable non-shadowing variables for actress profile links", () => {
        const source = readTestFile(join(repoRoot, "src/plugins/new-video/new-video.js"), "utf8");
        expect(source).toContain("const profileUrl = normalizeHttpUrl(`/actors/${encodeURIComponent(starId)}?t=d`, javDbUrl)");
        expect(source).toContain("noteText = isPaused");
        expect(source).not.toContain("`${c}/actors/${e.starId}?t=d`");
    });
});
