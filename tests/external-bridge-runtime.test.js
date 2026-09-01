import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jquery from "jquery";
import { ExternalBridgeController } from "../src/features/external-bridge/external-bridge-controller.js";
import externalBridge from "../src/features/external-bridge/manifest.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { PORT, SERVICE } from "../src/contracts/tokens.js";

describe("ExternalBridgeController", () => {
    it("starts enabled bridge contributions with one Feature scope", async () => {
        const scope = new LifecycleScope("feature:external-bridge"), plugins = Object.fromEntries([
            ["translationController", { start: vi.fn() }],
            ["oneOneFiveController", { start: vi.fn() }],
            ["offlineController", { start: vi.fn(), registry: { providers: new Map([["115", { id: "115" }]]) } }],
            ["oneTwoThreeController", { start: vi.fn() }],
            ["javTrailersController", { start: vi.fn() }],
            ["subtitleController", { start: vi.fn() }],
        ]);
        const controller = new ExternalBridgeController({ ...plugins, scope });

        await controller.start();

        expect(plugins.oneTwoThreeController.start).toHaveBeenCalledOnce();
        expect(plugins.translationController.start).toHaveBeenCalledOnce();
        expect(plugins.oneOneFiveController.start).toHaveBeenCalledOnce();
        expect(plugins.offlineController.start).toHaveBeenCalledOnce();
        expect(plugins.javTrailersController.start).toHaveBeenCalledOnce();
        expect(plugins.subtitleController.start).toHaveBeenCalledOnce();
        expect(controller.getApi()).toMatchObject({ hasTranslation: true, hasOffline: true });
        expect(controller.getApi().getOfflineProvider("115")).toBe(plugins.offlineController.registry.providers.get("115"));
    });

    it("does not start a second time and releases the started state on failure", async () => {
        const scope = new LifecycleScope("feature:external-bridge"), start = vi.fn().mockRejectedValue(new Error("bridge failed"));
        const controller = new ExternalBridgeController({ translationController: { start }, scope });

        await expect(controller.start()).rejects.toThrow("bridge failed");
        expect(controller.started).toBe(false);
        start.mockResolvedValue(undefined);
        await controller.start();
        expect(start).toHaveBeenCalledTimes(2);
    });

    it("only activates SubtitleCat filtering on the SubtitleCat site", async () => {
        const run = async (site, url, html) => {
            const dom = new JSDOM(html, { url }), error = vi.fn(), cleanups = [], scope = {
                assertActive() {},
                addCleanup(cleanup) { cleanups.push(cleanup); return () => {}; },
            };
            vi.stubGlobal("document", dom.window.document);
            vi.stubGlobal("window", dom.window);
            const result = await externalBridge.activate({
                [PORT.host]: { site },
                [SERVICE.ui]: { getJQuery: () => jquery(dom.window), show: { error } },
            }, { enabledContributions: ["external-bridge.subtitle"], site, route: "detail", scope });
            return { dom, error, result, cleanups };
        };

        const javdb = await run("javdb", "https://javdb.com/v/test", '<div class="t-banner-inner">banner</div><div id="navbar">nav</div><div class="sec-title">1 字幕</div><table class="sub-table"><tr><td><a>OTHER-1</a></td></tr></table>');
        expect(javdb.error).not.toHaveBeenCalled();
        expect(javdb.dom.window.document.querySelector(".t-banner-inner").style.display).toBe("");
        expect(javdb.dom.window.document.querySelector(".sec-title").textContent).toBe("1 字幕");
        javdb.result.dispose();
        javdb.cleanups.forEach((cleanup) => cleanup());

        const subtitlecat = await run("subtitlecat", "https://subtitlecat.com/?search=ABC-123", '<div class="t-banner-inner">banner</div><div id="navbar">nav</div><div class="sec-title">0 字幕</div><table class="sub-table"><tr><td><a>ABC-123</a></td></tr></table>');
        expect(subtitlecat.error).not.toHaveBeenCalled();
        expect(subtitlecat.dom.window.document.querySelector(".t-banner-inner").style.display).toBe("none");
        expect(subtitlecat.dom.window.document.querySelector(".sec-title").textContent).toBe("1 字幕");
        subtitlecat.result.dispose();
        subtitlecat.cleanups.forEach((cleanup) => cleanup());
        vi.unstubAllGlobals();
    });
});
