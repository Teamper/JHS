import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { ListPageCompatibilityService as ListPagePlugin } from "../src/features/list/list-compatibility-service.js";
import { ExternalBridgeTranslationController } from "../src/features/translation/translation-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
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

    it("runs native translation through the real ListPagePlugin with DOM Element[]", async () => {
        const { dom, jq, listPage, translate, clog } = createListHarness();
        dom.window.isListPage = true;
        const scope = new LifecycleScope("translation-list-test");
        const settings = new EventTarget();
        settings.snapshot = () => ({ translateTitle: "yes" });
        const controller = new ExternalBridgeTranslationController({
            document: dom.window.document, window: dom.window, route: "list",
            hostAdapter: { site: "javdb", getListSelectors: () => ({ itemSelector: ".movie-list .item" }) }, listPage,
            settings, translation: { translate }, styles: { register: () => () => {} }, diagnostics: { recordError: clog.error }, scope,
        });
        controller.start();
        await vi.waitFor(() => expect(translate).toHaveBeenCalledTimes(2));

        expect(translate).toHaveBeenCalledTimes(2);
        expect(dom.window.document.querySelector(".item").getAttribute("data-jhs-translation-key")).toBe("ABC-123");
        expect(clog.error).not.toHaveBeenCalled();
        scope.dispose();
    });

    it("translates the JavDB h1 title on detail routes", async () => {
        const dom = new JSDOM("<!DOCTYPE html><body><h1>ABC-123 Browser Fixture</h1></body>", { url: "https://javdb.com/v/test-id" });
        const translate = vi.fn(async () => "即时译文");
        const settings = new EventTarget();
        settings.snapshot = () => ({ translateTitle: "yes" });
        const scope = new LifecycleScope("translation-detail-test");
        const controller = new ExternalBridgeTranslationController({
            document: dom.window.document, window: dom.window, route: "detail",
            hostAdapter: { readMovieRef: () => ({ carNum: "ABC-123" }) }, settings, translation: { translate },
            styles: { register: () => () => {} }, diagnostics: { recordError: vi.fn() }, scope,
        });

        controller.start();
        await vi.waitFor(() => expect(dom.window.document.querySelector(".translated-title")?.textContent).toBe("即时译文"));

        expect(translate).toHaveBeenCalledWith("ABC-123 Browser Fixture", expect.objectContaining({ cacheAlias: "ABC-123", scope }));
        scope.dispose();
    });

    it("treats missing translateTitle as enabled by default", async () => {
        const { dom, listPage, translate } = createListHarness();
        listPage.runtimeServices.settings.snapshot = () => ({});
        const items = Array.from(dom.window.document.querySelectorAll(".movie-list .item"));

        await listPage.translateListItems(items);

        expect(translate).toHaveBeenCalledTimes(2);
    });

    it("requires an explicit quick root and throws instead of guessing globally", async () => {
        const rootDom = new JSDOM("<!DOCTYPE html><body></body>", { url: "https://javdb.com/" });
        vi.stubGlobal("$", jqueryFactory(rootDom.window));
        const { initQuickSettingForm } = await import("../src/plugins/backup/setting-forms.js");
        await expect(initQuickSettingForm({ settingsRegistry: null, settings: {}, jquery: () => ({ length: 0 }) }, () => null, () => {}, null)).rejects.toThrow("Quick setting root is required");
    });
});
