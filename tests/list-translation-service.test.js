// @vitest-environment jsdom

import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListTranslationService } from "../src/features/list/list-translation-service.js";

afterEach(() => { delete globalThis.$; });

function createService(scope, translation, enabled = "yes") {
    return new ListTranslationService({
        scope,
        document,
        window,
        selectors: { itemSelector: ".movie-list .item" },
        site: "javdb",
        settings: { snapshot: () => ({ translateTitle: enabled }) },
        translation,
    });
}

describe("ListTranslationService", () => {
    it("translates and restores JavDB card titles through the feature service", async () => {
        document.body.innerHTML = '<div class="movie-list"><div class="item"><div class="box" title="原题"></div><div class="video-title"><strong>ABC-123</strong> 原题</div></div></div>';
        globalThis.$ = jqueryFactory;
        const scope = new LifecycleScope("feature:list"), translation = { translate: vi.fn(async () => "译文") }, service = createService(scope, translation);
        const card = document.querySelector(".movie-list .item");

        await service.translateListItems([card]);

        expect(translation.translate).toHaveBeenCalledWith("原题", { cacheAlias: "ABC-123", scope });
        expect(card.getAttribute("data-jhs-translation-key")).toBe("ABC-123");
        expect(card.querySelector(".video-title").textContent).toContain("译文");
        await service.revertTranslation();
        expect(card.querySelector(".video-title").textContent).toContain("原题");
        scope.dispose();
    });

    it("drops an in-flight result after invalidation and respects the setting gate", async () => {
        document.body.innerHTML = '<div class="movie-list"><div class="item"><div class="box" title="原题"></div><div class="video-title"><strong>ABC-123</strong> 原题</div></div></div>';
        globalThis.$ = jqueryFactory;
        let resolveTranslation;
        const pending = new Promise((resolve) => { resolveTranslation = resolve; }), translation = { translate: vi.fn(() => pending) }, scope = new LifecycleScope("feature:list"), service = createService(scope, translation), card = document.querySelector(".movie-list .item");
        const request = service.translate(card);
        service.invalidateTranslations();
        resolveTranslation("译文");
        await request;

        expect(card.getAttribute("data-jhs-translation-key")).toBeNull();
        const disabled = createService(scope, { translate: vi.fn() }, "no");
        await disabled.translateListItems([card]);
        expect(disabled.translation.translate).not.toHaveBeenCalled();
        scope.dispose();
    });
});
