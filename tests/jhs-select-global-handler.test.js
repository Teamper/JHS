import { JhsSelect } from "../src/core/ui-primitives.js";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";

function loadJhsSelect(html) {
    const dom = new JSDOM(html, { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    for (const [key, value] of Object.entries({
        window: dom.window, document: dom.window.document, Node: dom.window.Node, Event: dom.window.Event, $,
    })) vi.stubGlobal(key, value);
    // Every fixture represents a fresh page and owns a separate document listener.
    JhsSelect._globalClickBound = false;
    JhsSelect.instances = new WeakMap();
    return { dom, $, document: dom.window.document };
}

afterEach(() => vi.unstubAllGlobals());

const fixture = '<body><select class="jhs-select-source" id="a"><option value="1">一</option><option value="2">二</option></select><select class="jhs-select-source" id="b"><option value="x">X</option><option value="y">Y</option></select></body>';

describe("JhsSelect global document click handler", () => {
    it("associates a label and description, forwards validation and preserves native form values", () => {
        const { dom, document } = loadJhsSelect('<label for="s">来源</label><span id="help">详细说明</span><select id="s" required aria-describedby="help" aria-invalid="true"><option value="a">Alpha</option></select>');
        const source = document.querySelector("select"), instance = JhsSelect.get(source);
        expect(instance.trigger.attr("role")).toBe("combobox"); expect(instance.menu.attr("role")).toBe("listbox");
        expect(instance.trigger.attr("aria-label")).toBe("来源"); expect(instance.trigger.attr("aria-describedby")).toBe("help");
        expect(instance.trigger.attr("aria-required")).toBe("true"); expect(instance.trigger.attr("aria-invalid")).toBe("true");
        document.querySelector("label").click(); expect(document.activeElement).toBe(instance.trigger[0]);
        source.setAttribute("aria-labelledby", "help"); source.removeAttribute("aria-invalid"); instance.refresh();
        expect(instance.trigger.attr("aria-labelledby")).toBe("help"); expect(instance.trigger.attr("aria-invalid")).toBeUndefined();
        instance.close(); dom.window.close();
    });
    it.each(["Escape", "outside"])("cancels pending navigation with %s without emitting change", action => {
        const { dom, $, document } = loadJhsSelect(fixture), source = document.querySelector("#a"), instance = JhsSelect.get(source), change = vi.fn();
        source.addEventListener("change", change); instance.open(); instance.trigger.trigger($.Event("keydown", { key: "End" }));
        expect(source.value).toBe("1"); expect(instance.menu.find('[aria-selected="true"]').text()).toBe("二");
        if (action === "Escape") instance.trigger.trigger($.Event("keydown", { key: "Escape" })); else document.body.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true }));
        expect(source.value).toBe("1"); expect(change).not.toHaveBeenCalled(); expect(instance.popover.opened).toBe(false);
        instance.open(); expect(instance.menu.find(".is-active").text()).toBe("一"); instance.close(); dom.window.close();
    });
    it("skips disabled options and groups, supports typeahead and commits once on Tab", () => {
        const { dom, $, document } = loadJhsSelect('<select id="s"><option value="a">Alpha</option><option disabled>Bad</option><optgroup label="Disabled" disabled><option>Charlie</option></optgroup><option value="d">Delta</option><option value="e">Echo</option></select>');
        const source = document.querySelector("select"), instance = JhsSelect.get(source), change = vi.fn(), jqueryChange = vi.fn();
        source.addEventListener("change", change); $(source).on("change.test", jqueryChange);
        instance.open(); instance.trigger.trigger($.Event("keydown", { key: "ArrowDown" }));
        expect(instance.menu.find(".is-active").text()).toBe("Delta"); expect(document.activeElement).toBe(instance.trigger[0]);
        instance.trigger.trigger($.Event("keydown", { key: "e" })); expect(instance.menu.find(".is-active").text()).toBe("Echo");
        const tab = $.Event("keydown", { key: "Tab" }); instance.trigger.trigger(tab);
        expect(tab.isDefaultPrevented()).toBe(false); expect(source.value).toBe("e"); expect(change).toHaveBeenCalledOnce(); expect(jqueryChange).toHaveBeenCalledOnce();
        JhsSelect.setValue(source, "a"); expect(change).toHaveBeenCalledOnce();
        JhsSelect.setValue(source, "d", true); expect(change).toHaveBeenCalledTimes(2);
        instance.close(); dom.window.close();
    });
    it("registers a single namespaced document handler no matter how many selects are bound", () => {
        const { $, document } = loadJhsSelect(fixture);
        JhsSelect.enhance(document);
        JhsSelect.enhance(document);
        const clickEvents = $._data(document, "events")?.click || [];
        expect(clickEvents.filter(handler => handler.namespace === "jhsSelect")).toHaveLength(1);
    });

    it("closes an open select when clicking outside the control and keeps it open when clicking inside", () => {
        const { $, document } = loadJhsSelect(fixture);
        const instance = JhsSelect.get(document.querySelector("#a"));
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
        const { $, document } = loadJhsSelect(fixture);
        const a = JhsSelect.get(document.querySelector("#a")), b = JhsSelect.get(document.querySelector("#b"));
        a.open(), b.open();
        expect($(".jhs-select-control.is-open")).toHaveLength(1);
    });

    it("renders a field trigger while preserving native button keyboard selection and disabled state", () => {
        const { dom, $, document } = loadJhsSelect(fixture);
        try {
            const source = document.querySelector("#a"), instance = JhsSelect.get(source), changed = vi.fn();
            source.addEventListener("change", changed);
            expect(instance.trigger.is('button[type="button"].jhs-field.jhs-select-trigger')).toBe(true);
            expect(instance.trigger.hasClass("jhs-btn--secondary")).toBe(false);
            instance.trigger.trigger($.Event("keydown", { key: "ArrowDown" }));
            expect(instance.trigger.attr("aria-expanded")).toBe("true");
            expect(document.activeElement).toBe(instance.trigger[0]);
            instance.trigger.trigger($.Event("keydown", { key: "ArrowDown" }));
            expect(source.value).toBe("1");
            instance.trigger.trigger($.Event("keydown", { key: "Enter" }));
            expect(source.value).toBe("2");
            expect(changed).toHaveBeenCalledOnce();
            expect(instance.trigger.attr("aria-expanded")).toBe("false");
            source.disabled = true;
            instance.refresh();
            expect(instance.trigger.prop("disabled")).toBe(true);
            instance.trigger.trigger("click");
            expect(instance.trigger.attr("aria-expanded")).toBe("false");
        } finally { dom.window.close(); }
    });
});
