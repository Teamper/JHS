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
