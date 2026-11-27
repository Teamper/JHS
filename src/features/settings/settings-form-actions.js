// @ts-check

import { JhsError } from "../../core/jhs-error.js";
import { MediaConnectionValidationError } from "../../core/media-library-model.js";
import { THIRD_PARTY_CACHE_KEY } from "../../services/cache-service.js";
import { renderCarImportResult } from "../../ui/settings/car-number-import-view.js";
import { bindWebDavSyncControls } from "../../ui/settings/webdav-sync-controls.js";
import { normalizeCarNum } from "../../core/constants.js";
import { buildFallbackCarUrl, parseCarNumberText } from "../../core/feature-helpers.js";
import { getMovieStateEligibility } from "../../core/movie-identity.js";
import { normalizeQuickFilterKey } from "../../core/list-filters.js";
import { legacyActionToFlag } from "../../core/state-model.js";
import { JhsSelect } from "../../core/ui-primitives.js";
import { backupDataByWebDav, backupListBtnByWebDav, exportSettingData, importSettingData, openFileListDialog } from "./setting-backup.js";
import { applyLayoutRangeValue, saveSettingForm } from "./setting-forms.js";
import { bindSettingControl } from "../../ui/settings/setting-binding-controller.js";
import { bindSettingRows, renderSettingRow } from "../../ui/settings/setting-control-renderer.js";

/** @typedef {import("./settings-controller.js").SettingPlugin} SettingPlugin */
/** @typedef {import("./settings-controller.js").JQueryEvent} JQueryEvent */
/** @typedef {import("./settings-controller.js").JQueryInputEvent} JQueryInputEvent */
/** @typedef {import("./settings-controller.js").JQueryHandle} JQueryHandle */

/** 完整设置中由 descriptor 驱动的 live 开关：使用实例草稿，快捷设置仍使用真实服务。 */
    /** @param {JQueryHandle | HTMLElement} layerRoot
 * @param {SettingPlugin} owner
 */
