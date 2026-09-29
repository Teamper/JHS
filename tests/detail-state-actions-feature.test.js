import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { DetailStateActionsController } from "../src/features/detail/detail-state-actions-controller.js";
import { DetailController } from "../src/features/detail/detail-controller.js";

describe("DetailStateActionsController", () => {
    it("owns state reads and toggles through injected services and releases DOM handlers", async () => {
        const dom = new JSDOM('<button id="favoriteBtn" aria-pressed="false"><span>收藏</span></button>', { url: "https://javdb.com/v/test" });
        const $ = jqueryFactory(dom.window);
        const record = { carNum: "ABC-123", url: "https://javdb.com/v/test", names: "测试", stateFlags: { favorite: false } };
        const state = {
            getState: vi.fn(async () => record),
            toggle: vi.fn(async (_carNum, flag) => { record.stateFlags[flag] = !record.stateFlags[flag]; }),
        };
        const confirm = vi.fn((_event, _message, accept) => accept());
        const closePage = vi.fn(async () => true);
        const scope = new LifecycleScope("detail-state-actions:test");
        const controller = new DetailStateActionsController({
            state, scope,
            page: {
                readPageInfo: () => ({ carNum: "ABC-123", url: record.url, actress: "测试", publishTime: "2026-09-25" }),
                ui: { document: dom.window.document, jquery: (value) => $(value), confirm, closePage, reportError: vi.fn(), logError: vi.fn() },
            },
        });
        controller.bind({ root: dom.window.document, carNum: "ABC-123" });

        await controller.favoriteOne({ currentTarget: dom.window.document.querySelector("#favoriteBtn"), preventDefault() {}, stopPropagation() {} });

        expect(state.getState).toHaveBeenCalledWith("ABC-123");
        expect(state.toggle).toHaveBeenCalledWith("ABC-123", "favorite", expect.objectContaining({ type: "detail-state", record: expect.objectContaining({ names: "测试" }) }));
        expect(closePage).toHaveBeenCalledOnce();
        expect(dom.window.document.querySelector("#favoriteBtn").getAttribute("aria-pressed")).toBe("true");

        scope.dispose();
        state.toggle.mockClear();
        $("#favoriteBtn").trigger("click");
        await Promise.resolve();
        expect(state.toggle).not.toHaveBeenCalled();
        dom.window.close();
    });

    it("confirms the blocked transition through the injected compatibility UI", async () => {
        const dom = new JSDOM('<button id="filterBtn"><span>屏蔽</span></button>');
        const $ = jqueryFactory(dom.window), record = { stateFlags: { blocked: false } };
        const state = { getState: vi.fn(async () => record), toggle: vi.fn(async () => { record.stateFlags.blocked = true; }) };
        const confirm = vi.fn((_event, _message, accept) => accept());
        const scope = new LifecycleScope("detail-state-actions:blocked");
        const controller = new DetailStateActionsController({
            state, scope,
            page: { readPageInfo: () => ({ carNum: "ABC-123", url: "https://javdb.com/v/test" }), ui: { document: dom.window.document, jquery: (value) => $(value), confirm, closePage: vi.fn(async () => false), reportError: vi.fn(), logError: vi.fn() } },
        });
        await controller.filterOne({ currentTarget: dom.window.document.querySelector("#filterBtn"), preventDefault() {}, stopPropagation() {} });
        expect(confirm).toHaveBeenCalledOnce();
        expect(state.toggle).toHaveBeenCalledOnce();
        scope.dispose();
        dom.window.close();
    });
});

describe("DetailController JavDB external-link contribution", () => {
    it("opens only HTTP(S) detail metadata links in a new tab and respects its disabled id", () => {
        const dom = new JSDOM('<main class="video-detail"><div class="video-meta-panel"><a id="https" href="https://example.test/title">https</a><a id="relative" href="/actor/1">relative</a><a id="mail" href="mailto:actor@example.test">mail</a></div></main>', { url: "https://javdb.com/v/test" });
        const root = dom.window.document.querySelector(".video-detail");
        if (!root) throw new Error("detail fixture is missing");
        const hostAdapter = {
            site: "javdb", location: dom.window.location,
            locateDetailRoot: () => root,
            locateDetailSlots: () => ({}),
            locateDetailExternalLinks: () => [...root.querySelectorAll(".video-meta-panel a")],
            readMovieRef: () => ({ carNum: "ABC-123", url: dom.window.location.href, site: "javdb" }),
        };
        const enabled = new DetailController({ hostAdapter, scope: new LifecycleScope("detail-links:enabled"), enabledContributions: ["detail.javdb-native"], state: {} });
        enabled.start();
        expect(dom.window.document.querySelector("#https").getAttribute("target")).toBe("_blank");
        expect(dom.window.document.querySelector("#relative").getAttribute("target")).toBe("_blank");
        expect(dom.window.document.querySelector("#mail").hasAttribute("target")).toBe(false);
        enabled.dispose();

        dom.window.document.querySelector("#https").removeAttribute("target");
        const disabled = new DetailController({ hostAdapter, scope: new LifecycleScope("detail-links:disabled"), enabledContributions: [], state: {} });
        disabled.start();
        disabled.dispose();
        expect(dom.window.document.querySelector("#https").hasAttribute("target")).toBe(false);
        dom.window.close();
    });
});
