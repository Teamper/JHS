import { createPageDialogs } from "../src/platform/browser/page-dialogs.js";
import { JHS_Z_INDEX } from "../src/core/theme.js";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { DomUiService } from "../src/services/dom-ui-service.js";
import { LayerDialogAdapter } from "../src/platform/userscript/layer-dialog-adapter.js";

function loadUtils(mobile, document = new JSDOM("").window.document, port) {
    const layer = { confirm: vi.fn(() => 7), close: vi.fn(), open: vi.fn(), alert: vi.fn() };
    const esc = { setupEscClose: vi.fn(), releaseEscClose: vi.fn() };
    const options = {
        esc, isMobileMode: () => mobile, window: { innerWidth: 1440, innerHeight: 900, document },
    };
    const utils = Object.assign(createPageDialogs({ ...options, dialog: port ?? new LayerDialogAdapter(layer) }), esc);
    return { utils, layer };
}

describe("user confirmation actions", () => {
    for (const mobile of [false, true]) {
        it(`keeps cancel separate from the named action on ${mobile ? "mobile" : "desktop"}`, () => {
            const { utils, layer } = loadUtils(mobile), accept = vi.fn(), cancel = vi.fn();
            utils.q({ clientX: 200, clientY: 200 }, "移除记录？", accept, cancel, { confirmText: "移除", skin: "caller-skin" });
            const [, options, first, second] = layer.confirm.mock.calls[0];
            expect(options.btn).toEqual(["取消", "移除"]);
            expect(options.skin).toBe("caller-skin jhs-confirm-actions");
            first(7);
            expect(cancel).toHaveBeenCalledOnce();
            expect(accept).not.toHaveBeenCalled();
            second(7);
            expect(accept).not.toHaveBeenCalled();
            utils.q(null, "移除记录？", accept, cancel, { confirmText: "移除" });
            layer.confirm.mock.calls[1][3](7);
            expect(accept).toHaveBeenCalledOnce();
            expect(cancel).toHaveBeenCalledOnce();
            expect(layer.close).toHaveBeenCalledWith(7);
        });
    }

    it("lets the dialog service stack confirmations while the direct Layer path keeps its index", () => {
        const service = { confirm: vi.fn(() => 9), close: vi.fn() }, { utils } = loadUtils(false, undefined, service);
        utils.q(null, "屏蔽记录？", vi.fn(), vi.fn());
        expect(service.confirm.mock.calls[0][1]).not.toHaveProperty("zIndex");

        const { utils: legacy, layer } = loadUtils(false);
        legacy.q(null, "旧确认", vi.fn(), vi.fn());
        expect(layer.confirm.mock.calls[0][1].zIndex).toBe(JHS_Z_INDEX.layer);
    });

    it("unifies unnamed confirmations to cancel-left and preserves the fourth cancellation callback", () => {
        const { utils, layer } = loadUtils(false), accept = vi.fn(), cancel = vi.fn();
        utils.q(null, "旧确认", accept, cancel);
        const [, options, first, second] = layer.confirm.mock.calls[0];
        expect(options.title).toBe("提示");
        expect(options.btn).toEqual(["取消", "确定"]);
        expect(options.skin).toBe("jhs-confirm-actions");
        first();
        expect(cancel).toHaveBeenCalledOnce();
        expect(accept).not.toHaveBeenCalled();
        second();
        expect(accept).not.toHaveBeenCalled();
        utils.q(null, "旧确认", accept, cancel, { tone: "danger" });
        expect(layer.confirm.mock.calls[1][1].skin).toBe("jhs-confirm-actions jhs-confirm-actions--danger");
        layer.confirm.mock.calls[1][3]();
        expect(accept).toHaveBeenCalledOnce();
    });

    it("forwards named labels to the fifth legacy argument", () => {
        const q = vi.fn(), accept = vi.fn(), options = { confirmText: "屏蔽" };
        const ui = new DomUiService(undefined, { q });
        ui.confirm({ clientX: 20, clientY: 30 }, "屏蔽影片？", accept, options);
        expect(q).toHaveBeenCalledWith({ clientX: 20, clientY: 30 }, "屏蔽影片？", accept, undefined, options);
    });

    it("maps a Layer named action to the second button without changing legacy confirms", () => {
        const layer = { open: vi.fn(), close: vi.fn(), confirm: vi.fn(() => 8), alert: vi.fn() };
        const service = new LayerDialogAdapter(layer), accept = vi.fn();
        service.confirm("删除备份？", { confirmText: "删除", cancelText: "保留", skin: "caller-skin" }, accept);
        const [, options, first, second] = layer.confirm.mock.calls[0];
        expect(options.btn).toEqual(["保留", "删除"]);
        expect(options.skin).toBe("caller-skin jhs-confirm-actions");
        expect(options).not.toHaveProperty("confirmText");
        first(8);
        expect(layer.close).toHaveBeenCalledWith(8);
        expect(accept).not.toHaveBeenCalled();
        second(8);
        expect(accept).toHaveBeenCalledWith(8);
        service.confirm("高危确认", { icon: 3, tone: "danger" }, accept);
        expect(layer.confirm.mock.calls[1][3]).toBe(accept);
        expect(layer.confirm.mock.calls[1][1].skin).toBe("jhs-confirm-actions jhs-confirm-actions--danger");
        expect(layer.confirm.mock.calls[1][1].btn).toEqual(["取消", "确定"]);
        expect(layer.confirm.mock.calls[1][1]).not.toHaveProperty("tone");
        service.confirm("默认确认", undefined, accept);
        expect(layer.confirm.mock.calls[2][3]).toBe(accept);
        expect(layer.confirm.mock.calls[2][1].skin).toBe("jhs-confirm-actions");
        expect(layer.confirm.mock.calls[2][1].btn).toEqual(["取消", "确定"]);
    });

    it("prefers the injected DialogService and cleans up each close without canceling twice", () => {
        const { utils, layer } = loadUtils(false), accept = vi.fn(), cancel = vi.fn();
        Object.assign(layer, { open: vi.fn(), alert: vi.fn() });
        const service = new LayerDialogAdapter(layer), confirm = vi.spyOn(service, "confirm");
        const actions = createPageDialogs({ dialog: service, esc: utils, isMobileMode: () => false, window: { innerWidth: 1440, innerHeight: 900, document: new JSDOM("").window.document } });
        actions.q(null, "授权此地址？", accept, cancel, { confirmText: "授权" });
        expect(confirm).toHaveBeenCalledWith("授权此地址？", expect.objectContaining({ confirmText: "授权" }), expect.any(Function), expect.any(Function));
        const [, options, first, second] = layer.confirm.mock.calls[0];
        expect(options.btn).toEqual(["取消", "授权"]);
        expect(options.skin).toBe("jhs-confirm-actions");
        options.success(null, 7);
        expect(utils.setupEscClose).toHaveBeenCalledExactlyOnceWith(7);
        first(7);
        options.end();
        options.end();
        second(7);
        expect(cancel).toHaveBeenCalledOnce();
        expect(accept).not.toHaveBeenCalled();
        expect(utils.releaseEscClose).toHaveBeenCalledWith(7);
        expect(layer.close).toHaveBeenCalledExactlyOnceWith(7);
    });

    it.each([false, true])("settles an undecided confirmation as cancel on end (mobile=%s)", mobile => {
        const { utils, layer } = loadUtils(mobile), accept = vi.fn(), cancel = vi.fn();
        utils.q(null, "授权此地址？", accept, cancel, { confirmText: "授权" });
        const [, options, , action] = layer.confirm.mock.calls[0];
        options.success(null, 7);
        options.end();
        options.end();
        action(7);
        expect(cancel).toHaveBeenCalledOnce();
        expect(accept).not.toHaveBeenCalled();
        expect(utils.releaseEscClose).toHaveBeenCalledWith(7);
    });

    it("never invokes cancellation when an injected confirmation was accepted", () => {
        const { utils, layer } = loadUtils(true), accept = vi.fn(), cancel = vi.fn();
        Object.assign(layer, { open: vi.fn(), alert: vi.fn() });
        utils.q(null, "授权此地址？", accept, cancel, { confirmText: "授权" });
        const [, options, , action] = layer.confirm.mock.calls[0];
        options.success(null, 7);
        action(7);
        options.end();
        options.end();
        expect(accept).toHaveBeenCalledOnce();
        expect(cancel).not.toHaveBeenCalled();
        expect(layer.close).toHaveBeenCalledExactlyOnceWith(7);
    });

    it.each(["cancel", "accept", "close"])("supports keyboard %s, traps focus and releases its local bindings", async action => {
        const dom = new JSDOM('<button id="trigger">打开确认</button><div id="layui-layer7" class="layui-layer"><div class="layui-layer-setwin"><a class="layui-layer-close"></a></div><div class="layui-layer-btn"><a class="layui-layer-btn0">取消</a><a class="layui-layer-btn1">授权</a></div></div>');
        try {
            const { document, KeyboardEvent } = dom.window;
            const { utils, layer } = loadUtils(false, document), accept = vi.fn(), cancel = vi.fn();
            const trigger = document.querySelector("#trigger"), root = document.querySelector("#layui-layer7"), buttons = root.querySelectorAll("a");
            for (const button of buttons) Object.defineProperty(button, "offsetParent", { get: () => root });
            trigger.focus();
            utils.q(null, "授权此地址？", accept, cancel, { confirmText: "授权" });
            const [, options, first, second] = layer.confirm.mock.calls[0];
            const close = root.querySelector(".layui-layer-close"), cancelButton = root.querySelector(".layui-layer-btn0"), acceptButton = root.querySelector(".layui-layer-btn1");
            cancelButton.addEventListener("click", () => first(7));
            acceptButton.addEventListener("click", () => second(7));
            close.addEventListener("click", () => layer.close(7));
            layer.close.mockImplementation(() => { root.remove(); options.end(); });
            options.success(root, 7);
            await Promise.resolve();
            expect(root.classList.contains("jhs-dialog")).toBe(true);
            expect(root.classList.contains("jhs-ui")).toBe(true);
            expect(root.getAttribute("role")).toBe("dialog");
            expect(root.getAttribute("aria-label")).toBe("提示");
            for (const button of buttons) { expect(button.getAttribute("role")).toBe("button"); expect(button.tabIndex).toBe(0); }
            expect(close.getAttribute("aria-label")).toBe("关闭弹窗");
            expect(document.activeElement).toBe(cancelButton);
            acceptButton.focus();
            const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
            acceptButton.dispatchEvent(tab);
            expect(tab.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(close);
            close.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
            expect(document.activeElement).toBe(acceptButton);
            const selected = action === "cancel" ? cancelButton : action === "accept" ? acceptButton : close;
            selected.focus();
            const key = action === "accept" ? "Enter" : " ";
            const activate = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
            selected.dispatchEvent(activate);
            expect(activate.defaultPrevented).toBe(true);
            expect(accept).toHaveBeenCalledTimes(action === "accept" ? 1 : 0);
            expect(cancel).toHaveBeenCalledTimes(action === "accept" ? 0 : 1);
            expect(document.activeElement).toBe(trigger);
            const afterClose = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
            selected.dispatchEvent(afterClose);
            expect(afterClose.defaultPrevented).toBe(false);
            expect(layer.close).toHaveBeenCalledOnce();
        } finally { dom.window.close(); }
    });
});
