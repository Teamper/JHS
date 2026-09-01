// @vitest-environment jsdom

import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { DetailBusNativeController } from "../src/features/detail/detail-bus-native-controller.js";

describe("DetailBusNativeController", () => {
    it("preserves JavBus detail enhancements and restores owned DOM changes", async () => {
        const dom = new JSDOM(`
            <div id="outer">
                <div id="container"><div id="avatar-wrapper"><div class="avatar-box"></div></div><div id="after"></div></div>
            </div>
            <h4 style="display: block">推薦作品</h4>
            <div class="genre"><a id="external" href="https://example.com/genre" target="_self">genre</a><a id="script" href="javascript:void(0)">script</a></div>
            <p><span class="header">識別碼:</span> <span id="car-number">ABC-123</span></p>
        `, { url: "https://www.javbus.com/star/actor" });
        const copyToClipboard = vi.fn(async () => true), scope = new LifecycleScope("feature:detail"), controller = new DetailBusNativeController({
            hostAdapter: { site: "javbus", document: dom.window.document, location: dom.window.location },
            ui: { getUtils: () => ({ copyToClipboard }) }, scope,
        });

        controller.start();

        const wrapper = dom.window.document.querySelector("#avatar-wrapper"), container = dom.window.document.querySelector("#container"), heading = dom.window.document.querySelector("h4"), external = dom.window.document.querySelector("#external");
        expect(heading.style.display).toBe("none");
        expect(external.target).toBe("_blank");
        expect(dom.window.document.querySelector("#script").hasAttribute("target")).toBe(false);
        expect(wrapper.parentElement.id).toBe("outer");
        const button = dom.window.document.querySelector(".jhs-copy-car-number");
        expect(button).not.toBeNull();
        button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(copyToClipboard).toHaveBeenCalledWith("番号", "ABC-123");
        expect(button.textContent).toBe("已复制");

        controller.dispose();

        expect(heading.style.display).toBe("block");
        expect(external.target).toBe("_self");
        expect(wrapper.parentElement).toBe(container);
        expect(dom.window.document.querySelector(".jhs-copy-car-number")).toBeNull();
        scope.dispose();
    });

    it("does not modify non-JavBus pages", () => {
        const dom = new JSDOM('<h4>推薦作品</h4><div class="genre"><a href="/genre">genre</a></div>', { url: "https://javdb.com/v/ABC-123" });
        const scope = new LifecycleScope("feature:detail"), controller = new DetailBusNativeController({
            hostAdapter: { site: "javdb", document: dom.window.document, location: dom.window.location }, scope,
        });

        controller.start();

        expect(dom.window.document.querySelector("h4").style.display).toBe("");
        expect(dom.window.document.querySelector("a").hasAttribute("target")).toBe(false);
        scope.dispose();
    });
});
