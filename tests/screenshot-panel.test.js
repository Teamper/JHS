// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ScreenshotService } from "../src/services/screenshot-service.js";
import { renderScreenshotPanel } from "../src/ui/detail/screenshot-panel.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

function createService(getImages) {
    return new ScreenshotService({ getAvailable: async () => [] }, {
        list: () => [{ id: "javstore" }],
        getAdapter: () => ({ getImages }),
    });
}

beforeEach(() => {
    globalThis.$ = jquery; globalThis.clog = { error: vi.fn() };
    document.body.innerHTML = '<div id="target"></div>';
    vi.spyOn(HTMLImageElement.prototype, "src", "set").mockImplementation(function (url) {
        this.setAttribute("src", url);
        Object.defineProperty(this, "naturalWidth", { value: 900, configurable: true });
        queueMicrotask(() => this.dispatchEvent(new Event("load")));
    });
});
afterEach(() => vi.restoreAllMocks());

it("ignores a replaced image error and makes the current failed image retryable", async () => {
    const host = jquery("#target"), screenshot = createService(vi.fn().mockResolvedValueOnce([{url:"https://img.javstore.net/old.jpg"}]).mockResolvedValueOnce([{url:"https://img.javstore.net/current.jpg"}]));
    await renderScreenshotPanel({target:host, carNum:"ABC-123", screenshot, settings:{}});
    const old = host.find("img")[0];
    await renderScreenshotPanel({target:host, carNum:"ABC-123", screenshot, settings:{}});
    old.dispatchEvent(new Event("error"));
    expect(host.find("img").attr("src")).toContain("current.jpg");
    host.find("button")[0].focus();
    host.find("img")[0].dispatchEvent(new Event("error"));
    expect(host.text()).toContain("缩略图加载失败");
    expect(host.find("img")).toHaveLength(0);
    expect(document.activeElement).toBe(host.find("button")[0]);
});

it("keeps keyboard focus during retry, refreshes the source once and focuses its result", async () => {
    let finish;
    const resolve = vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementationOnce(() => new Promise(done => { finish = done; }));
    const host = jquery("#target"), screenshot = createService(resolve);
    await renderScreenshotPanel({target:host, carNum:"ABC-123", screenshot, settings:{}});
    const retry = host.find("button")[0]; retry.focus(); retry.click(); retry.click();
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledTimes(2));
    expect(resolve.mock.calls[1][1].refreshCache).toBe(true);
    expect(document.activeElement).toBe(retry);
    finish([{url:"https://img.javstore.net/recovered.jpg"}]);
    await vi.waitFor(() => expect(host.find("img")).toHaveLength(1));
    expect(document.activeElement).toBe(host.find("button")[0]);
});

it("renders a service-owned screenshot without legacy plugin access", async () => {
    const screenshot = createService(vi.fn(async () => [{ url: "https://img.javstore.net/test.jpg" }]));
    const host = jquery("#target");
    const openImageViewer = vi.fn();
    await renderScreenshotPanel({ target: host, carNum: "ABC-123", screenshot, settings: {}, openImageViewer });
    expect(document.querySelector("#target img")?.getAttribute("src")).toBe("https://img.javstore.net/test.jpg");
    expect(host.attr("aria-busy")).toBe("false");
    host.find('.jhs-screenshot-thumbnail').trigger('click');
    expect(openImageViewer).toHaveBeenCalledWith(document.querySelector('#target img'),expect.objectContaining({imageKind:'contact-sheet',owner:document.querySelector('#target button'),trigger:document.querySelector('#target button')}));
});

