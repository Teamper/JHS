// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { requestHostPage } from "../src/core/host-page-request.js";
import { WantWatchImportController } from "../src/features/library/want-watch-import-controller.js";

vi.mock("../src/core/host-page-request.js", () => ({ requestHostPage: vi.fn() }));

const activeScopes = new Set();

function createHarness(html = '<h3>我的影片</h3><div class="movie-list"><div class="item"><a href="/v/abc-1"><div class="video-title"><strong>ABC-1</strong></div><div class="meta">2026</div></a></div></div>') {
    document.body.innerHTML = html;
    const scope = new LifecycleScope("library:state-import");
    activeScopes.add(scope);
    const patch = vi.fn().mockResolvedValue({}), request = vi.mocked(requestHostPage);
    const settings = { info: vi.fn(), ok: vi.fn(), error: vi.fn() }, diagnostics = { recordError: vi.fn() };
    const confirm = vi.fn((_event, _message, accept) => accept());
    const loadingHandle = { close: vi.fn() };
    const controller = new WantWatchImportController({
        document, window, href: window.location.href,
        hostAdapter: { getListSelectors: () => ({ itemSelector: ".movie-list .item" }) },
        http: {}, state: { patch }, ui: { confirm, loading: vi.fn(() => loadingHandle) }, notifications: settings,
        diagnostics, scope, sleep: vi.fn().mockResolvedValue(undefined),
    });
    return { controller, scope, patch, request, settings, confirm, loadingHandle, diagnostics };
}

afterEach(() => {
    for (const scope of activeScopes) scope.dispose();
    activeScopes.clear();
    vi.clearAllMocks();
});

describe("JavDB status imports", () => {
    it.each([
        ["https://javdb.com/want_watch_videos", "favorite", { favorite: true }, "是否将想看的影片导入到 JHS 收藏？"],
        ["https://javdb.com/watched_videos", "watched", { watched: true }, "是否将看过的影片导入到 JHS 已观看？"],
    ])("mounts and imports the matching state on %s", async (href, flag, expectedPatch, prompt) => {
        const { controller, scope, patch, confirm, loadingHandle, settings } = createHarness();
        controller.href = href;
        expect(controller.start()).toBe(true);
        const button = document.querySelector("#wantWatchBtn");
        expect(button?.textContent).toBe("导入至 JHS");
        button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(confirm).toHaveBeenCalledWith(expect.any(MouseEvent), expect.stringContaining(prompt), expect.any(Function));
        await vi.waitFor(() => expect(settings.ok).toHaveBeenCalledOnce());

        expect(patch).toHaveBeenCalledWith("ABC-1", expectedPatch, {
            type: "javdb-list-import", record: { carNum: "ABC-1", url: "/v/abc-1", names: "", publishTime: "2026" },
        });
        expect(loadingHandle.close).toHaveBeenCalledOnce();
        scope.dispose();
        expect(document.querySelector("#wantWatchBtn")).toBeNull();
    });

    it("imports all pages sequentially and preserves per-record failure counts", async () => {
        const page = (carNum, next = "") => `<div class="movie-list"><div class="item"><a href="/v/${carNum}"><div class="video-title"><strong>${carNum}</strong></div><div class="meta">2026</div></a></div></div>${next ? `<a class="pagination-next" href="${next}"></a>` : ""}`;
        const { controller, patch, request, settings } = createHarness(page("ABC-1", "/p2"));
        patch.mockRejectedValueOnce(new Error("record unavailable"));
        request.mockResolvedValueOnce(page("ABC-2", "/p3")).mockResolvedValueOnce(page("ABC-3"));
        const result = await controller.readAndImport("watched");

        expect(result).toEqual({ imported: 2, failed: 1, pages: 3 });
        expect(patch).toHaveBeenCalledTimes(3);
        expect(request).toHaveBeenNthCalledWith(1, {}, new URL("/p2", window.location.href).href, expect.any(LifecycleScope));
        expect(request).toHaveBeenNthCalledWith(2, {}, new URL("/p3", window.location.href).href, expect.any(LifecycleScope));
        expect(controller.sleep).toHaveBeenCalledTimes(2);
        expect(controller.diagnostics.recordError).toHaveBeenCalledWith(expect.objectContaining({ contributionId: "library.state-actions" }));
        expect(settings.info).toHaveBeenCalledTimes(3);
    });

    it("stops before requesting another page when the Feature is disposed during its delay", async () => {
        const html = '<h3>想看</h3><div class="movie-list"></div><a class="pagination-next" href="/p2"></a>';
        const { controller, scope, request } = createHarness(html);
        controller.sleep = vi.fn((_delay, signal) => new Promise((_resolve, reject) => {
            const abort = () => reject(new DOMException("aborted", "AbortError"));
            if (signal.aborted) abort();
            else signal.addEventListener("abort", abort, { once: true });
        }));
        const running = controller.readAndImport("favorite");
        await vi.waitFor(() => expect(controller.sleep).toHaveBeenCalledOnce());
        scope.dispose();
        await expect(running).rejects.toMatchObject({ name: "AbortError" });
        expect(request).not.toHaveBeenCalled();
    });

    it("keeps network failure visible and does not mount outside want/watch pages", async () => {
        const { controller, scope } = createHarness("<h3>影片</h3>");
        controller.href = "https://javdb.com/";
        expect(controller.start()).toBe(false);
        scope.dispose();
        expect(document.querySelector("#wantWatchBtn")).toBeNull();

        const next = createHarness('<h3>我的影片</h3><div class="movie-list"></div><a class="pagination-next" href="/p2"></a>');
        next.request.mockRejectedValueOnce(new Error("page failed"));
        await next.controller.importMovies("watched");
        expect(next.settings.error).toHaveBeenCalledWith("导入失败：page failed");
        expect(next.diagnostics.recordError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("page failed") }));
    });
});
