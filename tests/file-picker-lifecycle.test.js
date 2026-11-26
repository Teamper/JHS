// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { importSettingData } from "../src/features/settings/setting-backup.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
describe("temporary backup picker", () => {
    it.each(["reading", "exporting"])("ignores a late file callback after owner disposal while %s", async stage => {
        const parent = new LifecycleScope("picker-owner"), preview = vi.fn(), diffData = vi.fn(), close = vi.fn(), error = vi.fn();
        let finishExport;
        const exportData = vi.fn(() => new Promise(resolve => { finishExport = resolve; }));
        const reader = { result: '{"records":[]}', readyState: stage === "reading" ? 1 : 2, readAsText: vi.fn(), abort: vi.fn(), onload: null, onerror: null };
        vi.spyOn(window, "FileReader").mockImplementation(function () { return reader; });
        vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
        await importSettingData(preview, { document, window, jquery, getScope: async () => parent, backup: { exportData, diffData }, domUi: { loading: () => ({ close }) }, notifications: { error }, logger: { error: vi.fn() } });
        const input = document.querySelector('input[type="file"]');
        Object.defineProperty(input, "files", { value: [new File(['{}'], "backup.json")] }); input.dispatchEvent(new Event("change"));
        expect(input.isConnected).toBe(false);
        const callback = reader.onload, pending = stage === "exporting" ? callback({ currentTarget: reader }) : null;
        parent.dispose();
        if (stage === "reading") { expect(reader.abort).toHaveBeenCalledOnce(); await callback({ currentTarget: reader }); expect(exportData).not.toHaveBeenCalled(); }
        else { expect(close).toHaveBeenCalledOnce(); finishExport({ records: [] }); await pending; expect(close).toHaveBeenCalledOnce(); }
        expect(reader.onload).toBeNull(); expect(preview).not.toHaveBeenCalled(); expect(diffData).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
    });
    it.each(["cancel", "pagehide", "owner disposal"])("cleans its hidden input on %s without writing", async reason => {
        const parent = new LifecycleScope("picker-owner"), preview = vi.fn(), exportData = vi.fn(), diffData = vi.fn();
        vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
        await importSettingData(preview, { document, window, jquery, getScope: async () => parent, backup: { exportData, diffData }, domUi: {}, notifications: { error: vi.fn() }, logger: { error: vi.fn() } });
        const input = document.querySelector('input[type="file"]'); expect(input.hidden).toBe(true);
        if (reason === "cancel") input.dispatchEvent(new Event("cancel"));
        else if (reason === "pagehide") window.dispatchEvent(new Event("pagehide"));
        else parent.dispose();
        expect(document.querySelector('input[type="file"]')).toBeNull(); expect(preview).not.toHaveBeenCalled(); expect(exportData).not.toHaveBeenCalled(); expect(diffData).not.toHaveBeenCalled();
        expect(parent.cleanups.size).toBe(0); parent.dispose();
    });
});
