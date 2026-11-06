// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import jquery from "jquery";
import { parseJavStoreSearch } from "../../src/integrations/javstore/parser.js";
import { createJavStoreAdapter } from "../../src/integrations/javstore/manifest.js";

const html = readFileSync(join(import.meta.dirname, "../fixtures/integrations/javstore/search-title-date.html"), "utf8");
const candidate = "https://javstore.net/596549-[ENGSUB]SNOS-439-fixture-pn.html";
const image = "https://img2.javstore.net/images/2026/11/05/ENGSUB-FHD-SNOS-439_s.jpg";

it("does not combine an English title tail with the publication day into a movie number", () => {
    expect(parseJavStoreSearch(html, "SNOS-439")).toEqual([candidate]);
    expect(parseJavStoreSearch(jquery(html), "SNOS-439")).toEqual([candidate]);
});

it("still rejects conflicting movie numbers beside a publication date", () => {
    const conflict = html.replace("<h3>[ENGSUB]SNOS-439", "<h3>[ENGSUB]SNOS-438");
    expect(parseJavStoreSearch(conflict, "SNOS-439")).toEqual([]);
});

it("reaches the explicit CLICK HERE preview through the search adapter", async () => {
    const request = vi.fn(async options => ({
        data: options.url.includes("/search?") ? html
            : '<main><a href="http://img2.javstore.net/images/2026/11/05/ENGSUB-FHD-SNOS-439_s.jpg"><font><b> CLICK HERE! </b></font></a></main>',
        finalUrl: options.url,
    }));
    await expect(createJavStoreAdapter({ request }).getImages({ carNum: "SNOS-439" }))
        .resolves.toEqual([{ url: image, providerId: "javstore" }]);
    expect(request.mock.calls.map(([options]) => options.url))
        .toEqual(["https://javstore.net/search?q=SNOS-439", candidate]);
});
