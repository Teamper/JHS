import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { DetailScreenshotController } from "../src/features/detail/detail-screenshot-controller.js";

const repoRoot = join(import.meta.dirname, "..");

function loadCarNumHelpers() {
    const source = readTestFile(join(repoRoot, "src/core/constants.js"), "utf8"), start = source.indexOf("function normalizeCarNum"), end = source.indexOf("let M =", start);
    const context = vm.createContext({});
    vm.runInContext(`${source.slice(start, end)}; globalThis.normalize = normalizeCarNum; globalThis.first = firstValidCarNum; globalThis.assertContract = assertPageInfoContract;`, context);
    return context;
}

function loadUtils(url = "https://javdb.example/search?q=ABF-142") {
    const layer = { open: vi.fn() }, openTab = vi.fn(), location = new URL(url), context = vm.createContext({
        console,
        URL,
        window: { location, innerWidth: 1440, innerHeight: 900 },
        document: {},
        layer,
        GM_openInTab: openTab,
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

function loadScreenshotPlugin(overrides = {}) {
    const warn = vi.fn(), debug = vi.fn(), error = vi.fn(), cachedRequest = vi.fn();
    const scope = overrides.scope || { id: "detail", addCleanup: vi.fn(), assertActive: vi.fn() };
    scope.addCleanup ||= vi.fn();
    const controller = new DetailScreenshotController({
        hostAdapter: { site: "javdb", document: {}, locateDetailRoot: () => null },
        screenshot: overrides.screenshot || { isEnabled: () => true, resolve: vi.fn(async () => null) },
        settings: overrides.settings || { snapshot: () => ({ enableLoadScreenShot: "yes" }) },
        ui: { getClog: () => ({ warn, debug, error }), getJQuery: () => overrides.$ || vi.fn() },
        scope,
    });
    return { controller, warn, debug, error, cachedRequest };
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

    it("rejects an unavailable screenshot number before cache or JavStore access", async () => {
        const { controller, warn, cachedRequest } = loadScreenshotPlugin();
        await expect(controller.getScreenshot("undefined")).rejects.toThrow("缩略图番号不可用");
        expect(warn).toHaveBeenCalledWith("跳过缩略图解析：番号不可用");
        expect(cachedRequest).not.toHaveBeenCalled();
    });

    it("resolves screenshots through the declared ScreenshotService", async () => {
        const resolve = vi.fn(async () => [{ url: "https://img.javstore.net/preview.jpg", providerId: "javstore" }]);
        const settings = { snapshot: () => ({ enableLoadScreenShot: "yes" }) };
        const { controller } = loadScreenshotPlugin({ screenshot: { resolve, isEnabled: () => true }, settings, scope: { id: "detail" } });
        await expect(controller.getScreenshot("IPZZ-479")).resolves.toBe("https://img.javstore.net/preview.jpg");
        expect(resolve).toHaveBeenCalledWith({ carNum: "IPZZ-479" }, { scope: expect.objectContaining({ id: "detail" }), settings: { enableLoadScreenShot: "yes" } });
    });

    it("normalizes a legacy JavStore URL again at the image rendering boundary", () => {
        const dom = new JSDOM('<main><div class="preview-images"></div></main>'), $ = jqueryFactory(dom.window);
        const scope = { addCleanup: vi.fn(), assertActive: vi.fn() }, controller = new DetailScreenshotController({
            hostAdapter: { site: "javdb", document: dom.window.document, locateDetailRoot: () => dom.window.document, locateNativeGallery: () => dom.window.document.querySelector(".preview-images") },
            screenshot: { isEnabled: () => true }, settings: { snapshot: () => ({ enableLoadScreenShot: "yes" }) },
            ui: { getJQuery: () => $, getClog: () => ({}) }, scope,
        });
        controller.ensureHostedContainer();
        controller.addImg("缩略图", "http://img.javstore.net/legacy.jpg");
        expect(dom.window.document.querySelector(".screen-container img")?.getAttribute("src")).toBe("https://img.javstore.net/legacy.jpg");
    });
});

describe("source regression contracts", () => {
    it("keeps detail consumers on the strict getPageInfo object contract", () => {
        for (const file of ["src/features/detail/detail-page-state-actions-controller.js", "src/features/detail/detail-javdb-preview-controller.js"]) {
            const source = readTestFile(join(repoRoot, file), "utf8");
            expect(source).toContain("getPageInfo()");
            expect(source).not.toContain("getPageInfo()?.carNum");
        }
        expect(readTestFile(join(repoRoot, "src/features/detail/detail-screenshot-controller.js"), "utf8")).toContain("readMovieRef()");
        const translate = readTestFile(join(repoRoot, "src/features/external-bridge/translation-controller.js"), "utf8");
        expect(translate).toContain("readCarNum()");
        expect(translate).not.toContain("getPageInfo()?.carNum");
    });

    it("routes detail state-action dialogs through the declared DialogService", () => {
        const source = readTestFile(join(repoRoot, "src/features/detail/detail-page-state-actions-controller.js"), "utf8");
        expect(source).toContain('getRuntimeService("dialog")');
        expect(source).not.toContain("layer.open");
    });

    it("treats opted-in HTTP 404 responses as neutral results before retry accounting", () => {
        const source = readTestFile(join(repoRoot, "src/core/http.js"), "utf8");
        expect(source).toMatch(/404 === e\.status && requestOptions\.ignoreNotFound[\s\S]{0,80}a\(null\)/);
        expect(source.indexOf("404 === e.status && requestOptions.ignoreNotFound")).toBeLessThan(source.indexOf("this._isCloudflareChallenge(e.responseText, e.status)"));
    });

    it("uses readable non-shadowing variables for actress profile links", () => {
        const source = readTestFile(join(repoRoot, "src/features/discovery/new-video-controller.js"), "utf8");
        expect(source).toContain("const profileUrl = normalizeHttpUrl(`/actors/${encodeURIComponent(starId)}?t=d`, javDbUrl)");
        expect(source).toContain("noteText = isPaused");
        expect(source).not.toContain("`${c}/actors/${e.starId}?t=d`");
    });
});
