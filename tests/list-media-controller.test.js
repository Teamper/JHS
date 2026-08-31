import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListMediaController } from "../src/features/list/list-media-controller.js";

describe("ListMediaController", () => {
    it("plays and pauses delegated list videos through the feature scope", async () => {
        const scope = new LifecycleScope("feature:list"), video = { paused: true, play: vi.fn(async () => {}), pause: vi.fn() }, target = { closest: vi.fn(() => video) }, root = { contains: (element) => element === video, addEventListener: vi.fn((_type, listener) => { root.listener = listener; }), removeEventListener: vi.fn() }, document = { querySelector: vi.fn(() => root) }, controller = new ListMediaController({ scope, document, selectors: { boxSelector: ".movie-list" } });
        vi.stubGlobal("clog", { warn: vi.fn(), debug: vi.fn() });
        vi.stubGlobal("show", { error: vi.fn() });
        controller.start();
        const event = { target, preventDefault: vi.fn(), stopPropagation: vi.fn() };
        root.listener(event);
        await Promise.resolve();
        expect(video.play).toHaveBeenCalledOnce();
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(event.stopPropagation).toHaveBeenCalledOnce();
        video.paused = false;
        root.listener({ target, preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(video.pause).toHaveBeenCalledOnce();
        scope.dispose();
        expect(scope.snapshot().listeners).toBe(0);
        expect(root.removeEventListener).toHaveBeenCalledOnce();
    });
});
