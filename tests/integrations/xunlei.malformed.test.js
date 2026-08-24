import { expect, it } from "vitest";
import { createXunleiAdapter } from "../../src/integrations/xunlei/manifest.js";
import { parseXunleiSubtitles } from "../../src/integrations/xunlei/parser.js";

it("rejects malformed Xunlei search responses", () => {
    expect(() => parseXunleiSubtitles({ data: null })).toThrow(/结构无效/);
});

it("drops unsafe subtitle URLs", () => {
    expect(parseXunleiSubtitles({ data: [{ name: "unsafe", ext: "srt", url: "http://127.0.0.1/a.srt" }] })).toEqual([]);
});

it("rejects non-text subtitle bodies and unavailable providers", async () => {
    const malformed = createXunleiAdapter({ request: async () => ({ data: {}, finalUrl: "https://subtitle.example/a.srt" }) });
    await expect(malformed.download({ url: "https://subtitle.example/a.srt" })).rejects.toThrow(/不是文本/);
    const unavailable = createXunleiAdapter({ request: async () => { throw new Error("provider unavailable"); } });
    await expect(unavailable.search({ carNum: "ABC-123" })).rejects.toThrow("provider unavailable");
});
