// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import $ from "jquery";
import { SettingsDraft } from "../src/ui/settings/settings-draft.js";
import { saveSettingForm } from "../src/plugins/backup/setting-forms.js";
import { SettingPlugin } from "../src/plugins/backup/setting.js";

let draft;
afterEach(() => { draft?.dispose(); document.body.replaceChildren(); });
function mount() {
    document.body.innerHTML = '<section><div class="jhs-setting-row"><label class="jhs-setting-row__label">评论数</label><input id="reviewCount" type="number" value="20"></div><input id="live"><div id="reviewKeywordContainer"><div class="tag-box"></div><input class="keyword-input"></div><div id="filterKeywordContainer"><div class="tag-box"></div><input class="keyword-input"></div><textarea id="advanced-resource-json"></textarea><span id="settings-draft-status"></span><button id="saveBtn"></button></section>';
    const root = $("section"); draft = new SettingsDraft(root, { reviewCount: "#reviewCount" }); root.data("jhsSettingsDraft", draft);
    const values = { reviewCount: 20 }, deps = { jquery: $, settings: { snapshot: () => values, update: vi.fn(async fn => fn(values)) }, legacyStorage: { saveReviewFilterKeyword: vi.fn(async () => {}), saveTitleFilterKeyword: vi.fn(async () => {}) }, events: { emit: vi.fn() } };
    return { root, deps, values };
}
function keyword(container, value) { const label = document.createElement("span"); label.className = "keyword-label"; label.dataset.keyword = value; label.textContent = value; document.querySelector(`${container} .tag-box`).append(label); }

it("tracks real differences, clears reverted fields, and excludes automatic settings", () => {
    const { root } = mount();
    $("#live").val("changed").trigger("input"); expect(draft.refresh().count).toBe(0);
    $("#reviewCount").val("30").trigger("input"); expect(draft.refresh().count).toBe(1);
    $("#reviewCount").val("20").trigger("input"); expect(draft.refresh().count).toBe(0);
    expect(root.find(".jhs-setting-save-hint")).toHaveLength(0);
});

it("counts keyword groups and distinguishes unapplied text from saved settings", () => {
    mount(); keyword("#reviewKeywordContainer", "one"); keyword("#reviewKeywordContainer", "two");
    $("#advanced-resource-json").val("unimported").trigger("input");
    expect(draft.refresh()).toEqual({ count: 2, pending: true });
    const submitted = draft.capture(); draft.commitKeywords(submitted, "review");
    expect(draft.refresh()).toEqual({ count: 1, pending: true });
    draft.commitPending("#advanced-resource-json", "unimported"); expect(draft.refresh().pending).toBe(false);
});

it("saves a captured submission while retaining edits made during the asynchronous commit", async () => {
    const { root, deps, values } = mount(); let finish;
    deps.settings.update.mockImplementation(fn => new Promise(resolve => { finish = () => { fn(values); resolve(); }; }));
    $("#reviewCount").val("30").trigger("input");
    const saving = saveSettingForm(deps, root); await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    $("#reviewCount").val("40").trigger("input"); finish(); await saving;
    expect(values.reviewCount).toBe("30"); expect(draft.refresh().count).toBe(1);
    $("#reviewCount").val("30").trigger("input"); expect(draft.refresh().count).toBe(0);
});

it("advances successful keyword groups independently when another group fails", async () => {
    const { root, deps } = mount(); keyword("#reviewKeywordContainer", "review"); keyword("#filterKeywordContainer", "title");
    deps.legacyStorage.saveTitleFilterKeyword.mockRejectedValue(new Error("synthetic failure"));
    await expect(saveSettingForm(deps, root)).rejects.toMatchObject({ partialFailure: true });
    expect(draft.refresh().count).toBe(1); expect(root.data("jhsDirtyReviewKeywords")).toBe(false); expect(root.data("jhsDirtyTitleKeywords")).toBe(true);
    expect(deps.legacyStorage.saveReviewFilterKeyword).toHaveBeenCalledWith(["review"]);
});

it("guards settings close once, leaves automatic changes intact, and blocks closing during save", async () => {
    const { root } = mount(); const instance = { root, id: 1, scope: { disposed: false } };
    const dialog = { close: vi.fn(), confirm: vi.fn(() => 7) }, plugin = Object.create(SettingPlugin.prototype);
    Object.assign(plugin, { document, _settingsDialog: instance, getRuntimeService: () => dialog, utils: { setupEscClose: vi.fn(), releaseEscClose: vi.fn() } });
    $("#reviewCount").val("30").trigger("input");
    await plugin.requestSettingsClose(instance); await plugin.requestSettingsClose(instance);
    expect(dialog.confirm).toHaveBeenCalledOnce(); expect(dialog.close).not.toHaveBeenCalled();
    const [, options, discard] = dialog.confirm.mock.calls[0]; expect(options.cancelText).toBe("继续编辑");
    options.end(); root.find("#saveBtn").data("jhsBusy", true); await plugin.requestSettingsClose(instance);
    expect(dialog.confirm).toHaveBeenCalledOnce(); expect(root.find("#settings-draft-status").text()).toContain("正在保存");
    root.find("#saveBtn").data("jhsBusy", false); discard(7); expect(dialog.close).toHaveBeenCalledWith(1);
});

it("does not revive disposed drafts when an old save completes", () => {
    mount(); const submitted = draft.capture(); draft.dispose(); draft.commitFields(submitted, ["reviewCount"]); draft.commitKeywords(submitted, "review");
    expect(draft.baseline).toEqual({ fields: {}, review: [], title: [] });
});

it("refreshes an external connection without replacing local edits or a closed instance", async () => {
    const { root } = mount(); draft.dispose();
    root.append('<input id="webDavUrl" value="old"><input id="webDavUsername" value="old-user"><input id="webDavPassword" value="old-password">');
    draft = new SettingsDraft(root, { webDavUrl: "#webDavUrl", webDavUsername: "#webDavUsername", webDavPassword: "#webDavPassword" });
    root.data("jhsSettingsDraft", draft);
    let finish; const getProfile = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const instance = { root, scope: { disposed: false } }, plugin = Object.create(SettingPlugin.prototype);
    Object.assign(plugin, { _settingsDialog: instance, getRuntimeService: () => ({ getProfile }), notifications: { error: vi.fn() } });
    const syncing = plugin.syncFullConnection(instance);
    root.find("#webDavUrl").val("local").trigger("input"); finish({ url: "external", username: "external-user", password: "external-password" }); await syncing;
    expect(root.find("#webDavUrl").val()).toBe("local"); expect(root.find("#webDavUsername").val()).toBe("external-user"); expect(root.find("#webDavPassword").val()).toBe("external-password"); expect(draft.refresh().count).toBe(1);
    const late = plugin.syncFullConnection(instance); instance.scope.disposed = true; finish({ url: "late", username: "late", password: "late" }); await late;
    expect(root.find("#webDavPassword").val()).toBe("external-password");
});

it("tracks clearing an edited resource JSON document so an empty config cannot silently pass validation", () => {
    const { root } = mount(); root.find("#advanced-resource-json").val("{}"); draft.commitPending("#advanced-resource-json", "{}");
    root.find("#advanced-resource-json").val("").trigger("input"); expect(draft.refresh()).toEqual({count:1,pending:true}); expect(root.data("jhsDirtyResourceJson")).toBe(true);
});
