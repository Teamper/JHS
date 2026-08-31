import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

/** 以真实 ListPagePlugin + 热播卡片结构验证筛选判定链路（复现 v6.5 热播筛选回归）。 */
function loadRealListPage({ carList = [] } = {}) {
    const dom = new JSDOM('<div class="movie-list"></div>', { url: "https://javdb.com/advanced_search?handlePlayback=1&period=daily" }), $ = jqueryFactory(dom.window);
    dom.window.isListPage = true;
    let contextRef = null;
    const storageManager = {
        getSetting: vi.fn(async (key, fallback) => fallback),
        getTitleFilterKeyword: vi.fn(async () => []),
        getBlacklistMap: vi.fn(async () => new Map()),
        getBlacklistCarList: vi.fn(async () => []),
        getCarMap: vi.fn(async () => contextRef?.__testCarMap ?? new Map()),
    };
    class BasePlugin {
        getSelector() { return { boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".movie-list .item img" }; }
        getRuntimeService(name) {
            if (name === "translation") return { translate: vi.fn(async () => "译文") };
            if (name === "settings") return { snapshot: () => ({ translateTitle: "no", hoverBigImg: "no" }) };
            if (name === "state") return { getActivityLog: async () => ({ entries: [] }) };
            if (name === "ui") return { getJQuery: () => $, getClog: () => ({}) };
            return async () => undefined;
        }
    }
    const context = vm.createContext({
        console, window: dom.window, document: dom.window.document, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver,
        IntersectionObserver: undefined, localStorage: dom.window.localStorage, URLSearchParams, URL, fetch, $, BasePlugin,
        storageManager, utils: { time: vi.fn(() => "t") }, clog: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn(), html: vi.fn() }, show: { error: vi.fn() },
        isHitShowPage: () => true, mapLimit: vi.fn(async (items, limit, mapper) => Promise.all(items.map(mapper))), i: (target, key, value) => (target[key] = value),
        setTimeout, clearTimeout,
    });
    const source = [
        readTestFile(join(repoRoot, "src/core/site-context.js"), "utf8"),
        readTestFile(join(repoRoot, "src/core/constants.js"), "utf8"),
        "initializeRuntimeConstants(window.location);",
        readTestFile(join(repoRoot, "src/core/state-model.js"), "utf8"),
        readTestFile(join(repoRoot, "src/features/list/list-filters.js"), "utf8"),
        readTestFile(join(repoRoot, "src/features/list/list-view.js"), "utf8"),
        readTestFile(join(repoRoot, "src/features/list/list-evaluator.js"), "utf8"),
        readTestFile(join(repoRoot, "src/core/list-item-reader.js"), "utf8"),
        readTestFile(join(repoRoot, "src/core/storage-index.js"), "utf8"),
        readTestFile(join(repoRoot, "src/plugins/status/list-page.js"), "utf8"),
        "normalizeMovieCarNum = normalizeCarNum;",
        `globalThis.__testCarMap = createIndexedMap(${JSON.stringify(carList)}, "carNum");`,
        "globalThis.TestListPagePlugin=ListPagePlugin;",
    ].join("\n");
    vm.runInContext(source, context);
    contextRef = context;
    return { dom, plugin: new context.TestListPagePlugin(), $, storageManager };
}

/** markDataListHtml 的同构卡片（热播页真实 DOM 结构）。 */
const hitShowCard = (id, carNum, title = "测试标题") => `
    <div class="item" id="${id}">
        <a href="/v/${id}" class="box" title="${title}">
            <div class="cover"><img src="https://c0.jdbstatic.com/thumbs/a.jpg" alt=""></div>
            <div class="video-title"><strong>${carNum}</strong> ${title}</div>
            <div class="meta">2026-08-16</div>
        </a>
    </div>`;

describe("hit-show quick filter pipeline (real ListPagePlugin)", () => {
    it("marks a downloaded ranking item and routes it to the downloaded tab only", async () => {
        const { dom, plugin, $ } = loadRealListPage({ carList: [ { carNum: "ABC-123", stateFlags: { downloaded: true } } ] });
        const container = dom.window.document.querySelector(".movie-list");
        container.innerHTML = hitShowCard("a1", "ABC-123", "已下载片") + hitShowCard("a2", "XYZ-999", "未处理片");
        await plugin.doFilter();
        const downloaded = $("#a1"), pending = $("#a2");
        expect(JSON.parse(downloaded.attr("data-jhs-flags"))).toMatchObject({ downloaded: true });
        expect(JSON.parse(pending.attr("data-jhs-flags"))).toMatchObject({ downloaded: false });
        await plugin.createQuickFilter();
        expect(dom.window.document.querySelector("#jhs-quick-filter")).not.toBeNull();
        expect(downloaded.css("display")).toBe("none");
        expect(pending.css("display")).not.toBe("none");
        plugin.setQuickFilter("hasDown");
        expect(downloaded.css("display")).not.toBe("none");
        expect(pending.css("display")).toBe("none");
        plugin.setQuickFilter("all");
        expect(downloaded.css("display")).not.toBe("none");
        expect(pending.css("display")).not.toBe("none");
        plugin.setQuickFilter("waitCheck");
        expect(downloaded.css("display")).toBe("none");
        expect(pending.css("display")).not.toBe("none");
    });
});
