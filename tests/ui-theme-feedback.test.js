import { execFileSync } from "node:child_process";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildThemeCss } from "../src/core/theme.js";
import { buildUiPrimitivesCss } from "../src/core/ui-primitives.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

let scope, dom;

async function createRuntime() {
    vi.resetModules();
    dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { url: "https://javdb.com/" });
    Object.defineProperty(dom.window.document, "readyState", { value: "complete", configurable: true });
    dom.window.matchMedia = () => ({ matches: false });
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("localStorage", dom.window.localStorage);
    vi.stubGlobal("unsafeWindow", dom.window);
    const toastify = vi.fn(options => {
        const toastElement = document.createElement("div");
        toastElement.className = `toastify ${options.className}`;
        toastElement.appendChild(options.node);
        if (options.close) { const close = document.createElement("button"); close.className = "toast-close"; toastElement.appendChild(close); }
        return { toastElement, showToast() { document.body.appendChild(toastElement); } };
    });
    scope = new LifecycleScope("test-feedback");
    const { initializeLoggerRuntime } = await import("../src/core/logger.js");
    return { runtime: initializeLoggerRuntime(scope, { vendors: { Toastify: toastify } }), toastify };
}

afterEach(() => {
    scope?.dispose();
    dom?.window.close();
    scope = null; dom = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("theme and feedback contracts", () => {
    it("checks inherited token aliases and active input boundaries in both themes", () => {
        expect(execFileSync(process.execPath, ["scripts/contrast-audit.mjs"], { encoding: "utf8" })).toContain("active text >= 4.5, boundary >= 3; disabled controls exempt");
        const theme = buildThemeCss();
        expect(theme).toContain("--jhs-text-faint: var(--jhs-text-muted)");
        expect(theme).toContain("--jhs-disabled-text: var(--jhs-text-disabled)");
        expect(theme).not.toContain('.jhs-icon path');
    });

    it("gives unclassed native fields the touch minimum without shrinking textareas", () => {
        const css = buildUiPrimitivesCss(), touchRules = css.slice(css.lastIndexOf("@media (max-width:767px), (pointer:coarse)"));
        expect(touchRules).toMatch(/:where\(\.jhs-ui, \.jhs-dialog \.layui-layer-content\) input:not\(/);
        expect(touchRules).toContain('select,');
        expect(touchRules).toMatch(/textarea\):not\(textarea\),[\s\S]*min-height:var\(--jhs-touch-target\)/);
        expect(css).toMatch(/:where\(\.jhs-textarea,[^}]*min-height: 76px/);
    });

    it.each([
        ["ok", "success", 3000, false, "circle-check", "status"],
        ["info", "info", 3000, false, "info", "status"],
        ["error", "error", 5000, true, "triangle-alert", "alert"],
    ])("renders %s feedback with its default lifetime and semantic icon", async (method, severity, duration, close, icon, role) => {
        const { runtime, toastify } = await createRuntime();
        const result = runtime.show[method]("已保存");
        const options = toastify.mock.calls[0][0];
        expect(options).toMatchObject({ duration, close });
        expect(options.className).toContain(`jhs-toast--${severity}`);
        expect(options.node.querySelector(`[data-jhs-icon="${icon}"]`)).toBeTruthy();
        expect(result.toastElement.getAttribute("role")).toBe(role);
        if (close) expect(result.toastElement.querySelector(".toast-close").getAttribute("aria-label")).toBe("关闭提示");
        result.closeShow();
        expect(document.querySelector(".toastify")).toBeNull();
    });

    it("retains caller options and renders external-looking text as text", async () => {
        const { runtime, toastify } = await createRuntime();
        const message = '<img src="x" onerror="alert(1)">';
        runtime.show.error(message, { duration: 12000, close: false, gravity: "bottom", position: "left", className: "custom-toast" });
        const options = toastify.mock.calls[0][0];
        expect(options).toMatchObject({ duration: 12000, close: false, gravity: "bottom", position: "left" });
        expect(options.className).toContain("custom-toast");
        expect(options.node.querySelector("img")).toBeNull();
        expect(options.node.querySelector(".jhs-toast__message").textContent).toBe(message);
        runtime.show.info("持续提示", "bottom", "right", { duration: -1 });
        expect(toastify.mock.calls[1][0]).toMatchObject({ duration: -1, close: true, gravity: "bottom", position: "right" });
    });

    it("keeps loading closure and logger expand, maximize and filter behavior", async () => {
        const { runtime } = await createRuntime();
        const loading = runtime.loading();
        expect(document.querySelector(".loading-container").getAttribute("aria-busy")).toBe("true");
        loading.close();
        expect(document.querySelector(".loading-container")).toBeNull();
        const logger = runtime.clog;
        logger.show(); logger.toggleExpandCollapsed();
        expect(logger.toggleBtn.getAttribute("aria-expanded")).toBe("true");
        logger.toggleMaximize();
        expect(logger.maximizeBtn.querySelector('[data-jhs-icon="minimize-2"]')).toBeTruthy();
        expect(localStorage.getItem("jhs_clog_maximize")).toBe("maximized");
        logger.addLog("普通信息", "base"); logger.addLog("失败信息", "error"); logger.setFilter("error");
        await new Promise(resolve => setTimeout(resolve, 5));
        expect(logger.content.textContent).toContain("失败信息");
        expect(logger.content.textContent).not.toContain("普通信息");
        expect(logger.content.querySelector('[data-type="error"]').style.borderLeft).toBe("");
        logger.clear(); expect(logger.content.textContent).toBe("");
    });
});