export function hydrateLiveSettings(owner, layerRoot) {
    const root = owner.jquery(layerRoot);
    const hosts = root.find("[data-jhs-setting-section]");
    const registry = owner.getRuntimeService("settingsRegistry"), settings = owner.fullSettings, hostAdapter = owner.getRuntimeService("host");
    const staticKeys = new Set([ "needClosePage", "themeMode", "mobileMode", "enableClog", "containerColumns", "containerWidth" ]);
    const descriptors = registry.list({ surfaces: [ "full" ] }).filter((/** @type {import('../../app/settings-registry.js').SettingDescriptor} */ descriptor) => (descriptor.effect || "live") === "live" && descriptor.section !== "cloud" && !staticKeys.has(descriptor.key));
    descriptors.forEach((/** @type {import('../../app/settings-registry.js').SettingDescriptor} */ descriptor) => {
        const host = hosts.filter(`[data-jhs-setting-section="${descriptor.section || "detail"}"]`).first();
        if (!host.length) return;
        const { row } = renderSettingRow(descriptor, { jquery: owner.jquery, deferred: true, value: settings.snapshot()[descriptor.key] ?? descriptor.defaultValue });
        host.append(row);
    });
    const onWriteError = () => owner.notifications.error("设置保存失败，已恢复原设置");
    const dynamicBinding = hosts.length ? bindSettingRows(root, descriptors, { settings, onWriteError }) : null;
    /** @type {Array<NonNullable<ReturnType<typeof bindSettingControl>>>} */
    const staticBindings = [];
    const registerStatic = (/** @type {any} */ config) => {
        const binding = bindSettingControl({ settings, root, onWriteError, ...config });
        if (binding) staticBindings.push(binding);
    };
    registerStatic({
        selector: "#needClosePageBasic",
        key: "needClosePage",
        getValue: () => root.find("#needClosePageBasic").is(":checked") ? "yes" : "no",
        setValue: (/** @type {any} */ value) => root.find("#needClosePageBasic").prop("checked", value === "yes" || value === true),
        fallback: "yes",
    });
    registerStatic({
        selector: "#themeMode",
        key: "themeMode",
        getValue: () => root.find("#themeMode").val(),
        setValue: (/** @type {any} */ value) => { const el = root.find("#themeMode"); if (el[0]) JhsSelect.setValue(el[0], String(value ?? ""), false); else el.val(String(value ?? "")); },
        fallback: registry.get("themeMode")?.defaultValue,
    });
    registerStatic({
        selector: "#mobileMode",
        key: "mobileMode",
        getValue: () => root.find("#mobileMode").val(),
        setValue: (/** @type {any} */ value) => { const el = root.find("#mobileMode"); if (el[0]) JhsSelect.setValue(el[0], String(value ?? ""), false); else el.val(String(value ?? "")); },
        fallback: registry.get("mobileMode")?.defaultValue,
    });
    registerStatic({
        selector: "#enableClog",
        key: "enableClog",
        getValue: () => root.find("#enableClog").is(":checked") ? "yes" : "no",
        setValue: (/** @type {any} */ value) => root.find("#enableClog").prop("checked", value === "yes"),
        fallback: "yes",
    });
    registerStatic({
        selector: "#containerColumns",
        key: "containerColumns",
        getValue: () => Number(root.find("#containerColumns").val()) || 5,
        setValue: (/** @type {any} */ value) => applyLayoutRangeValue(root, null, "containerColumns", value, owner.utils.isMobileMode()),
        fallback: registry.get("containerColumns")?.defaultValue,
    });
    registerStatic({
        selector: "#containerWidth",
        key: "containerWidth",
        getValue: () => Number(root.find("#containerWidth").val()) + 70,
        setValue: (/** @type {any} */ value) => applyLayoutRangeValue(root, null, "containerWidth", value, owner.utils.isMobileMode()),
        fallback: registry.get("containerWidth")?.defaultValue,
    });
    registerStatic({
        selector: "#defaultQuickFilterTab",
        key: "defaultQuickFilterTab",
        getValue: () => normalizeQuickFilterKey(root.find("#defaultQuickFilterTab").val()),
        setValue: (/** @type {any} */ value) => { const el = root.find("#defaultQuickFilterTab"); const normalized = normalizeQuickFilterKey(value); if (el[0]) JhsSelect.setValue(el[0], normalized, false); else el.val(normalized); },
        fallback: "waitCheck",
    });
    if (!dynamicBinding && !staticBindings.length) return null;
    return {
        sync: (/** @type {Record<string, any>} */ snapshot) => {
            dynamicBinding?.sync?.(snapshot);
            for (const binding of staticBindings) binding.sync?.(snapshot);
        },
        flush: async (/** @type {{emit?: boolean}} */ options) => {
            await dynamicBinding?.flush?.(options);
            await Promise.all(staticBindings.map((binding) => binding.flush?.(options)));
        },
        dispose: () => {
            dynamicBinding?.dispose?.();
            for (const binding of staticBindings) binding.dispose();
        },
        setters: dynamicBinding?.setters ?? {},
    };
}

