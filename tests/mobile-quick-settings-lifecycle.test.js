import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { SettingPlugin } from "../src/features/settings/settings-controller.js";
import { SettingsRegistry } from "../src/app/settings-registry.js";
import { registerDefaultSettings } from "../src/app/settings-catalog.js";
import { SettingsService } from "../src/services/settings-service.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { acquirePageScrollLock } from "../src/core/page-scroll-lock.js";

const harnesses = [];

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

async function createHarness() {
    const dom = new JSDOM('<!doctype html><html><body><button id="opener">设置</button></body></html>', { url: "https://javdb.com/" });
    const jq = jqueryFactory(dom.window);
    const settings = new SettingsService({ get: async () => ({}), set: async () => {} });
    await settings.load();
    const registry = new SettingsRegistry();
    registerDefaultSettings(registry);
    const scope = new LifecycleScope("settings-test-owner");
    const notifications = { error: vi.fn() };
    const logger = { lowZIndex: vi.fn(), error: vi.fn() };
    vi.stubGlobal("$", jq);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("Element", dom.window.Element);
    vi.stubGlobal("storageManager", {});
    const plugin = new SettingPlugin({
        runtimeServices: { settings, settingsRegistry: registry, host: { getListSelectors: () => ({}) } },
        capabilities: {}, jquery: jq, utilities: {}, notifications, logger,
        events: {}, document: dom.window.document, window: dom.window,
    });
    plugin._settingScope = scope;
    plugin.openSettingDialog = vi.fn(async () => {});
    const opener = dom.window.document.getElementById("opener");
    opener.focus();
    const harness = { dom, jq, settings, plugin, scope, opener, notifications, logger };
    harnesses.push(harness);
    return harness;
}

function press(dom, key, options = {}) {
    const event = new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
    dom.window.document.activeElement.dispatchEvent(event);
    return event;
}

afterEach(() => {
    for (const { plugin, scope, dom } of harnesses.splice(0)) {
        plugin.disposeQuickSettings();
        scope.dispose();
        dom.window.close();
    }
    vi.unstubAllGlobals();
});

