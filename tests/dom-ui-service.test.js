import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { DomUiService } from "../src/services/dom-ui-service.js";

describe("DomUiService", () => {
    it("forwards host UI queries through its explicit dependency", () => {
        const root = {};
        const jquery = vi.fn((value) => ({ value }));
        const ui = new DomUiService(jquery);
        expect(ui.jquery(root)).toEqual({ value: root });
        const query = ui.jquery;
        expect(query(root)).toEqual({ value: root });
        expect(jquery).toHaveBeenCalledWith(root);
        expect(jquery).toHaveBeenCalledTimes(2);
    });

    it("isolates an unavailable jQuery runtime until an affected Feature uses it", () => {
        const ui = new DomUiService(undefined);
        expect(() => ui.jquery({})).toThrow("页面 UI 依赖尚未加载");
    });

    it("keeps confirmation and close-page behavior behind an injected legacy UI boundary", async () => {
        const position = { clientX: 10, clientY: 20 }, confirm = vi.fn(), closePage = vi.fn(async () => true);
        const ui = new DomUiService(value => value, { q: confirm, closePage });
        const accepted = vi.fn();
        ui.confirm(position, "安全文本", accepted);
        await ui.closePage({ layerIndex: 5 });
        expect(confirm).toHaveBeenCalledWith(position, "安全文本", accepted);
        expect(closePage).toHaveBeenCalledWith({ layerIndex: 5 });
    });

    it("forwards image viewing through a narrow capability", () => {
        const image = new JSDOM("", { url: "https://example.test/" }).window.document.createElement("img"), openImageViewer = vi.fn();
        const ui = new DomUiService(value => value, undefined, openImageViewer);
        ui.openImageViewer(image);
        expect(openImageViewer).toHaveBeenCalledWith(image);
        expect(() => new DomUiService(value => value).openImageViewer(image)).toThrow("图片查看器尚未加载");
    });

    it("keeps responsive dialog sizing behind the UI capability", () => {
        const getDialogArea = vi.fn(() => ["900px", "700px"]);
        const ui = new DomUiService(undefined, { getDialogArea });
        expect(ui.getDialogArea("lg")).toEqual(["900px", "700px"]);
        expect(getDialogArea).toHaveBeenCalledWith("lg");
    });

    it("formats dates through the injected utility boundary", () => {
        const formatDate = vi.fn(value => `formatted:${value}`), ui = new DomUiService(undefined, { formatDate });
        expect(ui.formatDate("2026-09-26")).toBe("formatted:2026-09-26");
        expect(formatDate).toHaveBeenCalledWith("2026-09-26");
    });

    it("keeps page navigation and visibility checks behind the injected UI capability", () => {
        const openPage = vi.fn(), isHidden = vi.fn(() => true), ui = new DomUiService(undefined, { openPage, isHidden });
        ui.openPage("https://example.test/movie", "ABC-1", false, { ctrlKey: true });
        expect(ui.isHidden({})).toBe(true);
        expect(openPage).toHaveBeenCalledWith("https://example.test/movie", "ABC-1", false, { ctrlKey: true });
        expect(isHidden).toHaveBeenCalledOnce();
    });

    it("starts loading feedback through an explicit UI capability", () => {
        const handle = { close: vi.fn() }, startLoading = vi.fn(() => handle);
        const ui = new DomUiService(undefined, undefined, undefined, startLoading);
        expect(ui.loading()).toBe(handle);
        expect(startLoading).toHaveBeenCalledOnce();
        expect(() => new DomUiService(undefined).loading()).toThrow("页面加载提示尚未加载");
    });

    it("creates image hover previews through the injected UI capability", () => {
        const preview = { destroy: vi.fn() }, factory = vi.fn(() => preview);
        const ui = new DomUiService(undefined, undefined, undefined, undefined, factory);
        const config = { selector: ".cover img" };
        expect(ui.createImageHoverPreview(config)).toBe(preview);
        expect(factory).toHaveBeenCalledWith(config);
        expect(() => new DomUiService(undefined).createImageHoverPreview(config)).toThrow("图片悬浮预览尚未加载");
    });
});
