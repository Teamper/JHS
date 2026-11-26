// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseTaskInterval } from "../src/features/discovery/task-intervals.js";
import { NewVideoWorkspaceService } from "../src/features/discovery/new-video-workspace-service.js";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

function fixture(settings, enabled = true) {
    document.body.innerHTML = '<button id="checkFavoriteActress"></button><button id="checkNewVideo"></button>';
    const task = enabled ? { lastCheckFavoriteActressTimeKey: "favorite", lastCheckNewVideoTimeKey: "newVideo" } : null;
    const service = new NewVideoWorkspaceService({
        runtimeServices: { storage: { getLocal: () => null } },
        task: { available: () => Boolean(task), current: () => task, activate: async () => task },
        jquery, legacyStorage: { getSetting: vi.fn(async () => settings) },
        utilities: {}, notifications: {}, logger: {}, events: {}, createImageHoverPreview: () => null, document, window,
    });
    return service;
}

describe("scan interval tooltips", () => {
    it("updates only the current workspace for an instance-owned refresh", async () => {
        const service = fixture({});
        const root = jquery('<div><button id="checkFavoriteActress"></button><button id="checkNewVideo"></button></div>').appendTo("body");
        service.nvWorkspaceRoot = root;
        await service.resetBtnTip({ root, generation: service.nvDialogGeneration });
        expect(root.find("#checkFavoriteActress").attr("data-tip")).toContain("24小时");
        expect(jquery("body > #checkFavoriteActress").attr("data-tip")).toBeUndefined();
    });

    it.each(["reopen", "dispose"])("drops an instance-owned tooltip result after %s", async action => {
        const service = fixture({});
        const root = jquery('<div><button id="checkFavoriteActress"></button><button id="checkNewVideo"></button></div>').appendTo("body");
        service.nvWorkspaceRoot = root;
        let finish;
        service.getTaskButtonTips = vi.fn(() => new Promise(resolve => finish = resolve));
        const loading = service.resetBtnTip({ root, generation: service.nvDialogGeneration });
        if (action === "reopen") {
            service.nvWorkspaceRoot = jquery('<div><button id="checkFavoriteActress" data-tip="新实例"></button></div>').appendTo("body");
            service.nvDialogGeneration++;
        } else service.dispose();
        finish({ favorite: "旧请求", newVideo: "旧请求" });
        await loading;
        expect(root.find("#checkFavoriteActress").attr("data-tip")).toBeUndefined();
        if (action === "reopen") expect(service.nvWorkspaceRoot.find("#checkFavoriteActress").attr("data-tip")).toBe("新实例");
    });

    it.each([
        [{}, 24, 12],
        [{ checkFavoriteActress_IntervalTime: "bad", checkNewVideo_intervalTime: "0" }, 24, 12],
        [{ checkFavoriteActress_IntervalTime: "36", checkNewVideo_intervalTime: "6" }, 36, 6],
    ])("uses the same normalized hours as the task scheduler", async (settings, favorite, newVideo) => {
        const service = fixture(settings);
        await service.resetBtnTip();
        expect(jquery("#checkFavoriteActress").attr("data-tip")).toContain(`${favorite}小时`);
        expect(jquery("#checkNewVideo").attr("data-tip")).toContain(`${newVideo}小时`);
        expect(parseTaskInterval("favoriteActress", settings.checkFavoriteActress_IntervalTime)).toBe(favorite);
        expect(parseTaskInterval("newVideo", settings.checkNewVideo_intervalTime)).toBe(newVideo);
    });

    it("labels disabled tasks without an undefined interval", async () => {
        const service = fixture({}, false);
        await service.resetBtnTip();
        expect(jquery("#checkFavoriteActress").attr("data-tip")).toBe("后台任务已关闭");
        expect(jquery("#checkNewVideo").attr("data-tip")).toBe("后台任务已关闭");
    });
});
