// @ts-check

import { PRODUCT_NAMES } from "../../core/product-names.js";
import { escapeHtml } from "../../core/constants.js";
import { decryptCredential, decryptPortableBackup } from "../../core/credential-crypto.js";
import { uploadWebDavBackup } from "../../services/backup-service.js";
import { createJhsTable } from "../../ui/table/create-jhs-table.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { formatUiDateTime } from "../../core/ui-date-time.js";

/** @typedef {{ name: string, size: number, createTime: string | number, fileId: string }} BackupFile */
/** @typedef {(diff: any, current: any, imported: any) => void} ShowDiffPreview */
/** @typedef {any} WebDavHandle */
/** @typedef {any} DialogHandle */
/** @typedef {{jquery: (value: any) => any, document: Document, legacyStorage: any, utilities: any, notifications: any, logger: any, domUi: any, window: Window & typeof globalThis, getScope?: () => Promise<LifecycleScope>, scope?: LifecycleScope, isActive?: () => boolean}} BackupUiDependencies */
/** @param {unknown} error */
function backupErrorDetails(error) {
    const candidate = /** @type {any} */ (error);
    const code = typeof candidate?.code === "string" && /^[A-Z_]{2,32}$/.test(candidate.code) ? candidate.code : "UNKNOWN";
    const status = Number(candidate?.details?.status);
    return { code, ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}) };
}
/** @param {{stage: string, result: string, durationMs: number, bytes?: number, code?: string, status?: number, timeoutMs?: number}} event @param {any} logger */
function logBackupStage(event, logger) {
    const code = typeof event.code === "string" && /^[A-Z_]{2,32}$/.test(event.code) ? event.code : undefined;
    const record = {
        stage: event.stage, result: event.result, durationMs: Math.max(0, Math.round(event.durationMs)),
        ...(event.bytes == null ? {} : { bytes: event.bytes }),
        ...(event.timeoutMs == null ? {} : { timeoutMs: event.timeoutMs }),
        ...(code ? { code } : {}),
        ...(event.status == null ? {} : { status: event.status }),
    };
    try {
        if (event.result === "error") logger.warn?.("[WebDAV备份]", record);
        else logger.log?.("[WebDAV备份]", record);
    }
    catch { /* Logging must not change the backup result. */ }
}
/** @template T @param {string} stage @param {() => Promise<T>} action @param {BackupUiDependencies} dependencies */
async function measureBackupStage(stage, action, dependencies) {
    const { logger, window } = dependencies;
    const startedAt = window.performance.now();
    try {
        const result = await action();
        logBackupStage({ stage, result: "success", durationMs: window.performance.now() - startedAt }, logger);
        return result;
    } catch (error) {
        logBackupStage({ stage, result: "error", durationMs: window.performance.now() - startedAt, ...backupErrorDetails(error) }, logger);
        throw error;
    }
}
/** @param {any} webdavService @param {BackupUiDependencies} dependencies */
async function resolveWebDavProfile(webdavService, dependencies) {
    if (typeof webdavService?.getProfile === "function") return webdavService.getProfile();
    const { legacyStorage: storageManager } = dependencies;
    const settings = await storageManager.getSetting();
    return { url: settings.webDavUrl, username: settings.webDavUsername, password: await decryptCredential(settings.webDavPassword || "") };
}

