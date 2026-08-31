// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { SubtitleCatController } from "../src/features/external-bridge/subtitle-cat-controller.js";

afterEach(() => vi.unstubAllGlobals());

function createController() {
    window.history.replaceState({}, "", "?search=ABC-1");
    vi.stubGlobal("$", jquery);
    const show = { error: vi.fn() };
    vi.stubGlobal("show", show);
    const scope = new LifecycleScope("feature:external-bridge"), controller = new SubtitleCatController({ document, window, scope });
    return { controller, scope, show };
}

describe("SubtitleCat lifecycle", () => {
    it("filters rows, updates the count, and restores the host page on dispose", () => {
        document.body.innerHTML = '<div class="t-banner-inner">banner</div><div id="navbar">nav</div><div class="sec-title"><strong>2</strong> 字幕</div><table class="sub-table"><tr><td><a>ABC-1</a></td></tr><tr><td><a>XYZ-2</a></td></tr></table>';
        const { controller, scope, show } = createController(), rows = document.querySelectorAll(".sub-table tr");
        controller.start();
        expect(document.querySelector(".t-banner-inner").style.display).toBe("none");
        expect(document.querySelector("#navbar").style.display).toBe("none");
        expect(rows[0].style.display).toBe("");
        expect(rows[1].style.display).toBe("none");
        expect(document.querySelector(".sec-title").textContent).toBe("1 字幕");
        expect(show.error).not.toHaveBeenCalled();
        scope.dispose();
        expect(document.querySelector(".t-banner-inner").style.display).toBe("");
        expect(document.querySelector("#navbar").style.display).toBe("");
        expect(rows[1].style.display).toBe("");
        expect(document.querySelector(".sec-title").innerHTML).toBe("<strong>2</strong> 字幕");
    });

    it("reports when no subtitle row matches the requested number", () => {
        document.body.innerHTML = '<div class="sec-title">4 字幕</div><table class="sub-table"><tr><td><a>XYZ-2</a></td></tr></table>';
        const { controller, show } = createController();
        controller.start();
        expect(show.error).toHaveBeenCalledWith("该番号无字幕!");
        expect(document.querySelector(".sec-title").textContent).toBe("0 字幕");
    });
});
