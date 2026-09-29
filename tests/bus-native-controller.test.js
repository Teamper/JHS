// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ClipboardService } from "../src/services/clipboard-service.js";
import { JavBusNativeController } from "../src/features/identity/javbus-native-controller.js";

describe("JavBus native page controller", () => {
    it("restores host links, recommendation visibility and copy controls on disposal", async () => {
        document.body.innerHTML = '<h4 style="color: red">推薦影片</h4><div class="genre"><a id="genre" href="https://example.test/genre">类型</a><a id="existing" target="_self" href="/type">保留</a></div><p><span class="header">識別碼:</span><span>ABC-123</span></p>';
        const clipboard = { copyText: vi.fn().mockResolvedValue(true) };
        const controller = new JavBusNativeController({ document, location: new URL("https://www.javbus.com/ABC-123"), isDetailPage: true, clipboard });
        const scope = new LifecycleScope("identity.bus-native");

        expect(controller.start(scope)).toBe(true);
        expect(document.querySelector("h4")?.style.display).toBe("none");
        expect(document.querySelector("#genre")?.getAttribute("target")).toBe("_blank");
        expect(document.querySelector("#existing")?.getAttribute("target")).toBe("_blank");
        const button = document.querySelector(".jhs-copy-car-number");
        expect(button?.textContent).toBe("复制");
        button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(clipboard.copyText).toHaveBeenCalledWith("番号", "ABC-123"));
        await vi.waitFor(() => expect(button?.textContent).toBe("已复制"));

        scope.dispose();
        expect(document.querySelector("h4")?.style.display).toBe("");
        expect(document.querySelector("h4")?.style.color).toBe("red");
        expect(document.querySelector("#genre")?.hasAttribute("target")).toBe(false);
        expect(document.querySelector("#existing")?.getAttribute("target")).toBe("_self");
        expect(document.querySelector(".jhs-copy-car-number")).toBeNull();
    });

    it("restores the actress avatar layout and inline position when stopped", () => {
        document.body.innerHTML = '<main id="destination"><section id="row"><div id="avatar-wrapper" style="position: relative"><div class="avatar-box"></div></div><span id="after"></span></section></main>';
        const wrapper = document.querySelector("#avatar-wrapper");
        const row = document.querySelector("#row");
        const controller = new JavBusNativeController({ document, location: new URL("https://www.javbus.com/star/fixture"), isDetailPage: false, clipboard: { copyText: vi.fn() } });
        const scope = new LifecycleScope("identity.bus-native-star");

        controller.start(scope);
        expect(wrapper?.parentElement?.id).toBe("destination");
        expect(wrapper?.style.position).toBe("initial");
        scope.dispose();
        expect(wrapper?.parentElement).toBe(row);
        expect(wrapper?.nextElementSibling?.id).toBe("after");
        expect(wrapper?.style.position).toBe("relative");
    });
});

describe("ClipboardService", () => {
    it("uses the injected compatibility helper so copy behavior and fallback remain unchanged", async () => {
        const copyText = vi.fn().mockResolvedValue(true);
        const service = new ClipboardService(copyText);

        await expect(service.copyText("番号", "ABC-123")).resolves.toBe(true);
        expect(copyText).toHaveBeenCalledWith("番号", "ABC-123");
    });
});
