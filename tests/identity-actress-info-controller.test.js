// @vitest-environment jsdom

import jquery from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { IdentityActressInfoController } from "../src/features/identity/identity-actress-info-controller.js";

const $ = jquery;

function createSettings(snapshot) {
    return {
        snapshot: () => snapshot,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    };
}

describe("IdentityActressInfoController", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.replaceChildren();
        window.history.replaceState({}, "", "/");
    });

    it("owns the style and settings listener through the feature scope", async () => {
        const scope = new LifecycleScope("feature:identity");
        const settings = createSettings({ enableLoadActressInfo: "no" });
        const removeStyle = vi.fn();
        const controller = new IdentityActressInfoController({
            hostAdapter: { site: "javdb", document },
            settings,
            actressInfo: {},
            styles: { register: vi.fn(() => removeStyle) },
            ui: { getJQuery: () => $, getClog: () => ({}) },
            scope,
        });

        await controller.start();
        expect(controller.started).toBe(true);
        expect(settings.addEventListener).toHaveBeenCalledWith("settings.changed", expect.any(Function), undefined);
        scope.dispose();
        expect(settings.removeEventListener).toHaveBeenCalledWith("settings.changed", expect.any(Function), undefined);
        expect(removeStyle).toHaveBeenCalledOnce();
        expect(controller.started).toBe(false);
    });

    it("OFF 时不挂载但仍删除自己创建的面板", async () => {
        const scope = new LifecycleScope("feature:identity");
        const controller = new IdentityActressInfoController({
            hostAdapter: { site: "javdb", document },
            settings: createSettings({ enableLoadActressInfo: "no" }),
            actressInfo: {},
            ui: { getJQuery: () => $, getClog: () => ({}) },
            scope,
        });
        $("body").append('<div class="actress-info">旧节点</div>');

        await controller.mount();
        expect($(".actress-info")).toHaveLength(1);
        controller.unmount();
        expect($(".actress-info")).toHaveLength(0);
        scope.dispose();
    });

    it("查询中切 OFF 后异步返回不再 append", async () => {
        window.history.replaceState({}, "", "/v/test-id");
        let resolveInfo;
        const pending = new Promise((resolve) => { resolveInfo = resolve; });
        const settings = createSettings({ enableLoadActressInfo: "yes" });
        const scope = new LifecycleScope("feature:identity");
        const controller = new IdentityActressInfoController({
            hostAdapter: { site: "javdb", document },
            settings,
            actressInfo: { lookup: vi.fn(() => pending), profileUrl: vi.fn(() => "") },
            ui: { getJQuery: () => $, getClog: () => ({}) },
            scope,
        });
        $("body").append('<div>女優A</div><a class="female"></a><div><strong>演員</strong></div>');

        const mountPromise = controller.mount();
        await Promise.resolve();
        controller.unmount();
        expect($(".actress-info")).toHaveLength(0);
        resolveInfo({ url: "https://example.test", birthday: "1990-01-01", age: "30", height: "160", weight: "45", threeSizeText: "B", braSize: "B70" });
        await mountPromise;
        expect($(".actress-info")).toHaveLength(0);
        scope.dispose();
    });
});
