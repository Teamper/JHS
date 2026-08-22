import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadController() {
    const dom = new JSDOM('<div id="detail"><button id="filterBtn"><span></span></button><button id="favoriteBtn"><span></span></button><button id="hasDownBtn"><span></span></button><button id="hasWatchBtn"><span></span></button></div>', { url: "https://javdb.example/v/a" });
    const $ = jqueryFactory(dom.window), records = new Map([["FC2-123", { carNum: "FC2-123", stateFlags: { blocked: false, favorite: false, downloaded: false, watched: false } }]]);
    const closePage = vi.fn().mockResolvedValue(true), confirm = vi.fn((event, message, callback) => callback()), toggle = vi.fn(async (carNum, flag) => {
        records.get(carNum).stateFlags[flag] = !records.get(carNum).stateFlags[flag];
    });
    const context = vm.createContext({
        document: dom.window.document, $, m: "屏蔽", u: "取消屏蔽", v: "收藏", b: "取消收藏", y: "标记下载", k: "标记观看",
        normalizeCarNum: value => String(value).trim().toUpperCase(),
        normalizeStateFlags: flags => ({ blocked: false, favorite: false, downloaded: false, watched: false, ...flags }),
        storageManager: { getCar: async carNum => records.get(carNum) }, stateService: { toggle },
        utils: { q: confirm, closePage }, show: { error: vi.fn() }, clog: { error: vi.fn() }
    });
    const source = readFileSync(join(repoRoot, "src/core/detail-state-controller.js"), "utf8");
    vm.runInContext(`${source};globalThis.Controller=DetailStateController`, context);
    return { controller: new context.Controller(), dom, $, records, toggle, confirm, closePage };
}

describe("DetailStateController", () => {
    it("toggles every flag in both directions and refreshes aria state", async () => {
        const { controller, $, records, toggle } = loadController(), root = $("#detail"), config = controller.bind({ root, layerIndex: 7, carNum: "fc2-123", getRecord: () => ({ carNum: "FC2-123" }) });
        for (const [flag, selector] of Object.entries({ blocked: "#filterBtn", favorite: "#favoriteBtn", downloaded: "#hasDownBtn", watched: "#hasWatchBtn" })) {
            await controller.requestToggle(config, flag, { currentTarget: root.find(selector)[0] });
            await vi.waitFor(() => expect(root.find(selector).attr("aria-pressed")).toBe("true"));
            expect(records.get("FC2-123").stateFlags[flag]).toBe(true);
            await controller.requestToggle(config, flag, { currentTarget: root.find(selector)[0] });
            await vi.waitFor(() => expect(root.find(selector).attr("aria-pressed")).toBe("false"));
            expect(records.get("FC2-123").stateFlags[flag]).toBe(false);
        }
        expect(toggle).toHaveBeenCalledTimes(8);
    });

    it("confirms only the false-to-true blocked transition and closes the owned layer", async () => {
        const { controller, $, confirm, closePage } = loadController(), root = $("#detail"), config = controller.bind({ root, layerIndex: 7, carNum: "FC2-123", getRecord: () => ({ carNum: "FC2-123" }) });
        await controller.requestToggle(config, "blocked", { currentTarget: root.find("#filterBtn")[0] });
        await vi.waitFor(() => expect(closePage).toHaveBeenCalledTimes(1));
        await controller.requestToggle(config, "blocked", { currentTarget: root.find("#filterBtn")[0] });
        await vi.waitFor(() => expect(closePage).toHaveBeenCalledTimes(2));
        expect(confirm).toHaveBeenCalledOnce();
        expect(closePage).toHaveBeenNthCalledWith(1, { layerIndex: 7, root });
        expect(closePage).toHaveBeenNthCalledWith(2, { layerIndex: 7, root });
    });
});

describe("Utils.closePage", () => {
    it("closes the layer owning root instead of the last layer", async () => {
        const dom = new JSDOM('<div class="layui-layer" id="layui-layer7"><div id="detail"></div></div><div class="layui-layer" id="layui-layer8"><div id="confirm"></div></div>', { url: "https://javdb.example/v/a" });
        const $ = jqueryFactory(dom.window), close = vi.fn(), context = vm.createContext({
            console, URL, window: dom.window, document: dom.window.document, $, layer: { close, open: vi.fn() },
            storageManager: { getSetting: vi.fn().mockResolvedValue("yes") }, GM_openInTab: vi.fn(), normalizeCarNum: value => value,
            i: (target, key, value) => (target[key] = value)
        });
        dom.window.layer = context.layer;
        vm.runInContext(`${readFileSync(join(repoRoot, "src/core/utils.js"), "utf8")};globalThis.TestUtils=Utils`, context);
        await new context.TestUtils().closePage({ root: dom.window.document.querySelector("#detail") });
        expect(close).toHaveBeenCalledOnce();
        expect(close).toHaveBeenCalledWith(7);
    });
});
