import { expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { SupplementaryCardsController } from "../src/features/list/supplementary-cards-controller.js";

it("shares the owner snapshot and updates only indexed supplementary cards", async () => {
    const dom = new JSDOM('<section><div class="container"><div class="movie-list" id="weekly"><div class="item" data-car="ABC-123"></div><div class="item" data-car="DEF-456"></div></div><div class="movie-list" id="main"></div></div></section>');
    const document = dom.window.document, weekly = document.querySelector("#weekly"), main = document.querySelector("#main");
    vi.stubGlobal("MutationObserver", dom.window.MutationObserver);
    const handlers = new Map(), scope = new LifecycleScope("supplementary-test");
    const context = { get: vi.fn(async () => ({ settings: {} })), invalidate: vi.fn(), dispose: vi.fn() };
    const owner = {
        scope, boundListRoot: main, filterContextProvider: context, readFilterSources: vi.fn(),
        hostAdapter: { locateCardEnhancementRoots: vi.fn(() => [weekly, main]), getListSelectors: () => ({ boxSelector: ".movie-list" }) },
        readCardIdentity: item => ({ carNum: item.dataset.car }),
        events: { on: (type, handler) => { handlers.set(type, handler); return () => handlers.delete(type); } },
        logger: { error: vi.fn() }, coverImageController: { replace: vi.fn() },
        coverButtons: { addSvgBtn: vi.fn() }, legacyPlugin: {},
    };
    const controller = new SupplementaryCardsController({ owner });
    controller.roots.set(weekly, { view: { dispose() {} }, menu: { dispose() {} } });
    const process = vi.spyOn(controller.presenter, "processItems").mockImplementation(async items => items);
    try {
        await controller.start();
        process.mockClear(); owner.hostAdapter.locateCardEnhancementRoots.mockClear();
        handlers.get("car-state-changed")({ carNums: ["ABC-123"] });
        await vi.waitFor(() => expect(process).toHaveBeenCalledTimes(1));
        expect(process.mock.calls[0][0]).toEqual([weekly.firstElementChild]);
        expect(owner.hostAdapter.locateCardEnhancementRoots).not.toHaveBeenCalled();
        weekly.firstElementChild.append(document.createElement("button"));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(owner.hostAdapter.locateCardEnhancementRoots).not.toHaveBeenCalled();
        expect(context.invalidate).not.toHaveBeenCalled();
    } finally { scope.dispose(); dom.window.close(); vi.unstubAllGlobals(); }
    expect(context.dispose).not.toHaveBeenCalled();
});
