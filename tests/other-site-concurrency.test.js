import { JSDOM } from "jsdom";
import jquery from "jquery";
import { expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { OtherSitesController } from "../src/features/external-sites/other-sites-controller.js";

it("checks at most four sites at once and releases the busy button when all finish", async () => {
    const dom = new JSDOM("<main></main>", { url: "https://javdb.com/v/test" });
    const { window } = dom, { document } = window, $ = jquery(window);
    const scope = new LifecycleScope("other-sites-test");
    const replies = [];
    const movie = {
        externalSites: () => [], searchUrl: id => "https://example.test/search/" + id,
        resolve: vi.fn(({ providerId }) => new Promise(resolve => {
            replies.push(() => resolve({ url: "https://example.test/watch/" + providerId }));
        })),
    };
    const summary = document.querySelector("main");
    const controller = new OtherSitesController({
        document, window, jquery: $, movie, scope,
        hostAdapter: { locateDetailSlots: () => ({ summary }) },
        settings: { snapshot: () => ({}) }, storage: { getLocal: () => null },
        ui: { isHidden: () => false }, site: "javdb", route: "detail",
    });
    controller.siteConfigs = Array.from({ length: 8 }, (_, i) => ({ id: "site" + i, providerId: "test" + i }));
    try {
        const task = controller.loadOtherSite("ABC-123", null, { autoDetect: true });
        const button = () => summary.querySelector('[data-jhs-role="detect-sites"]');
        await vi.waitFor(() => expect(movie.resolve).toHaveBeenCalledTimes(4));
        expect(button().getAttribute("aria-busy")).toBe("true");
        expect(button().disabled).toBe(true);
        for (const reply of replies.splice(0)) reply();
        await vi.waitFor(() => expect(movie.resolve).toHaveBeenCalledTimes(8));
        for (const reply of replies.splice(0)) reply();
        await task;
        expect(button().hasAttribute("aria-busy")).toBe(false);
        expect(button().disabled).toBe(false);
        expect([...summary.querySelectorAll("a")].map(link => link.href))
            .toEqual(controller.siteConfigs.map(({ providerId }) => "https://example.test/watch/" + providerId));
    } finally {
        controller.dispose();
        scope.dispose();
        dom.window.close();
    }
});
