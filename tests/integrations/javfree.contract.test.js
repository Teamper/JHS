// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createJavFreeAdapter } from "../../src/integrations/javfree/manifest.js";
import { parseJavFreeSearch, parseJavFreeImages } from "../../src/integrations/javfree/parser.js";
const fixture = name => readFileSync(join(import.meta.dirname, `../fixtures/integrations/javfree/${name}.html`), "utf8");
const detailUrl = "https://javfree.me/202569/ssis-001";
describe("javfree screenshot contract", () => {
    it("parses captured search and full-size screenshot markup", () => {
        expect(parseJavFreeSearch(fixture("search"), "SSIS-001", "https://javfree.me/")).toEqual([detailUrl]);
        const images = parseJavFreeImages(fixture("detail"), "SSIS-001", detailUrl);
        expect(images.length).toBeGreaterThan(0);
        expect(images.every(image => image.providerId === "javfree" && new URL(image.url).protocol === "https:")).toBe(true);
        expect(images[0].url.endsWith("SSIS-001-demosaic.jpeg")).toBe(true);
    });
    it("uses integration HTTP and forwards scope and refresh", async () => {
        const http = { request: vi.fn().mockResolvedValueOnce({ data: fixture("search") }).mockResolvedValueOnce({ data: fixture("detail"), finalUrl: detailUrl }) };
        const scope = { assertActive: vi.fn() };
        const result = await createJavFreeAdapter(http).getImages({ carNum: "SSIS-001" }, { scope, refreshCache: true });
        expect(result.length).toBeGreaterThan(0);
        expect(http.request).toHaveBeenCalledTimes(2);
        expect(http.request.mock.calls[0][0]).toMatchObject({ providerId: "javfree", capability: "movie.images", method: "GET", refreshCache: true, urlPolicy: { trustClass: "builtin-public" } });
        expect(http.request.mock.calls[1][1]).toBe(scope);
    });
});

it("matches FC2 numeric screenshot filenames exactly and supports lazy images", () => {
    const html = '<h1 class="entry-title">FC2-PPV-1234567</h1><div class="entry-content"><img data-src="//cf.javfree.me/test/1234567_1.jpg"><img src="https://cf.javfree.me/test/12345670_1.jpg"></div>';
    expect(parseJavFreeImages(html, "FC2-1234567", "https://javfree.me/777/fc2-ppv-1234567")).toEqual([{ url: "https://cf.javfree.me/test/1234567_1.jpg", providerId: "javfree" }]);
});
