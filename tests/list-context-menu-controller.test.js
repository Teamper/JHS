// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListContextMenuController } from "../src/features/list/list-context-menu-controller.js";

describe("ListContextMenuController", () => {
    it("blocks a card through the state service after confirmation", async () => {
        document.body.innerHTML = '<div class="movie-list"><div class="item"><img></div></div>';
        const scope = new LifecycleScope("feature:list"), stateService = { patch: vi.fn(async () => {}) }, confirm = vi.fn((_event, _message, callback) => void callback()), show = { ok: vi.fn(), error: vi.fn() };
        vi.stubGlobal("show", show);
        const service = new ListContextMenuController({
            scope,
            document,
            selectors: { boxSelector: ".movie-list" },
            site: "javdb",
            readItem: vi.fn(() => ({ carNum: "ABC-123", url: "/v/ABC-123", publishTime: "2026-08-25", fc2Source: "fc2" })),
            stateService,
            confirm,
        });
        service.start();
        const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
        document.querySelector("img").dispatchEvent(event);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(confirm).toHaveBeenCalledWith(event, "是否屏蔽番号 ABC-123?", expect.any(Function));
        expect(stateService.patch).toHaveBeenCalledWith("ABC-123", { blocked: true }, { record: { carNum: "ABC-123", url: "/v/ABC-123", names: "", publishTime: "2026-08-25", fc2Source: "fc2" } });
        expect(show.ok).toHaveBeenCalledWith("操作成功");
        expect(event.defaultPrevented).toBe(true);
        scope.dispose();
    });

    it("uses the visible actor name before requesting detail-page fallback", async () => {
        document.body.innerHTML = '<div class="movie-list"><div class="actor-section-name">Actor A, Actor B</div><div class="item"><img></div></div>';
        const scope = new LifecycleScope("feature:list"), stateService = { patch: vi.fn(async () => {}) }, parseActressName = vi.fn(async () => "remote actor"), confirm = vi.fn((_event, _message, callback) => void callback());
        const service = new ListContextMenuController({ scope, document, selectors: { boxSelector: ".movie-list" }, site: "javdb", readItem: () => ({ carNum: "ABC-123", url: "/v/ABC-123" }), stateService, parseActressName, confirm });
        service.start();
        document.querySelector("img").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(stateService.patch).toHaveBeenCalledWith("ABC-123", { blocked: true }, { record: expect.objectContaining({ names: "Actor A" }) });
        expect(parseActressName).not.toHaveBeenCalled();
        scope.dispose();
    });
});
