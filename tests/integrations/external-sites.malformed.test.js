// @vitest-environment jsdom
import { expect, it } from "vitest";
import { createExternalSitesAdapter, parseExternalSiteResults } from "../../src/integrations/external-sites/manifest.js";

it("rejects malformed responses, missing links and unknown sites", async () => {
    expect(() => parseExternalSiteResults(42, { id: "x" }, "ABC", "https://example.com")).toThrow(/不是 HTML/);
    expect(() => parseExternalSiteResults('<div class="item">ABC</div>', { id: "x", itemSelector: ".item" }, "ABC", "https://example.com")).toThrow(/缺少链接/);
    const adapter = createExternalSitesAdapter({ request: async () => ({ data: "" }) });
    await expect(adapter.searchSite("unknown", "ABC")).rejects.toMatchObject({ code: "UNSUPPORTED" });
});
