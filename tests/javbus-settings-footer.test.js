// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { initializeRuntimeConstants } from "../src/core/constants.js";
import { injectCoreCss } from "../src/core/css-injection.js";
import { buildSettingDialogHtml, buildQuickSettingHtml } from "../src/ui/settings/setting-templates.js";

afterEach(() => { document.head.innerHTML = ""; document.body.innerHTML = ""; initializeRuntimeConstants(new URL("https://javdb.com/")); });

it("keeps both settings footers visible while hiding the JavBus host footer", () => {
    initializeRuntimeConstants(new URL("https://www.javbus.com/"));
    injectCoreCss({ register: (_id, css) => { const style = document.createElement("style"); style.textContent = css; document.head.append(style); } });
    document.body.innerHTML = `<footer id="host-footer">JavBus</footer>${buildSettingDialogHtml()}${buildQuickSettingHtml()}`;
    expect(getComputedStyle(document.querySelector("#host-footer")).display).toBe("none");
    for (const selector of [".jhs-setting-footer", ".simple-setting__footer"]) {
        const footer = document.querySelector(selector);
        expect(footer, selector).not.toBeNull();
        expect(getComputedStyle(footer).display, selector).not.toBe("none");
        expect(footer.querySelector("button"), selector).not.toBeNull();
    }
});
