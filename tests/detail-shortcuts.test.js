import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { buildSettingDialogHtml, getPluginCategories } from "../src/plugins/backup/setting-templates.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { SettingsService } from "../src/services/settings-service.js";

afterEach(() => vi.unstubAllGlobals());

async function setup(detail = true, beforeHandle = () => {}) {
    const dom = new JSDOM('<button id="favoriteBtn" aria-pressed="false"><span>收藏</span></button><button id="filterBtn" aria-pressed="false">屏蔽</button><button id="hasDownBtn" aria-pressed="false">下载</button><button id="hasWatchBtn" aria-pressed="false">观看</button>', { url: "https://javdb.com/v/test" });
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("$", jqueryFactory(dom.window));
    window.isDetailPage = detail;
    let stored = { detailShortcuts: { favorite: { code: "KeyF", ctrl: true, alt: false, shift: false, meta: false } } };
    const settings = new SettingsService({ get: async () => stored, set: async (_, value) => { stored = value; } });
    await settings.load();
    const scope = new LifecycleScope("shortcuts");
    const modules = import.meta.glob("../src/plugins/status/*.js");
    expect(modules["../src/plugins/status/detail-shortcut.js"]).toBeTypeOf("function");
    const { DetailShortcutPlugin } = await modules["../src/plugins/status/detail-shortcut.js"]();
    const plugin = new DetailShortcutPlugin();
    plugin.runtimeServices = { settings, scope: async () => scope };
    beforeHandle(dom.window);
    await plugin.handle();
    const click = vi.fn();
    document.querySelector("#favoriteBtn").addEventListener("click", click);
    const press = (options = {}, target = document.body) => {
        const event = new dom.window.KeyboardEvent("keydown", { key: "f", code: "KeyF", ctrlKey: true, bubbles: true, cancelable: true, ...options });
        target.dispatchEvent(event);
        return event;
    };
    return { dom, plugin, settings, scope, click, press };
}

