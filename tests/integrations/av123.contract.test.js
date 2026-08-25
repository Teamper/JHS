import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it, vi } from "vitest";
import { create123AvAdapter } from "../../src/integrations/av123/manifest.js";
import { parse123AvCards } from "../../src/integrations/av123/parser.js";

it("normalizes 123AV cards without returning DOM", () => {
    const dom = new JSDOM('<article class="card"><a class="card__link" href="/cn/v/fc2-ppv-123">FC2-PPV-123 — Title</a></article>');
    const cards = parse123AvCards(jquery(dom.window)(dom.window.document));
    expect(cards[0]).toMatchObject({ carNum: "FC2-123", title: "Title" });
    expect(cards[0]).not.toBeInstanceOf(dom.window.Node);
});

it("loads search and detail contracts through HttpService", async () => {
    const runtime = new JSDOM();
    vi.stubGlobal("DOMParser", runtime.window.DOMParser);
    const request = vi.fn(async options => ({
        status: 200,
        data: options.url.includes("/search?") || options.url.includes("/makers/")
            ? '<article class="card"><a class="card__link" href="/cn/v/fc2-ppv-123">FC2-PPV-123 — Title</a></article>'
            : '<h1 class="watch__title">FC2-PPV-123 — Detail title</h1><p>发布日期 2026-01-02</p>',
        finalUrl: options.url,
    }));
    const adapter = create123AvAdapter({ request });
    await expect(adapter.listCatalog({ page: 1 })).resolves.toMatchObject({
        items: [expect.objectContaining({ carNum: "FC2-123", providerId: "av123" })],
    });
    const movieRef = await adapter.resolveMovie({ carNum: "FC2-123" });
    expect(movieRef).toMatchObject({ carNum: "FC2-123", providerId: "av123", url: "https://123av.com/cn/v/fc2-ppv-123" });
    await expect(adapter.getDetail(movieRef)).resolves.toMatchObject({ carNum: "FC2-123", title: "Detail title", releaseDate: "2026-01-02" });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ providerId: "av123", cacheScope: "public", requestOptions: { cookiePartition: { topLevelSite: "https://123av.com" } } }), undefined);
    vi.unstubAllGlobals();
});

it("uses one configured HTTPS origin for links, requests and legacy source recognition", async () => {
    const runtime = new JSDOM();
    vi.stubGlobal("DOMParser", runtime.window.DOMParser);
    const request = vi.fn(async options => ({ status: 200, data: '<article class="card"><a class="card__link" href="/cn/v/fc2-ppv-123">FC2-PPV-123 — Title</a></article>', finalUrl: options.url }));
    const settings = { snapshot: () => ({ av123Url: "https://mirror.example.test/path" }) };
    const adapter = create123AvAdapter({ request }, settings);
    expect(adapter.origin()).toBe("https://mirror.example.test");
    expect(adapter.searchUrl({ carNum: "FC2-123" })).toBe("https://mirror.example.test/cn/search?keyword=FC2-123");
    expect(adapter.detailUrl({ carNum: "FC2-123" })).toBe("https://mirror.example.test/cn/v/fc2-ppv-123");
    expect(adapter.matchesUrl("https://old-mirror.example/cn/v/fc2-ppv-999")).toBe(true);
    await adapter.resolveMovie({ carNum: "FC2-123" });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
        requestOptions: { cookiePartition: { topLevelSite: "https://mirror.example.test" } },
        urlPolicy: { trustClass: "custom-public", expectedOrigin: "https://mirror.example.test" },
    }), undefined);
    vi.unstubAllGlobals();
});

it("requests and exposes the verified 123AV search page", async () => {
    const runtime = new JSDOM();
    vi.stubGlobal("DOMParser", runtime.window.DOMParser);
    const request = vi.fn(async options => ({
        status: 200,
        data: '<article class="card"><a class="card__link" href="/cn/v/fc2-ppv-222">FC2-PPV-222 — Page two</a></article><a rel="last" href="?keyword=FC2&page=4">4</a>',
        finalUrl: options.url,
    }));
    const adapter = create123AvAdapter({ request });
    await expect(adapter.listCatalog({ keyword: "FC2", page: 2 })).resolves.toMatchObject({ maxPage: 4 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: "https://123av.com/cn/search?keyword=FC2&page=2" }), undefined);
    vi.unstubAllGlobals();
});
