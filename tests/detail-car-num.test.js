import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadCarNumHelpers() {
    const source = readFileSync(join(repoRoot, "src/core/constants.js"), "utf8"), start = source.indexOf("function normalizeCarNum"), end = source.indexOf("let M =", start);
    const context = vm.createContext({});
    vm.runInContext(`${source.slice(start, end)}; globalThis.normalize = normalizeCarNum; globalThis.first = firstValidCarNum; globalThis.assertContract = assertPageInfoContract;`, context);
    return context;
}

function getPageInfo({ url, javdb = false, javbus = false, copyCarNum = null, fallbackCarNum = null } = {}) {
    const helpers = loadCarNumHelpers();
    const collection = ({ text = "", attr = null, values = [] } = {}) => {
        const api = {
            first: () => api,
            attr: () => attr,
            text: () => text,
            each: () => api,
            prev: () => api,
            parent: () => api,
            find: () => api,
            map: () => ({ get: () => values })
        };
        return api;
    };
    const $ = (selector) => {
        if ("string" != typeof selector) return collection();
        if (selector.includes("data-clipboard-text")) return collection({ attr: copyCarNum });
        if (selector.includes(".panel-block")) return collection();
        if (selector.includes("#video_id")) return collection({ text: fallbackCarNum || "" });
        if (selector === ".female") return collection({ values: [ "女优甲" ] });
        if (selector === ".male") return collection({ values: [ "男优乙" ] });
        if (selector.includes('strong:contains("日期:")')) return collection({ text: "2026-08-11" });
        if (selector.includes('span[onmouseover*="star_"]')) return collection({ values: [ "女优丙" ] });
        if (selector.includes("發行日期")) return collection({ text: "發行日期: 2026-08-10" });
        return collection();
    };
    const context = vm.createContext({
        console,
        URL,
        performance: { now: () => 0 },
        window: { location: new URL(url) },
        $,
        r: javdb,
        l: javbus,
        o: url,
        normalizeCarNum: helpers.normalize,
        firstValidCarNum: helpers.first,
        assertPageInfoContract: helpers.assertContract,
        i: (target, key, value) => (target[key] = value)
    });
    const source = readFileSync(join(repoRoot, "src/core/plugin-manager.js"), "utf8");
    vm.runInContext(`${source}; globalThis.TestBasePlugin = BasePlugin;`, context);
    return context.TestBasePlugin.prototype.getPageInfo.call({});
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
    const source = readFileSync(join(repoRoot, "src/core/utils.js"), "utf8");
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
    const source = readFileSync(join(repoRoot, "src/plugins/image-viewer/preview-video.js"), "utf8"), start = source.indexOf("const Z ="), end = source.indexOf("async function fetchDmmPreview", start);
    vm.runInContext(`${source.slice(start, end)}; globalThis.TestDmmParser = DmmPreviewParser;`, context);
    return { Parser: context.TestDmmParser, warn, error, request };
}