/** Handle JSON file import via file input, run diff analysis, show preview. */
/** @param {ShowDiffPreview} showDiffPreviewFn @param {BackupUiDependencies} dependencies */
export async function importSettingData(showDiffPreviewFn, dependencies) {
    const { document, legacyStorage: storageManager, notifications: show, logger: clog, domUi, window } = dependencies;
    const loading = () => domUi.loading();
    const pickerScope = new LifecycleScope("backup-file-picker");
    try {
        const parentScope = await dependencies.getScope?.();
        if (parentScope?.disposed) return void pickerScope.dispose();
        const releaseParent = parentScope?.addCleanup(() => pickerScope.dispose());
        pickerScope.addCleanup(() => releaseParent?.());
        const input = document.createElement("input");
        input.type = "file", input.accept = ".json", input.hidden = true;
        let timer = 0;
        const cleanup = () => pickerScope.dispose();
        let inputRemoved = false;
        const removeInput = () => { if (!inputRemoved) { inputRemoved = true; input.remove(); } };
        pickerScope.addCleanup(() => { window.clearTimeout(timer); removeInput(); });
        pickerScope.listen(input, "cancel", cleanup, { once: true });
        pickerScope.listen(window, "pagehide", cleanup, { once: true });
        timer = window.setTimeout(cleanup, 3e5);
        input.onchange = async (/** @type {Event} */ e) => {
            const t = /** @type {HTMLInputElement} */ (e.currentTarget).files?.[0];
            if (!t) return void cleanup();
            window.clearTimeout(timer); removeInput();
            const n = new window.FileReader;
            pickerScope.addCleanup(() => { n.onload = null; n.onerror = null; if (n.readyState === 1) n.abort(); });
            n.onload = async (/** @type {ProgressEvent<FileReader>} */ e) => {
                if (pickerScope.disposed) return;
                try {
                    const t = String((/** @type {FileReader} */ (e.currentTarget)).result || ""), n = JSON.parse(t);
                    if (!n || "object" != typeof n || Array.isArray(n)) throw new Error("文件内容不是有效的数据对象");
                    const a = loading();
                    const releaseLoading = pickerScope.addCleanup(() => a.close());
                    try {
                        const e = await storageManager.exportData();
                        if (pickerScope.disposed) return;
                        const t = await storageManager.diffData(e, n);
                        if (pickerScope.disposed) return;
                        releaseLoading(), showDiffPreviewFn(t, n, null);
                    } catch (i) {
                        if (!pickerScope.disposed) { clog.error(i); show.error("导入预览失败，请重试"); }
                    }
                } catch (t) {
                    if (!pickerScope.disposed) { clog.error(t); show.error("导入失败，请检查文件格式"); }
                } finally { cleanup(); }
            }, n.onerror = () => {
                if (!pickerScope.disposed) show.error("文件读取失败，请重试");
                cleanup();
            }, n.readAsText(t);
        }, document.body.appendChild(input), input.click();
    } catch (e) {
        pickerScope.dispose();
        clog.error(e), show.error("导入失败，请重新选择文件");
    }
}

/** Create encrypted backup and upload via WebDAV. */
/** @param {string} folderName @param {WebDavHandle} webdavService @param {BackupUiDependencies} dependencies */
export async function backupDataByWebDav(folderName, webdavService, dependencies) {
    const { legacyStorage: storageManager, utilities: utils, notifications: show, logger: clog, domUi, window } = dependencies;
    const loading = () => domUi.loading();
    const logStage = (/** @type {{stage: string, result: string, durationMs: number, bytes?: number, code?: string, status?: number, timeoutMs?: number}} */ event) => logBackupStage(event, clog);
    const r = loading();
    const releaseLoading = dependencies.scope?.addCleanup(() => r.close());
    const startedAt = window.performance.now();
    let result = "error", bytes;
    try {
        const t = await measureBackupStage("读取凭据", () => resolveWebDavProfile(webdavService, dependencies), dependencies), n = t.url;
        if (dependencies.isActive?.() === false) return;
        if (!n) return void show.error("请填写并保存服务地址");
        const a = t.username;
        if (!a) return void show.error("请填写并保存用户名");
        if (!t.password) return void show.error("请填写并保存密码");
        const s = utils.getNowStr("_", "_") + ".json";
        const uploaded = await uploadWebDavBackup({
            webdav: webdavService, profile: { url: n, username: a, password: t.password }, folderName, fileName: s,
            scope: dependencies.scope, isActive: dependencies.isActive, onStage: logStage,
            measure: (/** @type {string} */ stage, /** @type {() => Promise<any>} */ action) => measureBackupStage(stage, action, dependencies),
            exportSnapshot: async () => ({ data: await storageManager.exportData(), revision: 0 }),
        });
        bytes = uploaded.bytes;
        result = "success";
    } catch (l) {
        clog.error("[WebDAV备份失败]", backupErrorDetails(l));
        if (dependencies.isActive?.() !== false) show.error("备份失败，请检查连接与授权");
    } finally {
        logStage({ stage: "合计", result, durationMs: window.performance.now() - startedAt, ...(bytes == null ? {} : { bytes }) });
        try { releaseLoading ? releaseLoading() : r.close(); }
        catch (error) {
            try { clog.warn("[WebDAV备份] 关闭加载提示失败", backupErrorDetails(error)); }
            catch { /* A completed upload must remain successful if diagnostics fail. */ }
        }
    }
    if (result === "success" && dependencies.isActive?.() !== false) {
        try { show.ok("已备份数据"); }
        catch (error) { clog.warn("[WebDAV备份] 上传成功，但完成提示失败", backupErrorDetails(error)); }
    }
}

