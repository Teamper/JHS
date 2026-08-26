import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { ListPagePlugin } from "../src/plugins/status/list-page.js";
import { TranslatePlugin } from "../src/plugins/translate/translate.js";
import { initializeRuntimeConstants } from "../src/core/constants.js";

function flush() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createListHarness() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div class="movie-list">
            <div class="item"><div class="video-title"><strong>ABC-123</strong> 原題</div></div>
            <div class="item"><div class="video-title"><strong>DEF-456</strong> 原題</div></div>
        </div>
    </body></html>`, { url: "https://javdb.com/" });
    const jq = jqueryFactory(dom.window);
    const translate = vi.fn(async () => "译文");
    const clog = { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn(), lowZIndex: vi.fn() };

    vi.stubGlobal("$", jq);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("isDetailPage", false);
    vi.stubGlobal("clog", clog);

    initializeRuntimeConstants(dom.window.location);

    const listPage = new ListPagePlugin();
    listPage.runtimeServices = {
        settings: { snapshot: () => ({ translateTitle: "yes" }) },
        translation: { translate },
        scope: async () => ({ disposed: false }),
    };
    listPage.translationGeneration = 0;
    listPage.getSelector = () => ({ itemSelector: ".movie-list .item" });

    return { dom, jq, listPage, translate, clog };
}

describe("translation DOM/jQuery contract", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("translates raw DOM Element[] through ListPagePlugin.translateListItems", async () => {
        const { dom, listPage, translate, clog } = createListHarness();
        const items = Array.from(dom.window.document.querySelectorAll(".movie-list .item"));

        await listPage.translateListItems(items);

        expect(translate).toHaveBeenCalledTimes(2);
        expect(dom.window.document.querySelector(".item").getAttribute("data-jhs-translation-key")).toBe("ABC-123");
        expect(dom.window.document.querySelector(".item").textContent).toContain("译文");
        expect(clog.error).not.toHaveBeenCalled();
    });

    it("runs TranslatePlugin.applyTranslation through the real ListPagePlugin with DOM Element[]", async () => {
        const { dom, jq, listPage, translate, clog } = createListHarness();
        dom.window.isListPage = true;

        const translatePlugin = new TranslatePlugin();
        translatePlugin.runtimeServices = {
            settings: { snapshot: () => ({ translateTitle: "yes" }) },
            translation: { translate },
            scope: async () => ({ disposed: false }),
        };
        translatePlugin.getOptionalDependency = () => listPage;

        await translatePlugin.applyTranslation();

        expect(translate).toHaveBeenCalledTimes(2);
        expect(dom.window.document.querySelector(".item").getAttribute("data-jhs-translation-key")).toBe("ABC-123");
        expect(clog.error).not.toHaveBeenCalled();
    });

    it("requires an explicit quick root and throws instead of guessing globally", async () => {
        const rootDom = new JSDOM("<!DOCTYPE html><body></body>", { url: "https://javdb.com/" });
        vi.stubGlobal("$", jqueryFactory(rootDom.window));
        const { initQuickSettingForm } = await import("../src/plugins/backup/setting-forms.js");
        await expect(initQuickSettingForm({ settingsRegistry: null, settings: {} }, () => null, () => {}, null)).rejects.toThrow("Quick setting root is required");
    });
});
