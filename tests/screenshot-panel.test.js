// @vitest-environment jsdom
import jquery from "jquery";
import { beforeEach, expect, it, vi } from "vitest";
import { renderScreenshotPanel } from "../src/ui/detail/screenshot-panel.js";

beforeEach(() => { globalThis.$ = jquery; globalThis.showImageViewer = vi.fn(); globalThis.clog = { error: vi.fn() }; document.body.innerHTML = '<div id="target"></div>'; });

it("renders a service-owned screenshot without legacy plugin access", async () => {
    const resolve = vi.fn(async () => [{ url: "https://img.javstore.net/test.jpg" }]);
    await expect(renderScreenshotPanel({ target: jquery("#target"), carNum: "ABC-123", screenshot: { resolve }, settings: {} })).resolves.toBe("https://img.javstore.net/test.jpg");
    expect(document.querySelector("#target img")?.getAttribute("src")).toBe("https://img.javstore.net/test.jpg");
});

it("keeps manual mode request-free until selected", async () => {
    const resolve = vi.fn(async () => []);
    await renderScreenshotPanel({ target: jquery("#target"), carNum: "ABC-123", screenshot: { resolve }, settings: { screenshotMode: "manual" } });
    expect(resolve).not.toHaveBeenCalled();
    jquery("#target button").trigger("click");
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledOnce());
});
