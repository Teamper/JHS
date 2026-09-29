// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { TitleKeywordController } from "../src/features/library/title-keyword-controller.js";
import { TitleKeywordService } from "../src/services/title-keyword-service.js";

function setup({ site = "javdb", route = "detail", initial = {}, selection = "Movie title" } = {}) {
    const host = document.createElement("main");
    host.innerHTML = '<div class="title"><strong>Detail title</strong></div>';
    document.body.append(host);
    const settings = new EventTarget();
    settings.value = { ...initial };
    settings.snapshot = () => settings.value;
    settings.set = (name, value) => {
        settings.value = { ...settings.value, [name]: value };
        settings.dispatchEvent(new CustomEvent("settings.changed", { detail: { names: [name] } }));
    };
    Object.defineProperty(window, "getSelection", { configurable: true, value: () => ({ toString: () => selection }) });
    const confirm = vi.fn(), closePage = vi.fn(async () => true), emitted = vi.fn(async () => undefined), add = vi.fn(async () => undefined);
    const scope = new LifecycleScope("test:title-keyword");
    const diagnostics = { recordError: vi.fn() };
    const ui = { confirm, jquery: value => ({ value }), closePage };
    const controller = new TitleKeywordController({
        document, window, site, route, settings, keywords: { add }, events: { emit: emitted }, ui, scope, diagnostics,
    });
    return { controller, scope, settings, host, confirm, closePage, emitted, add, diagnostics };
}

async function acceptAndDrain(confirm) {
    confirm.mock.calls[0][2]();
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 0));
}

describe("Library Feature title keyword controller", () => {
    afterEach(() => {
        document.body.replaceChildren();
        delete window.getSelection;
    });

    it("escapes selected external text for HTML-rendered confirmation and preserves legacy writes", async () => {
        const selected = "<img src=x onerror=alert(1)>\n  " + "x".repeat(130);
        const test = setup({ selection: selected });
        expect(test.controller.start()).toBe(true);
        const title = test.host.querySelector(".title strong");
        title.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 31, clientY: 45 }));

        const [position, message] = test.confirm.mock.calls[0];
        expect(position).toEqual({ clientX: 31, clientY: 125 });
        expect(message).toContain("&lt;img src=x onerror=alert(1)&gt;");
        expect(message).not.toContain("<img src=x");
        const rendered = document.createElement("div");
        rendered.innerHTML = message;
        expect(rendered.querySelector("img")).toBeNull();
        expect(rendered.textContent).toContain("<img src=x onerror=alert(1)>");

        await acceptAndDrain(test.confirm);
        expect(test.add).toHaveBeenCalledWith(`<img src=x onerror=alert(1)> ${"x".repeat(120 - "<img src=x onerror=alert(1)> ".length)}`);
        expect(test.emitted).toHaveBeenCalledWith("filter-rules-changed", { scope: "title-keyword" });
        expect(test.closePage).toHaveBeenCalledWith({ root: { value: title } });
        expect(test.diagnostics.recordError).not.toHaveBeenCalled();
        test.controller.dispose();
        test.scope.dispose();
    });

    it("keeps the default enabled state, responds to the saved switch, and removes listeners on teardown", () => {
        const test = setup();
        test.controller.start();
        const title = test.host.querySelector(".title strong");
        title.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        expect(test.confirm).toHaveBeenCalledTimes(1);

        test.settings.set("enableTitleSelectFilter", "no");
        title.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        expect(test.confirm).toHaveBeenCalledTimes(1);

        test.settings.set("enableTitleSelectFilter", "yes");
        title.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        expect(test.confirm).toHaveBeenCalledTimes(2);

        test.controller.dispose();
        test.scope.dispose();
        title.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        expect(test.confirm).toHaveBeenCalledTimes(2);
        expect(test.scope.snapshot()).toMatchObject({ listeners: 0, disposed: true });
    });

    it("handles FC2 titles inserted into the JavDB page and excludes JavBus list headings", () => {
        const javdb = setup({ site: "javdb", route: "list" });
        javdb.controller.start();
        const layer = document.createElement("div");
        layer.className = "layui-layer";
        layer.innerHTML = '<h1><strong class="current-title">FC2 title</strong></h1>';
        document.body.append(layer);
        layer.querySelector(".current-title").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        expect(javdb.confirm).toHaveBeenCalledTimes(1);
        javdb.controller.dispose();
        javdb.scope.dispose();

        const javbusList = setup({ site: "javbus", route: "list" });
        expect(javbusList.controller.start()).toBe(false);
        javbusList.scope.dispose();
    });

    it("keeps title keyword reads and writes behind the compatibility service", async () => {
        const saveTitleFilterKeyword = vi.fn(async keyword => keyword), getTitleFilterKeyword = vi.fn(async () => ["keyword"]);
        const service = new TitleKeywordService({ saveTitleFilterKeyword, getTitleFilterKeyword });
        await expect(service.add("ABC")).resolves.toBe("ABC");
        expect(saveTitleFilterKeyword).toHaveBeenCalledWith("ABC");
        await expect(service.getAll()).resolves.toEqual(["keyword"]);
        expect(getTitleFilterKeyword).toHaveBeenCalledOnce();
        await expect(new TitleKeywordService(undefined).add("ABC")).rejects.toThrow("标题关键词存储兼容服务不可用");
        await expect(new TitleKeywordService(undefined).getAll()).rejects.toThrow("标题关键词读取兼容服务不可用");
    });
});
