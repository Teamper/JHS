import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { HostedDetailSurface } from "../src/ui/detail/hosted-detail-surface.js";

describe("HostedDetailSurface", () => {
    it("creates stable owned slots before legacy contributions start and disposes them", () => {
        const dom = new JSDOM('<main class="host"><div id="resources"></div></main>');
        const root = dom.window.document.querySelector("main");
        const hostAdapter = {
            locateDetailRoot: () => root,
            locateDetailSlots: () => ({
                resources: root.querySelector("#resources"),
                reviews: root.querySelector('[data-jhs-slot="reviews"]'),
                related: root.querySelector('[data-jhs-slot="related"]'),
            }),
        };
        const surface = new HostedDetailSurface(hostAdapter).mount();
        expect(surface.slots.reviews).not.toBeNull();
        expect(surface.slots.related).not.toBeNull();
        surface.dispose();
        expect(root.querySelector("[data-jhs-slot-group]")).toBeNull();
        expect(root.querySelector('[data-jhs-slot="summary-actions"]')).toBeNull();
    });

    it("does not remove slots owned by an existing host workspace", () => {
        const dom = new JSDOM('<main><div data-jhs-slot="summary-actions"></div><div data-jhs-slot-group="post-resource"><section data-jhs-slot="reviews"></section><section data-jhs-slot="related"></section></div></main>');
        const root = dom.window.document.querySelector("main"), group = root.querySelector("[data-jhs-slot-group]");
        const hostAdapter = { locateDetailRoot: () => root, locateDetailSlots: () => ({ reviews: root.querySelector('[data-jhs-slot="reviews"]'), related: root.querySelector('[data-jhs-slot="related"]') }) };
        new HostedDetailSurface(hostAdapter).mount().dispose();
        expect(root.querySelector("[data-jhs-slot-group]")).toBe(group);
    });
});
