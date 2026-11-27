// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
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
        http: {}, state: { patch }, ui: { jquery, confirm, loading: vi.fn(() => loadingHandle) }, notifications: settings,
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
        ["https://javdb.com/want_watch_videos", "favorite", { favorite: true }, "将想看的影片导入 JHS 收藏？"],
        ["https://javdb.com/watched_videos", "watched", { watched: true }, "将看过的影片导入 JHS 已观看？"],
    ])("mounts and imports the matching state on %s", async (href, flag, expectedPatch, prompt) => {
        const { controller, scope, patch, confirm, settings } = createHarness();
        controller.href = href;
        expect(controller.start()).toBe(true);
        const button = document.querySelector("#wantWatchBtn");
        expect(button?.textContent).toBe("导入至 JHS");
        button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(confirm).toHaveBeenCalledWith(expect.any(MouseEvent), expect.stringContaining(prompt), expect.any(Function), { confirmText: "导入" });
        await vi.waitFor(() => expect(settings.ok).toHaveBeenCalledOnce());

        expect(patch).toHaveBeenCalledWith(["ABC-1"], expectedPatch, {
            type: "javdb-list-import", importBatchId: expect.any(String),
            records: [{ carNum: "ABC-1", stateEligibility: { eligible: true, reason: null }, url: "/v/abc-1", publishTime: "2026" }],
        });
        expect(button.disabled).toBe(false);
        expect(document.body.textContent).not.toContain("停止导入");
        scope.dispose();
        expect(document.querySelector("#wantWatchBtn")).toBeNull();
    });

    it("imports successive pages in 75-item batches and reports partial failure", async () => {
        const page = (first, last, next = "") => {
            const cards = Array.from({ length: last - first + 1 }, (_, index) => {
                const code = "ABC-" + (first + index);
                return `<div class="item"><a href="/v/${code}"><div class="video-title"><strong>${code}</strong></div><div class="meta">2026</div></a></div>`;
            }).join("");
            return `<div class="movie-list">${cards}</div>${next ? `<a class="pagination-next" href="${next}"></a>` : ""}`;
        };
        const { controller, patch, request, settings } = createHarness(page(1, 40, "/p2"));
        patch.mockRejectedValueOnce(new Error("batch unavailable"));
        request.mockResolvedValueOnce(page(41, 75, "/p3")).mockResolvedValueOnce(page(76, 77));
        const result = await controller.readAndImport("watched");

        expect(result).toEqual({ imported: 2, failed: 75, skipped: 0, pages: 3 });
        expect(patch.mock.calls.map(([keys]) => keys.length)).toEqual([75, 2]);
        expect(patch.mock.calls[1][0]).toEqual(["ABC-76", "ABC-77"]);
        expect(patch.mock.calls[1][2].importBatchId).toBe(patch.mock.calls[0][2].importBatchId);
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
        expect(next.settings.error).toHaveBeenCalledWith("影片导入失败，请重试");
        expect(next.diagnostics.recordError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("page failed") }));
    });
});
