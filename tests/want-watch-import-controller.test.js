// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { WantWatchImportController } from "../src/features/library/want-watch-import-controller.js";

function setup(href, html = "<h3>我的影片</h3>") {
    document.body.innerHTML = html;
    const scope = new LifecycleScope("library:state-import");
    const confirm = vi.fn();
    const controller = new WantWatchImportController({
        document, window, href,
        hostAdapter: { getListSelectors: () => ({ itemSelector: ".movie-list .item" }) },
        http: {}, state: { patch: vi.fn() }, ui: { confirm, loading: vi.fn() },
        notifications: { info: vi.fn(), ok: vi.fn(), error: vi.fn() }, diagnostics: { recordError: vi.fn() }, scope,
    });
    return { controller, scope, confirm };
}

describe("want/watch import feature", () => {
    it.each([
        ["https://javdb.com/want_watch_videos", "是否将想看的影片导入到 JHS 收藏？"],
        ["https://javdb.com/watched_videos", "是否将看过的影片导入到 JHS 已观看？"],
    ])("mounts and confirms the matching import on %s", (href, prompt) => {
        const { controller, scope, confirm } = setup(href);
        expect(controller.start()).toBe(true);
        const button = document.querySelector("#wantWatchBtn");
        expect(button?.textContent).toBe("导入至 JHS");
        button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(confirm).toHaveBeenCalledWith(expect.any(MouseEvent), expect.stringContaining(prompt), expect.any(Function));

        scope.dispose();
        expect(document.querySelector("#wantWatchBtn")).toBeNull();
        button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(confirm).toHaveBeenCalledOnce();
    });

    it("does not mount outside want/watch routes or without the native heading", () => {
        const { controller, scope } = setup("https://javdb.com/");
        expect(controller.start()).toBe(false);
        scope.dispose();

        const next = setup("https://javdb.com/want_watch_videos", "<main></main>");
        expect(next.controller.start()).toBe(false);
        next.scope.dispose();
        expect(document.querySelector("#wantWatchBtn")).toBeNull();
    });
});
