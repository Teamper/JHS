// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createProjectJavAdapter } from "../../src/integrations/projectjav/manifest.js";
import { parseProjectJavSearch, parseProjectJavImages } from "../../src/integrations/projectjav/parser.js";
const fixture = name => readFileSync(join(import.meta.dirname, `../fixtures/integrations/projectjav/${name}.html`), "utf8");
const detailUrl = "https://projectjav.com/movie/ssis-001-79945";
describe("projectjav screenshot contract", () => {
    it("parses captured search and full-size screenshot markup", () => {
        expect(parseProjectJavSearch(fixture("search"), "SSIS-001", "https://projectjav.com/")).toEqual([detailUrl]);
        const images = parseProjectJavImages(fixture("detail"), "SSIS-001", detailUrl);
        expect(images.length).toBeGreaterThan(0);
        expect(images.every(image => image.providerId === "projectjav" && new URL(image.url).protocol === "https:")).toBe(true);
        expect(images[0].url.endsWith("/screenshots/79945.jpg")).toBe(true);
    });
    it("uses integration HTTP and forwards scope and refresh", async () => {
        const http = { request: vi.fn().mockResolvedValueOnce({ data: fixture("search") }).mockResolvedValueOnce({ data: fixture("detail"), finalUrl: detailUrl }) };
        const scope = { assertActive: vi.fn() };
        const result = await createProjectJavAdapter(http).getImages({ carNum: "SSIS-001" }, { scope, refreshCache: true });
        expect(result.length).toBeGreaterThan(0);
        expect(http.request).toHaveBeenCalledTimes(2);
        expect(http.request.mock.calls[0][0]).toMatchObject({ providerId: "projectjav", capability: "movie.images", method: "GET", refreshCache: true, urlPolicy: { trustClass: "builtin-public" } });
        expect(http.request.mock.calls[1][1]).toBe(scope);
    });
});

it("continues after a missing first detail", async () => {
    const original = fixture("search");
    const search = original.replaceAll("79945", "11111").replaceAll("202569", "11111") + original;
    let details = 0;
    const request = vi.fn(async options => {
        if (details === 0) { details++; return { data: search }; }
        if (details++ === 1) throw Object.assign(new Error("missing"), { code: "NOT_FOUND" });
        return { data: fixture("detail"), finalUrl: detailUrl };
    });
    const result = await createProjectJavAdapter({ request }).getImages({ carNum: "SSIS-001" });
    expect(result.length).toBeGreaterThan(0);
    expect(request).toHaveBeenCalledTimes(3);
});

it.each(["ABORTED", "UNAUTHORIZED", "TIMEOUT"])("preserves %s from detail requests", async code => {
    const failure = Object.assign(new Error(code), { code });
    const request = vi.fn().mockResolvedValueOnce({ data: fixture("search") }).mockRejectedValueOnce(failure);
    await expect(createProjectJavAdapter({ request }).getImages({ carNum: "SSIS-001" })).rejects.toBe(failure);
    expect(request).toHaveBeenCalledTimes(2);
});
