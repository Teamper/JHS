// @vitest-environment jsdom
import jquery from "jquery";
import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { JavBusPreviewController } from "../src/features/detail/javbus-preview-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { DialogService } from "../src/services/dialog-service.js";
import { LayerDialogAdapter } from "../src/platform/userscript/layer-dialog-adapter.js";

const scopes = [];
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
beforeEach(() => {
    document.body.innerHTML = '<div id="gallery"><div class="sample-box"><div class="photo-frame"><img></div></div></div><button id="outside">背景</button>';
    vi.stubGlobal("clog", { debug() {}, warn() {}, error() {} });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
afterEach(async () => { scopes.forEach(scope => scope.dispose()); scopes.length = 0; await flush(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ""; });
function harness({ pendingSource = null, realLayer = false } = {}) {
    const scope = new LifecycleScope("bus-owner"); scopes.push(scope);
    const settings = new EventTarget(), values = { enablePreviewVideo: "yes", enableLoadPreviewVideo: "yes", videoQuality: "hhb", videoMuted: true };
    settings.snapshot = () => values;
    settings.set = vi.fn(async (name, value) => { values[name] = value; settings.dispatchEvent(new CustomEvent("settings.changed", { detail: { names: [name] } })); });
    const dialogs = new Map(); let nextId = 0;
    let layer = {
        open: vi.fn(options => {
            const id = ++nextId, root = document.createElement("section");
            root.className = "layui-layer"; root.id = `layui-layer${id}`;
            root.innerHTML = '<div class="layui-layer-title">视频预览</div><div class="layui-layer-content"></div>';
            root.querySelector(".layui-layer-content").innerHTML = options.content; document.body.append(root);
            dialogs.set(id, { root, options }); options.success?.(root, id); return id;
        }),
        close: vi.fn(id => {
            const item = dialogs.get(id); if (!item) return;
            dialogs.delete(id); jquery(item.root).remove(); item.options.end?.();
        }), confirm() {}, alert() {},
    };
    if (realLayer) {
        vi.stubGlobal("jQuery", jquery);
        const script = document.createElement("script"); script.src = "https://example.test/layer.js"; document.body.append(script);
        window.eval(readTestFile(join(import.meta.dirname, "browser/fixtures/layer-runtime/layer-1.0.9.min.js"), "utf8"));
        script.remove();
        layer = window.layer;
    }
    const sources = { hhb: "https://example.test/720.mp4", mhb: "https://example.test/480.mp4" };
    const storage = { getLocal: () => pendingSource ? null : JSON.stringify({ "ABC-123": sources }), setLocal: vi.fn() };
    const movie = { preview: vi.fn(() => pendingSource.promise) }, notifications = { error: vi.fn(), info: vi.fn() };
    let ready;
    const owner = new JavBusPreviewController({
        document, window, scope, route: "detail",
        hostAdapter: { site: "javbus", locateNativeGallery: () => document.querySelector("#gallery"), readMovieRef: () => ({ carNum: "ABC-123" }) },
        settings, storage, movie, dialog: new DialogService(new LayerDialogAdapter(layer)),
        events: { on: (_name, callback) => { ready = callback; return () => {}; } },
        ui: { jquery, notifications, getResponsiveArea: area => area, setupEscClose: vi.fn() }, diagnostics: { recordError: vi.fn() },
    });
    owner.start(); ready();
    return { owner, scope, settings, dialogs, layer, movie, notifications };
}

it("uses dialog focus and nested scroll ownership while preserving the player across close and reopen", async () => {
    const h = harness(), trigger = document.querySelector(".preview-video-container");
    trigger.focus(); await h.owner.handleVideo();
    const media = document.querySelector("#preview-video"), first = h.dialogs.get(1);
    expect(first.root.getAttribute("role")).toBe("dialog");
    expect(document.activeElement).toBe(media);
    expect(document.body.style.overflow).toBe("hidden");
    document.querySelector("#outside").focus(); expect(first.root.contains(document.activeElement)).toBe(true);
    media.currentTime = 17; media.muted = false; media.dispatchEvent(new Event("volumechange"));
    document.querySelector('[data-quality="mhb"]').click(); await flush();
    expect(document.querySelector('[data-quality="mhb"]').getAttribute("aria-pressed")).toBe("true");
    h.layer.close(1);
    expect(h.owner.session).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
    expect(media.isConnected).toBe(false); expect(media.pause).toHaveBeenCalled();
    await h.owner.handleVideo();
    expect(document.querySelector("#preview-video")).toBe(media);
    expect(media.currentTime).toBe(17); expect(media.muted).toBe(false);
    // Native player listeners survive vendor removal of the first dialog.
    document.querySelector('[data-quality="hhb"]').click(); await flush();
    expect(document.querySelector('[data-quality="hhb"]').getAttribute("aria-pressed")).toBe("true");
    expect(media.querySelector("source").src).toBe("https://example.test/720.mp4");
    first.options.end(); expect(h.dialogs.size).toBe(1);
    await h.settings.set("enablePreviewVideo", "no");
    expect(h.dialogs.size).toBe(0); expect(h.owner.player).toBeNull();
    expect(document.body.style.overflow).toBe("");
});

it.each(["resolve", "reject"])("discards a late media play %s after closing without replay or feedback", async settle => {
    const h = harness(), pending = deferred();
    HTMLMediaElement.prototype.play.mockReturnValue(pending.promise);
    const task = h.owner.handleVideo(); await vi.waitFor(() => expect(h.dialogs.size).toBe(1));
    const media = document.querySelector("#preview-video"); h.layer.close(1);
    const pauses = media.pause.mock.calls.length;
    pending[settle](settle === "reject" ? new Error("late decoder failure") : undefined); await task;
    expect(media.pause.mock.calls.length).toBeGreaterThan(pauses);
    expect(h.dialogs.size).toBe(0); expect(h.notifications.error).not.toHaveBeenCalled();
});

it("does not let a closed quality request alter a newly reopened player's selection", async () => {
    const h = harness(); await h.owner.handleVideo();
    const pending = deferred(); HTMLMediaElement.prototype.play.mockReturnValueOnce(pending.promise);
    const oldChoice = document.querySelector('[data-quality="mhb"]'); oldChoice.click();
    h.owner.closeVideoModal(); await h.owner.handleVideo();
    expect(document.querySelector("#preview-video source").src).toBe("https://example.test/480.mp4");
    expect(oldChoice.getAttribute("aria-pressed")).toBe("true");
    document.querySelector('[data-quality="hhb"]').click(); await flush();
    pending.resolve(); await flush();
    expect(oldChoice.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector("#preview-video source").src).toBe("https://example.test/720.mp4");
    expect(h.dialogs.size).toBe(1); expect(h.notifications.error).not.toHaveBeenCalled();
});

it("cancels the pending source when closed and permits a new session after a late response", async () => {
    const pendingSource = deferred(), h = harness({ pendingSource });
    const task = h.owner.handleVideo(); await vi.waitFor(() => expect(h.movie.preview).toHaveBeenCalledOnce());
    const requestScope = h.movie.preview.mock.calls[0][2].scope;
    h.owner.closeVideoModal(); expect(requestScope.disposed).toBe(true);
    pendingSource.resolve({ sources: { hhb: "https://example.test/late.mp4" } }); await task;
    expect(h.dialogs.size).toBe(0); expect(h.notifications.error).not.toHaveBeenCalled();
    await h.owner.handleVideo(); expect(h.dialogs.size).toBe(1);
});

it("releases the session if its dialog is externally removed without an end callback", async () => {
    const h = harness(); await h.owner.handleVideo();
    const old = h.owner.session; h.dialogs.get(1).root.remove(); await flush();
    expect(old.scope.disposed).toBe(true); expect(h.owner.session).toBeNull();
    expect(document.body.style.overflow).toBe("");
});

it("opens and closes the retained DOM player through the real Layer string-content path", async () => {
    const h = harness({ realLayer: true });
    await h.owner.handleVideo();
    const media = document.querySelector("#preview-video");
    expect(media).not.toBeNull(); expect(media.closest('[role="dialog"]')).not.toBeNull();
    media.currentTime = 17;
    document.querySelector(".layui-layer-close").click();
    await vi.waitFor(() => expect(document.querySelector(".layui-layer")).toBeNull());
    expect(h.owner.session).toBeNull(); expect(document.querySelector(".layui-layer-shade")).toBeNull();
    await h.owner.handleVideo();
    expect(document.querySelector("#preview-video")).toBe(media); expect(media.currentTime).toBe(17);
    document.querySelector('[data-quality="mhb"]').click(); await flush();
    expect(media.querySelector("source").src).toBe("https://example.test/480.mp4");
    h.owner.closeVideoModal();
    await vi.waitFor(() => expect(document.querySelector(".layui-layer")).toBeNull());
    expect(document.querySelector(".layui-layer-shade")).toBeNull();
    expect(document.querySelector("#bus-preview-modal")).toBeNull();
    expect(document.body.style.overflow).toBe("");
});
