// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { PrivacyService, PRIVACY_STATE_KEY } from "../src/services/privacy-service.js";
import { PrivacyController } from "../src/features/system/privacy-controller.js";
import { privacySelectors } from "../src/contracts/privacy-targets.js";
import { createPrivacyPreferences } from "../src/ui/settings/privacy-controls.js";
import { JavBusHostAdapter } from "../src/platform/hosts/javbus-host-adapter.js";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { AutoPageController } from "../src/features/list/auto-page-controller.js";

let scope, service, controller, storage, settings;
beforeEach(async () => {
    document.body.innerHTML = '<div class="video-title"><strong>ABC-123</strong>影片标题<button>收藏</button></div><div class="actors">演员</div><div class="cover"><img src="fixture.png"><button>截图</button></div><video></video><button data-jhs-privacy-toggle>隐私遮罩</button><button id="reveal">按住临时查看</button>';
    scope = new LifecycleScope("test:privacy");
    let enabled = false;
    storage = { getValue: vi.fn(async () => enabled), setValue: vi.fn(async (key, value) => { expect(key).toBe(PRIVACY_STATE_KEY); enabled = value; }), listenValue: vi.fn(), unlistenValue: vi.fn() };
    let preferences = {};
    settings = Object.assign(new EventTarget(), { snapshot: () => preferences, patch: vi.fn(async patch => { Object.assign(preferences, patch); settings.dispatchEvent(new Event("settings.changed")); }) });
    service = new PrivacyService({ storage, settings });
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const host = { document, getPrivacySelectors: () => privacySelectors({ title: ".video-title", code: ".video-title strong", actors: ".actors", images: ".cover img" }) };
    controller = new PrivacyController({ host, privacy: service, scope, settings, ui: {}, dialog: {}, notifications: { error: vi.fn() } });
    await controller.start();
});
afterEach(() => { scope.dispose(); service.dispose(); vi.restoreAllMocks(); });
it("defaults off, masks text/media and preserves reachable controls", async () => {
    expect(document.documentElement.hasAttribute("data-jhs-privacy-active")).toBe(false);
    await service.setEnabled(true);
    expect(document.documentElement.hasAttribute("data-jhs-privacy-active")).toBe(true);
    expect(document.querySelector(".video-title").textContent).toContain("ABC-123");
    expect(document.querySelector(".video-title button").closest("[data-jhs-privacy-text]")).toBeNull();
    expect(document.querySelector(".cover img").getAttribute("data-jhs-privacy-media")).toBe("images");
    expect(document.querySelector("video").getAttribute("data-jhs-privacy-media")).toBe("video");
    expect(document.querySelector("[data-jhs-privacy-toggle]").getAttribute("aria-pressed")).toBe("true");
});
it("masks asynchronously appended cards, owned FC2 and history/new-work workspaces", async () => {
    await service.setEnabled(true);
    const node = document.createElement("div");
    node.innerHTML = '<div class="video-title">新影片</div><div class="jhs-fc2-title">FC2-1234567</div><div class="tabulator-cell" tabulator-field="carNum">ABC-123</div><div id="actress-card-container"><img></div>';
    document.body.append(node);
    await vi.waitFor(() => expect(node.querySelectorAll("[data-jhs-privacy-text]")).toHaveLength(3));
    expect(node.querySelector("img").hasAttribute("data-jhs-privacy-media")).toBe(true);
});
it("restores on pointer release, cancellation, blur and tag visibility changes", async () => {
    const button = document.querySelector("#reveal");
    controller.bindReveal(button, scope);
    await service.setEnabled(true);
    for (const event of ["pointerup", "pointercancel", "lostpointercapture", "blur"]) {
        service.reveal(true);
        expect(service.masked).toBe(false);
        button.dispatchEvent(new Event(event));
        expect(service.masked).toBe(true);
    }
    service.reveal(true); window.dispatchEvent(new Event("blur")); expect(service.masked).toBe(true);
    service.reveal(true); document.dispatchEvent(new Event("visibilitychange")); expect(service.masked).toBe(true);
});
it("temporarily reveals on held Space without resuming video playback", async () => {
    const button = document.querySelector("#reveal"), video = document.querySelector("video");
    controller.bindReveal(button, scope);
    await service.setEnabled(true);
    button.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    expect(service.masked).toBe(false);
    button.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    expect(service.masked).toBe(true);
    video.dispatchEvent(new Event("play"));
    expect(video.pause).toHaveBeenCalled();
    const play = vi.spyOn(video, "play");
    await service.setEnabled(false);
    expect(play).not.toHaveBeenCalled();
});
it("uses a configured shortcut and excludes editable fields and repeats", async () => {
    await settings.patch({ privacyShortcut: { code: "KeyP", ctrl: true, alt: false, shift: false, meta: false } });
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyP", key: "p", ctrlKey: true, bubbles: true }));
    await vi.waitFor(() => expect(service.enabled).toBe(true));
    const input = document.createElement("input"); document.body.append(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyP", key: "p", ctrlKey: true, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyP", key: "p", ctrlKey: true, repeat: true }));
    await Promise.resolve(); expect(service.enabled).toBe(true);
});
it("updates portable targets without persisting activation in settings", async () => {
    await service.setEnabled(true);
    await settings.patch({ privacyTargets: ["images"] });
    expect(document.querySelector("[data-jhs-privacy-text]")).toBeNull();
    expect(document.querySelector("video").hasAttribute("data-jhs-privacy-media")).toBe(false);
    expect(document.querySelector("img").hasAttribute("data-jhs-privacy-media")).toBe(true);
    expect(settings.snapshot()).not.toHaveProperty("privacyEnabled");
});
it("reports save errors and retains the actual activation state", async () => {
    storage.setValue.mockRejectedValueOnce(new Error("disk"));
    await expect(service.setEnabled(true)).rejects.toThrow("disk");
    expect(service.enabled).toBe(false);
    await service.setEnabled(true);
    expect(service.enabled).toBe(true);
});
it("removes marks/listeners and restores the view when its instance stops", async () => {
    await service.setEnabled(true);
    service.reveal(true);
    scope.dispose();
    expect(document.querySelector("[data-jhs-privacy-text],[data-jhs-privacy-media]")).toBeNull();
    expect(document.documentElement.hasAttribute("data-jhs-privacy-active")).toBe(false);
    expect(scope.snapshot()).toMatchObject({ listeners: 0, observers: 0 });
});
it("edits preferences through an explicit save and starts with no shortcut", async () => {
    const close = vi.fn(), root = createPrivacyPreferences({ document, scope, settings, onClose: close });
    document.body.append(root);
    expect(root.querySelector('input[type="text"]').value).toBe("");
    root.querySelector('input[type="checkbox"]').click();
    expect(settings.patch).not.toHaveBeenCalled();
    root.querySelector("button").click();
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(settings.snapshot().privacyTargets).not.toContain("title");
});
it("serializes rapid toggles using the state reached by the previous write", async () => {
    await Promise.all([service.toggle(), service.toggle()]);
    expect(service.enabled).toBe(false);
});
it("hides native tooltips and tab title, then restores them without losing parsing evidence", async () => {
    const title = document.querySelector(".video-title");
    title.setAttribute("title", "ABC-123 tooltip");
    document.title = "ABC-123 title";
    await service.setEnabled(true);
    expect(title.getAttribute("title")).toBe("");
    expect(title.getAttribute("data-jhs-privacy-original-title")).toBe("ABC-123 tooltip");
    expect(document.title).toBe("JHS 隐私遮罩");
    service.reveal(true);
    expect(title.getAttribute("title")).toBe("ABC-123 tooltip");
    expect(document.title).toBe("ABC-123 title");
    service.reveal(false);
    await settings.patch({ privacyTargets: [] });
    expect(title.getAttribute("title")).toBe("ABC-123 tooltip");
    expect(document.title).toBe("ABC-123 title");
});
it("allows title and code masking to be configured independently", async () => {
    await settings.patch({ privacyTargets: ["title"] });
    await service.setEnabled(true);
    expect(document.querySelector(".video-title strong [data-jhs-privacy-text]")).toBeNull();
    expect(document.querySelector(".video-title > [data-jhs-privacy-text]")).not.toBeNull();
});
it("cleans a failed dialog mount and releases each completed preferences owner", () => {
    controller.ui = { jquery: node => node };
    controller.dialog = { open: vi.fn(() => { throw new Error("mount failed"); }), close: vi.fn() };
    expect(() => controller.configure()).toThrow("mount failed");
    expect(controller.dialogScope.disposed).toBe(true);
    expect(document.querySelector(".jhs-privacy-config")).toBeNull();
    const before = scope.cleanups.size;
    let options;
    controller.dialog.open.mockImplementation(value => { options = value; return 1; });
    for (let index = 0; index < 3; index++) { controller.configure(); options.end(); }
    expect(scope.cleanups.size).toBe(before);
});
it("masks JavBus's plain-text code beside its header while retaining dates", async () => {
    controller.host = new JavBusHostAdapter(document, { href: "https://www.javbus.com/ABC-123", pathname: "/ABC-123" });
    const root = document.createElement("div");
    root.innerHTML = '<div class="info"><p><span class="header">識別碼:</span> ABC-123</p><p>发行时间 2026-11-06</p></div><div id="magnet-table"><a href="magnet:?xt=urn:btih:fixture">ABC-123 文件</a></div>';
    document.body.append(root);
    await service.setEnabled(true);
    expect(root.querySelector(".info p [data-jhs-privacy-text]")).not.toBeNull();
    expect(root.querySelector(".info p:last-child [data-jhs-privacy-text]")).toBeNull();
    expect(root.querySelector("#magnet-table [data-jhs-privacy-text]")).not.toBeNull();
});
it("masks asynchronously mounted contact sheets and image viewers", async () => {
    await service.setEnabled(true);
    const root = document.createElement("div");
    root.innerHTML = '<div class="screen-container"><img></div><div class="viewer-container"><img></div>';
    document.body.append(root);
    await vi.waitFor(() => expect(root.querySelectorAll("[data-jhs-privacy-media]")).toHaveLength(2));
});
it("preserves authoritative JavDB code evidence while hiding its native tooltip", async () => {
    document.body.innerHTML = '<div class="column-video-info"><a title="複製番號" data-clipboard-text="ABC-123">ABC-123</a><h1>影片标题</h1></div>';
    const host = new JavDbHostAdapter(document, { href: "https://javdb.com/v/movie-a", pathname: "/v/movie-a" });
    controller.host = host;
    expect(host.readMovieRef()).toMatchObject({ carNum: "ABC-123", stateEligibility: { eligible: true } });
    await service.setEnabled(true);
    expect(document.querySelector("a").title).toBe("");
    expect(host.readMovieRef()).toMatchObject({ carNum: "ABC-123", stateEligibility: { eligible: true } });
});
it("keeps tab titles masked while preserving pagination and late host title updates", async () => {
    document.title = "ABC-123 第1頁";
    await service.setEnabled(true);
    AutoPageController.prototype.updatePageUrl.call({ document, window: { history: { replaceState: vi.fn() } }, hostAdapter: { site: "javbus" }, currentPage: 2 }, "/page/2");
    expect(document.title).toBe("JHS 隐私遮罩");
    service.reveal(true);
    expect(document.title).toBe("ABC-123 第2頁");
    service.reveal(false);
    document.title = "ABC-124 新页面";
    await vi.waitFor(() => expect(document.title).toBe("JHS 隐私遮罩"));
    await service.setEnabled(false);
    expect(document.title).toBe("ABC-124 新页面");
});
it("preserves history column captions and restores original markup when switched off", async () => {
    const root = document.createElement("div");
    root.innerHTML = '<div class="tabulator-col" tabulator-field="carNum">番号</div><div class="tabulator-cell" tabulator-field="carNum">ABC-123</div>';
    document.body.append(root);
    const before = root.innerHTML;
    await service.setEnabled(true);
    expect(root.querySelector(".tabulator-col [data-jhs-privacy-text]")).toBeNull();
    expect(root.querySelector(".tabulator-cell [data-jhs-privacy-text]")).not.toBeNull();
    await service.setEnabled(false);
    expect(root.innerHTML).toBe(before);
    expect(document.querySelector("[data-jhs-privacy-text],[data-jhs-privacy-media]")).toBeNull();
});

it("cannot reactivate privacy after its owner closes during the initial read", async () => {
    let finish;
    const deferredStorage = { ...storage, getValue: () => new Promise(resolve => { finish = resolve; }) };
    const privacy = new PrivacyService({storage:deferredStorage,settings});
    const owner = new LifecycleScope("privacy:late-start");
    const late = new PrivacyController({host:{document},privacy,scope:owner,settings,ui:{},dialog:{},notifications:{error:vi.fn()}});
    const pending = late.start();
    owner.dispose();
    finish(true);
    await expect(pending).rejects.toMatchObject({name:"AbortError"});
    expect(privacy.active).toBe(false);
    expect(privacy.masked).toBe(false);
    privacy.dispose();
});
