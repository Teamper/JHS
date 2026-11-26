// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { create123AvAdapter } from "../src/integrations/av123/manifest.js";
import { isCloudflareChallenge } from "../src/services/http-service.js";

const cards = readFileSync(join(import.meta.dirname, "fixtures/123av-cards.html"), "utf8");

describe("123AV Chinese adapter contract", () => {
    it("combines two Chinese catalog pages and searches one encoded page at a time", async () => {
        const request = vi.fn(async ({ url }) => ({ data: cards, finalUrl: url }));
        const adapter = create123AvAdapter({ request });
        const catalog = await adapter.listCatalog({ page: 2 });
        expect(catalog.maxPage).toBe(1378);
        expect(catalog.items).toHaveLength(12);
        expect(request.mock.calls.map(([input]) => input.url)).toEqual([
            "https://123av.com/cn/makers/fc2?page=3",
            "https://123av.com/cn/makers/fc2?page=4",
        ]);
        request.mockClear();
        const search = await adapter.listCatalog({ page: 3, keyword: "FC2 番号 &" });
        expect(search.maxPage).toBe(2756);
        expect(request).toHaveBeenCalledOnce();
        const url = new URL(request.mock.calls[0][0].url);
        expect(url.pathname).toBe("/cn/search");
        expect([...url.searchParams]).toEqual([["keyword", "FC2 番号 &"], ["page", "3"]]);
    });

    it("partitions requests by the configured HTTPS origin and keeps default origins on the allowlist", async () => {
        const request = vi.fn(async ({ url }) => ({ data: cards, finalUrl: url }));
        const adapter = create123AvAdapter({ request }, { snapshot: () => ({ av123Url: "https://catalog.example/custom" }) });
        await adapter.listCatalog({ keyword: "FC2-123" });
        expect(request).toHaveBeenCalledWith(expect.objectContaining({
            requestOptions: { cookiePartition: { topLevelSite: "https://catalog.example" } },
            urlPolicy: { trustClass: "custom-public", expectedOrigin: "https://catalog.example" },
        }), undefined);
        request.mockClear();
        await create123AvAdapter({ request }).listCatalog({ keyword: "FC2-123" });
        expect(request).toHaveBeenCalledWith(expect.objectContaining({
            requestOptions: { cookiePartition: { topLevelSite: "https://123av.com" } },
            urlPolicy: { trustClass: "builtin-public", hosts: ["123av.com"], expectedOrigin: "https://123av.com" },
        }), undefined);
    });

    it("does not classify ordinary 404 markup as a Cloudflare challenge", () => {
        expect(isCloudflareChallenge("<html><title>404 Page Not Found</title></html>", 404)).toBe(false);
    });
});
