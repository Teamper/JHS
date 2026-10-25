import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { initializeRuntimeConstants } from "../src/core/constants.js";
import { ListCoverImageController } from "../src/features/list/list-cover-image-controller.js";
import { ListPageCompatibilityService } from "../src/features/list/list-compatibility-service.js";
import { ListView } from "../src/features/list/list-view.js";

function harness(site = "javdb") {
    const dom = new JSDOM('<main><div class="movie-list"></div><span class="jhs-mobile-filter-label"></span><button class="jhs-mobile-filter-option" data-jhs-filter="favorite"></button></main>', { url: site === "javdb" ? "https://javdb.com/" : "https://www.javbus.com/" });
    const $ = jqueryFactory(dom.window);
    vi.stubGlobal("window", dom.window); vi.stubGlobal("document", dom.window.document); vi.stubGlobal("$", $);
    initializeRuntimeConstants(dom.window.location);
    return { dom, $, legacy: new ListPageCompatibilityService() };
}

describe("equivalent list presentation paths", () => {
    afterEach(() => vi.unstubAllGlobals());

    it.each([
        ["javdb", "https://c0.jdbstatic.com/thumbs/a.jpg", "https://c0.jdbstatic.com/covers/a.jpg"],
        ["javbus", "https://www.javbus.com/imgs/thumb/a.jpg", "https://www.javbus.com/imgs/cover/a_b.jpg"],
        ["javbus", "https://www.javbus.com/pics/thumbs/a.jpeg", "https://www.javbus.com/pics/cover/a_b.jpeg"],
        ["javbus", "https://pics.dmm.co.jp/a/abcps.jpg", "https://pics.dmm.co.jp/a/abcpl.jpg"],
        ["javdb", "https://unrelated.example/thumbs/a.jpg", "https://unrelated.example/thumbs/a.jpg"],
    ])("preserves cover upgrade, title and original-image recovery: %s %s", (site, original, upgraded) => {
        const { dom, legacy } = harness(site);
        const controller = new ListCoverImageController({ hostAdapter: { site, document: dom.window.document }, window: dom.window });
        for (const replace of [image => legacy._replaceSingleHdImg(image), image => controller.replaceOne(image)]) {
            const image = dom.window.document.createElement("img");
            image.src = original; image.title = "原始标题";
            replace(image);
            expect(image.src).toBe(upgraded);
            if (original !== upgraded) {
                expect(image.dataset.full).toBe(upgraded);
                expect(image.dataset.hdReplaced).toBe("true");
                expect(image.title).toBe("");
                if (site === "javbus") expect(image.dataset.title).toBe("原始标题");
                replace(image);
                expect(image.src).toBe(upgraded);
                image.dispatchEvent(new dom.window.Event("error"));
                expect(image.src).toBe(original);
                expect(image.onerror).toBeNull();
            } else expect(image.title).toBe("原始标题");
        }
        controller.dispose(); dom.window.close();
    });

    it.each(["feature", "compatibility"])("preserves primary/secondary selection, ARIA and mobile labels: %s", mode => {
        const { dom, $, legacy } = harness();
        const view = new ListView({ hostAdapter: {}, selectors: { boxSelector: ".movie-list", itemSelector: ".item" } });
        view.createQuickFilter("waitCheck");
        const sync = filter => {
            if (mode === "feature") view.syncQuickFilterUi(filter);
            else { legacy.activeQuickFilter = filter; legacy.syncQuickFilterUi(); }
        };
        sync("favorite");
        expect($('.jhs-segmented__item[aria-selected="true"]').data("jhs-filter")).toBe("favorite");
        expect($('.jhs-segmented__item[data-jhs-filter="favorite"]').attr("tabindex")).toBe("0");
        expect($(".jhs-quick-filter__label").text()).toBe("更多筛选");
        expect($(".jhs-mobile-filter-label").text()).toBe("筛选：收藏");
        expect($(".jhs-mobile-filter-option").attr("aria-checked")).toBe("true");
        sync("blockedItems");
        expect($('.jhs-segmented__item[aria-selected="true"]')).toHaveLength(0);
        expect($('.jhs-filter-option[aria-checked="true"]').data("jhs-filter")).toBe("blockedItems");
        expect($(".jhs-quick-filter__label").text()).toBe("筛选：屏蔽项");
        expect($(".jhs-mobile-filter-option").attr("aria-checked")).toBe("false");
        view.dispose(); dom.window.close();
    });
});
