import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const storage = readTestFile(join(process.cwd(), "src/core/storage.js"), "utf8");
const settingForms = readTestFile(join(process.cwd(), "src/plugins/backup/setting-forms.js"), "utf8");
const settingPlugin = readTestFile(join(process.cwd(), "src/plugins/backup/setting.js"), "utf8");
const settingTemplates = readTestFile(join(process.cwd(), "src/plugins/backup/setting-templates.js"), "utf8");

function methodBody(source, start, end) {
    return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

describe("settings invalidation ownership", () => {
    it("emits exactly once from saveSetting and never duplicates it in saveSettingItem", () => {
        const saveSetting = methodBody(storage, "async saveSetting(e)", "async saveSettingItem");
        const saveSettingItem = methodBody(storage, "async saveSettingItem", "async getSetting");
        expect(saveSetting.match(/clean_cacheSettingObj/g)).toHaveLength(1);
        expect(saveSettingItem).not.toContain("clean_cacheSettingObj");
    });

    it("routes the full settings form through SettingsService", () => {
        const saveForm = methodBody(settingForms, "async function saveSettingForm", "function addLabelTag");
        expect(saveForm).toContain("dependencies.settings.replace");
        expect(saveForm).not.toContain("storageManager.saveSetting(");
        expect(saveForm).not.toContain("invalidateConfig");
        expect(saveForm).toContain("dependencies.blacklist?.resetBtnTip?.()");
        expect(saveForm).toContain("dependencies.blacklist?.reloadTable?.()");
    });

    it("opens and closes Settings without requiring CoverButtonPlugin", () => {
        const openDialog = methodBody(settingPlugin, "async openSettingDialog", "renderTaskStatuses()");
        expect(openDialog).not.toContain('getDependency("CoverButtonPlugin")');
        expect(settingPlugin).toContain('getOptionalDependency("CoverButtonPlugin")?.enableSvgBtn?.()');
        expect(settingTemplates).not.toContain("coverButtonPlugin");
    });
});
