// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { CoverButtonController } from "../src/features/list/cover-button-controller.js";
import { ListPageCompatibilityService } from "../src/features/list/list-compatibility-service.js";

function createSettings(initial) {
    let values = { ...initial };
    const listeners = new Set();
    return {
        snapshot: () => ({ ...values }),
        addEventListener: (_name, handler) => listeners.add(handler),
        removeEventListener: (_name, handler) => listeners.delete(handler),
        listeners,
        update: (patch) => {
            values = { ...values, ...patch };
            for (const handler of listeners) handler({ detail: { names: Object.keys(patch) } });
        },
    };
}

function createController({ screenshotAvailable = true, settings: settingValues = {} } = {}) {
    const win = /** @type {any} */ (window);
    const doc = window.document;
    doc.body.innerHTML = `<div class="movie-list"><div class="item"><a href="/v/abc-123"><img class="cover-image" src="https://images.example.test/cover.jpg"><div class="video-title"><strong>ABC-123</strong> Test title</div><div class="meta">2026-08-25</div></a><div class="tags"></div></div></div>`;
    const $ = jqueryFactory;
    const settings = createSettings({ enableScreenSvg: "yes", enableVideoSvg: "yes", enablePreviewVideo: "no", enableLoadPreviewVideo: "yes", enableHandleSvg: "yes", enableSiteSvg: "yes", enableCopySvg: "yes", ...settingValues });
    const state = { patch: vi.fn(async () => {}) };
    const ui = {
        jquery: $,
        confirm: vi.fn(),
        loading: () => ({ close: vi.fn() }),
        openImageViewer: vi.fn(),
        openPage: vi.fn(),
    };
    const notifications = { error: vi.fn(), ok: vi.fn(), info: vi.fn() };
    const diagnostics = { recordError: vi.fn() };
    const navigation = { open: vi.fn() };
    const list = {
        getSelector: () => ({ itemSelector: ".movie-list .item" }),
        findCarNumAndHref: (item) => {
            const card = item?.jquery ? item : $(item);
            return { carNum: card.find(".video-title strong").text(), title: card.find(".video-title").text(), url: card.find("a").attr("href"), publishTime: card.find(".meta").text(), fc2Source: null };
        },
        parseActressName: vi.fn(async () => "测试演员"),
    };
    const scope = new LifecycleScope("cover-button-test");
    const controller = new CoverButtonController({
        document: doc, window: win, list, settings, state,
        screenshot: { resolve: vi.fn(async () => ({ url: "https://images.example.test/screenshot.jpg" })) },
        storage: {}, movie: { externalSiteOrigin: (key) => `https://${key}.example.test`, providerOrigin: () => "https://123av.example.test" },
        scope, ui, clipboard: { copyText: vi.fn(async () => true) }, notifications, diagnostics, navigation,
        screenshotAvailable, isJavBus: false,
    });
    return { window: win, document: doc, $, settings, state, ui, notifications, diagnostics, navigation, list, scope, controller };
}

