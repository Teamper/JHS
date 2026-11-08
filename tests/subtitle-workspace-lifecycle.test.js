// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import jquery from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { SubtitleWorkspaceController } from "../src/features/detail/subtitle-workspace-controller.js";
import { SubtitleUploadController } from "../src/features/detail/subtitle-upload-controller.js";

afterEach(() => document.body.replaceChildren());
const record = { providerId: "xunlei", name: "ABC-123 <img src=x onerror=alert(1)>", extension: "srt", language: "zh", url: "https://subtitle.example/test.srt" };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function harness() {
    let nextId = 0;
    const dialogs = new Map(), scope = new LifecycleScope("feature"), trigger = document.createElement("button");
    document.body.append(trigger); trigger.focus();
    const dialog = {
        open: vi.fn(options => {
            const id = ++nextId, root = document.createElement("section");
            root.append(options.content[0]); document.body.append(root);
            dialogs.set(id, { root, options }); options.success?.(root, id); return id;
        }),
        close: vi.fn(id => { const item = dialogs.get(id); if (!item) return; dialogs.delete(id); item.root.remove(); item.options.end?.(); }),
    };
    const ui = { jquery, getResponsiveArea: x => x, setupEscClose: vi.fn() };
    const subtitle = {
        searchAll: vi.fn(async (_movie, options) => options.onSource({ providerId: "xunlei", status: "success", records: [record] })),
        fetchAsset: vi.fn(async () => ({ bytes: new ArrayBuffer(4), text: "字幕 <b>literal</b>", extension: "srt", size: 4 })),
    };
    return { scope, trigger, dialog, dialogs, ui, subtitle };
}

it("retains result nodes and focus as sources settle and renders all provider text literally", async () => {
    const h = harness(); let deliver;
    h.subtitle.searchAll.mockImplementation(async (_movie, options) => { deliver = options.onSource; options.onSource({ providerId: "xunlei", status: "success", records: [record] }); });
    const controller = new SubtitleWorkspaceController({ ...h, document });
    const session = controller.open({ carNum: "ABC-123", trigger: h.trigger });
    await flush();
    const row = session.root.querySelector("article"), preview = [...row.querySelectorAll("button")].find(x => x.textContent === "预览");
    expect(row.querySelector("img")).toBeNull();
    preview.focus();
    deliver({ providerId: "subtitlecat", status: "success", records: [{ ...record, providerId: "subtitlecat", url: "https://subtitlecat.com/test.srt" }] });
    expect(session.root.querySelector("article")).toBe(row);
    expect(document.activeElement).toBe(preview);
    preview.click(); await flush();
    expect(session.root.querySelector("pre").textContent).toBe("字幕 <b>literal</b>");
    expect(session.root.querySelector("pre b")).toBeNull();
    session.close();
    expect(h.dialogs.size).toBe(0); expect(document.activeElement).toBe(h.trigger);
    expect(document.querySelector(".jhs-subtitles")).toBeNull();
    h.scope.dispose();
});

it("cancels late preview consumers on owner removal and feature disposal", async () => {
    const h = harness(); let complete;
    h.subtitle.fetchAsset.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const controller = new SubtitleWorkspaceController({ ...h, document });
    const owner = document.createElement("div"); document.body.append(owner);
    const session = controller.open({ carNum: "ABC-123", owner });
    await flush(); session.root.querySelector("article button").click(); await flush();
    const consumerScope = h.subtitle.fetchAsset.mock.calls[0][2].scope;
    owner.remove(); await flush();
    expect(consumerScope.disposed).toBe(true);
    complete({ text: "late", extension: "srt" }); await flush();
    expect(h.dialogs.size).toBe(0);
    expect(session.root.querySelector("pre").textContent).toBe("");
    h.scope.dispose();
    expect(h.scope.snapshot().listeners).toBe(0);
});

it("exposes recovery without downloading the source again", async () => {
    const h = harness();
    const uploads = {
        currentAccount: vi.fn(async () => ({ accountId: "1" })),
        records: vi.fn(async () => [{ key: "pending", state: "pending", folderId: "10", filename: "ABC-123.zh.srt" }]),
        reconcile: vi.fn(async record => ({ ...record, state: "success", message: "已核实上传完成" })),
    };
    const uploader = new SubtitleUploadController({ ...h, document, uploads });
    await uploader.openRecords({ movie: { carNum: "ABC-123" }, scope: h.scope, trigger: h.trigger });
    await flush();
    expect(document.body.textContent).toContain("已核实上传完成");
    expect(h.subtitle.fetchAsset).not.toHaveBeenCalled();
    expect(uploads.records).toHaveBeenCalledWith({ accountId: "1", carNum: "ABC-123" });
    h.scope.dispose();
    expect(document.querySelector(".jhs-subtitles")).toBeNull();
});
it("explicit re-search refreshes providers and cancels the previous search consumer", async () => {
    const h = harness(), controller = new SubtitleWorkspaceController({ ...h, document });
    const session = controller.open({ carNum: "ABC-123" });
    await flush();
    const first = h.subtitle.searchAll.mock.calls[0][1];
    expect(first.refreshCache).toBe(false);
    [...session.root.querySelectorAll("button")].find(button => button.textContent === "重新搜索").click();
    await flush();
    expect(first.scope.disposed).toBe(true);
    expect(h.subtitle.searchAll.mock.calls[1][1].refreshCache).toBe(true);
    session.close(); h.scope.dispose();
});
