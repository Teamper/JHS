// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createExternalSitesAdapter } from "../../src/integrations/external-sites/manifest.js";

const fixture = readFileSync(join(import.meta.dirname, "../fixtures/integrations/external-sites/javdb-search.html"), "utf8");

it("normalizes external search links and enforces exact configured origins", async () => {
    const request = vi.fn(async options => ({ data: fixture, finalUrl: options.url })), adapter = createExternalSitesAdapter({ request });
    await expect(adapter.searchSite("javDbBtn", "ABC-123", { scope: "scope" })).resolves.toEqual({ searchUrl: "https://javdb.com/search?q=ABC-123", matches: ["https://javdb.com/v/abc"] });
    expect(request.mock.calls[0][0].urlPolicy).toEqual({ trustClass: "builtin-public", hosts: ["javdb.com"], expectedOrigin: "https://javdb.com" });
    await adapter.searchSite("javDbBtn", "ABC-123", { settings: { javDbUrl: "https://mirror.example" } });
    expect(request.mock.calls[1][0].urlPolicy).toEqual({ trustClass: "custom-public", expectedOrigin: "https://mirror.example" });
});

it("reads SupJav results from post cards and keeps only configured-origin matches", async () => {
    const data = readFileSync(join(import.meta.dirname, "../fixtures/integrations/external-sites/supjav-search.html"), "utf8");
    const adapter = createExternalSitesAdapter({ request: vi.fn(async () => ({ data })) });
    await expect(adapter.searchSite("supJavBtn", "ABC-123")).resolves.toEqual({
        searchUrl: "https://supjav.com/?s=ABC-123",
        matches: ["https://supjav.com/abc-123.html"],
    });
});

it("keeps the JavBus search URL separate from the direct detail check", async () => {
    const request = vi.fn(async () => ({ data: "<div class='container'><h3>ABC-123 Fixture</h3></div>" }));
    const adapter = createExternalSitesAdapter({ request });
    await expect(adapter.searchSite("javBusBtn", "ABC-123")).resolves.toEqual({
        searchUrl: "https://www.javbus.com/search/ABC-123",
        matches: ["https://www.javbus.com/ABC-123"],
    });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: "https://www.javbus.com/ABC-123" }), undefined);
});
