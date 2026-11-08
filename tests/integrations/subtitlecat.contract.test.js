// @vitest-environment jsdom
import { readFileSync } from "node:fs"; import { join } from "node:path"; import jquery from "jquery"; import { expect, it } from "vitest"; import { createSubtitleCatAdapter } from "../../src/integrations/subtitlecat/manifest.js"; import { parseSubtitleCatResults } from "../../src/integrations/subtitlecat/parser.js";
import { parseSubtitleCatSearch, parseSubtitleCatDownloads } from "../../src/integrations/subtitlecat/parser.js";
it("normalizes SubtitleCat results", () => { document.documentElement.innerHTML = readFileSync(join(import.meta.dirname, "../fixtures/integrations/subtitlecat/results.html"), "utf8"); expect(parseSubtitleCatResults(jquery(document), "https://subtitlecat.com/")[0]).toEqual({ language: "Chinese", url: "https://subtitlecat.com/subtitles/test-zh" }); });
it("owns the SubtitleCat search URL", () => { expect(createSubtitleCatAdapter().detailUrl({ carNum: "ABC-123" })).toBe("https://subtitlecat.com/index.php?search=ABC-123"); });
it("parses current relative search links and downloadable language variants", async () => {
    const search = readFileSync(join(import.meta.dirname, "../fixtures/integrations/subtitlecat/search.html"), "utf8");
    const detail = readFileSync(join(import.meta.dirname, "../fixtures/integrations/subtitlecat/detail.html"), "utf8");
    const candidates = parseSubtitleCatSearch(search, "https://www.subtitlecat.com/index.php", "SSIS-001");
    expect(candidates).toHaveLength(2);
    expect(candidates[0].url).toBe("https://www.subtitlecat.com/subs/1707/ssis-001-zhTW.html");
    expect(parseSubtitleCatDownloads(detail, candidates[0].url, "SSIS-001", candidates[0].name).map(item => item.language)).toEqual(["zh-CN", "zh-TW", "en"]);
    const calls = [];
    const adapter = createSubtitleCatAdapter({ request: async (options, scope) => { calls.push([options, scope]); return { data: calls.length === 1 ? search : detail, finalUrl: options.url }; } });
    expect(await adapter.search({ carNum: "SSIS-001" }, { scope: { assertActive() {} } })).toHaveLength(6);
    expect(calls).toHaveLength(3);
    expect(calls[0][0]).toMatchObject({ capability: "subtitle.search", urlPolicy: { hosts: ["subtitlecat.com"] } });
    expect(calls[0][0].cacheAccept({ data: search })).toBe(true);
    expect(calls[0][0].cacheAccept({ data: "<title>Just a moment</title>" })).toBe(false);
    expect(calls[1][0].cacheAccept({ data: detail })).toBe(true);
    expect(calls[1][0].cacheAccept({ data: "<html>error</html>" })).toBe(false);
    calls.length = 0;
    await adapter.search({ carNum: "SSIS-001" }, { refreshCache: true });
    expect(calls.every(([request]) => request.refreshCache === true)).toBe(true);
});
