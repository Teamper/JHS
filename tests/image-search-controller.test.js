// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ImageSearchController } from "../src/features/identity/image-search-controller.js";

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

function createController({ resolve = vi.fn(async () => ({ imageUrl: "https://imgur.com/image", targets: [
    { id: "google", name: "Google", url: "https://lens.google.com/search", iconUrl: "https://google.com/favicon.ico" },
    { id: "yandex", name: "Yandex", url: "https://yandex.ru/search", iconUrl: "https://yandex.ru/favicon.ico" },
] })), selections = "{}" } = {}) {
    let activeDialog = null;
    let nextId = 1;
    const dialog = {
        open: vi.fn((options) => {
            const layerRoot = document.createElement("div");
            layerRoot.className = "layui-layer";
            layerRoot.innerHTML = options.content;
            document.body.append(layerRoot);
            activeDialog = { id: nextId++, options, layerRoot };
            options.success(layerRoot, activeDialog.id);
            return activeDialog.id;
        }),
        close: vi.fn((id) => {
            if (activeDialog?.id !== id) return;
            const closed = activeDialog;
            activeDialog = null;
            closed.options.end();
            closed.layerRoot.remove();
        }),
        get active() { return activeDialog; },
    };
    const local = new Map([["jhs_selectedSites", selections]]);
    const storage = {
        getLocal: vi.fn((key) => local.get(key) ?? null),
        setLocal: vi.fn((key, value) => local.set(key, value)),
    };
    const notifications = { info: vi.fn(), error: vi.fn() };
    const settings = { snapshot: vi.fn(() => ({ mobileMode: "off" })) };
    const featureScope = new LifecycleScope("feature:identity");
    const controller = new ImageSearchController({
        document, window, dialog, storage, imageSearch: { resolve }, notifications, settings,
    });
    controller.start(featureScope);
    return { controller, featureScope, dialog, storage, notifications, settings, resolve, local };
}

function pasteText(text) {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { items: [], getData: () => text } });
    document.dispatchEvent(event);
    return event;
}

describe("ImageSearchController", () => {
    it("preserves URL search, remembered site choices, safe target text, and selected open-all behavior", async () => {
        const loaded = createController({ selections: JSON.stringify({ Yandex: false }) });
        loaded.controller.open();
        const event = pasteText("https://example.com/poster.jpg");
        expect(event.defaultPrevented).toBe(false);
        expect(document.querySelector('[data-role="preview-image"]').src).toBe("https://example.com/poster.jpg");
        document.querySelector('[data-action="search"]').click();
        await vi.waitFor(() => expect(document.querySelectorAll('[data-role="targets"] .jhs-image-search__target')).toHaveLength(2));

        const checkboxes = document.querySelectorAll('[data-role="targets"] input[type="checkbox"]');
        expect(checkboxes[0].checked).toBe(true);
        expect(checkboxes[1].checked).toBe(false);
        checkboxes[0].checked = false;
        checkboxes[0].dispatchEvent(new Event("change", { bubbles: true }));
        expect(JSON.parse(loaded.local.get("jhs_selectedSites"))).toMatchObject({ Google: false, Yandex: false });

        loaded.resolve.mockResolvedValueOnce({ imageUrl: "https://imgur.com/image", targets: [
            { id: "unsafe-label", name: "<b>plain text</b>", url: "https://lens.google.com/search", iconUrl: "https://google.com/favicon.ico" },
            { id: "yandex", name: "Yandex", url: "https://yandex.ru/search", iconUrl: "https://yandex.ru/favicon.ico" },
        ] });
        document.querySelector('[data-role="image-url"]').value = "https://example.com/poster-2.jpg";
        document.querySelector('[data-role="image-url"]').dispatchEvent(new Event("change", { bubbles: true }));
        document.querySelector('[data-action="search"]').click();
        await vi.waitFor(() => expect(document.querySelector('[data-role="targets"]')?.textContent).toContain("<b>plain text</b>"));
        expect(document.querySelector('[data-role="targets"] b')).toBeNull();

        const opened = vi.spyOn(window, "open").mockReturnValue(null);
        const checkboxesAfterSearch = document.querySelectorAll('[data-role="targets"] input[type="checkbox"]');
        checkboxesAfterSearch[0].checked = true;
        checkboxesAfterSearch[1].checked = false;
        document.querySelector('[data-action="open-all"]').click();
        expect(opened).toHaveBeenCalledTimes(1);
        expect(opened).toHaveBeenCalledWith("https://lens.google.com/search", "_blank", "noopener");

        loaded.featureScope.dispose();
        expect(loaded.dialog.active).toBeNull();
        expect(document.querySelector(".jhs-image-search")).toBeNull();
    });

    it("rejects non-HTTP image URLs before preview and keeps upload selection functional", async () => {
        const loaded = createController();
        loaded.controller.open();
        const input = document.querySelector('[data-role="image-url"]');
        input.value = "javascript:alert(1)";
        input.dispatchEvent(new Event("change", { bubbles: true }));
        expect(document.querySelector('[data-role="preview"]').hidden).toBe(true);
        expect(loaded.notifications.info).toHaveBeenCalledWith("请输入有效的 HTTP/HTTPS 图片 URL");
        expect(loaded.resolve).not.toHaveBeenCalled();

        const file = new File(["synthetic image"], "poster.png", { type: "image/png" });
        loaded.controller.handleImageFile(file);
        await vi.waitFor(() => expect(loaded.resolve).toHaveBeenCalledOnce());
        expect(loaded.resolve.mock.calls[0][0]).toMatch(/^data:image\/png;base64,/);
        expect(loaded.notifications.info).toHaveBeenCalledWith("开始上传图片...");
        loaded.controller.close();
        expect(loaded.dialog.active).toBeNull();
    });

    it("does not render a late response after its dialog closes and releases the request scope", async () => {
        let finishRequest;
        const resolve = vi.fn(() => new Promise((resolvePromise) => { finishRequest = resolvePromise; }));
        const loaded = createController({ resolve });
        loaded.controller.open();
        pasteText("https://example.com/poster.jpg");
        document.querySelector('[data-action="search"]').click();
        expect(resolve).toHaveBeenCalledOnce();
        const requestScope = loaded.controller.session.requestScope;
        loaded.controller.close();
        expect(requestScope.disposed).toBe(true);
        finishRequest({ imageUrl: "https://imgur.com/image", targets: [{ id: "late", name: "Late", url: "https://example.com", iconUrl: "https://example.com/icon.png" }] });
        await Promise.resolve();
        expect(document.querySelector(".jhs-image-search")).toBeNull();
        expect(loaded.notifications.error).not.toHaveBeenCalled();
    });

    it("uses the existing mobile-mode override for responsive dialog sizing", () => {
        const loaded = createController();
        vi.stubGlobal("innerWidth", 1400);
        loaded.settings.snapshot.mockReturnValue({ mobileMode: "on" });
        loaded.controller.open();
        expect(loaded.dialog.open.mock.calls[0][0].area).toEqual(["100%", "90%"]);
        loaded.controller.close();
    });
});
