import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { BlacklistEntryController } from "../src/features/library/blacklist-entry-controller.js";

afterEach(() => vi.unstubAllGlobals());

function createEntry(html, request = vi.fn(async () => ({ data: "<div class='movie-list'></div>" }))) {
    const dom = new JSDOM(html, { url: "https://javdb.com/actors/actor-a?page=2" }), $ = jqueryFactory(dom.window);
    vi.stubGlobal("$", $);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    Object.defineProperty(dom.window.navigator, "locks", { configurable: true, value: { request: (_name, _options, callback) => callback({}) } });
    const state = { addBlacklistItem: vi.fn(async () => {}), batchSaveBlacklistCarList: vi.fn(async () => ({ changed: [] })) };
    const ui = { confirm: vi.fn(), loading: vi.fn(() => ({ close: vi.fn() })) };
    const notifications = { error: vi.fn(), ok: vi.fn() }, logger = { error: vi.fn(), warn: vi.fn() };
    const scope = { disposed: false }, task = { singleTaskKey: "checkNewActressActorFilterCar" };
    const controller = new BlacklistEntryController({
        document: dom.window.document, window: dom.window, location: dom.window.location, jquery: $, site: "javdb",
        state, http: { request }, ui, notifications, logger, scope, task,
        getSubjectInfo: () => ({ starId: "actor-a", name: "演员甲", allName: ["演员甲"], role: "actor", movieType: "censored", blacklistUrl: "https://javdb.com/actors/actor-a?t=d" }),
        parsePage: (page, name, starId, site) => {
            const cards = page.find(".movie-list .item").toArray();
            return { nextPageLink: page.find(".pagination-next").attr("href") || null, recordCount: cards.length, lastPublishTime: null, records: cards.map((element) => ({ carNum: $(element).attr("data-car"), url: $(element).find("a").attr("href"), names: name, starId, actionType: "filter", site })) };
        },
    });
    return { controller, state, ui, notifications, logger, scope, dom, $, request };
}

describe("BlacklistEntryController", () => {
    it("renders an external category name as text in the blacklist confirmation", () => {
        const { controller, ui, state, dom } = createEntry("<div class='movie-list'></div>");
        controller.getSubjectInfo = () => ({ starId: "tag-a", name: "tag-a", allName: ["tag-a"], role: "虚拟演员", movieType: '<img src=x onerror="alert(1)">', blacklistUrl: "https://javdb.com/tags/tag-a" });

        controller.addBlacklist({ clientX: 3, clientY: 4 });

        const rendered = dom.window.document.createElement("div");
        rendered.innerHTML = ui.confirm.mock.calls[0][1];
        expect(rendered.querySelector("img")).toBeNull();
        expect(rendered.textContent).toContain('<img src=x onerror="alert(1)">');
        expect(state.addBlacklistItem).not.toHaveBeenCalled();
        dom.window.close();
    });

    it("confirms escaped actor text, persists the established entry, and scans from the current page through pagination", async () => {
        const current = '<div class="movie-list"><div class="item" data-car="A-1"><a href="/v/1"></a></div></div><a class="pagination-next" href="?page=3">Next</a>';
        const { controller, state, ui, notifications, dom, request } = createEntry(current, vi.fn(async () => ({ data: '<div class="movie-list"><div class="item" data-car="A-2"><a href="/v/2"></a></div></div>' })));
        controller.getSubjectInfo = () => ({ starId: "actor-a", name: "<img src=x>", allName: ["<img src=x>"], role: "actor", movieType: "censored", blacklistUrl: "https://javdb.com/actors/actor-a" });
        controller.addBlacklist({ clientX: 10, clientY: 20 });
        const [position, message, confirm] = ui.confirm.mock.calls[0];
        expect(position).toEqual({ clientX: 10, clientY: 100 });
        expect(message).toContain("&lt;img src=x&gt;");
        expect(message).not.toContain("<img src=x>");
        const renderedConfirm = dom.window.document.createElement("div");
        renderedConfirm.innerHTML = message;
        expect(renderedConfirm.querySelector("img")).toBeNull();
        expect(renderedConfirm.textContent).toContain("<img src=x>");

        await controller.addAndScan(controller.getSubjectInfo());

        expect(state.addBlacklistItem).toHaveBeenCalledExactlyOnceWith({ starId: "actor-a", name: "<img src=x>", allName: ["<img src=x>"], role: "actor", movieType: "censored", url: "https://javdb.com/actors/actor-a" });
        expect(state.batchSaveBlacklistCarList).toHaveBeenCalledTimes(2);
        expect(state.batchSaveBlacklistCarList).toHaveBeenNthCalledWith(1, [expect.objectContaining({ carNum: "A-1", starId: "actor-a" })]);
        expect(state.batchSaveBlacklistCarList).toHaveBeenNthCalledWith(2, [expect.objectContaining({ carNum: "A-2", starId: "actor-a" })]);
        expect(request).toHaveBeenCalledOnce();
        expect(request.mock.calls[0][0].url).toBe("https://javdb.com/actors/actor-a?page=3");
        expect(notifications.ok).toHaveBeenCalledOnce();
        expect(typeof confirm).toBe("function");
        dom.window.close();
    });

    it("does not write the actor again when page parsing fails after its durable insertion", async () => {
        const { controller, state, notifications, dom } = createEntry("<div class='movie-list'></div>");
        controller.parsePage = () => { throw new Error("challenge page"); };
        await expect(controller.addAndScan()).rejects.toThrow("challenge page");
        expect(state.addBlacklistItem).toHaveBeenCalledOnce();
        expect(state.batchSaveBlacklistCarList).not.toHaveBeenCalled();
        expect(notifications.error).toHaveBeenCalledOnce();
        dom.window.close();
    });
});
