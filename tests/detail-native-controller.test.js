// @vitest-environment jsdom

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { DetailNativeController } from "../src/features/detail/detail-native-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

describe("DetailNativeController", () => {
    it("opens HTTP(S) metadata links in a new tab and restores changed targets", () => {
        const dom = new JSDOM('<div class="video-meta-panel"><a id="relative" href="/external">relative</a><a id="existing" href="https://example.com" target="_self">existing</a><a id="script" href="javascript:alert(1)">script</a></div>', { url: "https://javdb.com/v/ABC-123" });
        const scope = new LifecycleScope("feature:detail"), controller = new DetailNativeController({ hostAdapter: { site: "javdb", document: dom.window.document, location: dom.window.location }, scope });

        controller.start();

        expect(dom.window.document.querySelector("#relative").target).toBe("_blank");
        expect(dom.window.document.querySelector("#existing").target).toBe("_blank");
        expect(dom.window.document.querySelector("#script").hasAttribute("target")).toBe(false);

        controller.dispose();
        expect(dom.window.document.querySelector("#relative").hasAttribute("target")).toBe(false);
        expect(dom.window.document.querySelector("#existing").target).toBe("_self");
        scope.dispose();
    });

    it("does not touch non-JavDB hosts", () => {
        const dom = new JSDOM('<div class="video-meta-panel"><a href="/external">relative</a></div>', { url: "https://www.javbus.com/ABC-123" });
        const scope = new LifecycleScope("feature:detail"), controller = new DetailNativeController({ hostAdapter: { site: "javbus", document: dom.window.document, location: dom.window.location }, scope });

        controller.start();

        expect(dom.window.document.querySelector("a").hasAttribute("target")).toBe(false);
        scope.dispose();
    });
});
