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

    it("keeps confirmation and close-page behavior behind an injected page dialog", async () => {
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
        expect(openImageViewer).toHaveBeenCalledWith(image, "", undefined);
        const options = { trigger: image };
        ui.openImageViewer("https://example.test/image.jpg", options);
        expect(openImageViewer).toHaveBeenCalledWith("https://example.test/image.jpg", "", options);
        expect(() => new DomUiService(value => value).openImageViewer(image)).toThrow("图片查看器尚未加载");
    });

    it("keeps responsive dialog sizing behind the UI capability", () => {
        const ui = new DomUiService(undefined);
        expect(ui.getDialogArea("lg", { innerWidth: 964, innerHeight: 764 })).toEqual(["900px", "700px"]);
    });

    it("formats a local date through the shared formatter", () => {
        const ui = new DomUiService(undefined);
        expect(ui.formatDate(new Date(2026, 8, 26))).toBe("2026-09-26 00:00:00");
    });

    it("forwards navigation and identifies an unpainted element", () => {
        const openPage = vi.fn(), ui = new DomUiService(undefined, { openPage });
        ui.openPage("https://example.test/movie", "ABC-1", false, { ctrlKey: true });
        const { window } = new JSDOM("<div hidden></div>");
        expect(ui.isHidden(window.document.querySelector("div"))).toBe(true);
        window.close();
        expect(openPage).toHaveBeenCalledWith("https://example.test/movie", "ABC-1", false, { ctrlKey: true });
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
