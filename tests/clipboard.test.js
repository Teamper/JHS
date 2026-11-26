import { createClipboardWriter } from "../src/platform/browser/file-actions.js";
import { afterEach, describe, expect, it, vi } from "vitest";

function loadClipboard({ writeText, execResult = true } = {}) {
    const info = vi.fn(), error = vi.fn(), logError = vi.fn(), focus = vi.fn(), remove = vi.fn(), appendChild = vi.fn();
    const textarea = { value: "", style: {}, setAttribute: vi.fn(), select: vi.fn(), remove };
    const document = { body: { append: appendChild }, activeElement: { focus }, createElement: vi.fn(() => textarea), execCommand: vi.fn(() => execResult) };
    vi.stubGlobal("navigator", { clipboard: writeText ? { writeText } : null });
    vi.stubGlobal("document", document);
    const copyToClipboard = createClipboardWriter({ info, error }, { error: logError });
    return { utils: { copyToClipboard }, info, error, logError, document, textarea, focus };
}

afterEach(() => vi.unstubAllGlobals());

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
