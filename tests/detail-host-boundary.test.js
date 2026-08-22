import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jquery from "jquery";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceSource = readFileSync(join(process.cwd(), "src/plugins/status/detail-workspace.js"), "utf8");
const unifiedSource = readFileSync(join(process.cwd(), "src/plugins/offline/unified-offline.js"), "utf8");
const selectSource = readFileSync(join(process.cwd(), "src/core/ui-primitives.js"), "utf8").slice(readFileSync(join(process.cwd(), "src/core/ui-primitives.js"), "utf8").indexOf("class JhsSelect"));

class BasePlugin {
    getBean() { return null; }
}

function createEventBus() {
    const handlers = new Map;
    return {
        on(type, handler) { const list = handlers.get(type) || []; list.push(handler), handlers.set(type, list); },
        async emit(type, payload, options) { for (const handler of handlers.get(type) || []) await handler(payload, options); }
    };
}

function createContext(html, { javdb = true } = {}) {
    const dom = new JSDOM(html, { url: javdb ? "https://javdb.com/v/test?hideNav=1" : "https://www.javbus.com/ABC-1" }), $ = jquery(dom.window), eventBus = createEventBus();
    dom.window.isDetailPage = true;
    const context = vm.createContext({
        window: dom.window, document: dom.window.document, Node: dom.window.Node, Event: dom.window.Event,
        MutationObserver: dom.window.MutationObserver, $, r: javdb, l: !javdb, BasePlugin, jhsEventBus: eventBus,
        setTimeout, clearTimeout, queueMicrotask, clog: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        utils: { loopDetector: (condition, callback) => condition() && callback() },
        storageManager: {}, stateService: {}, show: {}, layer: {}, escapeHtml: value => String(value),
        normalizeStateFlags: value => value || {}, _: "yes"
    });
    vm.runInContext(`${selectSource};globalThis.JhsSelect=JhsSelect`, context);
    vm.runInContext(`${workspaceSource};globalThis.DetailWorkspacePlugin=DetailWorkspacePlugin;globalThis.getDetailResourceAdapter=getDetailResourceAdapter`, context);
    vm.runInContext(`${unifiedSource};globalThis.UnifiedOfflinePlugin=UnifiedOfflinePlugin`, context);
    return { dom, $, context, eventBus };
}

const javdbFixture = `
<div class="video-detail">
  <h2>ABC-1</h2><div class="video-meta-panel"><div class="columns"><div class="column column-video-cover"></div><div class="column column-video-info"></div></div></div>
  <div class="columns preview"><div class="tile-images"></div></div>
  <div class="message-body" data-controller="magnet-sort">
    <div class="magnet-sort"><select data-action="change->magnet-sort#sort"><option value="default">默认</option><option value="date">日期</option></select></div>
    <div id="magnets-content" data-magnet-sort-target="list">
      <div class="item" data-rank="0" data-date="1"><div class="magnet-name"><a href="magnet:?xt=one"><span class="name">one</span></a></div><div class="buttons"><button class="copy-to-clipboard" data-clipboard-text="magnet:?xt=one">复制</button><a>下载</a></div></div>
      <div class="item" data-rank="1" data-date="2"><div class="magnet-name"><a href="magnet:?xt=two"><span class="name">two</span></a></div><div class="buttons"><button class="copy-to-clipboard" data-clipboard-text="magnet:?xt=two">复制</button><a>下载</a></div></div>
    </div>
  </div>
  <section class="host-similar">原生相似推荐</section>
</div>`;