function loadScreenshotPlugin(overrides = {}) {
    const warn = vi.fn(), debug = vi.fn(), error = vi.fn(), cachedRequest = vi.fn(), context = vm.createContext({
        console,
        URL,
        BasePlugin: class {},
        normalizeCarNum: loadCarNumHelpers().normalize,
        clog: { warn, debug, error, log: vi.fn() },
        storageManager: { cachedRequest },
        localStorage: { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() },
        gmHttp: overrides.gmHttp || { get: vi.fn() },
        utils: overrides.utils || { htmlTo$dom: vi.fn() },
        $: overrides.$ || vi.fn(),
        r: true,
        l: false
    });
    context.CACHE_TTL = { screenshot: 6048e5 };
    const parserSource = readFileSync(join(repoRoot, "src/parsers/third-party-parsers.js"), "utf8");
    const registrySource = readFileSync(join(repoRoot, "src/plugins/image-viewer/screenshot-provider-registry.js"), "utf8");
    const source = readFileSync(join(repoRoot, "src/plugins/image-viewer/screenshot.js"), "utf8");
    vm.runInContext(`${parserSource}\n${registrySource}\n${source}; globalThis.TestScreenshotPlugin = ScreenShotPlugin;`, context);
    return { Plugin: context.TestScreenshotPlugin, warn, debug, error, cachedRequest };
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

    it("rejects an unavailable screenshot number before cache or JavStore access", async () => {
        const { Plugin, warn, cachedRequest } = loadScreenshotPlugin();
        await expect(new Plugin().getScreenshot("undefined")).rejects.toThrow("缩略图番号不可用");
        expect(warn).toHaveBeenCalledWith("跳过缩略图解析：番号不可用");
        expect(cachedRequest).not.toHaveBeenCalled();
    });

    it("checks matching JavStore results in source order until CLICK HERE! is found", async () => {
        const candidates = [
            { text: "IPZZ-479 first", href: "/first-ipzz479-pn.html" },
            { text: "IPZZ-479 second", href: "/second-ipzz479-pn.html" },
            { text: "another title", href: "/other-pn.html" }
        ];
        const searchLinks = {
            filter: (predicate) => {
                const matches = candidates.filter((element, index) => predicate(index, element));
                return { map: (mapper) => ({ get: () => matches.map((element, index) => mapper(index, element)) }) };
            }
        };
        const noPreview = { filter: () => noPreview, first: () => noPreview, attr: () => undefined };
        const previewLink = { filter: (predicate) => (predicate(0, { text: "CLICK HERE!" }), previewLink), first: () => previewLink,
            attr: () => "//img.javstore.net/images/2025/02/13/MOSAIC-ARCHIVE-ipzz-479_s.jpg" };
        const searchDom = { find: vi.fn(() => searchLinks) };
        const firstDetail = { find: vi.fn(() => noPreview) };
        const secondDetail = { find: vi.fn(() => previewLink) };
        const gmHttp = { get: vi.fn().mockResolvedValueOnce("search-html").mockResolvedValueOnce("first-html").mockResolvedValueOnce("second-html") };
        const utils = { htmlTo$dom: vi.fn((html) => ({ "search-html": searchDom, "first-html": firstDetail, "second-html": secondDetail })[html]) };
        const { Plugin } = loadScreenshotPlugin({ gmHttp, utils, $: (element) => ({ text: () => element.text, attr: () => element.href }) });
        await expect(new Plugin().getJavStoreScreenShot("IPZZ-479")).resolves.toBe("https://img.javstore.net/images/2025/02/13/MOSAIC-ARCHIVE-ipzz-479_s.jpg");
        expect(gmHttp.get.mock.calls.map(([url]) => url)).toEqual([
            "https://javstore.net/search?q=IPZZ-479",
            "https://javstore.net/first-ipzz479-pn.html",
            "https://javstore.net/second-ipzz479-pn.html"
        ]);
        expect(searchDom.find).toHaveBeenCalledWith('a[href$="-pn.html"]');
        expect(firstDetail.find).toHaveBeenCalledWith("a");
        expect(secondDetail.find).toHaveBeenCalledWith("a");
    });

    it("returns null for a JavStore 404 or empty search without requesting details", async () => {
        const gmHttp = { get: vi.fn().mockResolvedValue(null) };
        const { Plugin } = loadScreenshotPlugin({ gmHttp });
        await expect(new Plugin().getJavStoreScreenShot("ABF-142")).resolves.toBeNull();
        expect(gmHttp.get).toHaveBeenCalledTimes(1);
        expect(gmHttp.get.mock.calls[0][4]).toEqual({ ignoreNotFound: true });
    });

    it("returns null when no -pn.html result text matches the car number", async () => {
        const links = { filter: (predicate) => (predicate(0, { text: "another title" }), { map: () => ({ get: () => [] }) }) };
        const gmHttp = { get: vi.fn().mockResolvedValue("search-html") };
        const utils = { htmlTo$dom: vi.fn(() => ({ find: vi.fn(() => links) })) };
        const { Plugin, debug } = loadScreenshotPlugin({ gmHttp, utils, $: (element) => ({ text: () => element.text }) });
        await expect(new Plugin().getJavStoreScreenShot("IPZZ-479")).resolves.toBeNull();
        expect(gmHttp.get).toHaveBeenCalledTimes(1);
        expect(debug).toHaveBeenCalledWith("JavStore, 查询番号无结果:", "https://javstore.net/search?q=IPZZ-479");
    });

    it("continues after a candidate 404 and returns the next valid preview", async () => {
        const candidateElements = [ { text: "IPZZ-479 first", href: "/missing-pn.html" }, { text: "IPZZ-479 second", href: "/valid-pn.html" } ];
        const searchLinks = { filter: (predicate) => ({ map: (mapper) => ({ get: () => candidateElements.filter((element, index) => predicate(index, element)).map((element, index) => mapper(index, element)) }) }) };
        const preview = { filter: (predicate) => (predicate(0, { text: "CLICK HERE!" }), preview), first: () => preview, attr: () => "/preview.th.jpg" };
        const gmHttp = { get: vi.fn().mockResolvedValueOnce("search-html").mockResolvedValueOnce(null).mockResolvedValueOnce("detail-html") };
        const utils = { htmlTo$dom: vi.fn((html) => "search-html" === html ? { find: () => searchLinks } : { find: () => preview }) };
        const { Plugin } = loadScreenshotPlugin({ gmHttp, utils, $: (element) => ({ text: () => element.text, attr: () => element.href }) });
        await expect(new Plugin().getJavStoreScreenShot("IPZZ-479")).resolves.toBe("https://javstore.net/preview.jpg");
        expect(gmHttp.get).toHaveBeenCalledTimes(3);
    });

    it("upgrades legacy JavStore cache entries and normalizes new cache writes", async () => {
        const loaded = loadScreenshotPlugin();
        loaded.cachedRequest.mockResolvedValueOnce({ url: "http://img.javstore.net/legacy.jpg" });
        await expect(new loaded.Plugin().getCachedProviderScreenshot("javstore", "IPZZ-479", vi.fn())).resolves.toEqual({
            url: "https://img.javstore.net/legacy.jpg", source: "javstore", detailUrl: null
        });
        loaded.cachedRequest.mockImplementationOnce(async (key, ttl, loader) => (await loader()).data);
        await expect(new loaded.Plugin().getCachedProviderScreenshot("javstore", "IPZZ-480", async () => "http://img2.javstore.net/new.jpg")).resolves.toEqual({
            url: "https://img2.javstore.net/new.jpg", source: "javstore", detailUrl: null
        });
    });

    it("normalizes a legacy JavStore URL again at the image rendering boundary", () => {
        const html = vi.fn(), container = { html, on: vi.fn().mockReturnThis() };
        const { Plugin } = loadScreenshotPlugin({ $: vi.fn(() => container) });
        new Plugin().addImg("缩略图", "http://img.javstore.net/legacy.jpg");
        expect(html).toHaveBeenCalledWith(expect.stringContaining('src="https://img.javstore.net/legacy.jpg"'));
        expect(html).not.toHaveBeenCalledWith(expect.stringContaining('src="http://img.javstore.net'));
    });
});

