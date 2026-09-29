import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { HistoryEntryController } from "../src/features/library/history-entry-controller.js";

afterEach(() => {
    vi.useRealTimers();
});

describe("Feature-owned history entry points", () => {
    it("preserves JavDB responsive entry placement and restores host markup on disposal", () => {
        const dom = new JSDOM('<body><div class="navbar-end"></div><div class="navbar-search" style="margin-left: 12px"></div></body>', { url: "https://javdb.com/" });
        const $ = jqueryFactory(dom.window);
        let searchHidden = true;
        const jquery = (selector) => {
            const result = $(selector);
            if (selector === ".navbar-search") result.is = () => searchHidden;
            return result;
        };
        const openHistory = vi.fn(), scope = new LifecycleScope("feature:history-entry");
        const controller = new HistoryEntryController({
            document: dom.window.document, window: dom.window, jquery, profile: new dom.window.EventTarget(),
            site: "javdb", openHistory, scope, onError: vi.fn(),
        });

        controller.start();
        expect(dom.window.document.querySelector(".navbar-end #historyBtn").textContent).toBe("鉴定记录");
        expect(dom.window.document.querySelector(".miniHistoryBtnBox").style.display).toBe("none");
        expect(dom.window.document.querySelector(".navbar-search").style.marginLeft).toBe("0px");
        dom.window.document.querySelector("#historyBtn").click();
        expect(openHistory).toHaveBeenCalledOnce();

        searchHidden = false;
        dom.window.dispatchEvent(new dom.window.Event("resize"));
        expect(dom.window.document.querySelector(".historyBtnBox").style.display).toBe("none");
        expect(dom.window.document.querySelector(".miniHistoryBtnBox").style.display).toBe("");

        scope.dispose();
        expect(dom.window.document.querySelector("#historyBtn")).toBeNull();
        expect(dom.window.document.querySelector("#miniHistoryBtn")).toBeNull();
        expect(dom.window.document.querySelector(".navbar-search").style.marginLeft).toBe("12px");
        expect(scope.snapshot()).toMatchObject({ listeners: 0, disposed: true });
        dom.window.close();
    });

    it("cancels the JavBus toolbar wait when its owner closes", async () => {
        vi.useFakeTimers();
        const dom = new JSDOM("<body></body>", { url: "https://www.javbus.com/" });
        const scope = new LifecycleScope("feature:history-entry:bus"), profile = new dom.window.EventTarget();
        const controller = new HistoryEntryController({
            document: dom.window.document, window: dom.window, jquery: jqueryFactory(dom.window),
            profile, site: "javbus", openHistory: vi.fn(), scope, onError: vi.fn(),
        });

        controller.start();
        expect(vi.getTimerCount()).toBe(2);
        profile.dispatchEvent(new dom.window.CustomEvent("profile.changed", { detail: { profile: "regular" } }));
        expect(vi.getTimerCount()).toBe(2);
        scope.dispose();
        expect(vi.getTimerCount()).toBe(0);
        dom.window.document.body.innerHTML = '<button id="setting-btn"></button><div id="top-right-box"></div>';
        await vi.advanceTimersByTimeAsync(100);
        expect(dom.window.document.querySelector("#historyBtn")).toBeNull();
        dom.window.close();
    });

    it("mounts one JavBus entry when host controls become ready", async () => {
        vi.useFakeTimers();
        const dom = new JSDOM("<body></body>", { url: "https://www.javbus.com/" });
        const scope = new LifecycleScope("feature:history-entry:bus-ready"), openHistory = vi.fn();
        const controller = new HistoryEntryController({
            document: dom.window.document, window: dom.window, jquery: jqueryFactory(dom.window),
            profile: new dom.window.EventTarget(), site: "javbus", openHistory, scope, onError: vi.fn(),
        });

        controller.start();
        dom.window.document.body.innerHTML = '<button id="setting-btn"></button><div id="top-right-box"></div>';
        await vi.advanceTimersByTimeAsync(25);
        const button = dom.window.document.querySelector("#top-right-box #historyBtn");
        expect(button?.textContent).toBe("鉴定记录");
        button.click();
        expect(openHistory).toHaveBeenCalledOnce();
        scope.dispose();
        expect(dom.window.document.querySelector("#historyBtn")).toBeNull();
        dom.window.close();
    });
});
