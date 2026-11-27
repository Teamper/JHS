import { saveSettingForm } from "../src/features/settings/setting-forms.js";
import { bindClick } from "../src/features/settings/settings-form-actions.js";
import { SettingsService } from "../src/services/settings-service.js";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";

describe("settings invalidation ownership", () => {
    it("emits one completion event for a stored settings patch", async () => {
        let stored = { themeMode: "light", reviewCount: 20 };
        const set = vi.fn(async (_key, value) => { stored = value; }), afterPersist = vi.fn();
        const settings = new SettingsService({ get: async () => stored, set }, { afterPersist });
        const onChange = vi.fn();
        settings.addEventListener("settings.changed", onChange);
        await settings.patch({ themeMode: "dark", reviewCount: 30 });
        expect(set).toHaveBeenCalledOnce();
        expect(afterPersist).toHaveBeenCalledExactlyOnceWith({ themeMode: "dark", reviewCount: 30 }, ["themeMode", "reviewCount"]);
        expect(onChange).toHaveBeenCalledOnce();
    });

    it("uses the EventBus binding initialized after form import and isolates UI refresh failures", async () => {
        const dom = new JSDOM("<div></div>"), $ = jqueryFactory(dom.window), bus = { emit: async () => { throw new Error("bus unavailable"); } };
        const newVideo = { resetBtnTip: () => { throw new Error("new-video unavailable"); } };
        const blacklist = { resetBtnTip: vi.fn(), reloadTable: vi.fn() };
        const logger = { error: vi.fn() };
        const settings = { snapshot: () => ({ trustedLocalOrigins: [] }), update: async updater => updater({ trustedLocalOrigins: [] }) };
        const dependencies = {
            settings, newVideo, blacklist, movie: {}, jquery: $, document: dom.window.document,
            keywordRules: { getReviewKeywords: async () => [], getTitleKeywords: async () => [] },
            utilities: {}, events: bus, logger,
        };
        await expect(saveSettingForm(dependencies, $(dom.window.document.querySelector("div")))).resolves.toEqual({ ok: true });
        expect(blacklist.resetBtnTip).toHaveBeenCalledOnce();
        expect(blacklist.reloadTable).toHaveBeenCalledOnce();
        expect(logger.error).toHaveBeenCalledTimes(2);
        dom.window.close();
    });

    it.each([".clean-btn", "#clean-all"])("clears actress profile attempts from %s", async selector => {
        const dom = new JSDOM('<main><button class="clean-btn" data-key="jhs_actress_info"></button><button id="clean-all"></button></main>');
        const $ = jqueryFactory(dom.window);
        const local = new Map([["jhs_actress_info", "{}"]]);
        const clearActressProfileBackfillAttempts = vi.fn();
        const services = {
            storage: { removeLocal: key => local.delete(key) },
            state: { clearActressProfileBackfillAttempts },
            cache: { clearNamespace: vi.fn(), clearAll: vi.fn(), clearThirdPartyCache: vi.fn() },
            translation: { clearCache: vi.fn() },
        };
        bindClick({
            jquery: $, document: dom.window.document, _settingPanels: {},
            getFormDependencies: () => ({}), getRuntimeService: name => services[name],
            cacheItems: [{ key: "jhs_actress_info" }], notifications: { ok: vi.fn() },
        }, $("main"));
        $(selector).trigger("click");
        await vi.waitFor(() => expect(clearActressProfileBackfillAttempts).toHaveBeenCalledOnce());
        expect(local.has("jhs_actress_info")).toBe(false);
        dom.window.close();
    });
});
