import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { expect, it, vi } from "vitest";
import { LifecycleScope } from "../../src/core/lifecycle-scope.js";
import { JavTrailersController } from "../../src/features/external-bridge/javtrailers-controller.js";

it("plays the native JavTrailers preview with the resolved media URL", async () => {
    const html = readFileSync(new URL("../fixtures/integrations/javtrailers/preview.html", import.meta.url), "utf8");
    const page = new JSDOM(html, { url: "https://javtrailers.com/video/sample?handle=1" });
    const scope = new LifecycleScope("javtrailers-fixture");
    const playVideo = vi.fn();
    vi.useFakeTimers();
    try {
        const controller = new JavTrailersController({ document: page.window.document, window: page.window, scope, playVideo });
        expect(controller.start()).toBe(true);
        await vi.advanceTimersByTimeAsync(100);
        expect(playVideo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ src: "https://javtrailers.com/videos/sample.mp4" }));
    } finally {
        scope.dispose();
        page.window.close();
        vi.useRealTimers();
    }
});
