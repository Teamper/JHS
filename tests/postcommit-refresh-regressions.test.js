import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { StorageManager } from "../src/core/storage.js";
import { ListItemIndex } from "../src/features/list/list-item-index.js";
import { JhsEventBus } from "../src/core/event-bus.js";
import { ListPageCompatibilityService } from "../src/features/list/list-compatibility-service.js";
import { ListNavigationController } from "../src/features/list/list-navigation-controller.js";

afterEach(() => vi.unstubAllGlobals());

describe("postcommit list freshness", () => {
    it("serializes duplicate scoped refreshes and repairs an index miss without evaluating all cards", async () => {
        const list = new ListPageCompatibilityService(), card = {}, calls = [];
        let finish;
        list.invalidateListRefreshContext = vi.fn();
        list.rebuildItemIndex = vi.fn();
        list.getIndexedItems = vi.fn().mockReturnValueOnce([]).mockReturnValue([card]);
        list.requestListRefresh = vi.fn(async options => {
            calls.push(options);
            if (calls.length === 1) await new Promise(resolve => { finish = resolve; });
            return true;
        });
        const first = list.refreshCarNums(["ABC-1"]);
        await vi.waitFor(() => expect(calls).toHaveLength(1));
        const second = list.refreshCarNums(["ABC-1"]);
        expect(list.invalidateListRefreshContext).toHaveBeenCalledTimes(1);
        finish();
        await Promise.all([first, second]);
        expect(list.rebuildItemIndex).toHaveBeenCalledOnce();
        expect(calls.every(call => call.full === false && call.items.length === 1)).toBe(true);
    });

    it("refreshes the parent card after detail close and ignores callbacks after disposal", async () => {
        let navigation;
        const refreshCarNums = vi.fn();
        const controller = new ListNavigationController({
            hostAdapter: { location: new URL("https://javdb.com/") },
            list: { findCarNumAndHref: () => ({ carNum: "ABC-1", aHref: "/v/one" }), refreshCarNums },
            ui: { jquery: value => value, openPage: (_url, _car, _shade, options) => { navigation = options; } },
        });
        controller.openMovieDetail({});
        await navigation.onClose();
        expect(refreshCarNums).toHaveBeenCalledWith(["ABC-1"]);
        controller.dispose();
        await navigation.onClose();
        expect(refreshCarNums).toHaveBeenCalledOnce();
    });
    it("keeps reordered cards indexed but removes cards moved outside their owner root", () => {
        const dom = new JSDOM('<main><article data-id="ABC-1"></article><article data-id="ABC-2"></article></main><aside></aside>');
        const root = dom.window.document.querySelector("main"), cards = [...root.children];
        const index = new ListItemIndex({ root, readCarNum: card => card.getAttribute("data-id") });
        index.add(cards);
        root.replaceChildren(cards[1], cards[0]);
        index.removeNodes(cards, "article");
        expect(index.get(["ABC-1", "ABC-2"])).toHaveLength(2);
        dom.window.document.querySelector("aside").append(cards[0]);
        index.removeNodes([cards[0]], "article");
        expect(index.get(["ABC-1"])).toEqual([]);
        dom.window.close();
    });

    it.each(["getCarMap", "getStatusMap", "getBlacklistMap"])("does not let an old %s read refill a newer generation", async method => {
        const key = method === "getBlacklistMap" ? "blacklist" : "car_list";
        let release;
        const old = [{ carNum: "ABC-1", starId: "actor", status: "favorite", stateFlags: { downloaded: false } }];
        const latest = [{ carNum: "ABC-1", starId: "actor", status: "downloaded", stateFlags: { downloaded: true } }];
        vi.stubGlobal("localforage", { createInstance: () => ({ getItem: vi.fn().mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValue(latest) }) });
        StorageManager.instance = null;
        const storage = new StorageManager(), first = storage[method]();
        storage._invalidateCache(key);
        const fresh = await storage[method]();
        release(old);
        await first;
        expect(await storage[method]()).toBe(fresh);
        StorageManager.instance = null;
    });

    it("broadcasts a committed notice before waiting for a slow local listener", async () => {
        const posted = vi.fn();
        vi.stubGlobal("BroadcastChannel", class { addEventListener() {} postMessage(event) { posted(event); } });
        const bus = new JhsEventBus("committed"), order = [];
        let finish;
        bus.on("car-state-changed", () => { order.push("local"); return new Promise(resolve => { finish = resolve; }); });
        const pending = bus.emit("car-state-changed", { carNums: ["ABC-1"] }, { broadcastFirst: true });
        expect(posted).toHaveBeenCalledOnce();
        expect(order).toEqual(["local"]);
        finish();
        await pending;
    });
});
