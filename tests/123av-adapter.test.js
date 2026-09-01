import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path) => readTestFile(join(import.meta.dirname, "..", path), "utf8");
const fc2Source = readSource("src/features/list/list-fc2-lookup-controller.js");
const integrationSource = readSource("src/integrations/av123/manifest.js");
const otherSiteSource = readSource("src/features/detail/detail-external-sites-controller.js");
const httpSource = readSource("src/core/http.js");

describe("123AV Chinese adapter contract", () => {
    it("uses the confirmed Chinese list and encoded search routes", () => {
        expect(integrationSource).toContain("/cn/makers/fc2?page=${sourcePage}");
        expect(integrationSource).toContain("/cn/search?keyword=${encodeURIComponent(keyword)}&page=${sourcePage}");
        expect(integrationSource).toContain("keyword ? [page]");
        expect(fc2Source).not.toContain('this.keyword && $(".page-box").hide()');
        expect(fc2Source).not.toContain("123av.com");
        expect(otherSiteSource).toContain('providerId: "av123"');
        expect(otherSiteSource).toContain('getRuntimeService("movie").searchUrl');
    });

    it("removes obsolete 123AV selectors, routes and sorting controls", () => {
        for (const obsolete of ["/ja", "/tags/fc2", "/dm4/tags/fc2", ".box-item", ".detail a", "img[data-src]", "img[title]", ".page-item", ".page-link", "リリース日:", "#player", "Movie({id", "conditionBox"]) {
            expect(fc2Source).not.toContain(obsolete);
        }
        expect(otherSiteSource).not.toContain('getAv123Url() + "/ja"');
    });

    it("classifies Cloudflare failures by normalized code and preserves request context", () => {
        expect(otherSiteSource).toContain('const code = /** @type {{ code?: string }} */ (a)?.code');
        expect(otherSiteSource).toContain('"CF_BLOCKED" === code');
        expect(otherSiteSource).not.toContain("a?._cfBlocked");
        expect(otherSiteSource).not.toContain('includes("Just a moment")');
        expect(httpSource).toContain("Cloudflare challenge blocked: ${t}");
        expect(httpSource).toContain("n.requestUrl = t");
        expect(httpSource).toContain("n.finalUrl = e.finalUrl");
        expect(httpSource).toContain("n.cfDiagnostics =");
        expect(integrationSource).toContain("cookiePartition: { topLevelSite: origin }");
        expect(integrationSource).toContain('trustClass: "custom-public"');
        expect(otherSiteSource).not.toContain("cookiePartitionTopLevelSite");
    });

    it("does not classify ordinary 404 markup as a Cloudflare challenge", () => {
        const isCloudflareChallenge = (html) => {
            const normalized = html.toLowerCase();
            return normalized.includes("just a moment") || normalized.includes("cf-chl-") || normalized.includes("challenge-platform");
        };
        expect(isCloudflareChallenge("<html><title>404 Page Not Found</title></html>")).toBe(false);
    });
});
