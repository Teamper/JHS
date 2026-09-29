import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jquery from "jquery";
import { ListPageCompatibilityService as ListPagePlugin } from "../src/features/list/list-compatibility-service.js";
import { JavDbPreviewController as PreviewVideoPlugin } from "../src/features/detail/javdb-preview-controller.js";
import { JavBusHostAdapter } from "../src/platform/hosts/javbus-host-adapter.js";
import { initializeRuntimeConstants } from "../src/core/constants.js";
import { isBatchRunActive } from "../src/features/list/batch-coordinator.js";
import { saveSettingForm } from "../src/plugins/backup/setting-forms.js";
import { BlacklistPlugin } from "../src/plugins/blacklist/blacklist.js";

let dom;
function setup(html, url = "https://www.javbus.com/search/1234567/3") {
    dom = new JSDOM(html, { url });
    const $ = jquery(dom.window);
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, $, clog: { error() {}, debug() {} }, show: { error() {} } })) vi.stubGlobal(key, value);
    initializeRuntimeConstants(dom.window.location);
    return $;
}
afterEach(() => { dom?.window.close(); vi.unstubAllGlobals(); });
describe("reviewed UI regressions", () => {
    it("routes the legacy blacklist batch API through the List Feature controller", async () => {
        setup('<button id="filterAllVideo"></button>');
        const batch = vi.fn(async (scope, flag, options) => ({ matched: 2, updated: 2 }));
        const plugin = new BlacklistPlugin({ executeCommand: vi.fn(), getSubjectInfo: vi.fn(), batchAllVideos: batch });
        await expect(plugin.filterAllVideo("Actor", { filter: "all", confirm: false, root: null })).resolves.toEqual({ matched: 2, updated: 2 });
        expect(batch).toHaveBeenCalledWith(
            "Actor", { filter: "all", confirm: false, root: null },
        );
    });
    it("does not submit a stale password when only the username was edited", async () => {
        const $ = setup('<div id="form"><input id="webDavUsername" value="new-user"><input id="webDavPassword" value="stale-password"></div>');
        const root = $("#form").data("jhsDirtyManualKeys", new Set(["webDavUsername"]));
        const saveProfile = vi.fn(async () => {});
        await saveSettingForm({
            settings: { snapshot: () => ({}), update: async fn => fn({}) }, webdav: { saveProfile },
            jquery: $, document: dom.window.document, legacyStorage: {}, utilities: {}, events: {}, logger: {},
        }, root);
        expect(saveProfile).toHaveBeenCalledWith({ username: "new-user" });
    });
    it("restores JavBus text without losing the host link", async () => {
        const $ = setup('<div class="item"><a href="/ABC-123"><img data-title="原題"><div class="video-title" title="原題">翻译标题</div></a></div>');
        const plugin = Object.create(ListPagePlugin.prototype);
        plugin.getSelector = () => ({ itemSelector: ".item" });
        await plugin.revertTranslation();
        expect($(".video-title").text().trim()).toBe("原題");
        expect($("a").attr("href")).toBe("/ABC-123");
    });
    it("keeps native preview actions when DMM is disabled", async () => {
        const $ = setup('<div class="fancybox-content"><video id="preview-video"></video></div>', "https://javdb.com/v/abc");
        vi.stubGlobal("getComputedStyle", dom.window.getComputedStyle.bind(dom.window));
        vi.stubGlobal("MutationObserver", dom.window.MutationObserver);
        dom.window.HTMLMediaElement.prototype.play = vi.fn(async () => {});
        const plugin = Object.create(PreviewVideoPlugin.prototype), favoriteOne = vi.fn();
        plugin.getRuntimeService = () => ({ snapshot: () => ({ enablePreviewVideo: "yes", enableLoadPreviewVideo: "no" }) });
        plugin.getOptionalDependency = () => ({ favoriteOne });
        plugin.previewGeneration = 0;
        await plugin.handleVideo();
        $("#video-favoriteBtn").trigger("click");
        expect(favoriteOne).toHaveBeenCalledOnce();
        plugin.unmountDmmPlayer();
        expect($("#video-favoriteBtn")).toHaveLength(1);
    });
    it("routes the legacy batch API through its Feature-owned controller", async () => {
        setup('<button id="favoriteAllVideo"></button>');
        const plugin = Object.create(ListPagePlugin.prototype), batchController = { run: vi.fn(async () => ({ matched: 2, updated: 2 })) };
        plugin.listBatchController = batchController;
        await expect(plugin.batchSaveAllVideos({ kind: "search" }, "favorite", { confirm: false })).resolves.toEqual({ matched: 2, updated: 2 });
        expect(batchController.run).toHaveBeenCalledWith({ kind: "search" }, "favorite", { confirm: false });
        expect(isBatchRunActive()).toBe(false);
    });
    it.each(["search", "star", "genre"])("keeps numeric %s ids when resolving page one", prefix => {
        const host = new JavBusHostAdapter(null, null);
        expect(host.resolveFirstPageUrl(`https://www.javbus.com/en/${prefix}/1234567/3`)).toBe(`https://www.javbus.com/en/${prefix}/1234567`);
        expect(host.resolveFirstPageUrl(`https://www.javbus.com/${prefix}/1234567`)).toBe(`https://www.javbus.com/${prefix}/1234567`);
    });
});