describe("host detail resource boundaries", () => {
    it("preserves the JavDB controller target and reinjects one rightmost action after native redraws", async () => {
        const { $, context, eventBus } = createContext(javdbFixture), controller = $('[data-controller="magnet-sort"]')[0], list = $("#magnets-content")[0];
        let nativeCount = 0, jqueryCount = 0;
        const render = value => {
            const order = "date" === value ? [ [ "two", 2, 1 ], [ "one", 1, 0 ] ] : [ [ "one", 1, 0 ], [ "two", 2, 1 ] ];
            $("#magnets-content").html(order.map(([name, date, rank]) => `<div class="item" data-rank="${rank}" data-date="${date}"><div class="magnet-name"><a href="magnet:?xt=${name}"><span class="name">${name}</span></a></div><div class="buttons"><button class="copy-to-clipboard" data-clipboard-text="magnet:?xt=${name}">复制</button><a>下载</a></div></div>`).join(""));
        };
        const select = $("select[data-action]")[0];
        select.addEventListener("change", (() => { nativeCount++, render(select.value); })), $(select).on("change.test", (() => jqueryCount++));
        const workspace = new context.DetailWorkspacePlugin, offline = new context.UnifiedOfflinePlugin;
        workspace.ensureWorkspace(), eventBus.on("magnet-items-updated", (() => offline.injectNativeButtons())), offline.injectNativeButtons();
        const resourceRegion = $(controller).closest(".video-detail > *")[0], postResource = $('[data-jhs-slot-group="post-resource"]')[0], reviews = $('[data-jhs-slot="reviews"]')[0], related = $('[data-jhs-slot="related"]')[0], similar = $(".host-similar")[0];
        expect($(".video-detail").css("display")).not.toBe("flex");
        expect(resourceRegion.nextElementSibling).toBe(postResource);
        expect(postResource.children[0]).toBe(reviews), expect(postResource.children[1]).toBe(related);
        expect($(postResource).children().index(reviews)).toBeLessThan($(postResource).children().index(related));
        expect($(".video-detail").children().index(postResource)).toBeLessThan($(".video-detail").children().index(similar));
        expect(list.parentElement).toBe(controller);
        expect($("#magnets-content")).toHaveLength(1);
        expect($("#magnets-content > .item").toArray().every(row => $(row).find(".buttons").children().last().hasClass("jhs-offline-btn"))).toBe(true);
        expect($(".one23-offline-btn,.one115-offline-btn")).toHaveLength(0);

        context.JhsSelect.setValue(select, "date", true);
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(nativeCount).toBe(1), expect(jqueryCount).toBe(1);
        expect($("#magnets-content > .item .name").first().text()).toBe("two");
        expect($("#magnets-content > .item").toArray().every(row => $(row).find(".jhs-offline-btn").length === 1 && $(row).find(".buttons").children().last().hasClass("jhs-offline-btn"))).toBe(true);

        context.JhsSelect.setValue(select, "default", true);
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(nativeCount).toBe(2), expect(jqueryCount).toBe(2);
        expect($("#magnets-content > .item .name").first().text()).toBe("one");
        expect($("#magnets-content")).toHaveLength(1), expect($("#magnets-content")[0].parentElement).toBe(controller);

        const replacement = list.cloneNode(true);
        list.replaceWith(replacement);
        await new Promise(resolve => setTimeout(resolve, 20));
        expect($("#magnets-content")).toHaveLength(1);
        expect($("#magnets-content .item").toArray().every(row => $(row).find(".jhs-offline-btn").length === 1)).toBe(true);
        expect(resourceRegion.nextElementSibling).toBe(postResource);
    });

    it("does not emit magnet lifecycle events for review, related, or native sibling changes", async () => {
        const { $, context, eventBus } = createContext(javdbFixture), workspace = new context.DetailWorkspacePlugin;
        let events = 0;
        eventBus.on("magnet-items-updated", (() => events++)), workspace.ensureWorkspace();
        await new Promise(resolve => setTimeout(resolve, 20));
        events = 0;
        $('[data-jhs-slot="reviews"]').append("<p>review</p>"), $('[data-jhs-slot="related"]').append("<p>related</p>"), $(".host-similar").append("<p>native</p>");
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(events).toBe(0);
        $("#magnets-content").append('<div class="item"><div class="buttons"></div></div>');
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(events).toBe(1);
    });

    it("keeps the JavBus table schema and owns actions inside the resource cell", () => {
        const fixture = `<div class="container"><div class="movie"><table id="magnet-table"><tbody><tr><td>磁力名称</td><td>大小</td><td>日期</td></tr><tr><td><a href="magnet:?xt=bus">ABC-1</a></td><td>1GB</td><td>2026</td></tr></tbody></table></div></div><section class="jhs-review-panel"><a href="magnet:?xt=review">评论资源</a><button class="jhs-offline-btn">离线</button></section>`;
        const { $, context } = createContext(fixture, { javdb: false }), row = $("#magnet-table tr").eq(1), cells = row.children("td").length, offline = new context.UnifiedOfflinePlugin;
        offline.injectNativeButtons(), offline.injectNativeButtons();
        expect(row.children("td")).toHaveLength(cells);
        expect(row.children("td").first().children(".jhs-offline-actions")).toHaveLength(1);
        expect(row.find(".jhs-offline-btn")).toHaveLength(1);
        expect($(".jhs-review-panel .jhs-offline-btn")).toHaveLength(1);
        expect($(".one23-offline-btn,.one115-offline-btn")).toHaveLength(0);
    });
});
