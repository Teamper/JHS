import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListCoverStateActionsController } from "../src/features/list/list-cover-state-actions-controller.js";

afterEach(() => vi.unstubAllGlobals());

describe("ListCoverStateActionsController", () => {
    it("mounts card actions from explicit feature dependencies and releases its style", async () => {
        const dom = new JSDOM('<div class="movie-list"><article class="item"><div class="photo-info"><div class="cover"><img src="https://cdn.example/cover.jpg"></div></div></article></div>', { url: "https://javdb.com/advanced_search" });
        const $ = jqueryFactory(dom.window), listeners = [], settings = {
            snapshot: () => ({ enableLoadScreenShot: "yes", enableVideoSvg: "yes", enablePreviewVideo: "yes", enableHandleSvg: "yes", enableSiteSvg: "yes", enableCopySvg: "yes", videoQuality: "high" }),
            addEventListener: vi.fn((name, handler) => listeners.push({ name, handler })),
            removeEventListener: vi.fn(),
        }, styles = { register: vi.fn(() => vi.fn()) }, listFeatureApi = {
            getListSelectors: vi.fn(() => ({ itemSelector: ".movie-list .item" })),
            findCarNumAndHref: () => ({ carNum: "ABC-123", url: "/v/abc", title: "标题", publishTime: "2026-08-01" }),
            parseActressName: vi.fn(async () => []),
        }, scope = new LifecycleScope("test:list-cover-actions"), controller = new ListCoverStateActionsController({
            hostAdapter: { site: "javdb", document: dom.window.document, location: dom.window.location },
            settings,
            storage: {},
            movie: { externalSiteOrigin: () => "https://example.com", providerOrigin: () => "https://123.example" },
            screenshot: { isEnabled: () => true },
            state: { patch: vi.fn() },
            features: { getFeatureApi: vi.fn(async () => listFeatureApi) },
            ui: { getJQuery: () => $, getClog: () => ({ warn: vi.fn(), error: vi.fn() }), show: {} },
            styles,
            scope,
            document: dom.window.document,
            window: Object.assign(dom.window, { isListPage: true }),
        });

        await controller.handle({ scope, listFeatureApi });

        expect(dom.window.document.querySelector(".jhs-cover-tools")).not.toBeNull();
        expect(dom.window.document.querySelectorAll(".jhs-cover-tools svg").length).toBeGreaterThan(0);
        expect(listFeatureApi.getListSelectors).toHaveBeenCalled();
        expect(styles.register).toHaveBeenCalledWith("jhs-list-cover-actions", expect.stringContaining(".jhs-cover-tools"));
        expect(listeners).toHaveLength(1);
        expect(listeners[0].name).toBe("settings.changed");

        controller.dispose();
        expect(styles.register.mock.results[0].value).toHaveBeenCalledOnce();
    });
});
