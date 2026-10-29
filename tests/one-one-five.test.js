// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalize115SearchResults } from "../src/integrations/one115/manifest.js";
import { OneOneFiveMatchController } from "../src/features/external-bridge/one-one-five-match-controller.js";
import { format115Size, matches115FileName, normalize115Keyword, preview115Rename } from "../src/features/external-bridge/one-one-five-utils.js";

const mixedMatches = normalize115SearchResults(JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/integrations/one115/mixed-matches.json"), "utf8")));

function createController({ enabled = false, route = "detail", carNum = "ABC-123", searchFiles = vi.fn(async () => []) } = {}) {
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
        readMovieRef: () => ({ carNum, url: location.href }),
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
        expect(normalize115Keyword("FC2-PPV-123456")).toBe("123456");
        expect(normalize115Keyword("fc2ppv123456")).toBe("123456");
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
        requests[0].resolve([{ name: "ABC-123.mp4", fileId: "1" }]);
        await Promise.resolve();
        expect(summary.querySelector(".jhs-115-match")).toBeNull();
        settings.setEnabled(true);
        await vi.waitFor(() => expect(requests).toHaveLength(2));
        requests[1].resolve([]);
        await vi.waitFor(() => expect(summary.querySelector(".jhs-115-match")?.textContent).toBe("115 匹配：未匹配 重试"));
        scope.dispose();
    });

    it("renders multi-match links as inert text plus validated HTTPS anchors", async () => {
        const searchFiles = vi.fn(async () => [{ name: "ABC-123 <img src=x onerror=alert(1)>.mp4", fileId: "1" }, { name: "ABC-123-CD2.mp4", fileId: "2" }]);
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

describe("115 complete movie identity matching", () => {
    it.each(["START-657.mp4", "start_657.mkv", "START657.mp4", "ＳＴＡＲＴ－６５７.mp4", "标题 START 657-C.mp4", "START-657-4K-H265.mp4", "START-657-CD1.mp4", "START-657-CD12.mp4", "START-657 普通标题.mp4"])("accepts equivalent complete filenames: %s", name => {
        expect(matches115FileName(name, "START-657")).toBe(true);
    });
    it.each(["START-651.mp4", "START-6570.mp4", "START-0657.mp4", "XSTART-657.mp4", "START-657X.mp4", "START-657_START-651.mp4", "START-657 ABC123.mp4", "unknown.mp4", "657.mp4", ""])("rejects unrelated or conflicting filenames: %s", name => {
        expect(matches115FileName(name, "START-657")).toBe(false);
    });
    it.each(["FC2-1234567.mp4", "FC2-PPV-1234567.mp4", "fc2ppv1234567.mp4", "FC2_PPV_1234567-CD1.mp4", "1234567.mp4", "1234567-C.mp4"])("accepts FC2 aliases and standalone numbers: %s", name => {
        for (const target of ["FC2-1234567", "FC2-PPV-1234567"]) expect(matches115FileName(name, target)).toBe(true);
    });
    it.each(["12345670.mp4", "91234567.mp4", "ABC-1234567.mp4", "ABC1234567.mp4", "010123-1234567.mp4", "FC2-1234568.mp4", "FC2-1234567_FC2-7654321.mp4", "1234567_7654321.mp4"])("rejects ambiguous FC2 numeric evidence: %s", name => {
        expect(matches115FileName(name, "FC2-1234567")).toBe(false);
    });
    it.each([null, undefined, "", "START", "FC2", "FC2-PPV", "unknown", "ABC.*123"])("rejects incomplete target %s", target => {
        expect(matches115FileName("START-657.mp4", target)).toBe(false);
    });
    it("handles invalid names and preserves complex numeric identities", () => {
        expect(matches115FileName(null, "START-657")).toBe(false);
        expect(matches115FileName("010123_001.mp4", "010123-001")).toBe(true);
        expect(matches115FileName("1PONDO-010123_001.mp4", "1PONDO-010123-001")).toBe(true);
        expect(matches115FileName("T28-123.mp4", "T28-123")).toBe(true);
        expect(matches115FileName("T28-123_T28-124.mp4", "T28-123")).toBe(false);
    });
    it.each(["detail", "list"])("only exposes filtered candidates on %s", async route => {
        const searchFiles = vi.fn(async () => mixedMatches);
        const { controller, scope, root, summary, dialog, offline } = createController({ route, enabled: true, carNum: "START-657", searchFiles });
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = '<div class="video-title"><strong>START-657</strong></div>';
        root.append(item);
        try {
            controller.start();
            if (route === "list") {
                await vi.waitFor(() => expect(controller.observer).not.toBeNull());
                await controller.matchCard(item, controller.lifecycleScope);
                expect(item.querySelector(".jhs-115-list-match").textContent).toBe("匹配2个");
                item.querySelector(".jhs-115-list-match").click();
                expect(dialog.open.mock.calls[0][0].content).toContain("file=correct-c");
                expect(dialog.open.mock.calls[0][0].content).not.toContain("wrong-");
            } else {
                await vi.waitFor(() => expect(summary.querySelectorAll(".jhs-115-match-row")).toHaveLength(2));
                expect([...summary.querySelectorAll("a")].map(link => link.textContent)).toEqual(["start_657-C.mp4（0 B）", "START657-CD2.mkv（0 B）"]);
                expect(summary.querySelectorAll(".jhs-115-rename")).toHaveLength(2);
                summary.querySelector(".jhs-115-rename").click();
                await vi.waitFor(() => expect(offline.renameFile).toHaveBeenCalledWith("one115", "correct-c", expect.any(String), expect.any(Object)));
                expect(summary.innerHTML).not.toContain("wrong-");
            }
            expect(searchFiles).toHaveBeenCalledWith("one115", "START-657", expect.any(Object));
            expect(mixedMatches).toHaveLength(8);
        } finally { scope.dispose(); }
    });
    it.each(["detail", "list"])("keeps the no-match retry on %s after excluding every candidate", async route => {
        const searchFiles = vi.fn(async () => mixedMatches.slice(0, 5));
        const { controller, scope, summary, root } = createController({ route, enabled: true, carNum: "START-657", searchFiles });
        const item = document.createElement("div");
        item.innerHTML = '<div class="video-title"><strong>START-657</strong></div>';
        root.append(item);
        try {
            controller.start();
            if (route === "list") {
                await vi.waitFor(() => expect(controller.observer).not.toBeNull());
                await controller.matchCard(item, controller.lifecycleScope);
                const retry = item.querySelector(".jhs-115-list-match");
                expect(retry.textContent).toBe("未匹配");
                retry.click();
                await vi.waitFor(() => expect(searchFiles).toHaveBeenCalledTimes(2));
                expect(searchFiles.mock.calls[1][2].force).toBe(true);
            } else {
                await vi.waitFor(() => expect(summary.textContent).toContain("未匹配 重试"));
                expect(summary.querySelector("button")).not.toBeNull();
                expect(summary.querySelectorAll("a,.jhs-115-rename")).toHaveLength(0);
            }
        } finally { scope.dispose(); }
    });
});
