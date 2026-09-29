import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListContextMenuController } from "../src/features/list/list-context-menu-controller.js";

describe("List Feature context-menu action", () => {
    let dom, scope, controller;

    afterEach(() => {
        scope?.dispose();
        dom?.window.close();
        vi.unstubAllGlobals();
        scope = dom = controller = null;
    });

    function mount({ actorName = "Actress, Other", parseActressName = vi.fn(async () => "Parsed Actress") } = {}) {
        dom = new JSDOM(`<div class="actor-section-name">${actorName}</div><div class="movie-list"><article class="item"><img id="cover"></article></div>`, { url: "https://javdb.com/" });
        vi.stubGlobal("document", dom.window.document);
        const jquery = (value) => value?.jquery ? value : value?.nodeType ? value : null;
        const confirm = vi.fn();
        const state = { patch: vi.fn(async () => {}) };
        const notifications = { ok: vi.fn(), error: vi.fn() };
        const diagnostics = { recordError: vi.fn() };
        const list = {
            findCarNumAndHref: vi.fn(() => ({ carNum: '<img src=x onerror="alert(1)">', url: "/v/abc-123", publishTime: "2026-08-25", fc2Source: "fc2" })),
            parseActressName,
        };
        scope = new LifecycleScope("test:list-context-menu");
        controller = new ListContextMenuController({
            hostAdapter: { site: "javdb", document: dom.window.document, locateListRoot: () => dom.window.document.querySelector(".movie-list") },
            list, state, ui: { jquery, confirm }, notifications, diagnostics, scope,
        });
        expect(controller.start()).toBe(true);
        return { confirm, state, notifications, diagnostics, list };
    }

    it("renders the escaped confirmation safely and writes the original block record", async () => {
        const { confirm, state, notifications, list } = mount();
        const image = dom.window.document.querySelector("#cover");
        const event = new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 12, clientY: 24 });
        image.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(list.findCarNumAndHref).toHaveBeenCalledOnce();
        expect(confirm).toHaveBeenCalledWith({ clientX: 12, clientY: 24 }, expect.stringContaining("&lt;img"), expect.any(Function));
        const message = confirm.mock.calls[0][1];
        const rendered = dom.window.document.createElement("div");
        rendered.innerHTML = message;
        expect(rendered.querySelector("img")).toBeNull();
        expect(rendered.textContent).toContain('<img src=x onerror="alert(1)">');

        await confirm.mock.calls[0][2]();
        expect(state.patch).toHaveBeenCalledWith('<img src=x onerror="alert(1)">', { blocked: true }, {
            record: {
                carNum: '<img src=x onerror="alert(1)">', url: "/v/abc-123", names: "Actress", publishTime: "2026-08-25", fc2Source: "fc2",
            },
        });
        expect(notifications.ok).toHaveBeenCalledWith("操作成功");
    });

    it("does not commit an actress lookup that finishes after the list scope closes", async () => {
        let resolveName;
        const parseActressName = vi.fn(() => new Promise((resolve) => { resolveName = resolve; }));
        const { confirm, state } = mount({ actorName: "", parseActressName });
        dom.window.document.querySelector("#cover").dispatchEvent(new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        const pendingAction = confirm.mock.calls[0][2]();
        await vi.waitFor(() => expect(parseActressName).toHaveBeenCalledOnce());
        scope.dispose();
        resolveName("Late Actress");
        await pendingAction;
        expect(state.patch).not.toHaveBeenCalled();
    });

    it("ignores context menus outside list covers and videos and releases its root listener", () => {
        const { confirm } = mount();
        const outside = dom.window.document.createElement("div");
        dom.window.document.querySelector(".movie-list").append(outside);
        const event = new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true });
        outside.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
        expect(confirm).not.toHaveBeenCalled();
        expect(scope.snapshot().listeners).toBe(1);
        controller.dispose();
        expect(scope.snapshot().listeners).toBe(0);
    });
});
