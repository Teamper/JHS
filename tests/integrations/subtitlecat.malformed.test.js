// @vitest-environment jsdom
import { expect, it } from "vitest";
import { parseSubtitleCatDownloads, parseSubtitleCatSearch } from "../../src/integrations/subtitlecat/parser.js";

it("rejects neighboring and contradictory movie identities, offsite links and malformed paths", () => {
    const html = `<a href="/subs/1/SSIS-0010.html">SSIS-0010</a><a href="/subs/1/SSIS-001.html">SSIS-002</a><a href="https://evil.example/subs/1/SSIS-001.html">SSIS-001</a><a href="/subs/1/%ZZ.html">SSIS-001</a>`;
    expect(parseSubtitleCatSearch(html, "https://www.subtitlecat.com", "SSIS-001")).toEqual([]);
    expect(() => parseSubtitleCatSearch(null, "https://subtitlecat.com", "SSIS-001")).toThrow();
    expect(() => parseSubtitleCatSearch("<title>Just a moment</title>", "https://subtitlecat.com", "SSIS-001")).toThrow();
});

it("only exposes safe downloadable languages for the complete requested code", () => {
    const html = `<a id="download_zh-CN" href="/subs/1/FC2-1234567-zh-CN.srt">Download</a><a id="download_en" href="/subs/1/FC2-12345678-en.srt">Download</a><a id="download_ja" href="http://subtitlecat.com/subs/1/FC2-1234567-ja.srt">Download</a><a id="download_bad_script" href="/subs/1/FC2-1234567-zh.srt">Download</a>`;
    expect(parseSubtitleCatDownloads(html, "https://subtitlecat.com/subs/1/FC2-1234567.html", "FC2-1234567", "FC2")).toMatchObject([{ language: "zh-CN" }]);
    expect(parseSubtitleCatDownloads(html, "https://subtitlecat.com/subs/1/FC2-12345678.html", "FC2-1234567", "FC2")).toEqual([]);
});
