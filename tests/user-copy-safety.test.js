import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { StorageManager } from "../src/core/storage.js";
import { ExternalBridgeTranslationController } from "../src/features/translation/translation-controller.js";
import { renderTranslatedTitle } from "../src/ui/translation/title-translation.js";
import { OtherSitesController } from "../src/features/external-sites/other-sites-controller.js";
import { V } from "../src/core/javdb-api.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { installVisibleLayout } from "./helpers/visible-layout.js";

afterEach(() => vi.unstubAllGlobals());

describe("user copy keeps technical diagnostics private", () => {
    it("keeps a legacy detail response error in diagnostics and out of its user notice", async () => {
        const error = vi.fn(), notice = vi.fn(), message = "https://private.example/?token=secret";
        vi.stubGlobal("md5", () => "fixture-signature");
        vi.stubGlobal("clog", { error });
        vi.stubGlobal("show", { error: notice });
        vi.stubGlobal("storageManager", { cachedRequest: vi.fn(async () => ({ message })) });
        let failure;
        try { await V("fixture-movie"); } catch (caught) { failure = caught; }
        expect(failure).toBeInstanceOf(Error);
        expect(failure.message).toBe(message);
        expect(error).toHaveBeenCalledWith("影片详情加载失败", failure);
        expect(notice).toHaveBeenCalledWith("影片详情加载失败，请重试");
        expect(notice.mock.calls.flat().join(" ")).not.toContain("secret");
    });

    it("keeps third-party failure hints safe and retains the original known-code errors", async () => {
        const dom = new JSDOM('<body><a data-jhs-site-id="jableBtn">Jable</a></body>');
        const $ = jqueryFactory(dom.window), debug = vi.fn(), setLocal = vi.fn();
        const searchExternalSite = vi.fn();
        const controller = new OtherSitesController({
            document: dom.window.document, window: dom.window, jquery: $, hostAdapter: {},
            movie: { searchExternalSite }, storage: { getLocal: () => null, setLocal },
            settings: { snapshot: () => ({}) }, events: {}, scope: {}, ui: { isHidden: () => false },
            notifications: { debug }, site: "javdb", route: "detail",
        });
        try {
            for (const [code, message] of [
                ["CIRCUIT_OPEN", "此来源暂不可用，请稍后重试"],
                ["CF_BLOCKED", "站点安全验证未通过，请稍后重试"],
                ["INVALID_URL", "站点地址不可用，请在设置中检查"],
                ["NOT_FOUND", "未找到影片，点击前往搜索页"],
            ]) {
                const failure = Object.assign(new Error("https://private.example/?token=secret"), { code });
                searchExternalSite.mockRejectedValueOnce(failure);
                await controller.handleSite("ABC-1", { id: "jableBtn" });
                expect($("[data-jhs-site-id]").attr("title")).toBe(message);
                expect(dom.window.document.body.outerHTML).not.toContain("secret");
                expect(debug).toHaveBeenLastCalledWith(expect.any(String), failure);
            }
            expect(setLocal).not.toHaveBeenCalled();
        } finally { dom.window.close(); }
    });

    it("keeps the original storage error while showing an actionable message", async () => {
        const error = vi.fn();
        vi.stubGlobal("show", { error });
        await expect(StorageManager.prototype.saveCar.call({}, { carNum: "ABC-1", url: "/v/a", actionType: "internal-action-secret" })).rejects.toThrow("actionType错误, 请联系作者更正: internal-action-secret");
        expect(error).toHaveBeenCalledWith("操作无法完成，请反馈给作者");
        expect(error.mock.calls.flat().join(" ")).not.toContain("internal-action-secret");
    });

    it("shows a safe detail translation failure and retains the original diagnostic", async () => {
        const dom = new JSDOM("<body><h1>ABC-1 原题</h1></body>");
        installVisibleLayout(dom.window);
        const failure = new Error("https://private.example/?token=secret"), recordError = vi.fn();
        const controller = new ExternalBridgeTranslationController({
            document: dom.window.document, window: dom.window, route: "detail", hostAdapter: {}, listPage: null,
            settings: { snapshot: () => ({ translateTitle: "yes" }) },
            translation: { translate: vi.fn().mockRejectedValue(failure) }, styles: {},
            diagnostics: { recordError }, scope: new LifecycleScope("safe-translation-error"),
        });
        await controller.translateDetail(0);
        expect(dom.window.document.querySelector(".translated-title")?.textContent).toBe("翻译失败，请重试");
        expect(dom.window.document.body.textContent).not.toContain("secret");
        expect(recordError).toHaveBeenCalledWith(expect.objectContaining({ message: failure.message }));
        dom.window.close();
    });

    it("keeps the FC2 translation failure safe while logging the original error", async () => {
        const dom = new JSDOM('<body><div class="origin-title">ABC-1 原题</div></body>');
        const failure = new Error("https://private.example/?token=secret"), error = vi.fn();
        vi.stubGlobal("$", jqueryFactory(dom.window));
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("clog", { error });
        await renderTranslatedTitle({ root: dom.window.document, translation: { translate: vi.fn().mockRejectedValue(failure) }, isActive: () => true });
        expect(dom.window.document.querySelector(".translated-title")?.textContent).toBe("翻译失败，请重试");
        expect(dom.window.document.body.textContent).not.toContain("secret");
        expect(error).toHaveBeenCalledWith("翻译失败:", failure);
        dom.window.close();
    });
});