/** List WebDAV backups and open the file list dialog. */
/** @param {string} folderName @param {Function} openFileListDialogFn @param {WebDavHandle} webdavService @param {BackupUiDependencies} dependencies */
export async function backupListBtnByWebDav(folderName, openFileListDialogFn, webdavService, dependencies) {
    const { notifications: show, logger: clog, domUi } = dependencies;
    if (dependencies.isActive?.() === false) return;
    const scope = new LifecycleScope("backup-list-load");
    const releaseParent = dependencies.scope?.addCleanup(() => scope.dispose());
    scope.addCleanup(() => releaseParent?.());
    const active = () => !scope.disposed && dependencies.isActive?.() !== false;
    const loading = domUi.loading();
    scope.addCleanup(() => loading.close());
    try {
        const t = await resolveWebDavProfile(webdavService, dependencies), n = t.url;
        if (!active()) return;
        if (!n) return void show.error("请填写并保存服务地址");
        const a = t.username;
        if (!a) return void show.error("请填写并保存用户名");
        if (!t.password) return void show.error("请填写并保存密码");
        const i = t.password;
        const e = webdavService.createClient({ url: n, username: a, password: i }), files = await e.getBackupList(folderName);
        if (active()) openFileListDialogFn(files, e, PRODUCT_NAMES.webdav);
    } catch (o) {
        if (active()) { clog.error(o); show.error("备份列表加载失败，请重试"); }
    } finally {
        scope.dispose();
    }
}

