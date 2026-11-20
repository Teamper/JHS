// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { JhsError } from "../../src/core/jhs-error.js";
import { LifecycleScope } from "../../src/core/lifecycle-scope.js";
import { createWikipediaAdapter } from "../../src/integrations/wikipedia/manifest.js";
import { parseWikipediaActressInfo, parseWikipediaActressPage } from "../../src/integrations/wikipedia/parser.js";

it("rejects malformed Wikipedia pages", () => {
    expect(() => parseWikipediaActressInfo("<html><body>missing</body></html>", "https://ja.wikipedia.org/wiki/test")).toThrow("information is missing");
    expect(() => parseWikipediaActressPage(/** @type {any} */ (null), "https://ja.wikipedia.org/wiki/test")).toThrow(TypeError);
});

it("never fabricates cm when height has no cm unit and ignores non-matching links without disambigbox", () => {
    const html = `<html><body><table>
        <tr><th>誕生日</th><td>1995年1月2日</td></tr>
        <tr><th>身長</th><td>159</td></tr>
        <tr><th>体重</th><td>― / ― kg</td></tr>
    </table><div id="mw-content-text"><a href="/wiki/Other_(AV%E5%A5%B3%E5%84%AA)">Other</a></div></body></html>`;
    const parsed = parseWikipediaActressPage(html, "https://ja.wikipedia.org/wiki/Alice", "Alice");
    expect(parsed.info?.height).toBe("");
    expect(parsed.info?.weight).toBe("");
    expect(parsed.disambigUrls).toEqual([]);

    const unitlessOnly = parseWikipediaActressPage("<html><body><table><tr><th>身長</th><td>5 ft 3 in</td></tr></table></body></html>", "https://ja.wikipedia.org/wiki/Alice", "Alice");
    expect(unitlessOnly.info).toBeNull();
});

it("propagates AbortSignal and transient block errors from disambiguation requests", async () => {
    const disambigHtml = `<div id="disambigbox"></div><div id="mw-content-text"><a href="/wiki/Alice_(AV%E5%A5%B3%E5%84%AA)">Alice</a></div>`;
    const scope = new LifecycleScope("wiki-abort");
    const request = vi.fn(async (options, passedScope) => {
        if (options.url.endsWith("/wiki/Alice")) {
            scope.dispose();
            return { data: disambigHtml, finalUrl: options.url };
        }
        expect(passedScope?.signal?.aborted).toBe(true);
        throw new JhsError("ABORTED", "aborted");
    });
    await expect(createWikipediaAdapter({ request }).lookup("Alice", { scope })).rejects.toMatchObject({ code: "ABORTED" });

    const rateLimited = vi.fn(async (options) => {
        if (options.url.endsWith("/wiki/Alice")) return { data: disambigHtml, finalUrl: options.url };
        throw new JhsError("RATE_LIMITED", "429", { retryable: true });
    });
    await expect(createWikipediaAdapter({ request: rateLimited }).lookup("Alice")).rejects.toMatchObject({ code: "RATE_LIMITED" });
});
