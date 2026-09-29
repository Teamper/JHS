// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { JavTrailersController } from "../src/features/external-bridge/javtrailers-controller.js";
import externalBridge from "../src/features/external-bridge/manifest.js";
import { compatibilityContributionCatalog } from "../src/features/compatibility/contribution-catalog.js";

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    history.replaceState(null, "", "/");
    document.body.replaceChildren();
});

function makeController(path, options = {}) {
    history.replaceState(null, "", `${path}${path.includes("?") ? "" : "?handle=1"}`);
    const scope = new LifecycleScope("feature:external-bridge");
    const navigate = vi.fn();
    const controller = new JavTrailersController({ scope, navigate, play: vi.fn(), ...options });
    return { controller, scope, navigate };
}

describe("JavTrailers Feature controller", () => {
    it("owns the old disable ID but no longer registers a BasePlugin behavior executor", () => {
        const contribution = compatibilityContributionCatalog.find((item) => item.id === "external-bridge.javtrailers");
        expect(contribution).toMatchObject({ legacyPluginId: "JavTrailersPlugin", executionOwner: "feature", plugin: null });
        expect(externalBridge.contributes).toContain("external-bridge.javtrailers");
    });

    it("leaves normal JavTrailers navigation alone when the preview flag is absent", () => {
        const { controller, scope, navigate } = makeController("/videos/sample?normal=1");
        expect(controller.start()).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
        expect(scope.snapshot()).toMatchObject({ listeners: 0, observers: 0 });
        scope.dispose();
    });

    it("redirects a matching search result and preserves the handle query", () => {
        document.body.innerHTML = '<div class="videos-list"><a class="video-link" href="/videos/abc-1"><span class="vid-title">ABC-1 trailer</span></a></div>';
        const { controller, scope, navigate } = makeController("/search/abc-1?handle=1");
        expect(controller.start()).toBe(true);
        expect(navigate).toHaveBeenCalledWith("/videos/abc-1?handle=1");
        expect(scope.snapshot().listeners).toBe(0);
        scope.dispose();
    });

    it("turns an unmatched video 404 into a search path while preserving its query", () => {
        document.body.innerHTML = "<h1>Page not found</h1>";
        const { controller, scope, navigate } = makeController("/video/ABC001?handle=1");
        expect(controller.start()).toBe(true);
        expect(navigate).toHaveBeenCalledWith("/search/abc-1?handle=1");
        expect(scope.snapshot().listeners).toBe(0);
        scope.dispose();
    });

    it("plays the preview, adjusts the timeline, and restores only its own styles on stop", async () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="videoPlayerContainer"></div><div id="vjs_video_3"><canvas style="top: 3px"></canvas></div><video id="vjs_video_3_html5_api" style="position: absolute"></video><div class="vjs-control-bar"></div>';
        const playVideo = vi.fn();
        const { controller, scope } = makeController("/videos/sample?handle=1", { playVideo });
        const video = document.getElementById("vjs_video_3_html5_api");
        const canvas = document.querySelector("#vjs_video_3 canvas");
        let currentTime = 0;
        Object.defineProperty(video, "currentTime", { configurable: true, get: () => currentTime, set: (value) => { currentTime = value; } });
        expect(controller.start()).toBe(true);
        await vi.advanceTimersByTimeAsync(100);

        expect(playVideo).toHaveBeenCalledWith(video);
        expect(video.currentTime).toBe(5);
        expect(video.style.position).toBe("fixed");
        expect(canvas.style.position).toBe("fixed");
        video.currentTime = 15;
        video.dispatchEvent(new Event("timeupdate"));
        expect(video.currentTime).toBe(17);
        video.currentTime = 1;
        window.dispatchEvent(new MessageEvent("message"));
        expect(video.currentTime).toBe(6);

        scope.dispose();
        video.style.position = "relative";
        window.dispatchEvent(new MessageEvent("message"));
        expect(video.currentTime).toBe(6);
        expect(video.style.position).toBe("relative");
        expect(canvas.style.position).toBe("");
        expect(canvas.style.top).toBe("3px");
        expect(scope.snapshot()).toMatchObject({ listeners: 0, disposed: true });
    });

    it("cancels player polling and pending preview startup after feature disposal", async () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="videoPlayerContainer"></div>';
        const playVideo = vi.fn();
        const { controller, scope } = makeController("/videos/sample?handle=1", { playVideo });
        controller.start();
        scope.dispose();
        document.body.insertAdjacentHTML("beforeend", '<video id="vjs_video_3_html5_api"></video><div id="vjs_video_3"><canvas></canvas></div>');
        await vi.advanceTimersByTimeAsync(500);
        expect(playVideo).not.toHaveBeenCalled();
        expect(scope.snapshot()).toMatchObject({ listeners: 0, observers: 0, disposed: true });
    });
});