describe("source regression contracts", () => {
    it("keeps detail consumers on the strict getPageInfo object contract", () => {
        for (const file of [
            "src/plugins/translate/translate.js",
            "src/plugins/status/detail-page-button.js",
            "src/plugins/image-viewer/preview-video.js",
            "src/plugins/image-viewer/screenshot.js"
        ]) {
            const source = readFileSync(join(repoRoot, file), "utf8");
            expect(source).toContain("getPageInfo()");
            expect(source).not.toContain("getPageInfo()?.carNum");
        }
    });

    it("treats opted-in HTTP 404 responses as neutral results before retry accounting", () => {
        const source = readFileSync(join(repoRoot, "src/core/http.js"), "utf8");
        expect(source).toMatch(/404 === e\.status && requestOptions\.ignoreNotFound[\s\S]{0,80}a\(null\)/);
        expect(source.indexOf("404 === e.status && requestOptions.ignoreNotFound")).toBeLessThan(source.indexOf("this._isCloudflareChallenge(e.responseText, e.status)"));
    });

    it("uses readable non-shadowing variables for actress profile links", () => {
        const source = readFileSync(join(repoRoot, "src/plugins/new-video/new-video.js"), "utf8");
        expect(source).toContain("const profileUrl = normalizeHttpUrl(`/actors/${encodeURIComponent(starId)}?t=d`, javDbUrl)");
        expect(source).toContain("noteText = isPaused");
        expect(source).not.toContain("`${c}/actors/${e.starId}?t=d`");
    });
});
