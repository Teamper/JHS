import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { SettingsService } from "../src/services/settings-service.js";
import { DETAIL_SHORTCUT_ACTIONS, readDetailShortcuts, shortcutFromEvent } from "../src/core/detail-shortcuts.js";
import { DetailShortcutController } from "../src/features/detail/detail-shortcut-controller.js";
import { bindShortcutRecorder } from "../src/ui/settings/shortcut-recorder.js";
import { buildSettingDialogHtml, resolveSettingPanel } from "../src/plugins/backup/setting-templates.js";
import detailManifest from "../src/features/detail/manifest.js";
import { compatibilityContributionCatalog } from "../src/features/compatibility/contribution-catalog.js";

const cleanups = [];
afterEach(() => { while (cleanups.length) cleanups.pop()(); vi.unstubAllGlobals(); });
const buttons = () => Object.values(DETAIL_SHORTCUT_ACTIONS).map(({id,label}) => `<button id="${id}" aria-pressed="false"><span>${label}</span></button>`).join("");

async function setup(shortcuts = { favorite: { code: "KeyF" } }) {
    const dom = new JSDOM(`<!doctype html><head></head><body><main>${buttons()}</main></body>`, { url: "https://javdb.com/v/test" });
    const document = dom.window.document, root = document.querySelector("main"), scope = new LifecycleScope("shortcuts-test");
    let stored = { detailShortcuts: shortcuts };
    const storage = { get: async () => stored, set: vi.fn(async (_, value) => { stored = value; }) };
    const settings = new SettingsService(storage);
    await settings.load();
    const controller = new DetailShortcutController({ root, settings, scope });
    controller.start();
    const click = vi.fn();
    root.querySelector("#favoriteBtn").addEventListener("click", click);
    const press = (options = {}, target = document.body) => {
        const event = new dom.window.KeyboardEvent("keydown", { key: "f", code: "KeyF", bubbles: true, cancelable: true, ...options });
        target.dispatchEvent(event);
        return event;
    };
    cleanups.push(() => { scope.dispose(); dom.window.close(); });
    return { dom, document, root, scope, storage, settings, controller, click, press };
}

