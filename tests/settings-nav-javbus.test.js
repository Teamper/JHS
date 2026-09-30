// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { SettingPlugin } from "../src/plugins/backup/setting.js";

const $ = jquery;
afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture(route, compact = false) {
    vi.stubGlobal("storageManager", {});
    document.body.innerHTML = route === "list"
        ? '<div class="container-fluid"><div class="masonry"></div></div>'
        : '<div class="container-fluid"><h3>影片详情</h3><div id="mag-submit-show"></div></div>';
    delete window.isListPage;
    delete window.isDetailPage;
    const scope = new LifecycleScope("settings-nav-test");
    const profile = new window.EventTarget();
    let mode = compact ? "compact" : "regular";
    profile.current = () => mode;
    const host = { locateListRoot: () => document.querySelector(".masonry"), locateDetailRoot: () => document.querySelector("#mag-submit-show") };
    const plugin = new SettingPlugin({ site: "javbus", route, runtimeServices: { host, settings: { snapshot: () => ({}) } }, jquery: $, utilities: {}, notifications: {}, logger: {}, document, window });
    plugin.activateFeatureSurface(scope, profile);
    return { plugin, scope, profile, change(value) { mode = value; profile.dispatchEvent(new window.Event("profile.changed")); } };
}

describe("JavBus settings navigation", () => {
    it("mounts on a list without legacy page flags or an inspection button", () => {
        const test = fixture("list");
        expect(document.querySelectorAll("#setting-btn")).toHaveLength(1);
        expect(document.querySelector("#top-right-box").nextElementSibling?.classList.contains("masonry")).toBe(true);
        test.plugin.mountDesktopSettingNav();
        expect(document.querySelectorAll("#setting-btn")).toHaveLength(1);
        test.change("compact");
        expect(document.querySelectorAll("#setting-btn")).toHaveLength(0);
        test.change("regular");
        expect(document.querySelectorAll("#setting-btn")).toHaveLength(1);
        test.scope.dispose();
        expect(document.querySelectorAll("#setting-btn")).toHaveLength(0);
    });

    it("mounts once before the detail heading", () => {
        const test = fixture("detail");
        expect(document.querySelectorAll("#setting-btn")).toHaveLength(1);
        expect(document.querySelector("h3").previousElementSibling?.classList.contains("jhs-setting-detail-anchor")).toBe(true);
        test.plugin.mountDesktopSettingNav();
        expect(document.querySelectorAll("#setting-btn")).toHaveLength(1);
        test.scope.dispose();
    });
});
