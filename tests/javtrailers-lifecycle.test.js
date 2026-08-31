// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { JavTrailersController } from "../src/features/external-bridge/javtrailers-controller.js";

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("JavTrailers lifecycle", () => {
    it("disposes playback message and jQuery click listeners with the Feature scope", () => {
        document.body.innerHTML = '<div id="videoPlayerContainer"></div><video id="vjs_video_3_html5_api"></video>';
        vi.stubGlobal("$", jquery);
        const ui = { getJQuery: () => jquery, getUtils: () => ({}), getClog: () => ({}) }, scope = new LifecycleScope("feature:external-bridge"), plugin = new JavTrailersController({ document, window, ui, scope });
        vi.spyOn(plugin, "handlePlayJavTrailers").mockImplementation(() => {});
        plugin.bindPlaybackControls(scope);
        expect(scope.snapshot().listeners).toBe(1);
        $("#videoPlayerContainer").trigger("click");
        expect(plugin.handlePlayJavTrailers).toHaveBeenCalledTimes(1);
        const video = document.getElementById("vjs_video_3_html5_api");
        video.currentTime = 1;
        window.dispatchEvent(new MessageEvent("message"));
        expect(video.currentTime).toBe(6);
        scope.dispose();
        $("#videoPlayerContainer").trigger("click");
        window.dispatchEvent(new MessageEvent("message"));
        expect(plugin.handlePlayJavTrailers).toHaveBeenCalledTimes(1);
        expect(video.currentTime).toBe(6);
        expect(scope.snapshot()).toMatchObject({ listeners: 0, disposed: true });
    });

    it("cancels DOM waits and the media listener when disposed", async () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="vjs_video_3"><canvas></canvas></div><video id="vjs_video_3_html5_api"></video><div class="vjs-control-bar"></div>';
        const cancellations = [];
        vi.stubGlobal("$", jquery);
        vi.stubGlobal("clog", { debug: vi.fn() });
        vi.stubGlobal("utils", { loopDetector: (condition, callback) => {
            if (condition()) callback();
            const cancel = vi.fn();
            cancellations.push(cancel);
            return cancel;
        } });
        const ui = { getJQuery: () => jquery, getUtils: () => ({ loopDetector: (condition, callback) => {
            if (condition()) callback();
            const cancel = vi.fn();
            cancellations.push(cancel);
            return cancel;
        } }), getClog: () => ({ debug: vi.fn() }) }, scope = new LifecycleScope("feature:external-bridge"), plugin = new JavTrailersController({ document, window, ui, scope }), video = document.getElementById("vjs_video_3_html5_api");
        video.play = vi.fn(async () => {});
        plugin.handlePlayJavTrailers(scope);
        await vi.advanceTimersByTimeAsync(100);
        expect(scope.snapshot().listeners).toBe(1);
        video.currentTime = 15;
        video.dispatchEvent(new Event("timeupdate"));
        expect(video.currentTime).toBe(17);
        scope.dispose();
        video.currentTime = 15;
        video.dispatchEvent(new Event("timeupdate"));
        expect(video.currentTime).toBe(15);
        expect(cancellations).toHaveLength(2);
        cancellations.forEach(cancel => expect(cancel).toHaveBeenCalledOnce());
        expect(scope.snapshot()).toMatchObject({ listeners: 0, disposed: true });
    });
});
