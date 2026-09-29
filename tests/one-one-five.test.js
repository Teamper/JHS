// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { OneOneFiveMatchController } from "../src/features/external-bridge/one-one-five-match-controller.js";
import { format115Size, normalize115Keyword, preview115Rename } from "../src/features/external-bridge/one-one-five-utils.js";

function createController({ enabled = false, route = "detail", searchFiles = vi.fn(async () => []) } = {}) {
    if (!window.IntersectionObserver) {
        window.IntersectionObserver = class {
            constructor(callback) { this.callback = callback; }
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }
    const settings = new EventTarget();
    let value = enabled;
    settings.snapshot = () => ({ enable115Match: value, oneOneFiveConcurrency: 4, oneOneFiveCacheMinutes: 60 });
    settings.setEnabled = (next) => {
        value = next;
        settings.dispatchEvent(new CustomEvent("settings.changed", { detail: { names: ["enable115Match"] } }));
    };
    const eventListeners = new Map();
    const events = {
        on: (name, listener) => {
            const listeners = eventListeners.get(name) ?? new Set();
            listeners.add(listener);
            eventListeners.set(name, listeners);
            return () => listeners.delete(listener);
        },
        emit: (name, payload) => eventListeners.get(name)?.forEach((listener) => listener(payload)),
    };
    const summary = document.createElement("section");
    document.body.replaceChildren(summary);
    const root = document.createElement("div");
    root.className = "movie-list";
    document.body.append(root);
    const host = {
        readMovieRef: () => ({ carNum: "ABC-123", url: location.href }),
        locateDetailSlots: () => ({ summary }),
        locateListRoot: () => root,
    };
    const scope = new LifecycleScope("test-one-one-five");
    const dialog = { open: vi.fn() };
    const ui = { confirm: vi.fn((_position, _message, accept) => accept()) };
    const notifications = { error: vi.fn(), info: vi.fn(), ok: vi.fn(), debug: vi.fn() };
    const offline = {
        searchFiles,
        getPlayUrl: (_provider, match) => `https://115.com/?file=${match.fileId}`,
        getIntegrationHomeUrl: () => "https://115.com/",
        renameFile: vi.fn(async () => {}),
    };
    const controller = new OneOneFiveMatchController({
        document, window, route, host, offline, settings, events, dialog, ui, notifications, scope,
        diagnostics: { recordError: vi.fn() },
    });
    return { controller, scope, settings, events, root, summary, offline, dialog, ui, notifications };
}

describe("115 domain", () => {
    it("normalizes FC2 keywords and sizes", () => {
        expect(normalize115Keyword("FC2-123456")).toBe("123456");
        expect(format115Size(1024 ** 3)).toBe("1.00 GB");
    });

    it("preserves rename suffixes", () => {
        expect(preview115Rename("old-4K-U.mkv", "abc-1")).toBe("ABC-1-4K-U.mkv");
    });

    it("routes matching through explicit offline, host and event capabilities", async () => {
        const { readTestFile } = await import("./helpers/read-test-file.js");
        const { join } = await import("node:path");
        const source = readTestFile(join(import.meta.dirname, "../src/features/external-bridge/one-one-five-match-controller.js"), "utf8");
        expect(source).toContain("this.host.locateListRoot");
        expect(source).toContain('this.events.on("list-items-added"');
        expect(source).toContain('this.offline.renameFile("one115"');
        expect(source).not.toContain("GM_xmlhttpRequest");
        expect(source).not.toContain("https://115.com");
    });

    it.each([false, "false", "no", 0, "0", null, "invalid"])("disabled 115 value %j owns no matching requests", async value => {
        const { controller, scope, settings, summary } = createController({ enabled: value });
        settings.snapshot = () => ({ enable115Match: value });
        controller.start();
        await vi.waitFor(() => expect(controller.lifecycleScope).toBeNull());
        expect(controller.getRuntimeService("offline").searchFiles).not.toHaveBeenCalled();
        expect(summary.querySelector(".jhs-115-match")).toBeNull();
        scope.dispose();
    });

    it("cancels late detail results on OFF and starts one fresh request on ON", async () => {
        const requests = [];
        const searchFiles = vi.fn((_provider, _keyword, { scope: requestScope }) => new Promise((resolve) => requests.push({ requestScope, resolve })));
        const { controller, scope, settings, summary } = createController({ searchFiles });
        controller.start();
        await vi.waitFor(() => expect(controller.lifecycleScope).toBeNull());
        settings.setEnabled(true);
        await vi.waitFor(() => expect(requests).toHaveLength(1));
        settings.setEnabled(false);
        expect(requests[0].requestScope.signal.aborted).toBe(true);
        requests[0].resolve([{ name: "late result", fileId: "1" }]);
        await Promise.resolve();
        expect(summary.querySelector(".jhs-115-match")).toBeNull();
        settings.setEnabled(true);
        await vi.waitFor(() => expect(requests).toHaveLength(2));
        requests[1].resolve([]);
        await vi.waitFor(() => expect(summary.querySelector(".jhs-115-match")?.textContent).toBe("115匹配：未匹配 重试"));
        scope.dispose();
    });

    it("renders multi-match links as inert text plus validated HTTPS anchors", async () => {
        const searchFiles = vi.fn(async () => [{ name: "<img src=x onerror=alert(1)>", fileId: "1" }, { name: "第二个", fileId: "2" }]);
        const { controller, scope, settings, root, dialog } = createController({ route: "list", enabled: true, searchFiles });
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = '<div class="video-title"><strong>ABC-123</strong></div>';
        root.append(item);
        controller.start();
        await vi.waitFor(() => expect(controller.observer).not.toBeNull());
        const observer = controller.observer;
        observer.callback([{ target: item, isIntersecting: true }]);
        await new Promise((resolve) => setTimeout(resolve, 70));
        await vi.waitFor(() => expect(item.querySelector(".jhs-115-list-match")).not.toBeNull());
        item.querySelector(".jhs-115-list-match").click();
        expect(dialog.open).toHaveBeenCalledOnce();
        expect(dialog.open.mock.calls[0][0].content).not.toContain("<img src=x");
        expect(dialog.open.mock.calls[0][0].content).toContain("&lt;img src=x");
        expect(dialog.open.mock.calls[0][0].content).toContain("rel=\"noopener noreferrer\"");
        settings.setEnabled(false);
        scope.dispose();
    });
});