it("keeps the current request busy when an older screenshot response arrives", async () => {
    const host = jquery("#target");
    let finishOld, finishCurrent;
    const screenshot = createService(vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockImplementationOnce(() => new Promise(resolve => { finishCurrent = resolve; })));
    const options = { target: host, carNum: "ABC-123", screenshot, settings: {} };
    const old = renderScreenshotPanel(options);
    await vi.waitFor(() => expect(finishOld).toBeTypeOf("function"));
    const current = renderScreenshotPanel(options);
    await vi.waitFor(() => expect(finishCurrent).toBeTypeOf("function"));
    expect(host.attr("aria-busy")).toBe("true");
    finishOld([{ url: "https://img.javstore.net/old.jpg" }]); await old;
    expect(host.attr("aria-busy")).toBe("true"); expect(host.text()).toBe("加载中…");
    finishCurrent([{ url: "https://img.javstore.net/current.jpg" }]); await current;
    expect(host.attr("aria-busy")).toBe("false"); expect(host.find("img").attr("src")).toContain("current.jpg");
});

it("clears busy on cancellation and ignores a late failed screenshot", async () => {
    const host = jquery("#target"), scope = new LifecycleScope("screenshot-test");
    let fail;
    const screenshot = createService(vi.fn(() => new Promise((resolve, reject) => { fail = reject; })));
    const pending = renderScreenshotPanel({ target: host, carNum: "ABC-123", screenshot, settings: {}, scope });
    await vi.waitFor(() => expect(fail).toBeTypeOf("function"));
    expect(host.attr("aria-busy")).toBe("true"); scope.dispose();
    expect(host.attr("aria-busy")).toBe("false");
    fail(new Error("late")); await pending;
    expect(host.text()).toBe("加载中…"); expect(globalThis.clog.error).not.toHaveBeenCalled();
});

it("clears busy when a current screenshot request fails", async () => {
    const host = jquery("#target"), screenshot = createService(vi.fn(async () => { throw new Error("offline"); }));
    await renderScreenshotPanel({ target: host, carNum: "ABC-123", screenshot, settings: {} });
    expect(host.attr("aria-busy")).toBe("false"); expect(host.text()).toContain("缩略图加载失败");
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
    await vi.waitFor(() => expect(jquery("#target [role='tabpanel']").text()).toContain("暂无缩略图"));
});

it("hides disabled providers and does not create request entries", async () => {
    const resolve = vi.fn(async () => []);
    const screenshot = createService(resolve);
    await renderScreenshotPanel({
        target: jquery("#target"), carNum: "ABC-123", screenshot,
        settings: { screenshotMode: "manual", screenshotProviders: [{ id: "javstore", enabled: false }] },
    });
    expect(jquery("#target button").length).toBe(0);
    expect(jquery("#target").text()).toBe("暂无可用截图来源");
    expect(resolve).not.toHaveBeenCalled();
});

it("shows an empty state without rendering unsafe screenshot URLs", async () => {
    const screenshot = createService(vi.fn(async () => [{ url: "javascript:alert(1)" }]));
    await renderScreenshotPanel({ target: jquery("#target"), carNum: "ABC-123", screenshot, settings: {} });
    expect(jquery("#target img").length).toBe(0);
    expect(jquery("#target").text()).toContain("暂无缩略图");
});

it("lets the screenshot service select the enabled automatic source", async () => {
    const resolve = vi.fn(async () => [ { url: "https://img.javstore.net/test.jpg", providerId: "javstore" } ]);
    const screenshot = createService(resolve);
    await renderScreenshotPanel({ target: jquery("#target"), carNum: "ABC-123", screenshot, settings: {} });
    expect(resolve).toHaveBeenCalledWith({ carNum: "ABC-123" }, expect.objectContaining({ scope: expect.any(LifecycleScope), settings: {} }));
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

it.each([['http://images.example.test/contact.jpg', 'http://images.example.test/contact.jpg'], ['http://img.javstore.net/contact.jpg', 'https://img.javstore.net/contact.jpg']])("uses the service URL policy for %s", async (url, expected) => {
    const screenshot = createService(vi.fn(async () => [{ url }]));
    const host = jquery("#target");
    await renderScreenshotPanel({ target: host, carNum: "SONE-917", screenshot, settings: {} });
    expect(host.find("img").attr("src")).toBe(expected);
    expect(host.text()).not.toContain("暂无缩略图");
});