/** @param {SettingPlugin} owner */
export function bindClick(owner, layerRoot = null) {
    const panels = owner._settingPanels;
    if (!panels) return;
    const dependencies = owner.getFormDependencies(), webdav = owner.getRuntimeService("webdav"), dialog = owner.getRuntimeService("dialog"), diagnostics = owner.getRuntimeService("diagnostics"), storage = owner.getRuntimeService("storage"), translation = owner.getRuntimeService("translation"), previewDiff = (/** @type {any} */ diff, /** @type {unknown} */ imported, restored = null) => panels.showDiffPreview(diff, imported, restored, dialog, dependencies);
    const root = layerRoot ? owner.jquery(layerRoot) : owner.jquery(owner.document);
    bindWebDavSyncControls(root, { ...dependencies, dialog });
    const registry = dependencies.settingsRegistry, session = dependencies.draftSettings;
    const disclosure = new Map();
    root.find("#jhs-settings-search").on("input.jhsSettingNav", (/** @type {JQueryInputEvent} */ event) => {
        const query = event.currentTarget.value.trim().toLowerCase();
        if (!query) {
            root.find("[data-jhs-search-hidden]").removeAttr("data-jhs-search-hidden");
            for (const [element, open] of disclosure) element.open = open;
            disclosure.clear();
            root.removeClass("jhs-settings-searching");
            owner.activateSettingPanel(root, root.data("jhsActiveSettingGroup") || "appearance-panel");
            return;
        }
        root.addClass("jhs-settings-searching");
        root.find(".content-panel").each((/** @type {number} */ _, /** @type {HTMLElement} */ group) => {
            let matched = false;
            for (const section of group.querySelectorAll(".jhs-setting-section")) {
                const heading = section.querySelector("h3,summary");
                const sectionMatch = heading?.textContent?.toLowerCase().includes(query);
                const rows = [...section.querySelectorAll(".jhs-setting-row,.jhs-option-row")];
                let visible = Boolean(sectionMatch || !rows.length && section.textContent?.toLowerCase().includes(query));
                for (const row of rows) {
                    const show = Boolean(sectionMatch || row.textContent?.toLowerCase().includes(query));
                    row.toggleAttribute("data-jhs-search-hidden", !show);
                    visible ||= show;
                    if (show) for (let details = row.closest("details"); details && section.contains(details); details = details.parentElement?.closest("details") ?? null) {
                        if (!disclosure.has(details)) disclosure.set(details, details.open);
                        details.open = true;
                    }
                }
                section.toggleAttribute("data-jhs-search-hidden", !visible);
                matched ||= visible;
            }
            group.toggleAttribute("data-jhs-search-hidden", !matched);
        });
    });
    root.on("click.jhsSettingNav", ".jhs-reset-setting-group", async (/** @type {JQueryEvent} */ event) => {
        const group = owner.jquery(event.currentTarget).closest(".content-panel");
        const patch = /** @type {Record<string, any>} */ ({});
        for (const descriptor of registry.list()) {
            if (descriptor.sensitive || descriptor.defaultValue === undefined) continue;
            const key = descriptor.key;
            const field = descriptor.formSelector ? group.find(descriptor.formSelector)
                : group.find('[data-jhs-setting="' + key + '"] input,[data-jhs-setting="' + key + '"] select,#' + key);
            if (!field.length) continue;
            if (!descriptor.formSelector) { patch[key] = descriptor.defaultValue; continue; }
            if (descriptor.type === "boolean") field.prop("checked", descriptor.defaultValue === true || descriptor.defaultValue === "yes");
            else field.val(descriptor.formScale ? descriptor.defaultValue / descriptor.formScale : descriptor.defaultValue);
            field.trigger("change");
        }
        await session?.patch(patch);
        owner._fullSettingBinding?.sync(session?.snapshot() ?? {});
        JhsSelect.refreshAll(group[0]);
        root.data("jhsSettingsDraft")?.refresh();
    });
    root.find("#discardSettingsBtn").on("click", async () => {
        if (root.find("#saveBtn").data("jhsBusy")) return;
        try {
            session?.discard();
            owner._fullSettingBinding?.sync(session?.snapshot() ?? {});
            owner._cloudSettingBinding?.sync(session?.snapshot() ?? {});
            root.find(".keyword-input,#car-number-import").val("");
            root.find("#car-number-import").trigger("input");
            const generation = root.data("jhsSettingsGeneration");
            await Promise.all([owner.hydrateSettingForm(root, generation), owner.loadResourceSettings(root, generation)]);
            if (dependencies.isActive?.() !== false) root.data("jhsSettingsDraft")?.refresh();
        } catch (error) { owner.logger.error("恢复当前设置失败", error); owner.notifications.error("恢复设置失败，请重试"); }
    });
    root.find("#jhs-settings-category").on("change.jhsSettingNav", (/** @type {JQueryInputEvent} */ event) => owner.activateSettingPanel(root, event.currentTarget.value));
    root.find("#saveBtn").attr("data-jhs-settings-ready", "false").prop("disabled", !0).attr("title", "加载中…");
    root.find(".side-menu-item").off(".jhsSettingNav").on("click.jhsSettingNav", (/** @type {JQueryEvent} */ event) => {
        owner.activateSettingPanel(root, owner.jquery(event.currentTarget).data("panel"));
    }).on("keydown.jhsSettingNav", (/** @type {JQueryEvent} */ event) => {
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const buttons = root.find(".side-menu-item"), index = buttons.index(event.currentTarget);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
            : ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
        buttons.eq(next).trigger("click").trigger("focus");
    });
    root.find("#importBtn").on("click", ((/** @type {JQueryEvent} */ e) => importSettingData(previewDiff, dependencies)));
    root.find("#exportBtn").on("click", ((/** @type {JQueryEvent} */ e) => exportSettingData(dependencies)));
    root.find("#clear-car-number-import").on("click", () => {
        root.find("#car-number-import").val("").trigger("input").trigger("focus");
        root.find("#car-number-import-preview").empty().prop("hidden", true);
    });
    root.find("#preview-car-number-import").on("click", (() => owner.previewCarNumbers(root)));
    root.find("#confirm-car-number-import").on("click", (async (/** @type {JQueryEvent} */ e) => owner.confirmCarNumbers(e, root)));
    root.find("#testWebDavConnection").on("click", async (/** @type {JQueryEvent} */ event) => {
        const button = owner.jquery(event.currentTarget).prop("disabled", true).attr("aria-busy", "true");
        try {
            await webdav.testConnection({
                url: String(root.find("#webDavUrl").val() || ""), username: String(root.find("#webDavUsername").val() || ""),
                password: String(root.find("#webDavPassword").val() || ""),
            }, dependencies.scope);
            if (dependencies.isActive()) owner.notifications.ok("WebDAV 连接成功，目录可读");
        } catch (error) {
            if (dependencies.isActive()) {
                const code = /** @type {any} */ (error)?.code;
                owner.notifications.error(code === "AUTH_REQUIRED" ? "WebDAV 登录失败，请核对账号与读取权限" : error instanceof Error ? error.message : "WebDAV 测试失败");
            }
        } finally { if (dependencies.isActive()) button.prop("disabled", false).removeAttr("aria-busy"); }
    });
    root.find("#webdavBackupBtn").on("click", ((/** @type {JQueryEvent} */ e) => owner.hasUnsavedConnection(root) ? owner.notifications.info("请先保存连接设置") : backupDataByWebDav(owner.folderName, webdav, dependencies)));
    root.find("#webdavBackupListBtn").on("click", ((/** @type {JQueryEvent} */ e) => owner.hasUnsavedConnection(root) ? owner.notifications.info("请先保存连接设置") : backupListBtnByWebDav(owner.folderName, (/** @type {import('./setting-backup.js').BackupFile[]} */ files, /** @type {any} */ client, /** @type {string} */ label) => openFileListDialog(files, client, label, owner.folderName, previewDiff, dialog, dependencies), webdav, dependencies)));
    root.find("#saveBtn").on("click", (async (/** @type {JQueryEvent} */ event) => {
        const button = owner.jquery(event.currentTarget);
        if (button.data("jhsBusy") || "true" !== button.attr("data-jhs-settings-ready")) return;
        button.data("jhsBusy", !0).attr({ "aria-busy": "true", "aria-disabled": "true" });
        const fullBinding = owner._fullSettingBinding, cloudBinding = owner._cloudSettingBinding;
        try {
            // Settle input normalization into this instance draft before capturing a save.
            await fullBinding?.flush?.({ throwOnFailure: true });
            await cloudBinding?.flush?.({ throwOnFailure: true });
            if (dependencies.isActive?.() === false) return;
            root.data("jhsSettingsDraft")?.refresh();
            const json = root.find("#advanced-resource-json");
            if (json.length && !json.prop("readonly") && (String(json.val() || "").trim() || root.data("jhsDirtyResourceJson"))) {
                try { await owner.fullResources.importConfig(String(json.val() || "")); json.removeAttr("aria-invalid"); }
                catch (error) {
                    if (dependencies.isActive?.() === false) return;
                    owner.activateSettingPanel(root, "resources-panel");
                    json.closest("details").prop("open", true); json.attr("aria-invalid", "true").trigger("focus");
                    owner.notifications.error("资源配置格式不正确，请检查 JSON");
                    owner.logger.error("资源配置校验失败", error); return;
                }
                if (dependencies.isActive?.() === false) return;
                await owner.loadResourceSettings(root, root.data("jhsSettingsGeneration"));
            }
            for (const container of ["#reviewKeywordContainer", "#filterKeywordContainer"]) {
                if (String(root.find(`${container} .keyword-input`).val() || "").trim()) root.find(`${container} .add-tag-btn`).trigger("click");
            }
            root.data("jhsSettingsDraft")?.refresh();
            const changed = new Set([...(root.data("jhsDirtyManualKeys") || []), ...(dependencies.draftSettings?.dirtyKeys() || [])]);
            const invalid = root.find("input,select,textarea").toArray().find((/** @type {HTMLInputElement} */ input) => {
                const key = input.closest("[data-jhs-setting]")?.getAttribute("data-jhs-setting") || (input.id === "circuitBreakerCooldownSec" ? "circuitBreakerCooldown" : input.id);
                return changed.has(key) && !input.disabled && input.willValidate && !input.checkValidity();
            });
            if (invalid) { owner.jquery(invalid).parents("details").prop("open", true); owner.activateSettingPanel(root, invalid.closest(".content-panel")?.id); invalid.focus?.(); invalid.reportValidity(); return; }
            const result = await saveSettingForm(dependencies, root);
            if (result?.canceled) return;
            if (dependencies.isActive?.() === false) return;
            try { owner.notifications.ok(result?.requiresNavigation ? "已保存，部分设置下次打开页面生效" : "已保存设置"); }
            catch (error) { try { owner.logger?.warn?.("设置已保存，完成提示显示失败", error); } catch { /* committed settings win */ } }
        } catch (error) {
            if (dependencies.isActive?.() === false) return;
            if (error && typeof error === 'object' && 'partialFailure' in error) owner.notifications.error("部分设置保存失败，请重试");
            else owner.notifications.error(error instanceof TypeError || error instanceof JhsError || error instanceof MediaConnectionValidationError ? error.message : "设置保存失败，请重试");
            owner.logger.error("设置保存失败", error);
        } finally {
            button.removeData("jhsBusy").prop("disabled", "true" !== button.attr("data-jhs-settings-ready")).removeAttr("aria-busy aria-disabled");
            const instance = owner._settingsDialog;
            if (instance?.pendingClose && instance.root?.[0] === root[0]) {
                instance.pendingClose = false;
                void owner.requestSettingsClose(instance);
            }
        }
    }));
    root.find("#runHealthCheckBtn").on("click", (() => panels.renderDataHealthPanel(dependencies)));
    root.find("#repairHealthBtn").on("click", ((/** @type {JQueryEvent} */ e) => {
        owner.utils.q(e, "修复本地数据？系统会先创建恢复点", (() => panels.repairDataHealthWithBackup(owner.getFormDependencies())), null, { confirmText: "修复", cancelText: "取消" });
    }));
    root.find("#pm-export-diagnostics").on("click", () => {
        const snapshot = owner.getRuntimeService("diagnostics").exportSnapshot();
        owner.domUi.download(JSON.stringify(snapshot, null, 2), "JHS-diagnostics.json");
    });
    root.find("#pm-clear-log").on("click", (() => {
        owner.getRuntimeService("diagnostics").clearErrors(), root.find("#plugin-error-log").text("暂无错误记录"), owner.notifications.ok("已清空错误日志");
    }));
    root.find("#createSnapshotBtn").on("click", (async () => {
        const loadingHandle = owner.domUi.loading();
        try {
            await owner.getRuntimeService("backup").createSnapshot("手动恢复点", "manual");
        } catch (error) {
            owner.logger.error("快照创建失败", error), owner.notifications.error("恢复点创建失败，请重试");
            return;
        } finally { try { loadingHandle.close?.(); } catch (error) { owner.logger.warn?.("快照加载提示关闭失败", error); } }
        try { owner.notifications.ok("已创建恢复点"); } catch (error) { owner.logger.warn?.("快照已创建，提示显示失败", error); }
        try { await panels.renderSnapshotPanel(owner.getFormDependencies()); }
        catch (error) { owner.logger.error("快照已创建，列表刷新失败", error), owner.notifications.info("已创建恢复点，请重新打开设置"); }
    }));
    root.find(".clean-btn").on("click", (async (/** @type {JQueryEvent} */ e) => {
        const key = owner.jquery(e.currentTarget).data("key");
        if (key === "jhs_actress_info") {
            await owner.getRuntimeService("cache").clearNamespace("actress-info");
            storage.removeLocal(key);
            await owner.getRuntimeService("state").clearActressProfileBackfillAttempts();
        } else {
            key === THIRD_PARTY_CACHE_KEY ? (await owner.getRuntimeService("cache").clearThirdPartyCache(), await owner.getRuntimeService("cache").clearNamespace("external-detail-v1")) : "_circuitBreaker" === key ? diagnostics.resetAllCircuitBreakers() : "_domainStats" === key ? diagnostics.clearDomainStats() : "jhs_translate" === key ? await translation.clearCache() : "jhs_screenShot" === key ? (await owner.getRuntimeService("cache").clearNamespace("screenshot"), await storage.removeLocal(key)) : storage.removeLocal(key);
        }
        owner.notifications.ok("已清理所选缓存"), root.find("#cache-data-display").addClass("jhs-is-hidden");
        "jhs_dmm_video" === key && storage.removeLocal("jhs_other_site_dmm");
    }));
    root.find("#clean-all").on("click", (async () => {
        for (const item of owner.cacheItems) if (item.key !== "jhs_translate") storage.removeLocal(item.key);
        await translation.clearCache();
        const cache = owner.getRuntimeService("cache");
        await cache.clearAll();
        await owner.getRuntimeService("state").clearActressProfileBackfillAttempts();
        await cache.clearThirdPartyCache();
        storage.removeLocal("jhs_other_site_dmm");
        root.find("#cache-data-display").addClass("jhs-is-hidden");
        owner.notifications.ok("已清理全部缓存");
    }));
    root.find(".view-btn").on("click", (async (/** @type {JQueryEvent} */ e) => {
        const key = owner.jquery(e.currentTarget).data("key");
        let raw;
        if (key === THIRD_PARTY_CACHE_KEY) raw = JSON.stringify(await owner.getRuntimeService("cache").getThirdPartyCache());
        else if ("_circuitBreaker" === key) raw = JSON.stringify(diagnostics.getNetworkDiagnostics().circuitBreakers);
        else if ("_domainStats" === key) raw = JSON.stringify(diagnostics.getNetworkDiagnostics().domainStats);
        else if ("jhs_translate" === key) raw = JSON.stringify(await translation.inspectCache());
        else raw = storage.getLocal(key);
        const display = root.find("#cache-data-display"), pre = display.find("pre");
        if (display.removeClass("jhs-is-hidden"), raw) try {
            const parsed = JSON.parse(raw);
            pre.text(JSON.stringify(parsed, null, 2));
        } catch {
            pre.text(raw);
        } else pre.text("暂无数据");
    }));
    const numberInput = root.find("#highlightedTagNumber"), colorInput = root.find("#highlightedTagColor"), labelPreview = root.find("#highlightedTagLabel");
    function updatePreview() {
        const count = numberInput.val(), color = colorInput.val();
        labelPreview.css("border", `${count}px solid ${color}`);
    }
    numberInput.on("input", updatePreview), colorInput.on("input", updatePreview);
    // Static live controls are bound through SettingBindingHub in
    // hydrateLiveSettings(); no direct settings.set() handlers here.
}

