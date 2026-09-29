// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { compatibilityContributionCatalog } from "../src/features/compatibility/contribution-catalog.js";
import { SubtitleCatController } from "../src/features/external-bridge/subtitlecat-controller.js";

afterEach(() => {
    history.replaceState(null, "", "/");
    document.body.replaceChildren();
});

describe("SubtitleCat Feature controller", () => {
    it("keeps the legacy disable ID without registering the old plugin executor", () => {
        expect(compatibilityContributionCatalog.find((item) => item.id === "external-bridge.subtitle"))
            .toMatchObject({ legacyPluginId: "SubTitleCatPlugin", executionOwner: "feature", plugin: null });
    });

    it("filters rows by the search query, updates only the leading count, and restores owned styles", () => {
        history.replaceState(null, "", "/index.php?search=abc-1");
        document.body.innerHTML = '<div class="t-banner-inner" style="display: flex"></div><nav id="navbar"></nav><h2 class="sec-title">3 <span>字幕</span></h2><table class="sub-table"><tr><td><a>ABC-1 中文</a></td></tr><tr><td><a>DEF-2 中文字幕</a></td></tr><tr style="display: grid"><td><a>ABC-1 English</a></td></tr></table>';
        const scope = new LifecycleScope("feature:external-bridge"), notifications = { error: vi.fn() };
        new SubtitleCatController({ scope, notifications }).start();

        const rows = [...document.querySelectorAll(".sub-table tr")];
        expect(document.querySelector(".t-banner-inner").style.display).toBe("none");
        expect(document.querySelector("#navbar").style.display).toBe("none");
        expect(rows.map((row) => row.style.display)).toEqual(["", "none", "grid"]);
        expect(document.querySelector(".sec-title").textContent).toBe("2 字幕");
        expect(document.querySelector(".sec-title span")).not.toBeNull();
        expect(notifications.error).not.toHaveBeenCalled();

        scope.dispose();
        expect(document.querySelector(".t-banner-inner").style.display).toBe("flex");
        expect(document.querySelector("#navbar").style.display).toBe("");
        expect(rows.map((row) => row.style.display)).toEqual(["", "", "grid"]);
        expect(document.querySelector(".sec-title").textContent).toBe("3 字幕");
    });

    it("reports an empty result set and respects page-owned style changes during teardown", () => {
        history.replaceState(null, "", "/index.php?search=nomatch");
        document.body.innerHTML = '<div class="t-banner-inner"></div><div class="sec-title">4 字幕</div><table class="sub-table"><tr><td><a>ABC-1</a></td></tr></table>';
        const scope = new LifecycleScope("feature:external-bridge"), notifications = { error: vi.fn() };
        new SubtitleCatController({ scope, notifications }).start();
        document.querySelector(".t-banner-inner").style.display = "grid";
        expect(notifications.error).toHaveBeenCalledWith("该番号无字幕!");
        expect(document.querySelector(".sec-title").textContent).toBe("0 字幕");
        scope.dispose();
        expect(document.querySelector(".t-banner-inner").style.display).toBe("grid");
    });
});
