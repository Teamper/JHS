import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jquery from "jquery";
import { ListPagePlugin } from "../src/plugins/status/list-page.js";
import { PreviewVideoPlugin } from "../src/plugins/image-viewer/preview-video.js";
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
    it("does not submit a stale password when only the username was edited", async () => {
        const $ = setup('<div id="form"><input id="webDavUsername" value="new-user"><input id="webDavPassword" value="stale-password"></div>');
        const root = $("#form").data("jhsDirtyManualKeys", new Set(["webDavUsername"]));
        const saveProfile = vi.fn(async () => {});
        await saveSettingForm({ settings: { snapshot: () => ({}), update: async fn => fn({}) }, webdav: { saveProfile } }, root);
        expect(saveProfile).toHaveBeenCalledWith({ username: "new-user" });
    });
    it("releases blacklist batch ownership and buttons after context failure", async () => {
        const $ = setup('<button id="filterAllVideo"></button>'), plugin = Object.create(BlacklistPlugin.prototype);
        plugin.getRuntimeService = () => async () => null;
        plugin.getOptionalDependency = () => ({ createEvaluationContext: async () => { throw new Error("context failed"); } });
        await expect(plugin.filterAllVideo("actor", { confirm: false })).rejects.toThrow("context failed");
        expect(isBatchRunActive()).toBe(false);
        expect($("#filterAllVideo").attr("aria-disabled")).not.toBe("true");
        expect($("#filterAllVideo").hasClass("jhs-batch-busy")).toBe(false);
    });
    it("releases batch ownership when scope initialization fails", async () => {
        setup('<button id="favoriteAllVideo"></button>');
        const plugin = Object.create(ListPagePlugin.prototype);
        plugin.getRuntimeService = () => async () => { throw new Error("scope failed"); };
        await expect(plugin.batchSaveAllVideos({}, "favorite", { confirm: false })).rejects.toThrow("scope failed");
        expect(isBatchRunActive()).toBe(false);
        await expect(plugin.batchSaveAllVideos({}, "favorite", { confirm: false })).rejects.toThrow("scope failed");
    });
});
