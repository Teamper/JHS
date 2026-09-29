import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi, afterEach } from "vitest";
import { HistoryDialogController } from "../src/features/library/history-dialog-controller.js";

afterEach(() => vi.unstubAllGlobals());

function loadHistory() {
    const dom = new JSDOM("<body></body>", { url: "https://javdb.com/users/collection_codes" }), $ = jqueryFactory(dom.window), patch = vi.fn().mockResolvedValue(), toggle = vi.fn().mockResolvedValue(), close = vi.fn(), confirm = vi.fn((event, message, callback) => callback());
    vi.stubGlobal("document", dom.window.document);
    const layer = { open: vi.fn(), close }, stateService = { patch, toggle }, runtimeServices = { dialog: { open: layer.open, close: layer.close }, state: stateService };
    const repository = { patch, toggle, remove: vi.fn(), list: vi.fn(async () => []), activity: vi.fn(), offline: vi.fn() };
    const plugin = new HistoryDialogController({
        document: dom.window.document, window: dom.window, jquery: $,
        domUi: { confirm, getDialogArea: () => [], enhanceSelect: vi.fn(), loading: () => ({ close: vi.fn() }) },
        dialog: { open: layer.open, close: layer.close }, notifications: { ok: vi.fn(), info: vi.fn(), error: vi.fn() },
        logger: { error: vi.fn() }, clipboard: { copyText: vi.fn() }, movie: {}, settings: { snapshot: () => ({}) },
        storage: {}, state: stateService, repository, site: "javdb",
    });
    plugin.tableObj = { setData: vi.fn() };
    return { plugin, $, patch, toggle, layer, confirm, runtimeServices, dom };
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

    it("labels a configured 123AV mirror through the provider matcher", () => {
        const loaded = loadHistory();
        loaded.plugin.movie = {
            matchesProviderUrl: (providerId, value) => providerId === "av123" && new URL(value).hostname === "mirror.example",
            externalSiteOrigin: () => "https://unused.example",
        };
        loaded.plugin.settings = { snapshot: () => ({ av123Url: "https://mirror.example" }) };
        expect(loaded.plugin.getSourceLabel("https://mirror.example/cn/v/ABC-123")).toBe("123AV");
    });
});
