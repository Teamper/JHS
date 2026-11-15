import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListController } from "../src/features/list/list-controller.js";
import { buildFavoriteActressWorkIndex, matchCollectedActressesForWork, resolveFavoriteActressHighlightStyle } from "../src/core/favorite-actress-highlight.js";
import { readCardNames, readCardStarIds } from "../src/core/list-item-reader.js";

describe("favorite actress poster-wall highlight", () => {
    it("resolves border settings safely with invalid color/width fallbacks", () => {
        expect(resolveFavoriteActressHighlightStyle({ enableFavoriteActresses: "yes", highlightedTagNumber: 3, highlightedTagColor: "#ff6b81" })).toEqual({
            enabled: true, width: 3, color: "#ff6b81",
        });
        expect(resolveFavoriteActressHighlightStyle({ enableFavoriteActresses: "no", highlightedTagNumber: 0, highlightedTagColor: "javascript:bad" })).toEqual({
            enabled: false, width: 1, color: "var(--jhs-danger)",
        });
    });

    it("matches collected actresses via newVideoList, car_list names, card actor links, and alias boundaries", () => {
        const index = buildFavoriteActressWorkIndex([
            { starId: "st-1", name: "三上悠亜(無碼)", allName: ["三上悠亞", "Eimi Fukada"], newVideoList: [{ carNum: "SSIS-001" }] },
            { starId: "st-2", name: "Ai", allName: ["Ai"], newVideoList: [] },
        ]);
        expect(matchCollectedActressesForWork({ carNum: "ssis_001" }, index)).toEqual(["三上悠亜"]);
        expect(matchCollectedActressesForWork({ carNum: "ABC-001", recordNames: "OtherActor Eimi Fukada" }, index)).toEqual(["三上悠亜"]);
        expect(matchCollectedActressesForWork({ carNum: "ABC-002", recordNames: "Airi" }, index)).toEqual([]);
        expect(matchCollectedActressesForWork({ carNum: "ABC-003", cardStarIds: ["st-2"] }, index)).toEqual(["Ai"]);
    });

    it("reads inline actor names and starIds cleanly without jQuery globals", () => {
        const dom = new JSDOM(`
            <article class="item">
                <div class="tags"><a href="/actors/abc123">Alice</a></div>
                <span onmouseover="star_('x')"><a href="/star/xyz">Bob</a></span>
            </article>
        `);
        const item = dom.window.document.querySelector(".item");
        expect(readCardNames(item)).toBe("Alice Bob");
        expect(readCardStarIds(item)).toEqual(["abc123"]);
        dom.window.close();
    });

    it("registers and live-updates ListController highlight CSS and releases it on dispose", async () => {
        const dom = new JSDOM(`<div class="movie-list" data-jhs-primary-list="true"></div>`, { url: "https://javdb.com/" });
        const settingsListeners = new Set();
        let currentSettings = { enableFavoriteActresses: "yes", highlightedTagNumber: 2, highlightedTagColor: "#ff6b81" };
        let favoriteFeatureEnabled = true;
        const registered = new Map();
        const styles = {
            register: vi.fn((id, css) => {
                registered.set(id, css);
                return () => { if (registered.get(id) === css) registered.delete(id); };
            }),
        };
        const scope = new LifecycleScope("test-list");
        const controller = new ListController({
            legacyPlugin: { requestListRefresh: vi.fn(async () => {}), getSettingsSnapshot: () => currentSettings },
            hostAdapter: { site: "javdb", document: dom.window.document, window: dom.window, getLiveListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item" }) },
            scope,
            styles,
            settings: {
                snapshot: () => currentSettings,
                addEventListener: (_name, fn) => settingsListeners.add(fn),
                removeEventListener: (_name, fn) => settingsListeners.delete(fn),
            },
            isFavoriteActressesFeatureEnabled: () => favoriteFeatureEnabled,
            readCardIdentity: () => ({ carNum: "ABC-123", title: "T" }),
        });

        await controller.registerStyles();
        expect(registered.get("jhs-list-favorite-actresses-feature")).toContain("box-shadow:0 0 0 2px #ff6b81");

        currentSettings = { enableFavoriteActresses: "yes", highlightedTagNumber: 5, highlightedTagColor: "#00ff88" };
        controller.refreshFavoriteActressHighlightStyle();
        expect(registered.get("jhs-list-favorite-actresses-feature")).toContain("box-shadow:0 0 0 5px #00ff88");

        currentSettings = { enableFavoriteActresses: "no", highlightedTagNumber: 5, highlightedTagColor: "#00ff88" };
        controller.refreshFavoriteActressHighlightStyle();
        expect(registered.has("jhs-list-favorite-actresses-feature")).toBe(false);

        currentSettings = { enableFavoriteActresses: "yes", highlightedTagNumber: 4, highlightedTagColor: "#112233" };
        favoriteFeatureEnabled = false;
        controller.refreshFavoriteActressHighlightStyle();
        expect(registered.has("jhs-list-favorite-actresses-feature")).toBe(false);

        favoriteFeatureEnabled = true;
        controller.refreshFavoriteActressHighlightStyle();
        expect(registered.has("jhs-list-favorite-actresses-feature")).toBe(true);
        controller.dispose();
        expect(registered.has("jhs-list-favorite-actresses-feature")).toBe(false);
        dom.window.close();
    });
});
