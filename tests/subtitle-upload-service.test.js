import { expect, it, vi } from "vitest";
import { SubtitleUploadService } from "../src/services/subtitle-upload-service.js";

const bytes = new TextEncoder().encode("1\n00:00:01,000 --> 00:00:02,000\n字幕\n").buffer;
const file = { carNum: "ABC-123", accountId: "1", folderId: "10", filename: "ABC-123.zh.srt", bytes };

function harness() {
    const values = new Map(), queues = new Map();
    const storage = {
        getValue: vi.fn(async key => structuredClone(values.get(key))),
        setValue: vi.fn(async (key, value) => values.set(key, structuredClone(value))),
        listValues: async () => [...values.keys()],
    };
    const locks = { request: (key, run) => {
        const task = (queues.get(key) || Promise.resolve()).then(run);
        queues.set(key, task.catch(() => {})); return task;
    } };
    const offline = {
        getAccountIdentity: vi.fn(async () => ({ accountId: "1" })),
        listDirectory: vi.fn(async () => ({ items: [], hasMore: false, nextOffset: 0 })),
        uploadSubtitle: vi.fn(async (_provider, _file, options) => { options.onMutationDispatch(); return { fileId: "55" }; }),
    };
    const matching = { clear: vi.fn() }, events = { emit: vi.fn() };
    const service = new SubtitleUploadService({ offline, storage, matching, events, locks });
    return { service, offline, storage, values, matching, events };
}

it("persists intent before all requests and confirms uploaded files against remote evidence", async () => {
    const h = harness();
    h.offline.listDirectory.mockImplementation(async () => {
        expect(h.storage.setValue).toHaveBeenCalled();
        return { items: h.offline.uploadSubtitle.mock.calls.length ? [{ name: file.filename, size: bytes.byteLength, fileId: "55" }] : [], hasMore: false };
    });
    h.offline.uploadSubtitle.mockImplementation(async (_provider, _file, options) => {
        expect([...h.values.values()][0].state).toBe("dispatching");
        options.onMutationDispatch(); return { fileId: "55" };
    });
    expect(await h.service.submit(file)).toMatchObject({ state: "success", fileId: "55" });
    expect(h.matching.clear).toHaveBeenCalledOnce();
    expect(h.events.emit).toHaveBeenCalledWith("subtitle.uploaded", expect.objectContaining({ folderId: "10" }));
    expect(JSON.stringify([...h.values.values()])).not.toMatch(/signature|policy|bytes/);
});

it("does not dispatch or even read remote directories after a failed prewrite", async () => {
    const h = harness(); h.storage.setValue.mockRejectedValue(new Error("disk full"));
    await expect(h.service.submit(file)).rejects.toThrow("disk full");
    expect(h.offline.listDirectory).not.toHaveBeenCalled();
    expect(h.offline.uploadSubtitle).not.toHaveBeenCalled();
});

it("skips same-name files by default and refuses incomplete directories", async () => {
    const h = harness();
    h.offline.listDirectory.mockResolvedValue({ items: [{ name: file.filename, size: bytes.byteLength }], hasMore: false });
    expect(await h.service.submit(file)).toMatchObject({ state: "skipped" });
    expect(h.offline.uploadSubtitle).not.toHaveBeenCalled();
    h.offline.listDirectory.mockImplementation(async (_id, _folder, options) => ({ items: [{ name: `${options.offset}.mp4`, fileId: String(options.offset) }], hasMore: true, nextOffset: options.offset + 100 }));
    expect(await h.service.submit({ ...file, filename: "ABC-123.en.srt" })).toMatchObject({ state: "failed", message: expect.stringContaining("未完整") });
    expect(h.offline.uploadSubtitle).not.toHaveBeenCalled();
});

it("retains ambiguous uploads across service recreation and never replays a lost response", async () => {
    const h = harness();
    h.offline.uploadSubtitle.mockImplementation(async (_id, _file, options) => { options.onMutationDispatch(); throw new Error("response lost"); });
    const first = await h.service.submit(file);
    expect(first).toMatchObject({ state: "pending" });
    const restarted = new SubtitleUploadService(h.service.options);
    expect(await restarted.submit(file)).toMatchObject({ state: "pending", message: expect.stringContaining("未重复") });
    expect(h.offline.uploadSubtitle).toHaveBeenCalledOnce();
    h.offline.listDirectory.mockResolvedValue({ items: [{ name: file.filename, size: bytes.byteLength, fileId: "55", sha1: first.sha1 }], hasMore: false });
    expect(await restarted.reconcile(first)).toMatchObject({ state: "success" });
    expect(h.offline.uploadSubtitle).toHaveBeenCalledOnce();
});

it("leaves same-size evidence unconfirmed without a matching hash or acknowledged file id", async () => {
    const h = harness(), first = await h.service.submit(file);
    expect(first.state).toBe("pending");
    h.offline.listDirectory.mockResolvedValue({ items: [{ name: file.filename, size: bytes.byteLength, fileId: "other" }], hasMore: false });
    expect(await h.service.reconcile(first)).toMatchObject({ state: "pending" });
    expect(h.offline.uploadSubtitle).toHaveBeenCalledOnce();
});

it("binds intents to the account and serializes simultaneous consumers", async () => {
    const h = harness();
    await Promise.all([h.service.submit(file), h.service.submit(file)]);
    expect(h.offline.uploadSubtitle).toHaveBeenCalledOnce();
    h.offline.getAccountIdentity.mockResolvedValue({ accountId: "2" });
    await expect(h.service.submit(file)).rejects.toThrow("账号已切换");
    expect(h.offline.uploadSubtitle).toHaveBeenCalledOnce();
    expect(await h.service.records({ accountId: "2" })).toEqual([]);
});

it("separates directory outcomes and fails closed without cross-tab exclusion", async () => {
    const h = harness();
    h.offline.uploadSubtitle.mockImplementation(async (_provider, target, options) => {
        if (target.folderId === "20") throw new Error("init failed");
        options.onMutationDispatch(); return { fileId: "55" };
    });
    const first = await h.service.submit(file), second = await h.service.submit({ ...file, folderId: "20" });
    expect(first.state).toBe("pending"); expect(second.state).toBe("failed");
    expect(await h.service.records()).toHaveLength(2);
    const unavailable = new SubtitleUploadService({ ...h.service.options, locks: null });
    await expect(unavailable.submit(file)).rejects.toThrow("跨标签互斥");
});

it("rejects remote evidence when the account changes during directory enumeration", async () => {
    const h = harness();
    h.offline.getAccountIdentity.mockResolvedValueOnce({ accountId: "1" }).mockResolvedValue({ accountId: "2" });
    await expect(h.service.submit(file)).rejects.toThrow("账号已切换");
    expect(h.offline.uploadSubtitle).not.toHaveBeenCalled();
});
