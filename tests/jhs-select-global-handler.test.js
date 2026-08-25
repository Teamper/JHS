import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";

const uiSource = readTestFile(join(process.cwd(), "src/core/ui-primitives.js"), "utf8");
const selectSource = uiSource.slice(uiSource.indexOf("class JhsSelect"));

function loadJhsSelect(html) {
    const dom = new JSDOM(html, { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    const context = vm.createContext({
        window: dom.window, document: dom.window.document, Node: dom.window.Node, Event: dom.window.Event, $,
        setTimeout, clearTimeout, queueMicrotask, clog: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
    });
    vm.runInContext(`${selectSource};globalThis.JhsSelect=JhsSelect`, context);
    return { dom, $, context, document: dom.window.document };
}

const fixture = '<body><select class="jhs-select-source" id="a"><option value="1">一</option><option value="2">二</option></select><select class="jhs-select-source" id="b"><option value="x">X</option><option value="y">Y</option></select></body>';

describe("JhsSelect global document click handler", () => {
    it("registers a single namespaced document handler no matter how many selects are bound", () => {
        const { $, context, document } = loadJhsSelect(fixture);
        context.JhsSelect.enhance(document);
        context.JhsSelect.enhance(document);
        const clickEvents = $._data(document, "events")?.click || [];
        expect(clickEvents.filter(handler => handler.namespace === "jhsSelect")).toHaveLength(1);
    });

    it("closes an open select when clicking outside the control and keeps it open when clicking inside", () => {
        const { $, context, document } = loadJhsSelect(fixture);
        const instance = context.JhsSelect.get(document.querySelector("#a"));
        expect(instance).not.toBeNull();
        instance.open();
        expect($(".jhs-select-control.is-open")).toHaveLength(1);
        $("body").trigger("click");
        expect($(".jhs-select-control.is-open")).toHaveLength(0);
        instance.open();
        $(".jhs-select-control").trigger("click");
        expect($(".jhs-select-control.is-open")).toHaveLength(1);
    });

    it("closes the previously open select when a second one opens", () => {
        const { $, context, document } = loadJhsSelect(fixture);
        const a = context.JhsSelect.get(document.querySelector("#a")), b = context.JhsSelect.get(document.querySelector("#b"));
        a.open(), b.open();
        expect($(".jhs-select-control.is-open")).toHaveLength(1);
    });
});
