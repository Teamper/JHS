import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const storage = readTestFile(join(process.cwd(), "src/core/storage.js"), "utf8");
const settingsService = readTestFile(join(process.cwd(), "src/services/settings-service.js"), "utf8");
const settingForms = readTestFile(join(process.cwd(), "src/plugins/backup/setting-forms.js"), "utf8");
const settingPlugin = readTestFile(join(process.cwd(), "src/plugins/backup/setting.js"), "utf8");
const settingTemplates = readTestFile(join(process.cwd(), "src/plugins/backup/setting-templates.js"), "utf8");

function methodBody(source, start, end) {
    return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

describe("settings invalidation ownership", () => {
    it("emits exactly once from saveSetting and never duplicates it in saveSettingItem", () => {
        const saveSetting = methodBody(storage, "async _saveSettingWithoutLock(e)", "async saveSetting(e)");
        const saveSettingItem = methodBody(storage, "async saveSettingItem", "async getSetting");
        expect(saveSetting.match(/clean_cacheSettingObj/g)).toHaveLength(1);
        expect(saveSettingItem).not.toContain("clean_cacheSettingObj");
    });

    it("routes the settings form through the SettingsService ownership patch", () => {
        const saveForm = methodBody(settingForms, "async function saveSettingForm", "async function collectManualSettingPatch");
        expect(saveForm).toContain("dependencies.settings.update");
        expect(saveForm).not.toContain("dependencies.settings.replace");
        expect(saveForm).not.toContain("dependencies.settings.patch");
        expect(saveForm).not.toContain("{ ...dependencies.settings.snapshot() }");
        expect(saveForm).not.toContain("changedValues");
        expect(saveForm).not.toContain("storageManager.saveSetting(");
        expect(saveForm).not.toContain("invalidateConfig");
        expect(settingForms).toContain("MANUAL_FORM_SETTING_KEYS");
        expect(settingForms).toContain("dependencies.newVideo?.resetBtnTip?.()");
        expect(settingForms).toContain("dependencies.blacklist?.resetBtnTip?.()");
        expect(settingForms).toContain("dependencies.blacklist?.reloadTable?.()");
    });

    it("writes settings through a lock-scoped read-modify-write in SettingsService", () => {
        const update = settingsService.slice(settingsService.indexOf("async update("));
        expect(update).toContain("jhs_setting_lock");
        expect(update).toContain("this.storage.get(storageKey)");
        expect(update).toContain("this.storage.set(storageKey, next)");
        expect(update).toContain("this.writeChain");
        expect(update).not.toContain("this.snapshotValue, ...values");
    });

    it("keeps legacy StorageManager as the fallback but routes through the single entry when available", () => {
        const saveSetting = methodBody(storage, "async saveSetting(e)", "async saveSettingItem");
        const saveSettingItem = methodBody(storage, "async saveSettingItem", "async getSetting");
        expect(saveSetting).toContain("globalThis.settingsService?.replace");
        expect(saveSettingItem).toContain("globalThis.settingsService?.set");
        expect(saveSettingItem).not.toContain("clean_cacheSettingObj");
    });

    it("opens and closes Settings without requiring CoverButtonPlugin", () => {
        const openDialog = methodBody(settingPlugin, "async openSettingDialog", "renderTaskStatuses()");
        expect(openDialog).not.toContain('getDependency("CoverButtonPlugin")');
        expect(settingPlugin).toContain('getBean("CoverButtonPlugin")?.enableSvgBtn?.()');
        expect(settingTemplates).not.toContain("coverButtonPlugin");
    });
});

describe("migration write ownership", () => {
    const bootstrap = readFileSync(join(process.cwd(), "src/app/bootstrap.js"), "utf8");
    const migration = readFileSync(join(process.cwd(), "src/core/settings-migration.js"), "utf8");

    it("bootstrap local-origin migration is deferred to an atomic settings update", () => {
        expect(bootstrap).toContain("async function resolveLocalOrigins");
        expect(bootstrap).toContain("function applyBootstrapSettingMigrations");
        expect(bootstrap).toContain("await context.services.settings.update");
        expect(bootstrap).toContain("normalizeScreenshotSettingDraft(draft)");
        expect(bootstrap).not.toContain("persistDisabledPluginMigration");
        expect(bootstrap).not.toContain("persistLocalOriginMigration");
        expect(bootstrap).not.toContain("saveSetting({ ...settings");
    });

    it("runtime screenshot migration deletes the legacy key atomically and never replace()s", () => {
        expect(migration).toContain("normalizeScreenshotSettingDraft");
        expect(migration).toContain("settings.update(normalizeScreenshotSettingDraft)");
        expect(migration).toContain("delete draft.enableScreenSvg");
        expect(migration).not.toContain("settings.replace");
    });

    it("async_merge_other uses the lock-owned migration update instead of whole-object saveSetting(e)", () => {
        const merge = methodBody(storage, "async async_merge_other", "merge_blacklist");
        expect(merge).toContain("this.updateSettingWithoutLock");
        expect(merge).not.toContain("await this.saveSetting(e)");
    });

    it("lock-owned settings migration updates the SettingsService snapshot without re-entering mutation", () => {
        const update = methodBody(storage, "async updateSettingWithoutLock", "async importData");
        expect(update).toContain("_saveSettingWithoutLock");
        expect(update).toContain("adoptPersistedSnapshot");
        expect(update).not.toContain("_withStorageMutation");
        expect(settingsService).toContain("adoptPersistedSnapshot");
    });
});
