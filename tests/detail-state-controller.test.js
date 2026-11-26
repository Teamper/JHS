import { DetailStateController } from "../src/core/detail-state-controller.js";
import { getOwningLayerIndex } from "../src/core/dialog-shell.js";
import { createPageDialogs } from "../src/platform/browser/page-dialogs.js";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";

function loadController() {
    const dom = new JSDOM('<div id="detail"><button id="filterBtn"><span></span></button><button id="favoriteBtn"><span></span></button><button id="hasDownBtn"><span></span></button><button id="hasWatchBtn"><span></span></button></div>', { url: "https://javdb.example/v/a" });
    const $ = jqueryFactory(dom.window), records = new Map([["FC2-123", { carNum: "FC2-123", stateFlags: { blocked: false, favorite: false, downloaded: false, watched: false } }]]);
    const closePage = vi.fn().mockResolvedValue(true), confirm = vi.fn((event, message, callback) => callback()), toggle = vi.fn(async (carNum, flag) => {
        records.get(carNum).stateFlags[flag] = !records.get(carNum).stateFlags[flag];
    });
    return { controller: new DetailStateController({ toggle, getState: async carNum => records.get(carNum) }, { jquery: $, confirm, closePage, reportError: vi.fn(), logError: vi.fn() }), dom, $, records, toggle, confirm, closePage };
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

describe("page dialog ownership", () => {
    const createActions = (window, close = vi.fn()) => createPageDialogs({ window, dialog: { close }, settings: { snapshot: () => ({ needClosePage: "yes" }) } });

    it("attempts to close a userscript-opened detail tab even without window.opener", async () => {
        const { window } = new JSDOM('<div id="detail"></div>', { url: "https://javdb.example/v/a" }), closeWindow = vi.fn();
        window.close = closeWindow;
        await expect(createActions(window).closePage({ root: window.document.querySelector("#detail") })).resolves.toBe(true);
        expect(closeWindow).toHaveBeenCalledOnce();
    });

    it("prefers the owning iframe detail layer over a nested resource layer", async () => {
        const { window } = new JSDOM('<div class="layui-layer" id="layui-layer7"><iframe id="detail-frame"></iframe></div>', { url: "https://javdb.example/" });
        const child = window.document.querySelector("#detail-frame").contentWindow;
        child.document.body.innerHTML = '<div class="layui-layer" id="layui-layer8"><button id="offline">离线</button></div>';
        const closePage = vi.fn().mockResolvedValue(true), childClose = vi.fn();
        window.utils = { closePage };
        await createActions(child, childClose).closePage({ root: child.document.querySelector("#offline") });
        expect(closePage).toHaveBeenCalledWith({ layerIndex: 7 });
        expect(childClose).not.toHaveBeenCalled();
        window.close();
    });

    it("closes the layer owning root instead of the last layer", async () => {
        const { window } = new JSDOM('<div class="layui-layer" id="layui-layer7"><div id="detail"></div></div><div class="layui-layer" id="layui-layer8"><div id="confirm"></div></div>', { url: "https://javdb.example/v/a" });
        const close = vi.fn(), detail = window.document.querySelector("#detail");
        const layerIndex = getOwningLayerIndex({ root: detail }, window);
        detail.remove();
        await createActions(window, close).closePage({ root: detail, layerIndex });
        expect(close).toHaveBeenCalledExactlyOnceWith(7);
        window.close();
    });
});
