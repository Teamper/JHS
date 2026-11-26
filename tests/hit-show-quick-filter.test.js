import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListPageService } from "../src/features/list/list-page-service.js";
import { createIndexedMap } from "../src/core/storage-index.js";
import { initializeRuntimeConstants } from "../src/core/constants.js";

const windows = [], services = [];
afterEach(() => {
    for (const service of services.splice(0)) clearTimeout(service.recountFrame);
    windows.splice(0).forEach(window => window.close());
    vi.unstubAllGlobals();
});

function loadRealListPage({ carList = [] } = {}) {
    const dom = new JSDOM('<div class="movie-list"></div>', { url: "https://javdb.com/rankings/playback?p=daily&t=high_score" }), $ = jqueryFactory(dom.window);
    windows.push(dom.window);
    for (const name of ["window", "document", "Node", "Element", "HTMLElement", "localStorage", "MutationObserver"]) {
        vi.stubGlobal(name, name === "window" ? dom.window : dom.window[name]);
    }
    vi.stubGlobal("$", $);
    dom.window.isListPage = true;
    initializeRuntimeConstants(dom.window.location);
    const plugin = new ListPageService({ runtimeServices: {
        host: { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".movie-list .item img" }) },
        keywordRules: { getTitleKeywords: async () => [] },
        settings: { snapshot: () => ({ translateTitle: "no", hoverBigImg: "no" }) },
        state: {
            getBlacklistMap: async () => new Map(), getBlacklistCarList: async () => [],
            getCarMap: async () => createIndexedMap(carList, "carNum"),
            getFavoriteActressList: async () => [], getActivityLog: async () => ({ entries: [] }),
        },
        translation: { translate: vi.fn(async () => "译文") },
    } });
    services.push(plugin);
    return { dom, plugin, $ };
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
    it("isolates fallback filter arrow navigation from host page shortcuts", async () => {
        const { dom, plugin, $ } = loadRealListPage(), hostKeys = [];
        dom.window.document.body.addEventListener("keydown", event => hostKeys.push(event.key));
        await plugin.createQuickFilter();
        const tab = dom.window.document.querySelector('[role="tab"][data-jhs-filter="waitCheck"]');
        tab.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", keyCode: 39, bubbles: true, cancelable: true }));
        expect($('.jhs-segmented__item[aria-selected="true"]').text()).toBe("收藏");
        expect(hostKeys).toEqual([]);
        $("#jhs-quick-filter").remove();
        $(dom.window.document).off(".jhsQuickFilter");
        dom.window.close();
    });
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
