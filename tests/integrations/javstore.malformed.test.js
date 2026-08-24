// @vitest-environment jsdom
import { expect, it } from "vitest";
import { createJavStoreAdapter } from "../../src/integrations/javstore/manifest.js";
import { parseJavStoreSearch } from "../../src/integrations/javstore/parser.js";

it("rejects malformed JavStore candidates", () => {
    expect(parseJavStoreSearch('<a href="javascript:alert(1)">ABC-123</a>', "ABC-123")).toEqual([]);
});

it("returns an empty contract without requesting a detail when no candidate matches", async () => {
    let calls = 0;
    const adapter = createJavStoreAdapter({ request: async options => ({ status: 200, data: (++calls, "<html></html>"), finalUrl: options.url }) });
    await expect(adapter.getImages({ carNum: "ABC-123" })).resolves.toEqual([]);
    expect(calls).toBe(1);
});
