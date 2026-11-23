// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { JhsError } from "../../src/core/jhs-error.js";
import { LifecycleScope } from "../../src/core/lifecycle-scope.js";
import wikipediaManifest, { createWikipediaAdapter } from "../../src/integrations/wikipedia/manifest.js";
import { parseWikipediaActressInfo, parseWikipediaActressPage } from "../../src/integrations/wikipedia/parser.js";

const fixture = readFileSync(join(import.meta.dirname, "../fixtures/integrations/wikipedia/actress.html"), "utf8");

afterEach(() => {
    vi.useRealTimers();
});

it("declares cachePolicy none for person.actress-info so ActressInfoService owns caching", () => {
    expect(wikipediaManifest.cachePolicy).toEqual({ "person.actress-info": "none" });
});

it("normalizes Wikipedia actress information", () => {
    expect(parseWikipediaActressInfo(fixture, "https://ja.wikipedia.org/wiki/test")).toEqual({
        birthday: "1993年8月16日", age: "33岁", height: "159cm", weight: "48 kg",
        threeSizeText: "83 - 59 - 88", braSize: "E", url: "https://ja.wikipedia.org/wiki/test",
    });
});

it("skips nested imperial tables, strips hidden/footnotes, computes living age, and extracts inline cups", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    const html = `<!doctype html><html><body><table class="infobox">
        <tr><th>生年月日</th><td><span style="display:none">1996-05-10</span>1996年5月10日<sup class="reference">[1]</sup></td></tr>
        <tr><th>身長</th><td>162 CM[2]<table><tr><th colspan="2">英米単位系</th></tr><tr><th>身長</th><td>5 ft 4 in</td></tr><tr><th>体重</th><td>110 lb</td></tr></table></td></tr>
        <tr><th>体重</th><td>50 kg / 110 lb</td></tr>
        <tr><th>スリーサイズ</th><td>88(F) - 58 - 85 cm[3]</td></tr>
    </table></body></html>`;
    expect(parseWikipediaActressPage(html, "https://ja.wikipedia.org/wiki/sample")).toEqual({
        info: {
            birthday: "1996年5月10日",
            age: "30岁",
            height: "162cm",
            weight: "50 kg",
            threeSizeText: "88(F) - 58 - 85",
            braSize: "F",
            url: "https://ja.wikipedia.org/wiki/sample",
        },
        disambigUrls: [],
    });
});

it("does not compute age from birthday when a death row is present", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    const html = `<!doctype html><html><body><table>
        <tr><th>生年月日</th><td>1980年1月1日</td></tr>
        <tr><th>没年月日</th><td>2010年2月3日</td></tr>
        <tr><th>身長</th><td>160 cm</td></tr>
    </table></body></html>`;
    expect(parseWikipediaActressPage(html, "https://ja.wikipedia.org/wiki/deceased").info).toMatchObject({
        birthday: "1980年1月1日",
        age: "",
        height: "160cm",
    });
});

it("extracts only the matching actress title while skipping navboxes, references, and off-site links", () => {
    const html = `<!doctype html><html><body>
        <div id="mw-content-text"><div class="mw-parser-output">
            <div id="disambigbox">曖昧さ回避</div>
            <ul>
                <li><a href="https://en.wikipedia.org/wiki/Alice_(AV女優)">English</a></li>
                <li><a href="/wiki/Alice_(歌手)">Singer</a></li>
                <li><a href="/wiki/Alice_(AV女優)">Alice AV</a></li>
                <li><a href="/wiki/Alice_Alias_(AV女優)">Alias AV</a></li>
                <li><a href="/wiki/Third_(AV女優)">Third AV</a></li>
            </ul>
            <div class="navbox"><a href="/wiki/Nav_(AV女優)">Nav</a></div>
            <div class="reflist"><a href="/wiki/Ref_(AV女優)">Ref</a></div>
            <div class="catlinks"><a href="/wiki/Cat_(AV女優)">Cat</a></div>
        </div></div>
    </body></html>`;
    const parsed = parseWikipediaActressPage(html, "https://ja.wikipedia.org/wiki/Alice", "Alice");
    expect(parsed.info).toBeNull();
    expect(parsed.disambigUrls).toEqual([
        "https://ja.wikipedia.org/wiki/Alice_(AV%E5%A5%B3%E5%84%AA)",
    ]);
});

it("loads Wikipedia through the declared HTTP boundary and resolves disambiguation forwarding scope", async () => {
    const disambigHtml = `<div id="mw-content-text"><a href="/wiki/Alice_(AV%E5%A5%B3%E5%84%AA)">Alice</a></div>`;
    const scope = new LifecycleScope("wiki-contract");
    const request = vi.fn(async (options, passedScope) => {
        expect(passedScope).toBe(scope);
        if (options.url.endsWith("/wiki/Alice")) return { data: disambigHtml, finalUrl: options.url };
        return { data: fixture, finalUrl: options.url };
    });
    const result = await createWikipediaAdapter({ request }).lookup("Alice", { scope });
    expect(result).toEqual(expect.objectContaining({ age: "33岁" }));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({
        providerId: "wikipedia",
        capability: "person.actress-info",
        url: "https://ja.wikipedia.org/wiki/Alice_(AV%E5%A5%B3%E5%84%AA)",
    }), scope);
    scope.dispose();
});

