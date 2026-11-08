import { expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { SubtitleService } from "../src/services/subtitle-service.js";

const body = new TextEncoder().encode("1\n00:00:01,000 --> 00:00:02,000\n字幕\n").buffer;
const record = { providerId: "xunlei", extension: "srt", url: "https://subtitle.example/test.srt" };

it("progressively settles independent sources including partial failure", async () => {
    let finish;
    const slow = new Promise(resolve => { finish = resolve; });
    const update = vi.fn(), adapters = { xunlei: { search: () => [record] }, subtitlecat: { search: () => slow } };
    const service = new SubtitleService({ list: () => Object.keys(adapters).map(id => ({ id })), getAdapter: id => adapters[id] });
    const pending = service.searchAll({ carNum: "ABC-123" }, { onSource: update });
    await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
    finish([]);
    expect(await pending).toMatchObject([{ status: "success" }, { status: "empty" }]);
    adapters.subtitlecat.search = () => { throw new Error("offline"); };
    expect((await service.searchAll({}))[1]).toMatchObject({ status: "error", error: "offline" });
});

it("shares original bytes across preview/download consumers and retains a safe copy", async () => {
    const downloadAsset = vi.fn(async () => ({ data: body }));
    const service = new SubtitleService({ getAdapter: () => ({ downloadAsset }) });
    const [a, b] = await Promise.all([service.fetchAsset("xunlei", record), service.fetchAsset("xunlei", record)]);
    expect(downloadAsset).toHaveBeenCalledOnce();
    new Uint8Array(a.bytes)[0] = 0;
    const cached = await service.fetchAsset("xunlei", record);
    expect(cached.bytes).toEqual(b.bytes);
    expect(cached.bytes).not.toBe(b.bytes);
});

it("cancels each consumer independently and aborts only the last one", async () => {
    let finish, requestScope;
    const downloadAsset = vi.fn((_item, options) => { requestScope = options.scope; return new Promise(resolve => { finish = resolve; }); });
    const service = new SubtitleService({ getAdapter: () => ({ downloadAsset }) });
    const first = new LifecycleScope("first"), second = new LifecycleScope("second");
    const a = service.fetchAsset("xunlei", record, { scope: first }), b = service.fetchAsset("xunlei", record, { scope: second });
    const rejected = expect(a).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(downloadAsset).toHaveBeenCalledOnce());
    first.dispose(); await rejected;
    expect(requestScope.disposed).toBe(false);
    finish({ data: body });
    expect((await b).bytes).toEqual(body);
    expect(requestScope.disposed).toBe(true);
    second.dispose();
});

it("evicts failed/error-page downloads and refuses late writes after cancellation", async () => {
    let finish;
    const downloadAsset = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const service = new SubtitleService({ getAdapter: () => ({ downloadAsset }) });
    const scope = new LifecycleScope("last");
    const task = service.fetchAsset("xunlei", record, { scope });
    const rejected = expect(task).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(downloadAsset).toHaveBeenCalledOnce());
    scope.dispose(); await rejected;
    finish({ data: body }); await new Promise(resolve => setTimeout(resolve, 0));
    expect(service.assets.size).toBe(0);
    downloadAsset.mockResolvedValue({ data: new TextEncoder().encode("<html>Error</html>").buffer });
    await expect(service.fetchAsset("xunlei", record)).rejects.toThrow();
    downloadAsset.mockResolvedValue({ data: body });
    expect((await service.fetchAsset("xunlei", record)).text).toContain("字幕");
    expect(downloadAsset).toHaveBeenCalledTimes(3);
});
