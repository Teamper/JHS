import { describe, expect, it, vi } from "vitest";
import { MovieIdentityService } from "../src/services/movie-identity-service.js";
import { extractJavDbMovieId } from "../src/core/movie-identity.js";

describe("MovieIdentityService", () => {
    it("extracts movie ids only from explicit detail routes", () => {
        expect(extractJavDbMovieId("https://javdb.com/v/movie-123?ref=test")).toBe("movie-123");
        expect(extractJavDbMovieId("https://javdb.com/search?q=FC2-1234567")).toBeNull();
        expect(extractJavDbMovieId("https://123av.com/cn/v/fc2-ppv-1234567")).toBeNull();
    });
    it("uses JavDB as the default canonical resolver without probing AV123 first", async () => {
        const av123 = { resolveMovie: vi.fn(async () => ({ movieId: "av123" })) };
        const javdb = { resolveMovie: vi.fn(async () => ({ movieId: "javdb" })) };
        const integrations = {
            list: vi.fn(() => [{ id: "av123" }, { id: "javdb" }]),
            getAdapter: vi.fn(id => ({ av123, javdb })[id]),
        };
        await expect(new MovieIdentityService(integrations).resolve({ carNum: "ABC-123" })).resolves.toMatchObject({ movieId: "javdb" });
        expect(av123.resolveMovie).not.toHaveBeenCalled();
    });

    it("honors an explicitly selected Integration", async () => {
        const av123 = { resolveMovie: vi.fn(async () => ({ movieId: "av123" })) };
        const integrations = { list: vi.fn(() => [{ id: "av123" }, { id: "javdb" }]), getAdapter: vi.fn(() => av123) };
        await expect(new MovieIdentityService(integrations).resolve({ carNum: "FC2-123", providerId: "av123" })).resolves.toMatchObject({ movieId: "av123" });
        expect(integrations.getAdapter).toHaveBeenCalledWith("av123");
    });

    it("routes JavDB detail requests by movie id", async () => {
        const getDetail = vi.fn(async () => ({ movieId: "9", carNum: "ABC-123" }));
        const integrations = { list: vi.fn(() => [{ id: "av123" }, { id: "javdb" }]), getAdapter: vi.fn(() => ({ getDetail })) };
        await expect(new MovieIdentityService(integrations).detail({ movieId: "9" }, { scope: "scope" })).resolves.toMatchObject({ movieId: "9" });
        expect(integrations.getAdapter).toHaveBeenCalledWith("javdb");
        expect(getDetail).toHaveBeenCalledWith({ movieId: "9" }, { scope: "scope" });
    });

    it("routes ranking queries through the declared capability", async () => {
        const listRankings = vi.fn(async () => [{ movieId: "9" }]);
        const integrations = { list: vi.fn(() => [{ id: "javdb" }]), getAdapter: vi.fn(() => ({ listRankings })) };
        await expect(new MovieIdentityService(integrations).rankings({ period: "daily" })).resolves.toEqual([{ movieId: "9" }]);
        expect(listRankings).toHaveBeenCalledWith({ period: "daily" });
    });

    it("routes catalog queries only to the selected provider", async () => {
        const listCatalog = vi.fn(async () => ({ items: [{ carNum: "FC2-1" }], maxPage: 2 }));
        const integrations = { list: vi.fn(() => [{ id: "av123" }]), getAdapter: vi.fn(() => ({ listCatalog })) };
        await expect(new MovieIdentityService(integrations).catalog("av123", { page: 1 }, { scope: "scope" })).resolves.toMatchObject({ maxPage: 2 });
        expect(integrations.list).toHaveBeenCalledWith("movie.catalog");
        expect(listCatalog).toHaveBeenCalledWith({ page: 1 }, { scope: "scope" });
    });

    it("routes preview requests through the selected Integration", async () => {
        const getPreviewForMovie = vi.fn(async () => ({ sources: { hhb: "https://cdn.example/preview.mp4" } }));
        const integrations = { list: vi.fn(() => [{ id: "dmm" }]), getAdapter: vi.fn(() => ({ getPreviewForMovie })) };
        await expect(new MovieIdentityService(integrations).preview("dmm", { carNum: "ABC-123" }, { scope: "scope" })).resolves.toMatchObject({ sources: { hhb: "https://cdn.example/preview.mp4" } });
        expect(integrations.list).toHaveBeenCalledWith("movie.preview");
        expect(getPreviewForMovie).toHaveBeenCalledWith({ carNum: "ABC-123" }, { scope: "scope" });
    });

    it("builds provider-owned source URLs without leaking hosts into features", () => {
        const integrations = { getAdapter: vi.fn(id => ({ detailUrl: ({ carNum }) => `${id}:${carNum}` })) };
        expect(new MovieIdentityService(integrations).sourceUrls({ carNum: "FC2-1" }, ["fc2ppvdb", "fc2content"])).toEqual([
            { providerId: "fc2ppvdb", url: "fc2ppvdb:FC2-1" }, { providerId: "fc2content", url: "fc2content:FC2-1" },
        ]);
    });

    it("routes external-site catalogs, searches and navigation links through one Integration", async () => {
        const adapter = { getSites: vi.fn(() => [{ id: "javDbBtn" }]), searchSite: vi.fn(async () => ({ matches: ["movie"] })), getNavigationLinks: vi.fn(() => [{ id: "link" }]) };
        const integrations = { list: vi.fn(() => [{ id: "external-sites" }]), getAdapter: vi.fn(() => adapter) };
        const service = new MovieIdentityService(integrations);
        expect(service.externalSites({ javDbUrl: "configured" })).toEqual([{ id: "javDbBtn" }]);
        await expect(service.searchExternalSite("javDbBtn", "ABC-123", { scope: "scope" })).resolves.toEqual({ matches: ["movie"] });
        expect(adapter.searchSite).toHaveBeenCalledWith("javDbBtn", "ABC-123", { scope: "scope" });
        expect(service.externalNavigationLinks()).toEqual([{ id: "link" }]);
    });
});
