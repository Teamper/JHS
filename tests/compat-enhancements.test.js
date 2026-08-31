// @vitest-environment jsdom

import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CompatibilityController } from "../src/features/compatibility/compatibility-controller.js";
const nav = readTestFile(join(import.meta.dirname, "../src/features/identity/identity-navigation-controller.js"), "utf8");

function createController(html, options = {}) {
    const dom = new DOMParser().parseFromString(html, "text/html");
    const styles = options.styles ?? { register: vi.fn() };
    const scope = { assertActive: vi.fn(), addCleanup: vi.fn() };
    const controller = new CompatibilityController({
        hostAdapter: {
            site: options.site ?? "javdb", document: dom, location: { href: options.url ?? "https://javdb.com/", pathname: new URL(options.url ?? "https://javdb.com/").pathname },
            readMovieRef: options.readMovieRef,
        },
        storage: { get: vi.fn(async key => options.storage?.[key] ?? []) }, state: options.state ?? {},
        features: options.features ?? {}, styles, route: options.route ?? "other", scope,
    });
    return { dom, controller, styles, scope };
}

describe("status and media UX contracts", () => {
    it("injects the single confirmed ad-container rule only on JavDB", async () => {
        const javdb = createController("", { site: "javdb" });
        await javdb.controller.start();
        expect(javdb.styles.register).toHaveBeenCalledWith("jhs-compatibility", expect.stringContaining(".sda-content"));
        expect(javdb.styles.register.mock.calls[0][1]).toMatch(/display\s*:\s*none\s*!important/);
        const javbus = createController("", { site: "javbus", url: "https://javbus.com/" });
        await javbus.controller.start();
        expect(javbus.styles.register).not.toHaveBeenCalled();
    });
    it("removes records through the declared transactional StateService", async () => {
        const remove = vi.fn(async () => {}), showCarNumBox = vi.fn();
        vi.stubGlobal("utils", { q: vi.fn((event, message, callback) => void callback()) });
        vi.stubGlobal("show", { ok: vi.fn() });
        const fixture = createController('<div class="movie-info-container"></div>', {
            route: "detail", url: "https://javdb.com/movies/abc", readMovieRef: () => ({ carNum: "ABC-123" }),
            storage: { car_list: [{ carNum: "ABC-123" }] }, state: { remove },
            features: { getFeatureApi: vi.fn(() => ({ showCarNumBox })) },
        });
        await fixture.controller.start();
        fixture.dom.querySelector(".jhs-remove-car")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(remove).toHaveBeenCalledWith("ABC-123");
        expect(showCarNumBox).toHaveBeenCalledWith("ABC-123");
    });
    it("links bounded comment images without rebuilding review DOM", async () => {
        const imageViewer = vi.fn();
        vi.stubGlobal("showImageViewer", imageViewer);
        const fixture = createController('<div class="preview-images"><img src="one.jpg"></div><div class="review-content">请查看图一</div>');
        await fixture.controller.start();
        const link = fixture.dom.querySelector(".jhs-comment-image-link");
        expect(link?.textContent).toBe("图一");
        link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(imageViewer).toHaveBeenCalledWith(fixture.dom.querySelector(".preview-images img"));
    });
    it("intercepts image paste only on the navigation search input", () => { expect(nav).toContain('$("#search-keyword").on("paste.jhsIdentityNav"'); expect(nav).toContain('type.includes("image")'); });
    it("uses configured 115 concurrency and cache lifetime", () => { const one15 = readTestFile(join(import.meta.dirname, "../src/features/external-bridge/one-one-five-controller.js"), "utf8"); expect(one15).toContain("mapLimit(cards, this.concurrency"); expect(one15).toContain('getSetting("oneOneFiveConcurrency"'); expect(one15).toContain('getSetting("oneOneFiveCacheMinutes"'); expect(one15).toContain('rootMargin: "200px"'); });
});
