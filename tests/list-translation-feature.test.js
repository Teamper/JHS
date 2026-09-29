import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { ListPageCompatibilityService as ListPagePlugin } from "../src/features/list/list-compatibility-service.js";
import { ExternalBridgeTranslationController } from "../src/features/translation/translation-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

function createHarness({ site = "javdb", translation = vi.fn(async () => "即时译文"), markup } = {}) {
    const isJavDb = site === "javdb";
    const html = markup ?? (isJavDb
        ? '<div class="movie-list"><article class="item"><a href="/v/abc-123"><div class="video-title"><strong>ABC-123</strong> 原始标题</div></a></article></div>'
        : '<div class="masonry"><article class="item"><a href="/ABC-123"><span class="video-title">原始标题</span><img data-title="原始标题"></a></article></div>');
    const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, { url: `https://${isJavDb ? "javdb.com" : "www.javbus.com"}/` });
    const window = dom.window;
    window.isListPage = true;
    vi.stubGlobal("window", window);
    vi.stubGlobal("document", window.document);
    vi.stubGlobal("$", jqueryFactory(window));
    const settings = new EventTarget();
    settings.value = "yes";
    settings.snapshot = () => ({ translateTitle: settings.value });
    settings.set = (value) => {
        settings.value = value;
        const event = new Event("settings.changed");
        event.detail = { names: ["translateTitle"] };
        settings.dispatchEvent(event);
    };
    const listPage = new ListPagePlugin();
    const scope = new LifecycleScope("list-translation-feature-test");
    const diagnostics = { recordError: vi.fn() };
    const controller = new ExternalBridgeTranslationController({
        document: window.document, window, route: "list", hostAdapter: {
            site, getListSelectors: () => ({ itemSelector: isJavDb ? ".movie-list .item" : ".masonry .item" }),
        },
        listPage, settings, translation: { translate: translation }, styles: { register: () => () => {} }, diagnostics, scope,
    });
    return { dom, listPage, settings, translation, diagnostics, controller, scope };
}

describe("Feature-owned list title translation", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("replaces JavDB direct title text while retaining the number and the original for rollback", async () => {
        const { dom, listPage, translation, controller, scope } = createHarness();
        controller.start();
        await vi.waitFor(() => expect(dom.window.document.querySelector(".item").dataset.jhsTranslationKey).toBe("ABC-123"));

        const item = dom.window.document.querySelector(".item"), title = item.querySelector(".video-title");
        expect(title.querySelector("strong").textContent).toBe("ABC-123");
        expect(title.textContent).toContain("即时译文");
        expect(title.title).toBe("即时译文");
        expect(item.dataset.jhsOriginalTitle).toBe("原始标题");
        expect(translation).toHaveBeenCalledWith("原始标题", expect.objectContaining({ cacheAlias: "ABC-123", scope }));

        await listPage.translateListItems([item]);
        expect(translation).toHaveBeenCalledTimes(2);
        expect(title.textContent).toContain("即时译文");
        scope.dispose();
        expect(title.textContent).toContain("原始标题");
        expect(item.hasAttribute("data-jhs-translation-key")).toBe(false);
    });

    it("replaces JavBus card title text using the legacy image source and href alias", async () => {
        const { dom, translation, controller, scope } = createHarness({
            site: "javbus", markup: '<div class="masonry"><article class="item"><a href="/ABC-123"><span class="video-title">原始标题</span><img data-title="原始标题"></a></article></div>',
        });
        controller.start();
        await vi.waitFor(() => expect(dom.window.document.querySelector(".video-title").textContent).toBe("即时译文"));

        expect(translation).toHaveBeenCalledWith("原始标题", expect.objectContaining({ cacheAlias: "ABC-123", scope }));
        scope.dispose();
        expect(dom.window.document.querySelector(".video-title").textContent.trim()).toBe("原始标题");
    });

    it("preserves unowned JavBus title markup when translation is OFF", () => {
        const { dom, settings, controller, scope } = createHarness({
            site: "javbus",
            markup: '<div class="masonry"><article class="item"><a href="/ABC-123"><span class="video-title" title="宿主标题"> 宿主标题 </span><img data-title="数据标题"></a></article></div>',
        });
        settings.value = "no";
        controller.start();

        const title = dom.window.document.querySelector(".video-title");
        expect(title.getAttribute("title")).toBe("宿主标题");
        expect(title.textContent).toBe(" 宿主标题 ");
        scope.dispose();
        expect(title.getAttribute("title")).toBe("宿主标题");
        expect(title.textContent).toBe(" 宿主标题 ");
    });

    it("does not apply a list translation response that returns after Translate is switched OFF", async () => {
        let resolveTranslation;
        const translation = vi.fn(() => new Promise((resolve) => { resolveTranslation = resolve; }));
        const { dom, settings, controller, scope } = createHarness({ translation });
        controller.start();
        await vi.waitFor(() => expect(translation).toHaveBeenCalledOnce());
        settings.set("no");
        resolveTranslation("迟到译文");
        await new Promise((resolve) => setTimeout(resolve, 0));

        const item = dom.window.document.querySelector(".item");
        expect(item.querySelector(".video-title").textContent).toContain("原始标题");
        expect(item.hasAttribute("data-jhs-translation-key")).toBe(false);
        expect(controller.translateListItems).toBeInstanceOf(Function);
        scope.dispose();
    });

    it("does not start a stale translation after OFF→ON invalidates a batch during its frame yield", async () => {
        const { dom, settings, translation, controller, scope } = createHarness();
        const first = dom.window.document.querySelector(".item");
        for (let index = 1; index < 9; index += 1) {
            const item = first.cloneNode(true);
            item.querySelector("strong").textContent = `ABC-${index}`;
            item.querySelector(".video-title").lastChild.textContent = ` 原始标题${index}`;
            item.querySelector("a").setAttribute("href", `/v/abc-${index}`);
            item.setAttribute("data-jhs-processed", "true");
            first.parentElement.append(item);
        }
        let resumeFrame;
        let signalYield;
        controller.yieldListFrame = () => new Promise((resolve) => {
            resumeFrame = resolve;
            signalYield();
        });
        const yielded = new Promise((resolve) => { signalYield = resolve; });
        const batch = controller.translateListItems([...dom.window.document.querySelectorAll(".item")]);
        await yielded;
        expect(translation).toHaveBeenCalledTimes(8);

        settings.value = "no";
        await controller.reconfigure();
        settings.value = "yes";
        controller.invalidateListTranslations();
        resumeFrame();
        await batch;

        expect(translation).toHaveBeenCalledTimes(8);
        expect(dom.window.document.querySelectorAll('[data-jhs-translation-key="ABC-8"]')).toHaveLength(0);
        scope.dispose();
    });
});
