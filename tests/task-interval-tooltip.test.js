// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseTaskInterval } from "../src/features/discovery/task-intervals.js";
import { NewVideoWorkspaceService } from "../src/plugins/new-video/new-video.js";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

function fixture(settings, enabled = true) {
    document.body.innerHTML = '<button id="checkFavoriteActress"></button><button id="checkNewVideo"></button>';
    const task = enabled ? { lastCheckFavoriteActressTimeKey: "favorite", lastCheckNewVideoTimeKey: "newVideo" } : null;
    const service = new NewVideoWorkspaceService({
        runtimeServices: { storage: { getLocal: () => null } },
        resolveDependency: name => name === "TaskPlugin" ? task : null,
        jquery, legacyStorage: { getSetting: vi.fn(async () => settings) },
        utilities: {}, notifications: {}, logger: {}, events: {}, createImageHoverPreview: () => null, document, window,
    });
    return service;
}

describe("scan interval tooltips", () => {
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
        expect(jquery("#checkFavoriteActress").attr("data-tip")).toBe("后台任务功能已禁用");
        expect(jquery("#checkNewVideo").attr("data-tip")).toBe("后台任务功能已禁用");
    });
});