it("keeps a miss when the matching candidate is absent and ignores unrelated candidates", async () => {
    const disambigHtml = `<div id="disambigbox"></div><div id="mw-content-text">
        <a href="/wiki/Alice_(AV%E5%A5%B3%E5%84%AA)">One</a>
        <a href="/wiki/Alice_B_(AV%E5%A5%B3%E5%84%AA)">Two</a>
    </div>`;
    const request = vi.fn(async (options) => {
        if (options.url.endsWith("/wiki/Alice")) return { data: disambigHtml, finalUrl: options.url };
        if (options.url.includes("/wiki/Alice_(AV")) throw new JhsError("NOT_FOUND", "404", { details: { status: 404 } });
        return { data: fixture, finalUrl: options.url };
    });
    await expect(createWikipediaAdapter({ request }).lookup("Alice")).resolves.toBeNull();
    expect(request).toHaveBeenCalledTimes(2);

    const noLoopRequest = vi.fn(async (options) => ({ data: disambigHtml, finalUrl: "https://ja.wikipedia.org/wiki/Alice_(AV%E5%A5%B3%E5%84%AA)" }));
    await expect(createWikipediaAdapter({ request: noLoopRequest }).lookup("Alice")).resolves.toBeNull();
    expect(noLoopRequest).toHaveBeenCalledTimes(1);
});

it("rejects same-name non-actresses and disambiguation pages with unrelated links", async () => {
    const pages = [
        '<table class="infobox"><tr><th>身長</th><td>182 cm</td></tr></table>',
        '<div id="disambigbox"></div><main><a href="/wiki/Bella_(AV女優)">Bella</a></main>',
    ];
    for (const data of pages) {
        const request = vi.fn(async ({ url }) => ({ data, finalUrl: url }));
        await expect(createWikipediaAdapter({ request }).lookup("Alice")).resolves.toBeNull();
        expect(request).toHaveBeenCalledOnce();
    }
});

it("accepts a documented alias on a categorized actress article after a redirect", async () => {
    const data = fixture.replace("<table>", '<div id="mw-normal-catlinks"><a>日本のAV女優</a></div><table class="infobox"><tr><th>別名義</th><td>Ａｌｉｃｅ</td></tr>');
    const request = vi.fn(async () => ({ data, finalUrl: "https://ja.wikipedia.org/wiki/Canonical" }));
    await expect(createWikipediaAdapter({ request }).lookup("Alice")).resolves.toMatchObject({
        height: "159cm", url: "https://ja.wikipedia.org/wiki/Canonical",
    });
});

it.each([
    ["别名", "First Alias<br>櫻井澤亞 ＡＬＩＣＥ<sup class=\"reference\">[1]</sup>"],
    ["别名义", "<ul><li>First Alias</li><li>櫻井沢亜 Alice</li></ul>"],
    ["藝名", "First Alias、桜井泽亚 ALICE"],
    ["艺名", "First Alias，櫻井澤亞 Alice"],
])("checks full aliases in the %s infobox row", (label, aliases) => {
    const article = "https://ja.wikipedia.org/wiki/Canonical";
    const data = fixture.replace("<table>", '<div id="mw-normal-catlinks"><a>日本のAV女優</a></div>'
        + '<table class="infobox"><tr><th>' + label + '</th><td>' + aliases + '</td></tr>');
    expect(parseWikipediaActressPage(data, article, "桜井沢亜 alice").info).toMatchObject({ height: "159cm" });
    expect(parseWikipediaActressPage(data, article, "沢亜 alice").info).toBeNull();
    expect(parseWikipediaActressPage(data.replace(label, "出身"), article, "桜井沢亜 alice").info).toBeNull();
});

it("keeps the original lookup spelling and follows only a unique title after folding variants", async () => {
    const query = "桜井 Alice";
    const originalUrl = new URL("/wiki/" + encodeURIComponent(query), "https://ja.wikipedia.org").href;
    const candidate = new URL("/wiki/櫻井_ALICE_(AV女優)", originalUrl).href;
    const link = '<a href="/wiki/櫻井_ALICE_(AV女優)">One</a>';
    const request = vi.fn(async ({ url }) => ({
        data: url === originalUrl ? '<main id="disambigbox">' + link + '</main>' : fixture,
        finalUrl: url,
    }));
    await expect(createWikipediaAdapter({ request }).lookup(query)).resolves.toMatchObject({ url: candidate });
    expect(request.mock.calls.map(([options]) => options.url)).toEqual([originalUrl, candidate]);

    const ambiguous = '<main id="disambigbox">' + link + '<a href="/wiki/桜井_Alice_(AV女優)">Two</a></main>';
    expect(parseWikipediaActressPage(ambiguous, originalUrl, query)).toEqual({ info: null, disambigUrls: [] });
});
