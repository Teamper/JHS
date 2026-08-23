import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const storage = readFileSync(join(process.cwd(), "src/core/storage.js"), "utf8");
const settingForms = readFileSync(join(process.cwd(), "src/plugins/backup/setting-forms.js"), "utf8");

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

    it("lets settings-changed be the only TaskPlugin refresh path after form save", () => {
        const saveForm = methodBody(settingForms, "async function saveSettingForm", "function addLabelTag");
        expect(saveForm).toContain("storageManager.saveSetting");
        expect(saveForm).not.toContain("invalidateConfig");
    });
});