describe("detail shortcut ownership", () => {
    it("is Feature-owned and FC2-eligible without starting the Detail Feature on lists", () => {
        expect(detailManifest.routes).not.toContain("list");
        expect(detailManifest.contributes).toContain("detail.shortcuts");
        expect(compatibilityContributionCatalog.find(item => item.id === "detail.shortcuts")).toMatchObject({ featureId: "detail", executionOwner: "feature", plugin: null, routes: ["list", "detail", "owned-detail"] });
        expect(resolveSettingPanel("shortcut-panel")).toEqual({ group: "browse-panel", section: "detail-shortcut-settings" });
    });

    it("normalizes partial modifiers and ignores malformed imported values", () => {
        expect(readDetailShortcuts({ favorite: { code: "KeyF" }, blocked: { code: "KeyB", ctrl: "false" }, watched: { code: "Tab" }, downloaded: { code: "ControlLeft" }, other: { code: "KeyA" } })).toEqual({ favorite: { code: "KeyF", ctrl: false, alt: false, shift: false, meta: false } });
        for (const value of [null, [], "invalid"]) expect(readDetailShortcuts(value)).toEqual({});
    });

    it("uses exact modifiers, preserves state labels and refreshes or clears hints", async () => {
        const { root, settings, click, press, scope, controller } = await setup({ favorite: { code: "KeyF", ctrl: true } });
        expect(root.querySelector("#favoriteBtn span").textContent).toBe("收藏");
        expect(root.querySelector("#favoriteBtn").getAttribute("aria-keyshortcuts")).toBe("Control+F");
        press(); press({ ctrlKey: true, shiftKey: true });
        expect(click).not.toHaveBeenCalled();
        expect(press({ ctrlKey: true }).defaultPrevented).toBe(true);
        expect(click).toHaveBeenCalledTimes(1);
        await settings.set("detailShortcuts", { favorite: { code: "KeyF" } });
        expect(root.querySelector("kbd").textContent).toBe("F");
        press();
        expect(click).toHaveBeenCalledTimes(2);
        await settings.set("detailShortcuts", {});
        press();
        expect(click).toHaveBeenCalledTimes(2);
        expect(root.querySelector("kbd")).toBeNull();
        await settings.storage.set("setting", { detailShortcuts: { favorite: { code: "KeyZ" } } });
        await settings.refresh();
        expect(root.querySelector("kbd").textContent).toBe("Z");
        scope.dispose();
        expect(controller.scope.snapshot().listeners).toBe(0);
    });

    it.each(['<input>', '<textarea></textarea>', '<select></select>', '<div contenteditable><span></span></div>', '<div role="textbox"></div>', '<video controls></video>', '<audio controls></audio>'])("does not consume keys in %s", async html => {
        const { root, press, click } = await setup();
        root.insertAdjacentHTML("beforeend", html);
        const target = root.lastElementChild.querySelector("span") || root.lastElementChild;
        expect(press({}, target).defaultPrevented).toBe(false);
        expect(click).not.toHaveBeenCalled();
    });

    it("ignores composition, repeat, consumed events, full screen and duplicate imported assignments", async () => {
        const { dom, document, root, settings, press, click } = await setup();
        press({ repeat: true }); press({ isComposing: true }); press({ keyCode: 229 });
        const event = new dom.window.KeyboardEvent("keydown", { code: "KeyF", bubbles: true, cancelable: true });
        event.preventDefault(); document.body.dispatchEvent(event);
        Object.defineProperty(document, "fullscreenElement", { configurable: true, value: root });
        press();
        Object.defineProperty(document, "fullscreenElement", { value: null });
        await settings.set("detailShortcuts", { favorite: { code: "KeyF" }, watched: { code: "KeyF" } });
        press();
        expect(click).not.toHaveBeenCalled();
        expect(shortcutFromEvent(new dom.window.KeyboardEvent("keydown", { code: "Escape" }))).toBeNull();
    });

    it.each(["Space", "Enter"])("preserves native %s activation on focused controls", async code => {
        const { root, press, click } = await setup({ favorite: { code } });
        const button = root.querySelector("#filterBtn");
        button.focus();
        expect(press({ code }, button).defaultPrevented).toBe(false);
        expect(click).not.toHaveBeenCalled();
        button.blur();
        press({ code });
        expect(click).toHaveBeenCalledTimes(1);
    });

    it.each(['<div class="layui-layer"></div>', '<div role="dialog"></div>', '<div class="viewer-container"></div>', '<div class="bus-preview-modal is-open"></div>', '<div class="jhs-owned-popover is-open"></div>', '<div role="menu"></div>', '<div class="loading-container"></div>'])("blocks behind overlay %s and resumes after removal", async html => {
        const { document, press, click } = await setup();
        document.body.insertAdjacentHTML("beforeend", html);
        const overlay = document.body.lastElementChild;
        expect(press().defaultPrevented).toBe(false);
        expect(click).not.toHaveBeenCalled();
        overlay.remove(); press();
        expect(click).toHaveBeenCalledTimes(1);
    });

    it("does not let hidden reusable overlays block keys or hidden buttons receive them", async () => {
        const { root, document, press, click } = await setup();
        document.body.insertAdjacentHTML("beforeend", '<section hidden><div role="dialog"></div></section><div class="bus-preview-modal" style="visibility:hidden"></div>');
        press();
        root.querySelector("#favoriteBtn").disabled = true; press();
        root.querySelector("#favoriteBtn").disabled = false;
        root.setAttribute("hidden", ""); press();
        expect(click).toHaveBeenCalledTimes(1);
    });

    it("allows only the top FC2 detail layer and never clicks a duplicate id in another instance", async () => {
        const { dom, document, root, scope, settings, click, press } = await setup();
        const lower = document.createElement("div");
        lower.className = "layui-layer"; lower.style.zIndex = "10";
        root.before(lower); lower.append(root);
        const upper = document.createElement("div");
        upper.className = "layui-layer"; upper.style.zIndex = "20";
        upper.innerHTML = `<section>${buttons()}</section>`; document.body.append(upper);
        const childScope = new LifecycleScope("fc2-test");
        const child = new DetailShortcutController({ root: upper.firstElementChild, scope: childScope, settings });
        child.start();
        const upperClick = vi.fn(); upper.querySelector("#favoriteBtn").addEventListener("click", upperClick);
        press();
        expect(click).not.toHaveBeenCalled(); expect(upperClick).toHaveBeenCalledOnce();
        childScope.dispose(); upper.remove(); press();
        expect(click).toHaveBeenCalledOnce();
        scope.dispose(); press();
        expect(click).toHaveBeenCalledOnce(); expect(root.querySelector("kbd")).toBeNull();
    });

    it.each([false, true])("focuses only an owned frame without intervening interaction: %s", async interacted => {
        const { dom, document, scope, settings } = await setup();
        document.body.innerHTML = '<button>opener</button><div class="jhs-dialog layui-layer"><iframe></iframe></div>';
        const frame = document.querySelector("iframe"), frameDoc = frame.contentDocument;
        frameDoc.body.innerHTML = `<main>${buttons()}</main>`;
        const controller = new DetailShortcutController({ root: frameDoc.querySelector("main"), scope, settings });
        controller.start();
        let ready;
        const focus = vi.spyOn(frame.contentWindow, "focus").mockImplementation(() => {});
        controller.prepareFrameFocus({ on: (_name, callback) => { ready = callback; return () => {}; } });
        if (interacted) document.dispatchEvent(new dom.window.Event("pointerdown"));
        ready();
        expect(focus).toHaveBeenCalledTimes(interacted ? 0 : 1);
        document.body.insertAdjacentHTML("beforeend", '<div role="dialog"></div>');
        frameDoc.body.dispatchEvent(new frame.contentWindow.KeyboardEvent("keydown", { code: "KeyF", bubbles: true, cancelable: true }));
        expect(controller.canHandle()).toBe(false);
    });
});