describe("详情鉴定快捷键", () => {
    it.each([true, false])("仅详情插件在 iframe 中启动时聚焦一次：detail=%s", async detail => {
        const focus = vi.fn();
        const { scope, dom } = await setup(detail, frameWindow => {
            Object.defineProperty(frameWindow, "parent", { value: {} });
            frameWindow.focus = focus;
        });
        expect(focus).toHaveBeenCalledTimes(detail ? 1 : 0);
        dom.window.dispatchEvent(new dom.window.Event("load"));
        expect(focus).toHaveBeenCalledTimes(detail ? 1 : 0);
        scope.dispose();
    });

    it("设置提供独立录制面板，插件管理归入详情页", () => {
        const dom = new JSDOM(buildSettingDialogHtml("shortcut-panel", []));
        expect(dom.window.document.querySelector('[data-panel="shortcut-panel"]')?.textContent).toBe("快捷键");
        expect(dom.window.document.querySelectorAll("#shortcut-panel [data-shortcut-action]")).toHaveLength(4);
        expect(getPluginCategories().categories.detail.plugins).toContain("DetailShortcutPlugin");
    });

    it("按配置精确匹配修饰键并复用按钮点击，键位显示不覆盖状态标签", async () => {
        const { scope, click, press } = await setup();
        expect(document.querySelector("#favoriteBtn kbd")?.textContent).toBe("Ctrl+F");
        expect(document.querySelector("#favoriteBtn span").textContent).toBe("收藏");
        const style = [...document.querySelectorAll("style")].find(element => element.textContent.includes(".jhs-shortcut-hint"));
        expect(style?.isConnected).toBe(true);
        const hintStyle = window.getComputedStyle(document.querySelector("#favoriteBtn kbd"));
        expect(hintStyle.fontSize).toBe("0.85em");
        expect(hintStyle.marginInlineStart).toBe("0.4em");
        expect(style.sheet.cssRules[0].style.getPropertyValue("font")).toBe("inherit");
        expect(press().defaultPrevented).toBe(true);
        expect(click).toHaveBeenCalledTimes(1);
        press({ shiftKey: true });
        press({ ctrlKey: false });
        expect(click).toHaveBeenCalledTimes(1);
        scope.dispose();
        press();
        expect(click).toHaveBeenCalledTimes(1);
        expect(document.querySelector("#favoriteBtn kbd")).toBeNull();
        expect(style.isConnected).toBe(false);
    });

    it("配置可切换为单键并实时更新提示，清空后停止触发", async () => {
        const { settings, scope, click, press } = await setup();
        await settings.set("detailShortcuts", { favorite: { code: "KeyF" } });
        expect(document.querySelector("#favoriteBtn kbd")?.textContent).toBe("F");
        press({ ctrlKey: false });
        expect(click).toHaveBeenCalledTimes(1);
        await settings.set("detailShortcuts", {});
        press({ ctrlKey: false });
        expect(click).toHaveBeenCalledTimes(1);
        expect(document.querySelector("#favoriteBtn kbd")).toBeNull();
        scope.dispose();
    });

    it("输入、弹窗、输入法、长按和禁用按钮均不触发", async () => {
        const { scope, click, press } = await setup();
        for (const html of ['<input>', '<textarea></textarea>', '<select></select>', '<div contenteditable="true"><span></span></div>']) {
            const wrapper = document.createElement("div");
            wrapper.innerHTML = html;
            document.body.append(wrapper);
            press({}, wrapper.querySelector("span") || wrapper.firstChild);
            wrapper.remove();
        }
        press({ repeat: true });
        press({ isComposing: true });
        const modal = document.createElement("div");
        modal.setAttribute("role", "dialog");
        document.body.append(modal);
        press();
        modal.remove();
        const favorite = document.querySelector("#favoriteBtn");
        favorite.removeAttribute("aria-pressed");
        press();
        favorite.setAttribute("aria-pressed", "false");
        favorite.disabled = true;
        press();
        expect(click).not.toHaveBeenCalled();
        scope.dispose();
    });

    it.each(['hidden', 'style="display:none"', 'style="visibility:hidden"'])("祖先 %s 隐藏的 dialog 不阻断快捷键", async (attribute) => {
        const { scope, click, press } = await setup();
        const wrapper = document.createElement("div");
        wrapper.innerHTML = `<section ${attribute}><div role="dialog"></div></section>`;
        document.body.append(wrapper);
        press();
        expect(click).toHaveBeenCalledTimes(1);
        scope.dispose();
    });

    it("录制器随 Scope 释放监听，释放后不再保存或渲染", async () => {
        const { settings, scope, dom } = await setup(false);
        const { bindShortcutRecorder } = await import("../src/ui/settings/shortcut-recorder.js");
        const root = $(buildSettingDialogHtml("shortcut-panel", []));
        document.body.append(root[0]);
        bindShortcutRecorder(root, settings, scope);
        expect(scope.snapshot().listeners).toBeGreaterThan(0);
        scope.dispose();
        const input = root.find('[data-shortcut-action="favorite"]');
        input[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { code: "KeyB", key: "b", bubbles: true }));
        root.find('[data-shortcut-clear="favorite"]').trigger("click");
        await settings.waitForIdle();
        expect(settings.snapshot().detailShortcuts.favorite.code).toBe("KeyF");
        await settings.set("detailShortcuts", {});
        expect(input.val()).toBe("Ctrl+F");
        expect(scope.snapshot().listeners).toBe(0);
    });

    it.each([JSON.stringify(["detail.shortcuts"]), JSON.stringify(["DetailShortcutPlugin"])])("禁用配置 %s 立即隐藏 tab，重新启用恢复", async (disabledPlugins) => {
        const { settings, scope } = await setup(false);
        const { bindShortcutRecorder } = await import("../src/ui/settings/shortcut-recorder.js");
        const root = $(buildSettingDialogHtml("shortcut-panel", []));
        document.body.append(root[0]);
        root.find('[data-panel="base-panel"]').on("click", function() {
            root.find(".side-menu-item").removeClass("active");
            $(this).addClass("active");
        });
        const dispose = bindShortcutRecorder(root, settings, scope);
        await settings.set("disabledPlugins", disabledPlugins);
        expect(root.find('[data-panel="shortcut-panel"]')[0].hidden).toBe(true);
        expect(root.find("#shortcut-panel")[0].hidden).toBe(true);
        expect(root.find('[data-panel="base-panel"]').hasClass("active")).toBe(true);
        await settings.set("disabledPlugins", "[]");
        expect(root.find('[data-panel="shortcut-panel"]')[0].hidden).toBe(false);
        dispose();
        scope.dispose();
    });

    it("列表页不注册详情快捷键，不显示键位", async () => {
        const { scope, click, press } = await setup(false);
        press();
        expect(click).not.toHaveBeenCalled();
        expect(scope.snapshot().listeners).toBe(0);
        expect(document.querySelector("kbd")).toBeNull();
        expect(document.querySelector("style")).toBeNull();
        scope.dispose();
    });

    it("录制组合键、拒绝重复、Escape 取消、清除并持久化，失败时保留旧值", async () => {
        const { settings, scope, dom } = await setup(false);
        const { bindShortcutRecorder } = await import("../src/ui/settings/shortcut-recorder.js");
        const root = jqueryFactory(dom.window)(buildSettingDialogHtml("shortcut-panel", []));
        document.body.append(root[0]);
        const dispose = bindShortcutRecorder(root, settings);
        const input = root.find('[data-shortcut-action="blocked"]');
        input.trigger("focus");
        input[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { code: "KeyB", key: "b", altKey: true, bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(settings.snapshot().detailShortcuts.blocked?.code).toBe("KeyB"));
        expect(input.val()).toBe("Alt+B");
        input[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { code: "KeyF", key: "f", ctrlKey: true, bubbles: true }));
        expect(root.find('[role="status"]').text()).toContain("已被");
        expect(input.val()).toBe("Alt+B");
        input[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true }));
        expect(input.val()).toBe("Alt+B");
        settings.storage.set = async () => { throw new Error("disk full"); };
        input[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { code: "KeyC", key: "c", bubbles: true }));
        await vi.waitFor(() => expect(root.find('[role="status"]').text()).toContain("保存失败"));
        expect(input.val()).toBe("Alt+B");
        settings.storage.set = async () => {};
        root.find('[data-shortcut-clear="blocked"]').trigger("click");
        await vi.waitFor(() => expect(input.val()).toBe(""));
        expect(settings.snapshot().detailShortcuts.blocked).toBeUndefined();
        dispose();
        scope.dispose();
    });
});
