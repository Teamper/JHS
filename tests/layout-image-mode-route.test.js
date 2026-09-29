import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { applyImageMode } from "../src/services/layout-settings-service.js";

afterEach(() => vi.unstubAllGlobals());

describe("6.5.1 FC2 cover position", () => {
    it.each([
        ["https://javdb.com/tags/fc2?c10=1&jhs_source=123av", "50% 50% !important"],
        ["https://javdb.com/tags/fc2?c10=1", "100% 50% !important"],
        ["https://javdb.com/search_advanced?type=3", "100% 50% !important"],
    ])("uses the native category route to position vertical covers: %s", async (url, position) => {
        const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { url });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("$", jqueryFactory(dom.window));
        await applyImageMode(null, "yes");
        expect(dom.window.document.querySelector("#verticalImgStyle")?.textContent).toContain(`object-position: ${position};`);
        dom.window.close();
    });
});
