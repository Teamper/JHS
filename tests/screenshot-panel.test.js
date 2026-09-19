// @vitest-environment jsdom
import jquery from "jquery";
import { beforeEach, expect, it, vi } from "vitest";
import { ScreenshotService } from "../src/services/screenshot-service.js";
import { renderScreenshotPanel } from "../src/ui/detail/screenshot-panel.js";

/** 真实 ScreenshotService 策略 + 可替换 resolve。 */
function createService(resolve) {
    const service = new ScreenshotService(null, null);
    service.resolve = resolve ?? vi.fn(async () => []);
    return service;
}

beforeEach(() => { globalThis.$ = jquery; globalThis.showImageViewer = vi.fn(); globalThis.clog = { error: vi.fn() }; document.body.innerHTML = '<div id="target"></div>'; });

it("renders a service-owned screenshot without legacy plugin access", async () => {
    const screenshot = createService(vi.fn(async () => [{ url: "https://img.javstore.net/test.jpg" }]));
    const host = jquery("#target");
    await renderScreenshotPanel({ target: host, carNum: "ABC-123", screenshot, settings: {} });
    expect(document.querySelector("#target img")?.getAttribute("src")).toBe("https://img.javstore.net/test.jpg");
});

it("keeps manual mode request-free until selected", async () => {
    const resolve = vi.fn(async () => []);
    const screenshot = createService(resolve);
    await renderScreenshotPanel({
        target: jquery("#target"), carNum: "ABC-123", screenshot,
        settings: { screenshotMode: "manual", screenshotProviders: JSON.stringify([{ id: "javstore", enabled: true }]) },
    });
    expect(resolve).not.toHaveBeenCalled();
    expect(jquery("#target [role='tab']").length).toBe(1);
    jquery("#target [role='tab']").trigger("click");
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledOnce());
});

it("hides disabled providers and does not create request entries", async () => {
    const resolve = vi.fn(async () => []);
    const screenshot = createService(resolve);
    await renderScreenshotPanel({
        target: jquery("#target"), carNum: "ABC-123", screenshot,
        settings: { screenshotMode: "manual", screenshotProviders: [{ id: "javstore", enabled: false }] },
    });
    expect(jquery("#target button").length).toBe(0);
    expect(resolve).not.toHaveBeenCalled();
});

it("resolves the long-thumbnail only through javstore", async () => {
    const resolve = vi.fn(async () => [ { url: "https://img.javstore.net/test.jpg", providerId: "javstore" } ]);
    const screenshot = createService(resolve);
    await renderScreenshotPanel({ target: jquery("#target"), carNum: "ABC-123", screenshot, settings: {} });
    expect(resolve).toHaveBeenCalledWith({ carNum: "ABC-123" }, { providerId: "javstore", scope: undefined, settings: {} });
});

it("skips a screenshot that duplicates a gallery image", async () => {
    const resolve = vi.fn(async () => [ { url: "https://fc2content.net/gallery/1.jpg", providerId: "fc2content" } ]);
    const screenshot = createService(resolve);
    const isDuplicate = vi.fn((url) => url === "https://fc2content.net/gallery/1.jpg");
    await renderScreenshotPanel({ target: jquery("#target"), carNum: "FC2-123", screenshot, settings: {}, isDuplicate });
    expect(jquery("#target").children().length).toBe(0);
});

it("total switch OFF removes UI and never resolves", async () => {
    const resolve = vi.fn(async () => [{ url: "https://img.javstore.net/test.jpg" }]);
    const screenshot = createService(resolve);
    const host = jquery("#target");
    const result = await renderScreenshotPanel({ target: host, carNum: "ABC-123", screenshot, settings: { enableLoadScreenShot: "no" } });
    expect(result).toBeNull();
    expect(host.children().length).toBe(0);
    expect(resolve).not.toHaveBeenCalled();
});

it("parses legacy JSON-string screenshotProviders (6.5 regression fix)", async () => {
    const resolve = vi.fn(async () => []);
    const screenshot = createService(resolve);
    await renderScreenshotPanel({
        target: jquery("#target"), carNum: "ABC-123", screenshot,
        settings: { screenshotMode: "manual", screenshotProviders: JSON.stringify([{ id: "javstore", enabled: true }]) },
    });
    expect(jquery("#target [role='tab']").text()).toBe("JavStore");
});
