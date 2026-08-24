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
