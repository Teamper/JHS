import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { JavBusHostAdapter } from "../src/platform/hosts/javbus-host-adapter.js";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { ListCardStatePresenter } from "../src/features/list/list-card-state-presenter.js";
import { createListEvaluationContext } from "../src/features/list/list-evaluator.js";

function createHarness(site, html, readCardIdentity = () => ({ carNum: "ABC-123", title: "ABC title" }), yieldFrame) {
    const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { url: `https://${site}.com/` });
    const adapter = site === "javdb"
        ? new JavDbHostAdapter(dom.window.document, dom.window.location)
        : new JavBusHostAdapter(dom.window.document, dom.window.location);
    return { dom, adapter, presenter: new ListCardStatePresenter({ hostAdapter: adapter, document: dom.window.document, readCardIdentity, yieldFrame }) };
}

const evaluation = (overrides = {}) => ({
    flags: { blocked: true, favorite: true, downloaded: false, watched: false },
    visibilityReasons: { keyword: true, actorBlacklist: true, actressBlacklist: false },
    recent: true,
    hardHidden: true,
    ...overrides,
});

describe("ListCardStatePresenter", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("keeps JavDB badge placement, state attributes, and renders external names as text", () => {
        const { dom, adapter, presenter } = createHarness("javdb", '<div class="movie-list"><article class="item"><div class="tags"></div></article></div>');
        const item = dom.window.document.querySelector(".item"), externalName = '<img src=x onerror="alert(1)">';
        const context = {
            titleKeywords: ["ABC"], actorCarNumToNameMap: new Map([["ABC-123", externalName]]), actressCarNumToNameMap: new Map(),
        };

        presenter.presentCard({ item, carNum: "ABC-123", title: "ABC title", evaluation: evaluation(), context, tagPosition: "leftTop" });

        expect(item.dataset.jhsFlags).toBe(JSON.stringify(evaluation().flags));
        expect(item.dataset.jhsVisibility).toBe(JSON.stringify(evaluation().visibilityReasons));
        expect(item.dataset.jhsRecent).toBe("yes");
        expect(item.dataset.jhsTagPosition).toBe("leftTop");
        const badges = [...item.querySelectorAll(".jhs-status-tags .status-tag")];
        expect(badges.map((badge) => badge.textContent)).toEqual(["已屏蔽", "已收藏", "关键词屏蔽", "男演员屏蔽"]);
        expect(badges[3].dataset.tip).toBe(externalName);
        expect(item.querySelector(".jhs-status-tags img")).toBeNull();
        expect(item.querySelector(".jhs-status-tags").classList.contains("jhs-status-tags--left")).toBe(true);
        expect(item.querySelector(".jhs-badge").classList.contains("jhs-badge--success")).toBe(true);

        presenter.presentCard({ item, carNum: "ABC-123", title: "ABC title", evaluation: evaluation(), context, tagPosition: "leftTop" });
        expect(item.querySelectorAll(".jhs-status-tags")).toHaveLength(1);
        expect(adapter.site).toBe("javdb");
    });

    it("uses the JavBus tag host and its neutral badge treatment", () => {
        const { dom, presenter } = createHarness("javbus", '<div class="masonry"><article class="item"><div class="item-tag"></div></article></div>');
        const item = dom.window.document.querySelector(".item");
        presenter.presentCard({ item, carNum: "ABC-123", title: "ABC", evaluation: evaluation(), context: { titleKeywords: [], actorCarNumToNameMap: new Map(), actressCarNumToNameMap: new Map() } });

        expect(item.querySelector(".item-tag > .jhs-status-tags")).not.toBeNull();
        expect(item.querySelector(".jhs-badge").classList.contains("jhs-badge--neutral")).toBe(true);
    });

    it("evaluates the card batch in the Feature and returns only visible cards", async () => {
        const { dom, presenter } = createHarness("javdb", '<div class="movie-list"><article id="hidden" class="item"><div class="tags"></div></article><article id="visible" class="item"><div class="tags"></div></article></div>',
            (item) => ({ carNum: item.id === "hidden" ? "ABC-001" : "ABC-002", title: item.id }));
        const context = createListEvaluationContext({ carMap: new Map([["ABC-001", { stateFlags: { blocked: true } }]]) });
        const items = [...dom.window.document.querySelectorAll(".item")];
        const visible = await presenter.processItems(items, { context, filter: "waitCheck", isCurrent: () => true });

        expect(visible).toEqual([items[1]]);
        expect(items[0].dataset.jhsFlags).toContain('"blocked":true');
        expect(items[1].dataset.jhsFlags).toContain('"blocked":false');
    });

    it("does not mutate cards after a generation becomes stale during a frame yield", async () => {
        let current = true;
        const yieldFrame = vi.fn(async () => { current = false; });
        const { dom, presenter } = createHarness("javdb", `<div class="movie-list">${Array.from({ length: 13 }, (_, index) => `<article id="card-${index}" class="item"><div class="tags"></div></article>`).join("")}</div>`,
            (item) => ({ carNum: item.id, title: item.id }), yieldFrame);
        const items = [...dom.window.document.querySelectorAll(".item")];

        await expect(presenter.processItems(items, {
            context: createListEvaluationContext(), filter: "all", isCurrent: () => current,
        })).resolves.toBeNull();

        expect(yieldFrame).toHaveBeenCalledOnce();
        expect(items[11].hasAttribute("data-jhs-flags")).toBe(true);
        expect(items[12].hasAttribute("data-jhs-flags")).toBe(false);
    });

    it("leaves JavBus actor profile cards outside movie-card evaluation", async () => {
        const { dom, presenter } = createHarness("javbus", '<div class="masonry"><article class="item"><div class="avatar-box"></div></article><article id="movie" class="item"><div class="item-tag"></div></article></div>',
            (item) => ({ carNum: item.id, title: item.id }));
        const items = [...dom.window.document.querySelectorAll(".item")];
        const visible = await presenter.processItems(items, {
            context: createListEvaluationContext(), filter: "all", isCurrent: () => true,
        });

        expect(visible).toEqual([items[1]]);
        expect(items[0].hasAttribute("data-jhs-flags")).toBe(false);
        expect(items[1].hasAttribute("data-jhs-flags")).toBe(true);
    });

    it("collects the existing summary contract and skips JavBus actor-list cards", () => {
        const { dom, presenter } = createHarness("javbus", `<div class="masonry">
            <article class="item" data-jhs-flags='{}' data-jhs-visibility='{}'></article>
            <article class="item" data-jhs-flags='{"blocked":true}' data-jhs-visibility='{"keyword":true,"actorBlacklist":true}'></article>
            <article class="item" data-jhs-flags='{"favorite":true}' data-jhs-visibility='{"actressBlacklist":true}'></article>
            <article class="item" data-jhs-flags='{"downloaded":true,"watched":true}' data-jhs-visibility='{}'></article>
            <article class="item"><div class="avatar-box"></div></article>
        </div>`);

        expect(presenter.collectSummary()).toEqual({
            total: 4, pending: 1, blockedItems: 2, favorite: 1, downloaded: 1, watched: 1,
            debug: { manualBlocked: 1, keywordBlocked: 1, actorBlocked: 1, actressBlocked: 1 },
        });
        expect(dom.window.document.querySelector(".avatar-box")).not.toBeNull();
    });

    it("clears old badges when card state changes and tolerates malformed summary attributes", () => {
        const { dom, presenter } = createHarness("javdb", '<div class="movie-list"><article class="item"><div class="tags"></div></article></div>');
        const item = dom.window.document.querySelector(".item"), context = { titleKeywords: [], actorCarNumToNameMap: new Map(), actressCarNumToNameMap: new Map() };
        presenter.presentCard({ item, carNum: "ABC-123", title: "ABC", evaluation: evaluation(), context });
        presenter.presentCard({ item, carNum: "ABC-123", title: "ABC", evaluation: evaluation({ flags: {}, visibilityReasons: {}, recent: false, hardHidden: false }), context });

        expect(item.querySelectorAll(".jhs-status-tags")).toHaveLength(0);
        item.setAttribute("data-jhs-flags", "invalid");
        item.setAttribute("data-jhs-visibility", "invalid");
        expect(presenter.collectSummary()).toMatchObject({ total: 1, pending: 1, blockedItems: 0 });
    });
});
