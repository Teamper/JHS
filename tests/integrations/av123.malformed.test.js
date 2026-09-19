import jquery from "jquery";
import { JSDOM } from "jsdom";
import { expect, it, vi } from "vitest";
import { create123AvAdapter } from "../../src/integrations/av123/manifest.js";
import { parse123AvCards } from "../../src/integrations/av123/parser.js";

it("treats malformed 123AV cards as an empty contract", () => {
    const dom = new JSDOM('<article class="card"><script>alert(1)</script></article>');
    expect(parse123AvCards(jquery(dom.window)(dom.window.document))).toEqual([]);
});

it("keeps malformed provider responses out of normalized contracts", async () => {
    const runtime = new JSDOM();
    vi.stubGlobal("DOMParser", runtime.window.DOMParser);
    const adapter = create123AvAdapter({ request: async options => ({ status: 200, data: "<html></html>", finalUrl: options.url }) });
    await expect(adapter.resolveMovie({ carNum: "FC2-123" })).resolves.toBeNull();
    await expect(adapter.getDetail({ carNum: "FC2-123" })).rejects.toThrow(/malformed/);
    vi.unstubAllGlobals();
});
