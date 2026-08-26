import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readTestFile(join(import.meta.dirname, "../src/plugins/backup/setting-forms.js"), "utf8");

function methodBody(start, end) {
    return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

describe("settings form transaction ownership", () => {
    it("never builds the manual save object from the full settings snapshot", () => {
        const save = methodBody("async function saveSettingForm", "async function collectManualSettingPatch");
        expect(save).not.toContain("{ ...dependencies.settings.snapshot() }");
        expect(save).not.toContain("let e = { ...dependencies.settings.snapshot() }");
        expect(save).not.toContain("dependencies.settings.patch");
        expect(save).toContain("dependencies.settings.update");
    });

    it("whitelists only explicit manual keys and excludes every live/next-navigation key", () => {
        const manualBlock = source.slice(source.indexOf("const MANUAL_FORM_SETTING_KEYS"), source.indexOf("function formRoot"));
        for (const key of [ "videoQuality", "reviewCount", "webDavUrl", "enableTitleSelectFilter", "enableFavoriteActresses" ]) {
            expect(manualBlock).toContain(`"${key}"`);
        }
        for (const key of [ "enableLoadScreenShot", "enableScreenSvg", "enablePreviewVideo", "enableLoadPreviewVideo", "autoPage", "translateTitle", "hoverBigImg", "enableLoadOtherSite", "enableLoadActressInfo", "enableVerticalModel", "mobileMode", "themeMode", "containerColumns", "containerWidth", "needClosePage", "enableClog", "defaultQuickFilterTab" ]) {
            expect(manualBlock).not.toContain(`"${key}"`);
        }
    });

    it("uses root-scoped selectors in the settings form", () => {
        const load = methodBody("async function loadSettingForm", "async function saveSettingForm");
        const save = methodBody("async function saveSettingForm", "async function collectManualSettingPatch");
        const manual = methodBody("async function collectManualSettingPatch", "function addLabelTag");
        expect(load).not.toContain('$("#');
        expect(save).not.toContain('$("#');
        expect(manual).not.toContain('$("#');
        expect(load).toContain("root.find");
        expect(save).toContain("root.find");
    });

    it("keeps toast success outside saveSettingForm", () => {
        const save = methodBody("async function saveSettingForm", "async function collectManualSettingPatch");
        expect(save).not.toContain('show.ok("保存成功")');
        expect(save).not.toContain('show.ok(`保存成功`');
    });
});
