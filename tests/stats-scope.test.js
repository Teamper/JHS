import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { StatsController } from "../src/features/system/stats-controller.js";

function createHarness({ anchor = true } = {}) {
    const dom = new JSDOM(`<body>${anchor ? "<button id='newVideoBtn'>新作品</button>" : ""}</body>`, { url: "https://javdb.com/" });
    const document = dom.window.document;
    const listPage = { getCurrentPageSummary: vi.fn(async () => ({ blockedItems: 7 })), setQuickFilter: vi.fn(async () => {}) };
    const handlers = new Set();
    const styleRelease = vi.fn();
    let layerElement;
    const dialog = {
        close: vi.fn(),
        open: vi.fn(options => {
            layerElement = document.createElement("div");
            layerElement.innerHTML = options.content;
            document.body.append(layerElement);
            options.success(layerElement, 12);
            return 12;
        }),
    };
    const scope = new LifecycleScope("test:stats");
    const controller = new StatsController({
        document,
        libraryStats: { loadSnapshot: vi.fn(async () => ({
            cars: [
                { stateFlags: { blocked: true } },
                { stateFlags: { favorite: true, downloaded: true, watched: true } },
                { stateFlags: {} },
            ],
            actresses: [{}], blacklist: [{}, {}], activity: { entries: [], coverageStart: null },
        })), getPendingNewVideoTotal: vi.fn(async () => 3) },
        diagnostics: { exportSnapshot: () => ({ activeFeatures: ["list"], errors: [] }), recordError: vi.fn() },
        notifications: { error: vi.fn() },
        movie: { externalSiteOrigin: () => "https://javdb.com" },
        settings: { snapshot: () => ({}) }, dialog,
        events: { on: vi.fn((_type, handler) => { handlers.add(handler); return () => handlers.delete(handler); }) },
        ui: { getDialogArea: () => ["1040px", "760px"] },
        styles: { register: vi.fn(() => styleRelease) }, scope,
        openNewVideo: vi.fn(async () => {}),
        getPendingNewVideoTotal: () => controller.libraryStats.getPendingNewVideoTotal(),
        getCurrentPageSummary: listPage.getCurrentPageSummary,
        setQuickFilter: (filter) => listPage.setQuickFilter(filter),
    });
    controller.start();
    return { dom, document, controller, dialog, get layerElement() { return layerElement; }, listPage, handlers, scope, styleRelease };
}

let currentHarness;
afterEach(() => {
    currentHarness?.controller.dispose();
    currentHarness?.dom.window.close();
    currentHarness = null;
});

describe("Stats Feature scope semantics", () => {
    it("keeps full-library metrics static and only exposes scope-matched actions", async () => {
        currentHarness = createHarness();
        const { document, controller, dialog, listPage } = currentHarness;
        expect(document.querySelector("#newVideoBtn + #statsBtn span")?.textContent).toBe("统计");
        await controller.openDialog();

        expect(dialog.open.mock.calls[0][0].title).toBe("统计");
        const groups = document.querySelectorAll(".jhs-stats__group");
        const overview = groups[0], currentPage = groups[1];
        expect(overview.querySelectorAll(".jhs-stats__metric")).toHaveLength(11);
        expect(overview.querySelectorAll("button.jhs-stats__metric")).toHaveLength(1);
        expect(overview.querySelector("button[data-action='new-video'] span")?.textContent).toBe("新作品待处理");
        expect(overview.querySelector("[data-filter]")).toBeNull();
        expect([...overview.querySelectorAll(".jhs-stats__metric")].find((element) => element.querySelector("span")?.textContent === "手动屏蔽")?.querySelector("strong")?.textContent).toBe("1");

        expect(currentPage.querySelector("button[data-action='filter'] strong")?.textContent).toBe("7");
        overview.querySelector("button[data-action='new-video']")?.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));
        expect(controller.openNewVideo).toHaveBeenCalledOnce();
        currentPage.querySelector("button[data-action='filter']")?.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));
        expect(listPage.setQuickFilter).toHaveBeenCalledWith("blockedItems");
        expect(controller.libraryStats.getPendingNewVideoTotal).toHaveBeenCalledOnce();
        expect(listPage.getCurrentPageSummary).toHaveBeenCalledOnce();
        expect(dialog.close).toHaveBeenCalledTimes(2);
    });

    it("waits for the list contribution and cleans up its button, style, and pending dialog on stop", async () => {
        currentHarness = createHarness({ anchor: false });
        const { document, handlers, controller, scope, dialog, styleRelease } = currentHarness;
        expect(document.querySelector("#statsBtn")).toBeNull();
        document.body.insertAdjacentHTML("afterbegin", "<button id='newVideoBtn'>新作品</button>");
        [...handlers][0]?.();
        expect(document.querySelector("#newVideoBtn + #statsBtn")).not.toBeNull();
        await controller.openDialog();
        expect(controller.dialogId).toBe(12);
        controller.dispose();
        expect(scope.disposed).toBe(true);
        expect(dialog.close).toHaveBeenCalledWith(12);
        expect(document.querySelector("#statsBtn")).toBeNull();
        expect(styleRelease).toHaveBeenCalledOnce();
    });
});
