import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { DetailRelatedController } from "../src/features/detail/detail-related-controller.js";

describe("detail related controller", () => {
    it("mounts a lazy JavDB related panel into the owned slot", async () => {
        const dom = new JSDOM('<main><div id="related"></div></main>', { url: "https://javdb.com/v/ABC-123" });
        const $ = jqueryFactory(dom.window), slot = dom.window.document.querySelector("#related"), scope = new LifecycleScope("test:detail-related");
        vi.stubGlobal("$", $);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("utils", { formatDate: (value) => value });
        vi.stubGlobal("clog", { error: vi.fn() });
        vi.stubGlobal("show", { error: vi.fn() });
        const styles = { register: vi.fn(() => vi.fn()) };
        const controller = new DetailRelatedController({
            hostAdapter: { site: "javdb", location: dom.window.location, locateDetailSlots: () => ({ related: slot }) },
            related: { list: vi.fn() },
            settings: { snapshot: () => ({ enableLoadRelated: "no" }) },
            ui: { getJQuery: () => $ },
            styles,
            scope,
        });

        await controller.start();

        expect(slot.querySelector('[data-jhs-panel="related"]')?.getAttribute("data-jhs-movie-id")).toBe("ABC-123");
        expect(styles.register).toHaveBeenCalledWith("jhs-detail-related", expect.stringContaining("jhs-related-item"));
        expect(controller.related.list).not.toHaveBeenCalled();
        controller.dispose();
        scope.dispose();
    });
});
