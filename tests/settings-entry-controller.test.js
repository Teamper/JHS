import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { SettingsEntryController } from "../src/features/system/settings-entry-controller.js";

afterEach(() => vi.unstubAllGlobals());

describe("SettingsEntryController", () => {
    it("routes stable desktop entry clicks through the lazy command and closes quick surfaces", async () => {
        const dom = new JSDOM('<body><button id="setting-btn"><span>设置</span></button><button id="mini-setting-btn"></button><button id="other"></button></body>');
        const closeQuickSettings = vi.fn(), lowZIndex = vi.fn(), executeCommand = vi.fn(async () => "opened"), onError = vi.fn();
        const scope = new LifecycleScope("feature:settings-entry");
        const initializeSurface = vi.fn();
        const controller = new SettingsEntryController({ document: dom.window.document, scope, initializeSurface, closeQuickSettings, lowZIndex, executeCommand, onError });
        controller.start();
        expect(initializeSurface).not.toHaveBeenCalled();
        await Promise.resolve();
        expect(initializeSurface).toHaveBeenCalledOnce();

        const nested = dom.window.document.querySelector("#setting-btn span");
        nested.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(executeCommand).toHaveBeenCalledOnce());
        expect(closeQuickSettings).toHaveBeenCalledOnce();
        expect(lowZIndex).toHaveBeenCalledOnce();
        expect(executeCommand).toHaveBeenCalledExactlyOnceWith("settings.open");
        expect(onError).not.toHaveBeenCalled();

        scope.dispose();
        dom.window.document.querySelector("#mini-setting-btn").click();
        expect(executeCommand).toHaveBeenCalledOnce();
        dom.window.close();
    });

    it("isolates cleanup errors and reports a failed lazy settings command", async () => {
        const dom = new JSDOM('<body><button id="setting-btn"></button></body>');
        const error = new Error("settings command failed"), onError = vi.fn();
        const scope = new LifecycleScope("feature:settings-entry-errors");
        const controller = new SettingsEntryController({
            document: dom.window.document, scope, initializeSurface: vi.fn(), closeQuickSettings: () => { throw new Error("popover cleanup failed"); },
            lowZIndex: vi.fn(), executeCommand: vi.fn(async () => { throw error; }), onError,
        });
        controller.start();

        dom.window.document.querySelector("#setting-btn").click();
        await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
        expect(onError).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: "popover cleanup failed" }));
        expect(onError).toHaveBeenNthCalledWith(2, error);
        scope.dispose();
        dom.window.close();
    });

    it("does not mount its surface when disposed before the deferred startup slot", async () => {
        const dom = new JSDOM("<body></body>"), scope = new LifecycleScope("feature:settings-entry-deferred");
        const initializeSurface = vi.fn(), onError = vi.fn();
        const controller = new SettingsEntryController({
            document: dom.window.document, scope, initializeSurface, closeQuickSettings: vi.fn(), lowZIndex: vi.fn(),
            executeCommand: vi.fn(async () => undefined), onError,
        });
        controller.start();
        scope.dispose();
        await Promise.resolve();
        expect(initializeSurface).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        dom.window.close();
    });
});