/** @param {SettingPlugin} owner */
export function previewCarNumbers(owner, root = owner.jquery(owner.document)) {
    const parsed = parseCarNumberText(root.find("#car-number-import").val()), actionType = root.find("#car-number-import-status").val();
    const revision = ++owner._carImportRevision, raw = String(root.find("#car-number-import").val() || "");
    owner.pendingCarImport = actionType && parsed.values.length ? { ...parsed, actionType, revision, raw } : null;
    const message = !raw.trim() ? "请先填写番号" : !parsed.values.length ? "未识别到有效番号" : !actionType ? "请选择导入状态" : "";
    root.find("#car-number-import-help").text("展开明细可查看有效番号和异常项");
    renderCarImportResult(owner.jquery, root.find("#car-number-import-preview"), parsed, root.find("#car-number-import-status option:selected").text(), message);
    root.find("#confirm-car-number-import").prop("disabled", !owner.pendingCarImport).text(owner.pendingCarImport ? `导入 ${parsed.values.length} 条` : "导入记录");
}

/** @param {SettingPlugin} owner */
export async function confirmCarNumbers(owner, /** @type {JQueryEvent} */ event, root = owner.jquery(owner.document)) {
    if (!owner.pendingCarImport) return owner.notifications.info("请先解析预览");
    const pending = owner.pendingCarImport;
    if (pending.running) return;
    owner.utils.q(event, `导入 ${pending.values.length} 条记录？将添加所选状态`, (async () => {
        if (pending.running || owner.pendingCarImport !== pending || pending.revision !== owner._carImportRevision || String(root.find("#car-number-import").val() || "") !== pending.raw || root.find("#car-number-import-status").val() !== pending.actionType || !root[0]?.isConnected) return;
        pending.running = true;
        root.find("#confirm-car-number-import").prop("disabled", true);
        let existing;
        try { existing = new Map((await owner.getRuntimeService("state").getCarList()).map((/** @type {import('../../core/state-service.js').StateRecord} */ item) => [normalizeCarNum(item.carNum), item])); }
        catch (error) {
            pending.running = false;
            owner.logger.warn("番号导入读取失败", error);
            if (owner.pendingCarImport === pending && root[0]?.isConnected) root.find("#confirm-car-number-import").prop("disabled", false);
            return owner.notifications.error("读取现有记录失败，请重试");
        }
        const summary = { added: 0, updated: 0, failed: 0, skipped: pending.invalid.length }, flag = legacyActionToFlag(pending.actionType);
        const state = owner.getRuntimeService("state");
        const records = pending.values.map((rawCarNum) => {
            const carNum = normalizeCarNum(rawCarNum), current = existing.get(carNum);
            if (!carNum || !getMovieStateEligibility(carNum).eligible) {
                summary.skipped++;
                pending.invalid.push(String(rawCarNum));
                return null;
            }
            return { carNum, url: current?.url || buildFallbackCarUrl(carNum), names: current?.names || "", publishTime: current?.publishTime || "" };
        }).filter(record => record !== null);
        pending.values = records.map(record => record.carNum);
        // 分块批量 patch：逐条 patch 会放大为 O(n) 次全库事务
        const CHUNK = 75;
        for (let index = 0; index < records.length; index += CHUNK) {
            const chunk = records.slice(index, index + CHUNK);
            try {
                await state.patch(chunk.map((record) => record.carNum), { [/** @type {string} */ (flag)]: true }, { type: "manual-car-number-import", records: chunk });
                chunk.forEach((record) => existing.has(record.carNum) ? summary.updated++ : summary.added++);
            } catch (error) {
                summary.failed += chunk.length;
                owner.logger.warn("番号批量导入块失败", error);
            }
        }
        if (owner.pendingCarImport === pending) owner.pendingCarImport = null;
        const message = `已导入 ${summary.added + summary.updated} 条${summary.skipped ? `，跳过 ${summary.skipped} 条无效番号` : ""}${summary.failed ? `，失败 ${summary.failed} 条，请核对后重试` : ""}`;
        if (pending.revision === owner._carImportRevision && root[0]?.isConnected) {
            if (!summary.failed) {
                root.data("jhsSettingsDraft")?.commitPending("#car-number-import", pending.raw);
                root.data("jhsSettingsDraft")?.commitPending("#car-number-import-status", pending.actionType);
            }
            root.find("#confirm-car-number-import").prop("disabled", true).text("导入记录");
            renderCarImportResult(owner.jquery, root.find("#car-number-import-preview"), pending, "", message, summary);
        }
        (summary.failed ? owner.notifications.error : owner.notifications.ok).call(owner.notifications,message);
    }), null, { confirmText: "导入", cancelText: "取消" });
}
