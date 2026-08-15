import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function loadClipboard({ writeText, execResult = true } = {}) {
    const info = vi.fn(), error = vi.fn(), logError = vi.fn(), focus = vi.fn(), remove = vi.fn(), appendChild = vi.fn();
    const textarea = { value: "", style: {}, setAttribute: vi.fn(), select: vi.fn(), remove };
    const document = { body: { appendChild }, activeElement: { focus }, createElement: vi.fn(() => textarea), execCommand: vi.fn(() => execResult) };
    const context = vm.createContext({ URL, navigator: { clipboard: writeText ? { writeText } : null }, document, window: { location: new URL("https://javdb.com/"), innerWidth: 1280, innerHeight: 720 }, show: { info, error }, clog: { error: logError }, JHS_Z_INDEX: { layer: 1 }, i: (target, key, value) => (target[key] = value) });
    const source = readFileSync(join(import.meta.dirname, "../src/core/utils.js"), "utf8");
    vm.runInContext(`${source};globalThis.TestUtils=Utils`, context);
    return { utils: new context.TestUtils(), info, error, logError, document, textarea, focus };
}

describe("clipboard fallback", () => {
    it("uses the Clipboard API when available", async () => {
        const writeText = vi.fn().mockResolvedValue(), { utils, info, document } = loadClipboard({ writeText });
        await expect(utils.copyToClipboard("番号", "ABF-142")).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith("ABF-142"); expect(document.execCommand).not.toHaveBeenCalled(); expect(info).toHaveBeenCalledOnce();
    });
    it("falls back to a temporary textarea and restores focus", async () => {
        const writeText = vi.fn().mockRejectedValue(new Error("denied")), { utils, document, textarea, focus } = loadClipboard({ writeText });
        await expect(utils.copyToClipboard("番号", "ABF-142")).resolves.toBe(true);
        expect(document.execCommand).toHaveBeenCalledWith("copy"); expect(textarea.remove).toHaveBeenCalled(); expect(focus).toHaveBeenCalled();
    });
    it("reports one final failure", async () => {
        const { utils, error, logError } = loadClipboard({ execResult: false });
        await expect(utils.copyToClipboard("番号", "ABF-142")).resolves.toBe(false);
        expect(error).toHaveBeenCalledWith("复制失败，请手动复制"); expect(logError).toHaveBeenCalledOnce();
    });
});
