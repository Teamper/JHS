import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createXunleiAdapter } from "../../src/integrations/xunlei/manifest.js";
import { parseXunleiSubtitles } from "../../src/integrations/xunlei/parser.js";
import { SubtitleService } from "../../src/services/subtitle-service.js";

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/integrations/xunlei/subtitles.json"), "utf8"));

it("normalizes Xunlei subtitle contracts", () => {
    expect(parseXunleiSubtitles(fixture)).toEqual([{ name: "ABC-123 Chinese", extension: "srt", url: "https://subtitle.example/ABC-123.srt", providerId: "xunlei" }]);
});

it("searches and downloads through explicit URL trust boundaries", async () => {
    const request = vi.fn()
        .mockResolvedValueOnce({ data: fixture, finalUrl: "https://api-shoulei-ssl.xunlei.com/oracle/subtitle" })
        .mockResolvedValueOnce({ data: "1\n00:00:01,000 --> 00:00:02,000\ntext", finalUrl: "https://subtitle.example/ABC-123.srt" });
    const adapter = createXunleiAdapter({ request });
    const [item] = await adapter.search({ carNum: "ABC-123" }, { scope: "scope" });
    await expect(adapter.download(item, { scope: "scope" })).resolves.toContain("text");
    expect(request.mock.calls[0][0]).toMatchObject({ cacheScope: "public", urlPolicy: { trustClass: "builtin-public", hosts: ["xunlei.com"] } });
    expect(request.mock.calls[1][0]).toMatchObject({ cacheScope: "public", urlPolicy: { trustClass: "custom-public" } });
});

it("routes subtitle operations through the selected Integration", async () => {
    const search = vi.fn(async () => [fixture.data[0]]), download = vi.fn(async () => "text");
    const integrations = { list: vi.fn(() => [{ id: "xunlei" }]), getAdapter: vi.fn(() => ({ search, download })) };
    const service = new SubtitleService(integrations);
    await expect(service.search("xunlei", { carNum: "ABC-123" })).resolves.toHaveLength(1);
    await expect(service.download("xunlei", { url: "https://subtitle.example/a.srt" })).resolves.toBe("text");
});