describe("shortcut recorder", () => {
    it("does not render or accept more keys after disposal while a write is pending", async () => {
        const { document, settings, storage, scope, press } = await setup({});
        vi.stubGlobal("document", document);
        document.body.insertAdjacentHTML("beforeend", buildSettingDialogHtml("browse-panel", []));
        const root = document.body;
        bindShortcutRecorder({ root, settings, scope, onManage: vi.fn() });
        const input = root.querySelector('[data-shortcut-action="favorite"]');
        let complete;
        const originalSet = storage.set;
        storage.set = vi.fn((key, value) => new Promise(resolve => { complete = async () => { await originalSet(key, value); resolve(); }; }));
        press({ code: "KeyA" }, input);
        await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
        scope.dispose();
        input.value = "closed";
        const status = root.querySelector('[data-shortcut-status="favorite"]');
        status.textContent = "closed";
        press({ code: "KeyC" }, input);
        await complete(); await settings.waitForIdle();
        expect(settings.snapshot().detailShortcuts.favorite.code).toBe("KeyA");
        expect(input.value).toBe("closed"); expect(status.textContent).toBe("closed");
        expect(storage.set).toHaveBeenCalledOnce();
    });
    it("records, rejects conflicts, exits without closing its dialog, clears and preserves persisted values on error", async () => {
        const { dom, document, settings, storage, scope, press } = await setup({});
        vi.stubGlobal("document", document);
        document.body.insertAdjacentHTML("beforeend", buildSettingDialogHtml("browse-panel", []));
        const root = document.querySelector(".jhs-settings") || document.body;
        bindShortcutRecorder({ root, settings, scope, onManage: vi.fn() });
        const input = root.querySelector('[data-shortcut-action="favorite"]');
        press({ code: "KeyB", altKey: true }, input);
        await settings.waitForIdle();
        expect(input.value).toBe("Alt+B");
        const blocked = root.querySelector('[data-shortcut-action="blocked"]');
        press({ code: "KeyB", altKey: true }, blocked);
        await vi.waitFor(() => expect(root.querySelector('[data-shortcut-status="blocked"]').textContent).toContain("已被"));
        expect(blocked.value).toBe("");
        await settings.set("privacyShortcut", { code: "KeyP" });
        press({ code: "KeyP" }, blocked);
        await vi.waitFor(() => expect(root.querySelector('[data-shortcut-status="blocked"]').textContent).toContain("隐私遮罩"));
        expect(blocked.value).toBe("");
        const escape = press({ key: "Escape", code: "Escape" }, input);
        expect(escape.defaultPrevented).toBe(true); expect(input.isConnected).toBe(true);
        expect(press({ key: "Tab", code: "Tab" }, input).defaultPrevented).toBe(false);
        storage.set.mockRejectedValueOnce(new Error("disk full"));
        press({ code: "KeyC" }, input);
        await vi.waitFor(() => expect(root.querySelector('[data-shortcut-status="favorite"]').textContent).toContain("保存失败"));
        expect(input.value).toBe("Alt+B");
        root.querySelector('[data-shortcut-clear="favorite"]').click();
        await settings.waitForIdle(); expect(input.value).toBe("");
        await settings.set("disabledPlugins", '["detail.shortcuts"]');
        expect(input.disabled).toBe(true); expect(root.querySelector('[data-shortcut-disabled]').hidden).toBe(false);
        expect(root.querySelector("#detail-shortcut-settings")).not.toBeNull();
        await settings.set("disabledPlugins", "[]");
        expect(input.disabled).toBe(false);
        scope.dispose(); input.value = "closed";
        await settings.set("detailShortcuts", { favorite: { code: "KeyC" } });
        expect(input.value).toBe("closed");
    });
});
