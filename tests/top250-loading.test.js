import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { Top250Controller, hasChineseSubtitleMagnet } from "../src/features/discovery/top250-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

const nativeHtml = `<section><div class="container">
  <h2 class="section-title">Top250</h2>
  <div class="tabs"><a id="category" href="/rankings/top?t=3">FC2</a>
    <select id="year" data-url="/rankings/top?t=%25s"><option>2026</option></select></div>
  <div class="movie-list">
    <div class="item" id="with"><a class="box" href="/v/with"><span class="tags"><span class="tag is-warning">含中字磁链</span></span></a></div>
    <div class="item" id="playable"><a class="box" href="/v/playable"><span class="tag-can-play cnsub">中字播放</span></a></div>
    <div class="item" id="plain"><a class="box" href="/v/plain"><span class="tags"><span class="tag">其他</span></span></a></div>
  </div><nav class="pagination"><a class="pagination-next" href="/rankings/top?page=2">下一页</a></nav>
</div></section>`;

const scopes = new Set();

function setup(url = "https://javdb.com/rankings/top?t=y2026&page=2", html = nativeHtml) {
    const dom = new JSDOM(html, { url });
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    const host = new JavDbHostAdapter(dom.window.document, dom.window.location);
    const scope = new LifecycleScope("feature:ranking"), releaseStyle = vi.fn();
    scopes.add(scope);
    const styles = { register: vi.fn(() => releaseStyle) };
    const controller = new Top250Controller({ hostAdapter: host, styles, scope });
    return { dom, controller, host, document: dom.window.document, scope, styles, releaseStyle };
}

afterEach(() => {
    for (const scope of scopes) scope.dispose();
    scopes.clear();
    vi.unstubAllGlobals();
});

describe("TOP250 native-list enhancement", () => {
    it("preserves native ranks, card links, category and pagination", async () => {
        const { controller, document } = setup();
        const cards = [...document.querySelectorAll(".movie-list .item")];
        controller.start();
        controller.start();
        expect([...document.querySelectorAll(".movie-list .item")]).toEqual(cards);
        expect(document.querySelector("#with a").getAttribute("href")).toBe("/v/with");
        expect(document.querySelector("#category").getAttribute("href")).toBe("/rankings/top?t=3");
        expect(document.querySelector(".pagination-next").getAttribute("href")).toBe("/rankings/top?page=2");
        expect(document.querySelectorAll(".jhs-top250-subtitle")).toHaveLength(1);
    });

    it("filters only loaded cards by the magnet tag and restores all cards", async () => {
        const { controller, document, dom } = setup();
        controller.start();
        document.querySelector('button[data-jhs-subtitle="with"]').click();
        expect(document.querySelector("#with").classList.contains("jhs-top250-subtitle-hidden")).toBe(false);
        expect(document.querySelector("#playable").classList.contains("jhs-top250-subtitle-hidden")).toBe(true);
        expect(document.querySelector("#plain").classList.contains("jhs-top250-subtitle-hidden")).toBe(true);
        expect(dom.window.location.search).toContain("jhs_subtitle=with");
        expect(document.querySelector(".pagination-next").getAttribute("href")).toContain("jhs_subtitle=with");
        expect(document.querySelector("#category").getAttribute("href")).toContain("jhs_subtitle=with");
        expect(document.querySelector("#year").getAttribute("data-url")).toContain("jhs_subtitle=with");
        document.querySelector('button[data-jhs-subtitle="without"]').click();
        expect(document.querySelector("#with").classList.contains("jhs-top250-subtitle-hidden")).toBe(true);
        expect(document.querySelector("#playable").classList.contains("jhs-top250-subtitle-hidden")).toBe(false);
        document.querySelector('button[data-jhs-subtitle="all"]').click();
        expect([...document.querySelectorAll(".movie-list .item")].some(card => card.classList.contains("jhs-top250-subtitle-hidden"))).toBe(false);
        expect(dom.window.location.search).not.toContain("jhs_subtitle");
    });

    it("applies a migrated filter when the native page loads", async () => {
        const { controller, document } = setup("https://javdb.com/rankings/top?t=3&jhs_subtitle=without");
        controller.start();
        expect(document.querySelector("#with").classList.contains("jhs-top250-subtitle-hidden")).toBe(true);
        expect(document.querySelector('button[data-jhs-subtitle="without"]').getAttribute("aria-pressed")).toBe("true");
    });

    it("does not fabricate a list on a 404 page without a native container", async () => {
        const { controller, document } = setup("https://javdb.com/rankings/top", "<h1>404</h1>");
        expect(() => controller.start()).not.toThrow();
        expect(document.querySelector(".movie-list")).toBeNull();
        expect(document.querySelector(".jhs-top250-subtitle")).toBeNull();
    });

    it("keeps playable subtitle badges separate from subtitle-magnet tags", () => {
        const { document } = setup();
        expect(hasChineseSubtitleMagnet(document.querySelector("#with"))).toBe(true);
        expect(hasChineseSubtitleMagnet(document.querySelector("#playable"))).toBe(false);
    });

    it("removes controls, styles, and listeners when the feature scope closes", () => {
        const { controller, document, scope, styles, releaseStyle } = setup();
        controller.start();
        expect(scope.snapshot().listeners).toBe(1);
        expect(styles.register).toHaveBeenCalledWith("jhs-top250-subtitle-feature", expect.stringContaining(".jhs-top250-subtitle"));
        scope.dispose();
        expect(document.querySelector(".jhs-top250-subtitle")).toBeNull();
        expect(scope.snapshot().listeners).toBe(0);
        expect(releaseStyle).toHaveBeenCalledOnce();
    });
});
