import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";

function loadHistory() {
    const dom = new JSDOM("<body></body>", { url: "https://javdb.com/users/collection_codes" }), $ = jqueryFactory(dom.window), patch = vi.fn().mockResolvedValue(), toggle = vi.fn().mockResolvedValue(), close = vi.fn(), confirm = vi.fn((event, message, callback) => callback());
    const layer = { open: vi.fn(), close }, context = vm.createContext({
        document: dom.window.document, window: dom.window, $, BasePlugin: class {}, Tabulator: class {}, layer,
        normalizeStateFlags: flags => ({ favorite: false, downloaded: false, watched: false, blocked: false, ...flags }), stateService: { patch, toggle }, legacyActionToFlag: action => ({ filter: "blocked", favorite: "favorite", hasDown: "downloaded", hasWatch: "watched" })[action],
        utils: { getDialogArea: () => [], q: confirm }, show: { error: vi.fn() }, clog: { debug: vi.fn() }, i: (target, key, value) => (target[key] = value),
        r: true, l: false, d: "filter", h: "favorite", g: "hasDown", p: "hasWatch", m: "屏蔽", v: "收藏", y: "下载", k: "观看"
    });
    vm.runInContext(`${readFileSync(join(process.cwd(), "src/plugins/status/history.js"), "utf8")};globalThis.History=HistoryPlugin`, context);
    const plugin = new context.History;
    plugin.tableObj = { setData: vi.fn() };
    return { plugin, $, patch, toggle, layer, confirm };
}

async function openAndSubmit(state, next) {
    const loaded = loadHistory();
    await loaded.plugin.editRecord({ carNum: "ABC-1", names: "A", url: "/v/a", remark: "R", stateFlags: state });
    const options = loaded.layer.open.mock.calls[0][0];
    const layerRoot = loaded.$('<div class="layui-layer"></div>').append(options.content).appendTo("body");
    options.success(layerRoot, 9);
    for (const [flag, value] of Object.entries(next)) loaded.$(`#edit-${flag}`).prop("checked", value);
    await options.yes(9);
    await vi.waitFor(() => expect(loaded.patch).toHaveBeenCalledOnce());
    return loaded;
}

describe("History multi-state editor", () => {
    it("persists all four flags including explicit false values", async () => {
        const loaded = await openAndSubmit(
            { favorite: true, downloaded: true, watched: false, blocked: false },
            { favorite: false, downloaded: true, watched: true, blocked: false }
        );
        expect(loaded.patch.mock.calls[0][1]).toEqual({ favorite: false, downloaded: true, watched: true, blocked: false });
    });

    it("confirms blocked false-to-true exactly once", async () => {
        const loaded = await openAndSubmit(
            { favorite: false, downloaded: false, watched: false, blocked: false },
            { favorite: false, downloaded: false, watched: false, blocked: true }
        );
        expect(loaded.confirm).toHaveBeenCalledOnce();
    });

    it.each([
        [ "history-favoriteBtn", "favorite" ],
        [ "history-hasDownBtn", "downloaded" ],
        [ "history-hasWatchBtn", "watched" ]
    ])("toggles a single-row %s action", async (buttonClass, flag) => {
        const loaded = loadHistory(), root = loaded.$(`<div><div class="action-btns" data-car-num="ABC-1" data-href="/v/a"><button class="${buttonClass}"></button></div></div>`);
        loaded.plugin.tableObj = { getRow: () => ({ getData: () => ({ stateFlags: {} }) }), deselectRow: vi.fn(), setPage: vi.fn() };
        loaded.plugin.bindHistoryActions(root), root.find("button").trigger("click");
        await vi.waitFor((() => expect(loaded.toggle).toHaveBeenCalledWith("ABC-1", flag, expect.any(Object))));
    });

    it("only confirms blocking and directly toggles unblocking", async () => {
        const loaded = loadHistory(), root = loaded.$('<div><div class="action-btns" data-car-num="ABC-1"><button class="history-filterBtn"></button></div></div>');
        loaded.plugin.tableObj = { getRow: () => ({ getData: () => ({ stateFlags: { blocked: true } }) }), deselectRow: vi.fn(), setPage: vi.fn() };
        loaded.plugin.bindHistoryActions(root), root.find("button").trigger("click");
        await vi.waitFor((() => expect(loaded.toggle).toHaveBeenCalledWith("ABC-1", "blocked", expect.any(Object))));
        expect(loaded.confirm).not.toHaveBeenCalled();
    });
});
