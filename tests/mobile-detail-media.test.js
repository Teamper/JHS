// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { mountDetailMedia } from "../src/app/mobile/detail-media.js";

afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
});

it("loads the three slots independently and opens originals from the selected tile", async () => {
    const scope = new LifecycleScope("fixture");
    const root = document.createElement("main");
    document.body.append(root);
    const openGallery = vi.fn(async () => {});
    const settings = Object.assign(new EventTarget(), { snapshot: () => ({ enableLoadPreviewVideo: "no" }) });
    let finishSheet;
    const resolve = vi.fn(() => new Promise(done => { finishSheet = done; }));
    const services = { settings, privacy: { enabled: false, masked: false },
        screenshot: { resolve, isEnabled: () => true, getScreenshotSettings: () => ({ mode: "auto" }) } };
    const media = mountDetailMedia(root, { services, openGallery }, scope, vi.fn(), vi.fn());
    media.update({
        carNum: "JHSTEST-278", preview: { poster: "https://img.test/poster.jpg", video: "https://img.test/preview.mp4" },
        stills: [{ url: "https://img.test/first.jpg", thumbnail: "https://img.test/thumb.jpg" }, { url: "https://img.test/second.jpg" }],
    });
    expect(root.querySelector('[data-media=preview] button').textContent).toContain("预告");
    expect(resolve).toHaveBeenCalledTimes(1);
    const still = root.querySelector('[data-media=image] button');
    expect(still.querySelector("img").src).toBe("https://img.test/thumb.jpg");
    still.click();
    expect(openGallery.mock.calls[0][0]).toEqual({ urls: ["https://img.test/first.jpg", "https://img.test/second.jpg"], initialIndex: 0 });
    finishSheet([{ url: "https://img.test/sheet.jpg" }]);
    await vi.waitFor(() => expect(root.querySelectorAll('[data-media=image] button')).toHaveLength(3));
    still.click();
    const urls = ["https://img.test/sheet.jpg", "https://img.test/first.jpg", "https://img.test/second.jpg"];
    expect(openGallery.mock.calls[1][0]).toEqual({ urls, initialIndex: 1 });
    expect(root.querySelectorAll('[data-media=image] button')[1]).toBe(still);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const slot = still.parentElement;
    still.querySelector("img").dispatchEvent(new Event("error"));
    expect(slot.querySelector("[role=status]").textContent).toBe("图片加载失败");
    slot.querySelector("button:nth-of-type(2)").click();
    expect(openGallery.mock.calls[2][0]).toEqual({ urls, initialIndex: 1 });
    slot.querySelector("button").click();
    expect(slot.querySelector("img").src).toBe("https://img.test/thumb.jpg");
    scope.dispose();
});

it("keeps disabled sources off and waits for an explicit choice in manual mode", async () => {
    const root = document.createElement("main");
    document.body.append(root);
    const scope = new LifecycleScope("fixture");
    const preferences = { enablePreviewVideo: "no", enableLoadScreenShot: "no" };
    const settings = Object.assign(new EventTarget(), { snapshot: () => preferences });
    const resolve = vi.fn(async () => [{ url: "https://img.test/sheet.jpg" }]);
    const readPreview = vi.fn();
    const screenshot = { resolve, isEnabled: value => value.enableLoadScreenShot !== "no",
        getScreenshotSettings: () => ({ mode: "manual" }), getEnabledProviders: () => [{ id: "javstore", name: "JavStore" }] };
    const media = mountDetailMedia(root, { services: { settings, screenshot } }, scope, vi.fn(), readPreview);
    media.update({
        carNum: "JHSTEST-278", id:"card", preview: { requiresLogin: true },
        stills: [{ url: "https://img.test/still.jpg" }],
    });
    expect(root.querySelector('[data-media=preview]').hidden).toBe(true);
    expect(root.querySelector('[data-media=image-source]').hidden).toBe(true);
    expect(root.querySelectorAll('[data-media=image] .detail-media-tile')).toHaveLength(1);
    expect(readPreview).not.toHaveBeenCalled();
    preferences.enableLoadScreenShot = "yes";
    settings.dispatchEvent(new CustomEvent("settings.changed", { detail: { names: ["enableLoadScreenShot"] } }));
    const choice = root.querySelector('[data-media=image-source] select');
    expect(resolve).not.toHaveBeenCalled();
    choice.value = "javstore";
    choice.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(root.querySelectorAll('[data-media=image] .detail-media-tile')).toHaveLength(2));
    expect(resolve.mock.calls[0][1]).toMatchObject({ providerId: "javstore" });
    scope.dispose();
});