describe("mobile quick settings instance ownership", () => {
    it("disposes the replaced binding and listeners without closing the new sheet", async () => {
        const { plugin, jq, scope, dom, opener, settings } = await createHarness();
        const removeSettingsListener = vi.spyOn(settings, "removeEventListener");
        await plugin.openQuickSetting();
        const first = plugin._quickSettingInstance;
        const oldSheet = jq("#jhs-quick-setting-sheet")[0];
        const oldRoot = jq(oldSheet).find(".jhs-quick-setting");
        const disposeBinding = vi.spyOn(oldRoot.data("jhsQuickSettingBinding"), "dispose");

        await plugin.openQuickSetting();
        expect(disposeBinding).toHaveBeenCalledOnce();
        expect(oldRoot.data("jhsQuickSettingBinding")).toBeUndefined();
        expect(first.scope.snapshot().listeners).toBe(0);
        expect(oldSheet.isConnected).toBe(false);
        expect(jq("#jhs-quick-setting-sheet")).toHaveLength(1);
        expect(scope.cleanups.size).toBe(1);
        expect(dom.window.document.body.style.overflow).toBe("hidden");

        first.close();
        expect(jq("#jhs-quick-setting-sheet")).toHaveLength(1);
        const second = plugin._quickSettingInstance;
        expect(press(dom, "Escape").defaultPrevented).toBe(true);
        expect(jq("#jhs-quick-setting-sheet")).toHaveLength(0);
        expect(second.scope.snapshot().listeners).toBe(0);
        expect(scope.cleanups.size).toBe(0);
        expect(removeSettingsListener.mock.calls.filter(([type]) => type === "settings.changed")).toHaveLength(2);
        expect(dom.window.document.body.style.overflow).toBe("");
        expect(dom.window.document.activeElement).toBe(opener);
    });

    it("ignores an older idle response after the newer opening has mounted", async () => {
        const { plugin, settings, jq } = await createHarness();
        const oldIdle = deferred(), newIdle = deferred();
        vi.spyOn(settings, "waitForIdle").mockImplementationOnce(() => oldIdle.promise).mockImplementationOnce(() => newIdle.promise);
        const oldOpen = plugin.openQuickSetting();
        const first = plugin._quickSettingInstance;
        const newOpen = plugin.openQuickSetting();
        newIdle.resolve();
        await newOpen;
        const newSheet = jq("#jhs-quick-setting-sheet")[0];
        oldIdle.resolve();
        await oldOpen;

        expect(first.scope.snapshot().listeners).toBe(0);
        expect(jq("#jhs-quick-setting-sheet")).toHaveLength(1);
        expect(jq("#jhs-quick-setting-sheet")[0]).toBe(newSheet);
        expect(jq(newSheet).find(".jhs-quick-setting").data("jhsQuickSettingBinding")).toBeTruthy();
    });

    it("allows Escape while loading and never mounts the canceled response", async () => {
        const { plugin, settings, jq, dom, scope } = await createHarness();
        const idle = deferred();
        vi.spyOn(settings, "waitForIdle").mockReturnValueOnce(idle.promise);
        const opening = plugin.openQuickSetting();
        const instance = plugin._quickSettingInstance;
        press(dom, "Escape");
        idle.resolve();
        await opening;

        expect(plugin._quickSettingInstance).toBeNull();
        expect(instance.scope.snapshot().listeners).toBe(0);
        expect(scope.cleanups.size).toBe(0);
        expect(jq("#jhs-quick-setting-sheet, #jhs-quick-setting-backdrop")).toHaveLength(0);
    });

    it("cancels pending opens on explicit disposal and on feature teardown", async () => {
        const { plugin, settings, jq, scope } = await createHarness();
        const firstIdle = deferred(), secondIdle = deferred();
        vi.spyOn(settings, "waitForIdle").mockReturnValueOnce(firstIdle.promise).mockReturnValueOnce(secondIdle.promise);
        const firstOpen = plugin.openQuickSetting();
        plugin.disposeQuickSettings();
        firstIdle.resolve();
        await firstOpen;
        expect(jq("#jhs-quick-setting-sheet")).toHaveLength(0);

        const secondOpen = plugin.openQuickSetting();
        scope.dispose();
        secondIdle.resolve();
        await secondOpen;
        await plugin.openQuickSetting();
        expect(jq("#jhs-quick-setting-sheet")).toHaveLength(0);
        expect(plugin._quickSettingInstance).toBeNull();
    });

    it("does not let a closed form's late flush open full settings or touch its replacement", async () => {
        const { plugin, jq } = await createHarness();
        await plugin.openQuickSetting();
        const flush = deferred();
        jq("#jhs-quick-setting-sheet .jhs-quick-setting").data("jhsQuickSettingBinding").flush = vi.fn(() => flush.promise);
        jq("#jhs-quick-setting-sheet #moreBtn").trigger("click");
        await plugin.openQuickSetting();
        const replacement = jq("#jhs-quick-setting-sheet")[0];
        flush.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(plugin.openSettingDialog).not.toHaveBeenCalled();
        expect(replacement.isConnected).toBe(true);
        expect(jq("#jhs-quick-setting-sheet")[0]).toBe(replacement);
    });

    it("releases only its own scroll lock and disposes bindings on close", async () => {
        const { plugin, jq, dom } = await createHarness();
        dom.window.document.body.style.overflowY = "scroll";
        const releaseOther = acquirePageScrollLock(dom.window.document);
        await plugin.openQuickSetting();
        const instance = plugin._quickSettingInstance;
        const root = jq("#jhs-quick-setting-sheet .jhs-quick-setting");
        const dispose = vi.spyOn(root.data("jhsQuickSettingBinding"), "dispose");
        jq("#jhs-quick-setting-sheet .jhs-quick-setting__close").trigger("click");
        instance.close();
        expect(dispose).toHaveBeenCalledOnce();
        expect(dom.window.document.body.style.overflow).toBe("hidden");
        releaseOther();
        expect(dom.window.document.body.style.overflow).toBe("");
        expect(dom.window.document.body.style.overflowY).toBe("scroll");
    });

    it("wraps keyboard focus in the sheet and restores the opener after backdrop dismissal", async () => {
        const { plugin, jq, dom, opener } = await createHarness();
        await plugin.openQuickSetting();
        const close = jq("#jhs-quick-setting-sheet .jhs-quick-setting__close")[0];
        const more = jq("#jhs-quick-setting-sheet #moreBtn")[0];
        expect(dom.window.document.activeElement).toBe(close);
        expect(press(dom, "Tab", { shiftKey: true }).defaultPrevented).toBe(true);
        expect(dom.window.document.activeElement).toBe(more);
        expect(press(dom, "Tab").defaultPrevented).toBe(true);
        expect(dom.window.document.activeElement).toBe(close);
        jq("#jhs-quick-setting-backdrop").trigger("click");
        expect(dom.window.document.activeElement).toBe(opener);
    });

    it("consumes Escape before an existing parent dialog listener", async () => {
        const { plugin, dom } = await createHarness();
        const parentClose = vi.fn();
        dom.window.document.addEventListener("keydown", event => {
            if (event.key === "Escape" && !event.defaultPrevented) parentClose();
        });
        await plugin.openQuickSetting();
        press(dom, "Escape");
        expect(parentClose).not.toHaveBeenCalled();
    });

    it("disposes an already mounted sheet when its feature owner stops", async () => {
        const { plugin, jq, dom, scope } = await createHarness();
        await plugin.openQuickSetting();
        const instance = plugin._quickSettingInstance;
        const dispose = vi.spyOn(jq(".jhs-quick-setting").data("jhsQuickSettingBinding"), "dispose");
        scope.dispose();
        expect(dispose).toHaveBeenCalledOnce();
        expect(instance.scope.snapshot().listeners).toBe(0);
        expect(jq("#jhs-quick-setting-sheet, #jhs-quick-setting-backdrop")).toHaveLength(0);
        expect(dom.window.document.body.style.overflow).toBe("");
    });

    it("keeps full settings' caller-owned focus while closing its mobile sheet", async () => {
        const { plugin, jq, dom } = await createHarness();
        await plugin.openQuickSetting();
        const open = vi.fn();
        plugin.runtimeServices.dialog = { open };
        plugin.utils.getDialogArea = () => ["720px", "700px"];
        await SettingPlugin.prototype.openSettingDialog.call(plugin);
        expect(open).toHaveBeenCalledOnce();
        expect(open.mock.calls[0][0].ui).toEqual({ size: "lg", body: "scroll", focus: "caller" });
        expect(jq("#jhs-quick-setting-sheet")).toHaveLength(0);
        expect(dom.window.document.body.style.overflow).toBe("");
    });

    it("cleans failed loading and does not report a canceled stale failure", async () => {
        const { plugin, settings, jq, scope, notifications } = await createHarness();
        vi.spyOn(settings, "waitForIdle").mockRejectedValueOnce(new Error("load failed"));
        await plugin.openQuickSetting();
        expect(notifications.error).toHaveBeenCalledOnce();
        expect(scope.cleanups.size).toBe(0);
        expect(jq("#jhs-quick-setting-sheet")).toHaveLength(0);

        const idle = deferred();
        settings.waitForIdle.mockReturnValueOnce(idle.promise);
        const stale = plugin.openQuickSetting();
        plugin.disposeQuickSettings();
        idle.reject(new Error("stale load failed"));
        await stale;
        expect(notifications.error).toHaveBeenCalledOnce();
    });
});
