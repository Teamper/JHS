import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(join(process.cwd(), "src/plugins/blacklist/blacklist.js"), "utf8");

function createPlugin() {
    const dom = new JSDOM(`<body><input id="searchValue"><select id="dataType"><option value=""></option><option value="actor">actor</option><option value="actress">actress</option></select><select id="statusType"><option value=""></option><option value="normal">normal</option><option value="stop">stop</option></select><select id="urlType"><option value=""></option><option value="hasT">hasT</option><option value="noT">noT</option></select></body>`, { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    const blacklist = [
        { starId: "a-1", name: "Alpha", allName: ["别名 One"], role: "actor", url: "https://javdb.com/actors/a?t=c", lastPublishTime: "old" },
        { starId: "b-1", name: "Beta", allName: "Second Alias", role: "actress", url: "https://javdb.com/actors/b", lastPublishTime: "new" }
    ];
    const storageManager = { getBlacklist: vi.fn(async () => blacklist), getBlacklistCarList: vi.fn(async () => [{ starId: "a-1", carNum: "ABC-1" }]), getSetting: vi.fn(async () => 8760) };
    class BasePlugin { getBean() { return {}; } }
    const JhsSelect = { setValue: vi.fn((target, value) => $(target).val(value)) };
    let tabulatorOptions;
    function Tabulator(selector, options) { tabulatorOptions = options; }
    const context = vm.createContext({
        console, Object, Array, Map, Set, Promise, Date, URL, $, BasePlugin, storageManager, JhsSelect,
        i: (target, key, value) => target[key] = value,
        shouldSkipStopped: value => value === "old",
        B: "actor", P: "actress", D: "censored", A: "uncensored", T: "javdb", I: "javbus", l: false, r: true,
        window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
        normalizeHttpUrl: value => { try { const url = new URL(String(value), dom.window.location.href); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; } }, parseNumberSetting: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
        renderStateView: vi.fn(), utils: {}, show: {}, clog: {}, navigator: {}, jhsEventBus: {}, stateService: {}, gmHttp: {}, Tabulator
    });
    vm.runInContext(`${source};globalThis.TestPlugin=BlacklistPlugin`, context);
    const plugin = new context.TestPlugin;
    plugin.checkBlacklist_ruleTime = 8760;
    return { plugin, $, storageManager, JhsSelect, getTabulatorOptions: () => tabulatorOptions };
}

describe("blacklist combined filters", () => {
    it("combines search, role, status and URL category without clearing sibling filters", async () => {
        const { plugin, $ } = createPlugin();
        $("#searchValue").val("别名"), $("#dataType").val("actor"), $("#statusType").val("stop"), $("#urlType").val("hasT");
        const result = await plugin.getTableData();
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ starId: "a-1", count: 1, isUnCheck: true });
        expect($("#statusType").val()).toBe("stop");
        expect($("#urlType").val()).toBe("hasT");
    });

    it("keeps one table instance across empty and non-empty reloads", async () => {
        const { plugin } = createPlugin(), table = { setData: vi.fn() };
        plugin.tableObj = table, plugin.getTableData = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ starId: "a" }]);
        await plugin.reloadTable(), await plugin.reloadTable();
        expect(table.setData).toHaveBeenNthCalledWith(1, []);
        expect(table.setData).toHaveBeenNthCalledWith(2, [{ starId: "a" }]);
        expect(plugin.tableObj).toBe(table);
    });
});

describe("blacklist reset and pagination contracts", () => {
    it("uses silent select resets and a single reload after all four values reset", () => {
        const start = source.indexOf('content.on("click", "#cleanQueryBtn"'), end = source.indexOf(')).on("input", "#searchValue"', start), reset = source.slice(start, end);
        expect(reset.match(/JhsSelect\.setValue/g)).toHaveLength(3);
        expect(reset.match(/!1\)/g)).toHaveLength(3);
        expect(reset.match(/reloadTable\(\)/g)).toHaveLength(1);
        expect(reset).toContain('search.val("")');
    });

    it("exposes a real all-page selector and localized label", () => {
        expect(source).toContain("paginationSizeSelector: [ 20, 50, 100, 1e3, !0 ]");
        expect(source).toContain('all: "全部"');
        expect(source).not.toContain("99999");
    });

    it("returns a safe DOM link for imported actress names and URLs", async () => {
        const harness = createPlugin();
        harness.plugin.getTableData = vi.fn(async () => []);
        await harness.plugin.loadTableData();
        const formatter = harness.getTabulatorOptions().columns[0].formatter, node = formatter({ getData: () => ({ name: '<img id="injected">', url: 'javascript:alert(1)' }) });
        expect(node.tagName).toBe("A");
        expect(node.textContent).toBe('<img id="injected">');
        expect(node.querySelector("#injected")).toBeNull();
        expect(node.getAttribute("href")).toBe("#");
        expect(node.getAttribute("aria-disabled")).toBe("true");
    });
});
