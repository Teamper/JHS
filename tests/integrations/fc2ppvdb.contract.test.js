// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createFc2PpvDbAdapter } from "../../src/integrations/fc2ppvdb/manifest.js";
import { parseFc2PpvDbDetail, parseFc2PpvDbPeople } from "../../src/integrations/fc2ppvdb/parser.js";

const fixture = readFileSync(join(import.meta.dirname, "../fixtures/integrations/fc2ppvdb/detail.html"), "utf8");

it("normalizes an FC2PPVDB detail", () => {
    expect(parseFc2PpvDbDetail(fixture, "https://fc2ppvdb.com/articles/12345")).toMatchObject({ carNum: "FC2-12345", title: "Fixture FC2 title" });
});

it("normalizes FC2PPVDB actress and seller links", () => {
    expect(parseFc2PpvDbPeople(fixture, "https://fc2ppvdb.com/articles/12345")).toEqual({
        actors: [{ name: "Actress A", url: "https://fc2ppvdb.com/actresses/a" }],
        seller: { name: "Seller S", url: "https://fc2ppvdb.com/sellers/s" },
    });
});

it("loads details through the declared HTTP boundary", async () => {
    const request = vi.fn(async options => ({ status: 200, data: fixture, finalUrl: options.url }));
    const adapter = createFc2PpvDbAdapter({ request });
    await expect(adapter.getDetail({ carNum: "FC2-12345" })).resolves.toMatchObject({ carNum: "FC2-12345" });
    await expect(adapter.getPeople({ carNum: "FC2-12345" })).resolves.toMatchObject({ actors: [{ name: "Actress A" }] });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ providerId: "fc2ppvdb", capability: "movie.detail" }), undefined);
});