/** Backup file lists own their table, operations and nested confirmations. */
/** @param {BackupFile[]} files @param {WebDavHandle} client @param {string} label @param {string} folderName @param {ShowDiffPreview} showDiffPreviewFn @param {DialogHandle} dialog @param {BackupUiDependencies} dependencies */
export function openFileListDialog(files, client, label, folderName, showDiffPreviewFn, dialog, dependencies) {
    if (dependencies.isActive?.() === false) return;
    const { jquery: $, legacyStorage: storageManager, utilities: utils, notifications: show, logger: clog, domUi } = dependencies;
    const scope = new LifecycleScope("backup-file-list");
    /** @type {number | null} */ let index = null;
    /** @type {any} */ let table = null;
    /** @type {HTMLElement | null} */ let root = null;
    let busy = false;
    const releaseParent = dependencies.scope?.addCleanup(() => scope.dispose());
    scope.addCleanup(() => releaseParent?.());
    scope.addCleanup(() => { if (index != null) dialog.close(index); table?.destroy?.(); table = null; });
    const active = () => !scope.disposed && dependencies.isActive?.() !== false && (!root || root.isConnected);
    const formatSize = (/** @type {number} */ size) => {
        const units = ["B", "KB", "MB", "GB", "TB", "PB"];
        let i = 0, value = size;
        while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
        return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)} ${units[i]}`;
    };
    const buttons = (/** @type {BackupFile} */ file) => `<div data-backup-file="${escapeHtml(file.fileId)}">${[["delete","删除","danger"],["download","下载","secondary"],["import","导入","primary"]].map(([action,text,kind]) => `<button type="button" class="jhs-btn jhs-btn--${kind} backup-${action} jhs-backup-btn jhs-backup-btn-${kind}" data-action="${action}" data-backup-action="${action}">${text}</button>`).join(" ")}</div>`;
    const mobile = utils.isMobileMode();
    const renderCards = () => files.length ? files.map(file => `<article class="jhs-backup-card"><div class="jhs-backup-card-name">${escapeHtml(file.name)}</div><div class="jhs-backup-card-meta">${formatSize(file.size)} · ${formatUiDateTime(file.createTime)}</div><div class="jhs-backup-card-actions">${buttons(file)}</div></article>`).join("") : '<div class="jhs-backup-empty">暂无备份</div>';
    const perform = async (/** @type {string} */ action, /** @type {BackupFile} */ file) => {
        if (!active() || busy) return;
        busy = true;
        root?.querySelectorAll("[data-backup-action]").forEach(button => { /** @type {HTMLButtonElement} */ (button).disabled = true; });
        const loading = domUi.loading(), releaseLoading = scope.addCleanup(() => loading.close());
        let deleted = false;
        try {
            if (action === "delete") {
                await client.deleteFile(file.fileId); deleted = true;
                if (!active()) return;
                files = await client.getBackupList(folderName);
                if (!active()) return;
                if (table) await table.replaceData(files);
                else $(root).find(".jhs-backup-cards").html(renderCards());
                if (active()) show.ok("已删除备份");
            } else {
                let content = await client.getFileContent(file.fileId);
                if (!active()) return;
                content = await decryptPortableBackup(content);
                if (!active()) return;
                if (action === "download") utils.download(content, file.name);
                else {
                    const parsed = JSON.parse(content), current = await storageManager.exportData();
                    if (!active()) return;
                    const diff = await storageManager.diffData(current, parsed);
                    if (active()) { releaseLoading(); showDiffPreviewFn(diff, null, parsed); }
                }
            }
        } catch (error) {
            if (active()) {
                clog.error(error);
                show.error(deleted ? "备份已删除，列表刷新失败，请重新打开列表" : action === "delete" ? "备份删除失败，请重试" : action === "download" ? "备份下载失败，请重试" : "备份预览失败，请检查文件");
            }
        } finally {
            busy = false; releaseLoading();
            if (active()) root?.querySelectorAll("[data-backup-action]").forEach(button => { /** @type {HTMLButtonElement} */ (button).disabled = false; });
        }
    };
    index = dialog.open({
        type: 1, title: label + "备份文件", ui: {body: mobile ? "scroll" : "table"},
        content: mobile ? `<div id="jhs-backup-card-list" class="jhs-backup-cards">${renderCards()}</div>` : '<div class="jhs-table-dialog"><div id="table-container" class="jhs-table-dialog__content"></div></div>',
        area: utils.getResponsiveArea(["800px", "70%"]), anim: -1,
        end: () => { index = null; scope.dispose(); },
        success: (/** @type {any} */ element) => {
            const elementRoot = /** @type {HTMLElement} */ (element?.jquery ? element[0] : element);
            root = elementRoot;
            if (!active()) return;
            if (!mobile) table = createJhsTable(domUi.tableConstructor, /** @type {HTMLElement} */ (elementRoot.querySelector(".jhs-table-dialog__content")), {
                pagination: false, layout: "fitColumns", placeholder: "暂无备份", data: files,
                columnDefaults: {headerHozAlign:"center",hozAlign:"center"},
                columns: [
                    {title:"文件名",field:"name",minWidth:200,responsive:0,headerSort:false},
                    {title:"文件大小",field:"size",responsive:1,headerSort:false,formatter:(/** @type {any} */ cell)=>formatSize(cell.getValue())},
                    {title:"备份日期",field:"createTime",responsive:2,headerSort:false,formatter:(/** @type {any} */ cell)=>formatUiDateTime(cell.getValue())},
                    {title:"操作",minWidth:250,responsive:0,headerSort:false,formatter:(/** @type {any} */ cell)=>buttons(cell.getData())},
                ],
            });
            scope.listen(elementRoot, "click", event => {
                const button = /** @type {Element} */ (event.target).closest?.("[data-backup-action]");
                if (!button || !active() || busy) return;
                const file = files.find(file => file.fileId === button.closest("[data-backup-file]")?.getAttribute("data-backup-file"));
                if (!file) return;
                const action = button.getAttribute("data-backup-action") || "";
                if (action !== "delete") { void perform(action, file); return; }
                /** @type {number | null} */ let confirmation = null;
                const release = scope.addCleanup(() => { if (confirmation != null) dialog.close(confirmation); });
                confirmation = dialog.confirm(`删除备份“${escapeHtml(file.name)}”？此操作无法撤销`, {
                    icon:3,title:"提示",confirmText:"删除",cancelText:"取消",end:()=>{confirmation=null;release();},
                }, (/** @type {number} */ id) => { dialog.close(id); if (active()) void perform("delete",file); });
            });
        },
    });
    return index;
}

/** Export all data as a downloadable JSON file. */
/** @param {BackupUiDependencies} dependencies */
export async function exportSettingData(dependencies) {
    const { legacyStorage: storageManager, utilities: utils, notifications: show, logger: clog } = dependencies;
    try {
        const e = JSON.stringify(await storageManager.exportData()), t = `${utils.getNowStr("_", "_")}.json`;
        utils.download(e, t), show.ok("已导出数据");
    } catch (t) {
        clog.error(t), show.error("数据导出失败，请重试");
    }
}
