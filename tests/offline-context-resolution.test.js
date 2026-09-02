import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { createMovieContext, readOwnedMovieContext, resolveMovieContext } from "../src/core/movie-context.js";

afterEach(() => vi.unstubAllGlobals());

describe("offline movie context resolution", () => {
    it("lets an explicit context override an owned FC2 surface", () => {
        const dom = new JSDOM('<div class="jhs-fc2-workspace"><button class="jhs-offline-btn"></button></div>'), $ = jqueryFactory(dom.window), button = $("button");
        vi.stubGlobal("$", $);
        $(".jhs-fc2-workspace").data("jhsMovieContext", createMovieContext({ carNum: "FC2-123", surface: "fc2-dialog" }));
        const result = resolveMovieContext({ trigger: button, explicitContext: { carNum: "ABC-001", surface: "list-item" } });
        expect(result.source).toBe("explicit");
        expect(result.context).toMatchObject({ carNum: "ABC-001", surface: "list-item" });
    });

    it("resolves the nearest FC2 workspace before native page state", () => {
        const dom = new JSDOM('<div class="jhs-fc2-workspace"><div class="magnet-container"><button class="jhs-offline-btn"></button></div></div>'), $ = jqueryFactory(dom.window), button = $("button");
        vi.stubGlobal("$", $);
        $(".jhs-fc2-workspace").data("jhsMovieContext", { carNum: "FC2-456", movieId: "movie-456", surface: "fc2-dialog" });
        const result = resolveMovieContext({ trigger: button, nativeResolver: () => ({ carNum: "ABC-999" }) });
        expect(result.source).toBe("fc2-workspace");
        expect(result.context).toMatchObject({ carNum: "FC2-456", movieId: "movie-456" });
    });

    it("uses list-item and native-detail sources in order", () => {
        const list = resolveMovieContext({ listResolver: () => ({ carNum: "ABC-002" }), nativeResolver: () => ({ carNum: "ABC-003" }) });
        expect(list).toMatchObject({ source: "list-item", context: { carNum: "ABC-002" } });
        const native = resolveMovieContext({ nativeResolver: () => ({ carNum: "ABC-003" }) });
        expect(native).toMatchObject({ source: "native-detail", context: { carNum: "ABC-003", surface: "native-detail" } });
    });

    it("warns when only a legacy fallback identifies the movie", () => {
        const logger = vi.fn(), result = resolveMovieContext({ legacyResolver: () => ({ carNum: "ABC-004" }), logger });
        expect(result.source).toBe("legacy-fallback");
        expect(logger).toHaveBeenCalledWith("movie-context source=legacy-fallback", expect.anything());
    });

    it("fails safely when no valid context exists", () => {
        expect(resolveMovieContext({ explicitContext: { title: "missing" } })).toEqual({ context: null, source: "missing" });
        expect(readOwnedMovieContext(null)).toBeNull();
    });
});

