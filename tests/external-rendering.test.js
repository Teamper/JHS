import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it } from "vitest";

function loadHitShow() {
    const dom = new JSDOM('<div id="movie"><div id="score_movie"></div></div>'), $ = jqueryFactory(dom.window), source = readFileSync(join(process.cwd(), "src/plugins/external-search/hit-show.js"), "utf8");
    const escapeHtml = value => $("<span></span>").text(String(value ?? "")).html(), normalizeHttpUrl = value => { try { const url = new URL(value, "https://javdb.com/"); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; } };
    const context = vm.createContext({ BasePlugin: class {}, i: (target, key, value) => (target[key] = value), $, document: dom.window.document, escapeHtml, normalizeHttpUrl, loading: () => ({ close() {} }), window: dom.window });
    vm.runInContext(`${source};globalThis.HitShowPlugin=HitShowPlugin`, context);
    return { plugin: new context.HitShowPlugin(), dom };
}

describe("external rendering boundaries", () => {
    it("escapes list data and rejects executable cover URLs", () => {
        const { plugin, dom } = loadHitShow(), html = plugin.markDataListHtml([{ id: "movie", release_date: "2026", origin_title: '<img src=x onerror="boom">', number: "ABC-1", cover_url: "javascript:boom", magnets_count: 0 }]);
        dom.window.document.body.innerHTML = html;
        expect(dom.window.document.querySelector("script")).toBeNull();
        expect(dom.window.document.querySelector(".video-title").textContent).toContain('<img src=x onerror="boom">');
        expect(dom.window.document.querySelector(".cover img")).toBeNull();
    });

    it("reconstructs legacy score cache as text instead of injecting cached HTML", () => {
        const { plugin, dom } = loadHitShow(), cached = plugin.normalizeScoreData('<img src=x onerror="boom"> 4.2分，由88人评价');
        plugin.appendScore("movie", cached.score, cached.watchedCount);
        expect(dom.window.document.querySelector("#score_movie img")).toBeNull();
        expect(dom.window.document.querySelector("#score_movie").textContent).toContain("4.2分，由88人评价");
    });
});
