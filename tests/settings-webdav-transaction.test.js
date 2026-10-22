// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeRuntimeConstants } from "../src/core/constants.js";
import { SettingsService } from "../src/services/settings-service.js";
import { WebDavService } from "../src/services/webdav-service.js";
import { DialogService } from "../src/services/dialog-service.js";
import { LayerDialogAdapter } from "../src/platform/userscript/layer-dialog-adapter.js";
import { Utils } from "../src/core/utils.js";
import { loadSettingForm, saveSettingForm } from "../src/plugins/backup/setting-forms.js";
import { buildSettingDialogHtml, injectNetworkPanel } from "../src/plugins/backup/setting-templates.js";

const $ = jquery;
beforeEach(() => initializeRuntimeConstants(new URL("https://javdb.com/")));
afterEach(() => { $(document).off("keydown.globalLayerEsc"); document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function fixture() {
    const initial = { reviewCount: "20", themeMode: "light", webDavUrl: "https://old.example/dav", webDavUsername: "old-user", trustedLocalOrigins: ["https://old.example"] };
    const stored = { setting: structuredClone(initial) };
    const storage = { get: vi.fn(async key => structuredClone(stored[key])), set: vi.fn(async (key, value) => { stored[key] = structuredClone(value); }) };
    const settings = new SettingsService(storage);
    await settings.load();
    let password = "old-password";
    const credential = { get: vi.fn(async () => password), readEntry: vi.fn(async () => ({ exists: true, value: password })), set: vi.fn(async (_key, value) => { password = value; }) };
    credential.replaceWithRollback = async (key, value, operation) => {
        const previous = password;
        await credential.set(key, value);
        try { return await operation(); }
        catch (error) { await credential.set(key, previous); throw error; }
    };
    const webdav = new WebDavService({}, credential, settings, "https://javdb.com");
    const utilities = { q: vi.fn((_position, _message, accept) => accept()) };
    const dependencies = { jquery: $, document, settings, webdav, utilities, movie: { externalSiteOrigin: () => "https://example.test", providerOrigin: () => "https://example.test" }, legacyStorage: { getReviewFilterKeywordList: async () => [], getTitleFilterKeyword: async () => [] }, events: { emit: vi.fn() }, logger: { error: vi.fn() } };
    document.body.innerHTML = buildSettingDialogHtml();
    const root = $(document.body);
    injectNetworkPanel($, root);
    await loadSettingForm(dependencies, root);
    return { initial, stored, storage, settings, credential, webdav, utilities, dependencies, root, password: () => password };
}

function editProfileAndOrdinaryField(root) {
    for (const [id, value] of Object.entries({ reviewCount: "40", webDavUrl: "https://new.example/dav", webDavUsername: "new-user", webDavPassword: "new-password" })) root.find(`#${id}`).val(value).trigger("change");
}

describe("full settings WebDAV save transaction", () => {
    it("saves retention without enabling the retired backup loop", async () => {
        const f = await fixture();
        f.dependencies.autoBackup = { enable: vi.fn() };
        expect(f.root.find("#webDavAutoBackupEnabled")).toHaveLength(0);
        expect(f.root.find("#webDavSyncKeepCount").val()).toBe("10");
        f.root.find("#webDavSyncKeepCount").val("7").trigger("change");
        f.root.find("#webDavSyncHistoryDays").val("14").trigger("change");
        await saveSettingForm(f.dependencies, f.root);
        expect(f.settings.snapshot()).toMatchObject({ webDavSyncKeepCount: 7, webDavSyncHistoryDays: 14 });
        expect(f.dependencies.autoBackup.enable).not.toHaveBeenCalled();
    });
    it.each(["0", "2", "-1", "1.5", "1000001", "NaN"])("rejects invalid retained count %s before any write", async value => {
        const f = await fixture();
        f.root.find("#webDavSyncKeepCount").val(value).trigger("change");
        await expect(saveSettingForm(f.dependencies, f.root)).rejects.toThrow("整数");
        expect(f.storage.set).not.toHaveBeenCalled();
    });
    it.each(["-1", "1.5", "366"])("rejects invalid daily retention %s", async value => {
        const f = await fixture();
        f.root.find("#webDavSyncHistoryDays").val(value).trigger("change");
        await expect(saveSettingForm(f.dependencies, f.root)).rejects.toThrow("整数");
        expect(f.storage.set).not.toHaveBeenCalled();
    });
    it("rolls the password back while preserving ordinary fields, URL and authorized origins on a settings write failure", async () => {
        const test = await fixture(), error = new Error("storage unavailable");
        test.storage.set.mockRejectedValueOnce(error);
        editProfileAndOrdinaryField(test.root);
        await expect(saveSettingForm(test.dependencies, test.root)).rejects.toBe(error);
        expect(test.storage.set).toHaveBeenCalledOnce();
        expect(test.password()).toBe("old-password");
        const key = "jhs_webdav_password:origin:https%3A%2F%2Fjavdb.com";
        expect(test.credential.set.mock.calls).toEqual([[key, "new-password"], [key, "old-password"]]);
        expect(test.stored.setting).toEqual(test.initial);
        expect(test.settings.snapshot()).toEqual(test.initial);
        expect(test.root.data("jhsDirtyManualKeys")).toEqual(new Set(["reviewCount", "webDavUrl", "webDavUsername", "webDavPassword"]));
        expect(test.root.find("#webDavPassword").val()).toBe("new-password");
        expect(test.root.find("#reviewCount").val()).toBe("40");
        expect(test.utilities.q.mock.calls[0][4]).toEqual({ confirmText: "授权", cancelText: "取消" });
        await expect(saveSettingForm(test.dependencies, test.root)).resolves.toEqual({ ok: true });
        expect(test.stored.setting).toMatchObject({ reviewCount: "40", webDavUrl: "https://new.example/dav", webDavUsername: "new-user", trustedLocalOrigins: ["https://old.example", "https://new.example"] });
        expect(test.password()).toBe("new-password");
    });

    it("validates ordinary field drafts before credentials or authorization are written", async () => {
        const test = await fixture();
        editProfileAndOrdinaryField(test.root);
        test.root.find("#javDbUrl").val("javascript:alert(1)").trigger("change");
        await expect(saveSettingForm(test.dependencies, test.root)).rejects.toThrow("仅允许 HTTPS URL");
        expect(test.credential.set).not.toHaveBeenCalled();
        expect(test.storage.set).not.toHaveBeenCalled();
        expect(test.utilities.q).not.toHaveBeenCalled();
        expect(test.stored.setting).toEqual(test.initial);
    });

    it("never writes settings when the credential write fails", async () => {
        const test = await fixture(), error = new Error("credential unavailable");
        editProfileAndOrdinaryField(test.root);
        test.credential.set.mockRejectedValueOnce(error);
        await expect(saveSettingForm(test.dependencies, test.root)).rejects.toBe(error);
        expect(test.storage.set).not.toHaveBeenCalled();
        expect(test.stored.setting).toEqual(test.initial);
        expect(test.password()).toBe("old-password");
    });

    it("commits the profile, ordinary patch and new origin together while preserving the freshest other-tab values", async () => {
        const test = await fixture();
        editProfileAndOrdinaryField(test.root);
        test.stored.setting = { ...test.stored.setting, themeMode: "dark", foreignValue: "latest", trustedLocalOrigins: ["https://old.example", "https://other-tab.example"] };
        await expect(saveSettingForm(test.dependencies, test.root)).resolves.toEqual({ ok: true });
        expect(test.storage.set).toHaveBeenCalledOnce();
        expect(test.stored.setting).toMatchObject({ reviewCount: "40", webDavUrl: "https://new.example/dav", webDavUsername: "new-user", themeMode: "dark", foreignValue: "latest", trustedLocalOrigins: ["https://old.example", "https://other-tab.example", "https://new.example"] });
        expect(test.stored.setting).not.toHaveProperty("webDavPassword");
        expect(test.password()).toBe("new-password");
        expect(test.root.data("jhsDirtyManualKeys").size).toBe(0);
    });

    it("preserves the existing one-argument saveProfile API", async () => {
        const test = await fixture();
        await test.webdav.saveProfile({ username: "updated-user" });
        expect(test.storage.set).toHaveBeenCalledOnce();
        expect(test.stored.setting).toEqual({ ...test.initial, webDavUsername: "updated-user", webDavProfileRevision: expect.any(String) });
        expect(test.credential.set).not.toHaveBeenCalled();
    });

    it("keeps other settings editable and permits an explicit password repair after credential loading fails", async () => {
        const test = await fixture();
        test.credential.readEntry.mockRejectedValue(new Error("damaged record"));
        await expect(loadSettingForm(test.dependencies, test.root)).resolves.toBeUndefined();
        expect(test.root.find("#webDavPassword").val()).toBe("");
        expect(test.root.find("#webDavPassword").attr("aria-invalid")).toBe("true");
        expect(test.root.find("#jhs-webdav-credential-error").text()).toContain("重新输入密码并保存");
        test.root.find("#reviewCount").val("40").trigger("change");
        await expect(saveSettingForm(test.dependencies, test.root)).resolves.toEqual({ ok: true });
        expect(test.credential.set).not.toHaveBeenCalled();
        expect(test.password()).toBe("old-password");
        test.root.find("#webDavPassword").val("recovered-password").trigger("change");
        await expect(saveSettingForm(test.dependencies, test.root)).resolves.toEqual({ ok: true });
        expect(test.password()).toBe("recovered-password");
        expect(test.root.find("#jhs-webdav-credential-error")).toHaveLength(0);
        expect(test.root.find("#webDavPassword").attr("aria-invalid")).toBeUndefined();
    });

    it("settles WebDAV authorization as canceled when Escape closes the injected service dialog", async () => {
        const test = await fixture();
        let dialogOptions;
        const layer = {
            open: vi.fn(), alert: vi.fn(),
            confirm: vi.fn((_message, options) => {
                dialogOptions = options;
                const host = document.createElement("div");
                host.id = "layui-layer7";
                document.body.append(host);
                options.success($(host), 7);
                return 7;
            }),
            close: vi.fn(() => { dialogOptions.end(); document.getElementById("layui-layer7")?.remove(); }),
        };
        vi.stubGlobal("$", $); vi.stubGlobal("layer", layer);
        const utilities = Object.create(Utils.prototype);
        Object.assign(utilities, { layerIndexStack: [], iframeEscBindings: new Map(), isMobileMode: () => false });
        utilities.setDialogService(new DialogService(new LayerDialogAdapter(layer)));
        test.dependencies.utilities = utilities;
        editProfileAndOrdinaryField(test.root);
        const save = saveSettingForm(test.dependencies, test.root);
        await vi.waitFor(() => expect(layer.confirm).toHaveBeenCalledOnce());
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await expect(save).resolves.toEqual({ canceled: true });
        expect(layer.close).toHaveBeenCalledExactlyOnceWith(7);
        expect(utilities.layerIndexStack).toEqual([]);
        expect(test.credential.set).not.toHaveBeenCalled();
        expect(test.storage.set).not.toHaveBeenCalled();
        expect(test.stored.setting).toEqual(test.initial);
        expect(test.root.find("#webDavPassword").val()).toBe("new-password");
    });
});