describe("native list card actions Feature", () => {
    let current;
    afterEach(() => {
        current?.scope.dispose();
        if (current) current.document.body.innerHTML = "";
        current = null;
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("gates screenshot and DMM controls while applying card settings live", async () => {
        current = createController({ screenshotAvailable: false });
        await current.controller.start();
        const card = current.document.querySelector(".item");
        const display = (selector) => card.querySelector(selector).style.display;
        expect(card.querySelectorAll(".jhs-cover-tools")).toHaveLength(1);
        expect(display(".screenSvg")).toBe("none");
        expect(display(".videoSvg")).toBe("none");
        expect(display(".handleSvg")).not.toBe("none");

        current.settings.update({ enableHandleSvg: "no", enablePreviewVideo: "yes" });
        expect(display(".handleSvg")).toBe("none");
        expect(display(".videoSvg")).not.toBe("none");
        current.settings.update({ enablePreviewVideo: "no", enableHandleSvg: "yes" });
        expect(display(".videoSvg")).toBe("none");
        expect(display(".handleSvg")).not.toBe("none");
    });

    it("applies the list long-screenshot switch live", async () => {
        current = createController({ screenshotAvailable: true, settings: { enableScreenSvg: "yes" } });
        await current.controller.start();
        const card = current.document.querySelector(".item");
        const display = () => card.querySelector(".screenSvg").style.display;
        expect(display()).not.toBe("none");

        current.settings.update({ enableScreenSvg: "no" });
        expect(display()).toBe("none");
        current.settings.update({ enableScreenSvg: "yes" });
        expect(display()).not.toBe("none");
    });

    it("opens the screenshot viewer when the enabled card action is clicked", async () => {
        current = createController({ screenshotAvailable: true });
        await current.controller.start();

        current.document.querySelector(".screenSvg").click();

        await vi.waitFor(() => expect(current.controller.screenshot.resolve).toHaveBeenCalledWith(
            { carNum: "ABC-123" },
            expect.objectContaining({ allowWhenDisabled: true, scope: current.scope }),
        ));
        expect(current.ui.openImageViewer).toHaveBeenCalledOnce();
        expect(current.ui.openImageViewer.mock.calls[0][0]).toBe("https://images.example.test/screenshot.jpg");
    });

    it("keeps the clicked screenshot button through asynchronous resolution and later delegated handlers", async () => {
        current = createController();
        let resolveScreenshot;
        current.controller.screenshot.resolve.mockImplementation(() => new Promise(resolve => { resolveScreenshot = resolve; }));
        await current.controller.start();
        const trigger = current.document.querySelector(".screenSvg"), card = trigger.closest(".item");
        current.$(current.document).on("click.screenshotTriggerTest", ".item", () => {});
        current.scope.addCleanup(() => current.$(current.document).off(".screenshotTriggerTest"));
        trigger.click();
        expect(current.ui.openImageViewer).not.toHaveBeenCalled();
        resolveScreenshot({ url: "https://images.example.test/delayed.jpg" });
        await vi.waitFor(() => expect(current.ui.openImageViewer).toHaveBeenCalledOnce());
        expect(current.ui.openImageViewer.mock.calls[0][1]).toEqual({ imageKind:"contact-sheet", owner: card, trigger, scope: current.scope });
    });

    it("applies third-party and copy card switches live", async () => {
        current = createController();
        await current.controller.start();
        const card = current.document.querySelector(".item");
        const display = (selector) => card.querySelector(selector).style.display;
        expect(display(".siteSvg")).not.toBe("none");
        expect(display(".copySvg")).not.toBe("none");

        current.settings.update({ enableSiteSvg: "no", enableCopySvg: "no" });
        expect(display(".siteSvg")).toBe("none");
        expect(display(".copySvg")).toBe("none");

        current.settings.update({ enableSiteSvg: "yes", enableCopySvg: "yes" });
        expect(display(".siteSvg")).not.toBe("none");
        expect(display(".copySvg")).not.toBe("none");
    });

    it("keeps the detail fallback available when DMM is disabled", async () => {
        current = createController({ settings: { enableVideoSvg: "yes", enablePreviewVideo: "yes", enableLoadPreviewVideo: "yes" } });
        await current.controller.start();
        const card = current.document.querySelector(".item");
        const display = () => card.querySelector(".videoSvg").style.display;
        expect(display()).not.toBe("none");

        current.settings.update({ enableVideoSvg: "no" });
        expect(display()).toBe("none");
        current.settings.update({ enableVideoSvg: "yes" });
        expect(display()).not.toBe("none");

        current.settings.update({ enablePreviewVideo: "no" });
        expect(display()).toBe("none");
        current.settings.update({ enablePreviewVideo: "yes", enableLoadPreviewVideo: "no" });
        expect(display()).not.toBe("none");
        current.settings.update({ enableLoadPreviewVideo: "yes" });
        expect(display()).not.toBe("none");
    });

    it("records the existing list-card state operation with the parsed page identity", async () => {
        current = createController();
        await current.controller.start();
        current.document.querySelector(".favoriteBtn").click();
        await vi.waitFor(() => expect(current.state.patch).toHaveBeenCalledOnce());
        expect(current.state.patch).toHaveBeenCalledWith("ABC-123", { favorite: true }, {
            type: "list-card-state",
            record: { carNum: "ABC-123", url: "/v/abc-123", names: "测试演员", publishTime: "2026-08-25", fc2Source: null },
        });
        expect(current.notifications.ok).toHaveBeenCalledWith("已更新影片状态");
    });

    it("returns menu actions to their trigger before opening a confirmation", async () => {
        current = createController(); await current.controller.start();
        const trigger = current.document.querySelector(".handleSvg .jhs-card-menu-trigger");
        current.ui.confirm.mockImplementation(() => {
            expect(current.document.activeElement).toBe(trigger);
            const dialogButton = current.document.createElement("button");
            dialogButton.id = "confirmation"; current.document.body.append(dialogButton); dialogButton.focus();
        });
        trigger.click(); current.document.querySelector(".filterBtn").click();
        expect(current.document.activeElement.id).toBe("confirmation");
    });

    it("restores keyboard focus after copying from the portalled menu", async () => {
        current = createController(); await current.controller.start();
        const trigger = current.document.querySelector(".copySvg .jhs-card-menu-trigger");
        trigger.click(); current.document.querySelector(".carNumSvg").click();
        expect(current.controller.clipboard.copyText).toHaveBeenCalledWith("番号", "ABC-123");
        expect(current.document.activeElement).toBe(trigger);
    });

    it.each([false, true])("uses the next visible card after filtering unless focus moved, moved=%s", async moved => {
        current = createController();
        const card = current.document.querySelector(".item"), next = card.cloneNode(true);
        card.after(next); current.document.body.insertAdjacentHTML("beforeend", '<button id="elsewhere">其他操作</button>');
        vi.spyOn(window.HTMLElement.prototype, "getClientRects").mockImplementation(function () { return this.closest("[hidden]") ? [] : [{}]; });
        let finish;
        current.state.patch.mockImplementation(() => new Promise(resolve => { finish = () => { card.hidden = true; card.querySelector("button")?.blur(); resolve({}); }; }));
        await current.controller.start();
        const trigger = card.querySelector(".handleSvg .jhs-card-menu-trigger");
        trigger.click(); current.document.querySelector(".favoriteBtn").click();
        await vi.waitFor(() => expect(current.state.patch).toHaveBeenCalledOnce());
        if (moved) current.document.querySelector("#elsewhere").focus();
        finish(); await vi.waitFor(() => expect(current.notifications.ok).toHaveBeenCalledOnce());
        expect(current.document.activeElement).toBe(moved ? current.document.querySelector("#elsewhere") : next.querySelector("a"));
    });

    it("falls back to the card link if the menu trigger disappears during its action", async () => {
        current = createController(); await current.controller.start();
        vi.spyOn(window.HTMLElement.prototype, "getClientRects").mockImplementation(function () { return this.isConnected ? [{}] : []; });
        const trigger = current.document.querySelector(".copySvg .jhs-card-menu-trigger"), link = current.document.querySelector(".item a");
        trigger.click(); trigger.remove(); current.document.querySelector(".carNumSvg").click();
        expect(current.document.activeElement).toBe(link);
    });

    it.each([false, true])("does not commit or notify after a disposed actor lookup, rejecting=%s", async reject => {
        current = createController(); let finish;
        current.list.parseActressName.mockImplementation(() => new Promise((yes, no) => { finish = reject ? no : yes; }));
        await current.controller.start(); current.document.querySelector(".favoriteBtn").click();
        expect(current.list.parseActressName).toHaveBeenCalledWith("/v/abc-123", current.scope);
        current.scope.dispose(); finish(reject ? new Error("cancelled lookup") : "演员");
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(current.state.patch).not.toHaveBeenCalled();
        expect(current.notifications.ok).not.toHaveBeenCalled(); expect(current.notifications.error).not.toHaveBeenCalled();
    });

    it("passes the optional cover scope through the compatibility capability and preserves old callers", async () => {
        const listScope = new LifecycleScope("list"), coverScope = new LifecycleScope("cover");
        const request = vi.fn(async () => ({ data: "<main></main>" })), resolveScope = vi.fn(async () => listScope);
        vi.stubGlobal("utils", { htmlTo$dom: jqueryFactory });
        const list = new ListPageCompatibilityService({ runtimeServices: { legacyStorage: { getSetting: async () => "yes" }, scope: resolveScope, http: { request }, logger: { debug() {} } } });
        await list.getCoverButtonCapability().parseActressName("https://javdb.com/v/abc-123", coverScope);
        expect(request.mock.calls[0][1]).toBe(coverScope); expect(resolveScope).not.toHaveBeenCalled();
        await list.getCoverButtonCapability().parseActressName("https://javdb.com/v/abc-123");
        expect(request.mock.calls[1][1]).toBe(listScope); expect(resolveScope).toHaveBeenCalledOnce();
        coverScope.dispose(); listScope.dispose();
    });

    it("does not start the actor GET if its cover scope expires while the setting loads", async () => {
        const coverScope = new LifecycleScope("cover"), request = vi.fn(); let finish;
        const list = new ListPageCompatibilityService({ runtimeServices: { legacyStorage: { getSetting: () => new Promise(resolve => { finish = resolve; }) }, http: { request }, logger: { debug() {} } } });
        const pending = list.getCoverButtonCapability().parseActressName("https://javdb.com/v/abc-123", coverScope);
        coverScope.dispose(); finish("yes");
        await expect(pending).rejects.toMatchObject({ name: "AbortError" }); expect(request).not.toHaveBeenCalled();
    });

    it("does not start actor resolution when confirmation arrives after disposal", async () => {
        current = createController(); await current.controller.start();
        current.document.querySelector(".filterBtn").click();
        const confirm = current.ui.confirm.mock.calls[0][2];
        current.scope.dispose(); await confirm();
        expect(current.list.parseActressName).not.toHaveBeenCalled(); expect(current.state.patch).not.toHaveBeenCalled();
    });

    it.each([false, true])("lets an issued patch settle without late UI after disposal, rejecting=%s", async reject => {
        current = createController(); let finish;
        current.state.patch.mockImplementation(() => new Promise((yes, no) => { finish = reject ? no : yes; }));
        await current.controller.start(); current.document.querySelector(".favoriteBtn").click();
        await vi.waitFor(() => expect(current.state.patch).toHaveBeenCalledOnce());
        current.scope.dispose(); finish(reject ? new Error("write failure") : {});
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(current.state.patch).toHaveBeenCalledOnce();
        expect(current.notifications.ok).not.toHaveBeenCalled(); expect(current.notifications.error).not.toHaveBeenCalled();
    });

    it("escapes card numbers before the confirmation reaches an HTML renderer", async () => {
        current = createController();
        await current.controller.start();
        const untrusted = 'ABC-123<img id="jhs-cover-xss" src=x onerror="window.__jhsXss=true">';
        current.document.querySelector(".video-title strong").textContent = untrusted;
        current.document.querySelector(".filterBtn").click();

        const message = current.ui.confirm.mock.calls[0][1];
        const rendered = current.document.createElement("div");
        rendered.innerHTML = message;
        expect(rendered.querySelector("#jhs-cover-xss")).toBeNull();
        expect(rendered.textContent).toContain(untrusted);
    });

    it("keeps keyboard menu behavior and modifier-click background navigation", async () => {
        current = createController();
        await current.controller.start();
        const trigger = current.document.querySelector(".handleSvg .jhs-card-menu-trigger");
        trigger.click();
        expect(trigger.getAttribute("aria-expanded")).toBe("true");
        const first = current.document.querySelector(".jhs-owned-popover [role='menuitem']");
        first.dispatchEvent(new current.window.KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
        expect(current.document.activeElement.textContent).toContain("屏蔽");

        const siteLink = current.document.querySelector(".site-jable");
        siteLink.dispatchEvent(new current.window.MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
        expect(current.navigation.open).toHaveBeenCalledWith("https://jableBtn.example.test/search/ABC-123/", { newTab: true, background: true });
    });

    it("removes delegated handlers, listeners, and transient players when its scope closes", async () => {
        current = createController();
        await current.controller.start();
        expect(current.settings.listeners.size).toBe(1);
        current.scope.dispose();
        expect(current.settings.listeners.size).toBe(0);
        expect(current.document.querySelectorAll(".jhs-card-menu.is-open, .loading-spinner, [id$='_preview_video']")).toHaveLength(0);
    });
    it("falls back to the existing detail preview without requesting DMM when its sub-switch is off",async()=>{
        current=createController({settings:{enablePreviewVideo:"yes",enableLoadPreviewVideo:"no"}});
        current.controller.movie.preview=vi.fn(); await current.controller.start();
        current.document.querySelector('.videoSvg').click();
        expect(current.controller.movie.preview).not.toHaveBeenCalled();
        expect(current.ui.openPage).toHaveBeenCalledWith('/v/abc-123','ABC-123',true,{preview:true});
        expect(current.controller.activePreview).toBeNull();
    });
    it("returns to the cover and ignores delayed resolution after cancellation",async()=>{
        current=createController({settings:{enablePreviewVideo:"yes"}}); vi.stubGlobal('clog',{debug:vi.fn(),warn:vi.fn(),error:vi.fn()});
        let resolve; current.controller.movie.preview=vi.fn(()=>new Promise(done=>resolve=done));
        current.controller.storage={getLocal:()=>null,setLocal:vi.fn()}; await current.controller.start();
        const button=current.document.querySelector('.videoSvg'); button.click(); await Promise.resolve(); button.click();
        resolve({sources:{mhb_w:'https://example.test/preview.mp4'}}); await new Promise(done=>setTimeout(done,0));
        expect(current.document.querySelector('.jhs-card-preview')).toBeNull();
        expect(current.controller.activePreview).toBeNull(); expect(current.ui.openPage).not.toHaveBeenCalled();
    });
    it("uses card identity for duplicate movie numbers and never revives the previous card",async()=>{
        current=createController({settings:{enablePreviewVideo:"yes"}}); vi.stubGlobal('clog',{debug:vi.fn(),warn:vi.fn(),error:vi.fn()});
        const original=current.document.querySelector('.item'); original.after(original.cloneNode(true));
        const pending=[]; current.controller.movie.preview=vi.fn(()=>new Promise(done=>pending.push(done)));
        current.controller.storage={getLocal:()=>null,setLocal:vi.fn()}; await current.controller.start();
        const buttons=current.document.querySelectorAll('.videoSvg'); buttons[0].click(); await Promise.resolve(); buttons[1].click(); await Promise.resolve();
        pending[0]({sources:{mhb_w:'https://example.test/preview.mp4'}}); await new Promise(done=>setTimeout(done,0));
        expect(current.controller.activePreview.card).toBe(current.document.querySelectorAll('.item')[1]);
        expect(current.document.querySelectorAll('.item')[0].querySelector('.jhs-card-preview')).toBeNull();
        current.scope.dispose(); pending[1]({sources:null});
    });

    it("refreshes only the failed cached source once after an actual playback error",async()=>{
        current=createController({settings:{enablePreviewVideo:"yes"}}); vi.stubGlobal('clog',{debug:vi.fn(),warn:vi.fn(),error:vi.fn()});
        vi.spyOn(window.HTMLMediaElement.prototype,'readyState','get').mockReturnValue(3);
        vi.spyOn(window.HTMLMediaElement.prototype,'play').mockResolvedValue();
        vi.spyOn(window.HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
        vi.spyOn(window.HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
        let cache={'ABC-123':{mhb_w:'https://example.test/bad.mp4'},'KEEP-100':{mhb_w:'https://example.test/keep.mp4'}};
        current.controller.storage={getLocal:key=>key==='jhs_dmm_video'?JSON.stringify(cache):null,setLocal:vi.fn((key,value)=>{if(key==='jhs_dmm_video')cache=JSON.parse(value);})};
        current.controller.movie.preview=vi.fn(async()=>({sources:{mhb_w:'https://example.test/fresh.mp4'}})); await current.controller.start();
        current.document.querySelector('.videoSvg').click(); await vi.waitFor(()=>expect(current.document.querySelector('video')).not.toBeNull());
        await vi.waitFor(()=>expect(current.controller.activePreview.mediaReady).toBe(true));
        const video=current.document.querySelector('video'); Object.defineProperty(video,'error',{value:{code:4}}); video.dispatchEvent(new Event('error'));
        await vi.waitFor(()=>expect(current.document.querySelector('video')?.src).toBe('https://example.test/fresh.mp4'));
        expect(cache['KEEP-100']).toEqual({mhb_w:'https://example.test/keep.mp4'}); expect(current.controller.movie.preview).toHaveBeenCalledOnce();
        await vi.waitFor(()=>expect(current.controller.activePreview.mediaReady).toBe(true));
        const refreshed=current.document.querySelector('video'); Object.defineProperty(refreshed,'error',{value:{code:4}}); refreshed.dispatchEvent(new Event('error'));
        await vi.waitFor(()=>expect(current.ui.openPage).toHaveBeenCalledOnce()); expect(current.controller.movie.preview).toHaveBeenCalledOnce();
    });
    it("focuses the player on autoplay rejection without treating its source as broken",async()=>{
        current=createController({settings:{enablePreviewVideo:"yes"}}); vi.stubGlobal('clog',{debug:vi.fn(),warn:vi.fn(),error:vi.fn()});
        vi.spyOn(window.HTMLMediaElement.prototype,'readyState','get').mockReturnValue(3);
        vi.spyOn(window.HTMLMediaElement.prototype,'play').mockRejectedValue(new DOMException('gesture required','NotAllowedError'));
        vi.spyOn(window.HTMLMediaElement.prototype,'pause').mockImplementation(()=>{}); vi.spyOn(window.HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
        const setLocal=vi.fn(); current.controller.storage={getLocal:()=>JSON.stringify({'ABC-123':{mhb_w:'https://example.test/valid.mp4'}}),setLocal};
        await current.controller.start(); current.document.querySelector('.videoSvg').click();
        await vi.waitFor(()=>expect(current.document.activeElement.tagName).toBe('VIDEO'));
        expect(setLocal).not.toHaveBeenCalled(); expect(current.notifications.error).not.toHaveBeenCalled(); expect(current.ui.openPage).not.toHaveBeenCalled();
        expect(current.controller.diagnostics.recordError).toHaveBeenCalledWith(expect.objectContaining({message:expect.stringContaining('NotAllowedError')}));
    });

});
