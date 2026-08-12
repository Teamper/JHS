import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path) => readFileSync(join(import.meta.dirname, "..", path), "utf8");
const fc2Source = readSource("src/plugins/external-search/fc2-by-123av.js");
const otherSiteSource = readSource("src/plugins/external-search/other-site.js");
const httpSource = readSource("src/core/http.js");

describe("123AV Chinese adapter contract", () => {
    it("uses the confirmed Chinese list and encoded search routes", () => {
        expect(fc2Source).toContain("/cn/makers/fc2?page=${sourcePage}");
        expect(fc2Source).toContain("/cn/search?keyword=${encodeURIComponent(this.keyword)}");
        expect(otherSiteSource).toContain('`${await this.getAv123Url()}/cn`');
        expect(otherSiteSource).toContain("encodeURIComponent(t)");
    });

    it("removes obsolete 123AV selectors, routes and sorting controls", () => {
        for (const obsolete of ["/ja", "/tags/fc2", "/dm4/tags/fc2", ".box-item", ".detail a", "img[data-src]", "img[title]", ".page-item", ".page-link", "リリース日:", "#player", "Movie({id", "conditionBox"]) {
            expect(fc2Source).not.toContain(obsolete);
        }
        expect(otherSiteSource).not.toContain('getAv123Url() + "/ja"');
    });

    it("classifies Cloudflare failures by property and preserves request context", () => {
        expect(otherSiteSource).toContain("a?._cfBlocked");
        expect(otherSiteSource).not.toContain('includes("Just a moment")');
        expect(httpSource).toContain("Cloudflare challenge blocked: ${t}");
        expect(httpSource).toContain("n.requestUrl = t");
        expect(httpSource).toContain("n.finalUrl = e.finalUrl");
        expect(httpSource).toContain("n.cfDiagnostics =");
        expect(fc2Source).toContain('cookiePartitionTopLevelSite: "https://123av.com"');
        expect(otherSiteSource).toContain('requestOptions: { cookiePartitionTopLevelSite: "https://123av.com" }');
    });

    it("does not classify ordinary 404 markup as a Cloudflare challenge", () => {
        const isCloudflareChallenge = (html) => {
            const normalized = html.toLowerCase();
            return normalized.includes("just a moment") || normalized.includes("cf-chl-") || normalized.includes("challenge-platform");
        };
        expect(isCloudflareChallenge("<html><title>404 Page Not Found</title></html>")).toBe(false);
    });
});
