// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatsController } from "../src/features/stats/stats-controller.js";

function createScope() {
    return { assertActive: vi.fn(), addCleanup: vi.fn() };
}

describe("native stats scope semantics", () => {
    beforeEach(() => {
        document.body.innerHTML = '<button id="newVideoBtn" type="button">新作品</button>';
        vi.stubGlobal("utils", { getDialogArea: vi.fn(() => ["1040px", "760px"]), setupEscClose: vi.fn() });
    });

    it("keeps full-library metrics static and only exposes scope-matched actions", async () => {
        const listPage = { getCurrentPageSummary: vi.fn(() => ({ blockedItems: 7 })), setQuickFilter: vi.fn() };
        const newVideo = { getPendingNewVideoTotal: vi.fn(async () => 3), openNewVideoDialog: vi.fn() };
        const storage = {
            get: vi.fn(async (key) => ({
                car_list: [{ stateFlags: { blocked: true } }, { stateFlags: { favorite: true, downloaded: true, watched: true } }, { stateFlags: {} }],
                favorite_actresses: [{}], blacklist: [{}, {}], setting: {},
            }[key])),
        };
        const dialog = {
            close: vi.fn(),
            open: vi.fn((options) => {
                const root = document.createElement("div");
                root.innerHTML = options.content;
                document.body.append(root);
                options.success(root, 12);
                return 12;
            }),
        };
        const controller = new StatsController({
            diagnostics: { exportSnapshot: () => ({ activeFeatures: ["list"], errors: [] }) }, dialog,
            movie: { externalSiteOrigin: () => "https://javdb.com" }, storage,
            state: { getActivityLog: vi.fn(async () => ({ entries: [], coverageStart: null })) },
            features: { getFeatureApi: vi.fn(async (id) => id === "discovery" ? { hasNewVideo: true, getPendingNewVideoTotal: newVideo.getPendingNewVideoTotal, openNewVideoDialog: newVideo.openNewVideoDialog } : listPage) },
            route: "list", scope: createScope(),
        });

        await controller.start();
        await controller.openDialog();

        const dialogRoot = document.querySelector(".jhs-stats");
        expect(dialog.open).toHaveBeenCalledOnce();
        expect(dialogRoot?.querySelectorAll(".jhs-stats__group")).toHaveLength(4);
        expect(dialogRoot?.querySelectorAll(".jhs-stats__group:first-child .jhs-stats__metric")).toHaveLength(11);
        expect(dialogRoot?.querySelectorAll(".jhs-stats__group:first-child button.jhs-stats__metric")).toHaveLength(1);
        expect(dialogRoot?.querySelector("button[data-action='new-video'] span")?.textContent).toBe("新作品待处理");
        expect(dialogRoot?.querySelector(".jhs-stats__group:first-child [data-filter]")).toBeNull();
        expect([...dialogRoot?.querySelectorAll(".jhs-stats__metric") || []].find((element) => element.textContent?.includes("手动屏蔽"))?.querySelector("strong")?.textContent).toBe("1");
        expect(dialogRoot?.querySelector("button[data-action='filter'][data-filter='blockedItems'] strong")?.textContent).toBe("7");

        dialogRoot?.querySelector("button[data-action='new-video']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        dialogRoot?.querySelector("button[data-action='filter']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(newVideo.openNewVideoDialog).toHaveBeenCalledOnce();
        expect(listPage.setQuickFilter).toHaveBeenCalledWith("blockedItems");
        expect(dialog.close).toHaveBeenCalledTimes(2);
    });
});
