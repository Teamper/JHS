// @ts-check

import { escapeHtml } from "../../../core/constants.js";
import { decryptCredential, decryptData, encryptData } from "../../../core/credential-crypto.js";
import { createJhsTable } from "../../../ui/table/create-jhs-table.js";

/** @typedef {{ name: string, size: number, createTime: string | number, fileId: string }} BackupFile */
/** @typedef {(diff: any, current: any, imported: any) => void} ShowDiffPreview */
/** @typedef {any} WebDavHandle */
/** @typedef {any} DialogHandle */
/** @param {unknown} error */
const errorMessage = error => error instanceof Error ? error.message : String(error);

/** Handle JSON file import via file input, run diff analysis, show preview. */
/** @param {ShowDiffPreview} showDiffPreviewFn */
export async function importSettingData(showDiffPreviewFn) {
    try {
        const input = document.createElement("input");
        input.type = "file", input.accept = ".json";
        const cleanup = () => input.remove();
        input.onchange = async e => {
            const t = /** @type {HTMLInputElement} */ (e.currentTarget).files?.[0];
            if (!t) return void cleanup();
            const n = new FileReader;
            n.onload = async e => {
                cleanup();
                try {
                    const t = String((/** @type {FileReader} */ (e.currentTarget)).result || ""), n = JSON.parse(t);
                    if (!n || "object" != typeof n || Array.isArray(n)) throw new Error("文件内容不是有效的数据对象");
                    const a = loading();
                    try {
                        const e = await storageManager.exportData(), t = await storageManager.diffData(e, n);
                        a.close(), showDiffPreviewFn(t, n, null);
                    } catch (i) {
                        a.close(), clog.error(i), show.error("差异分析失败: " + errorMessage(i));
                    }
                } catch (t) {
                    clog.error(t), show.error("导入失败：文件内容不是有效的JSON格式 " + errorMessage(t));
                }
            }, n.onerror = () => {
                cleanup(), show.error("读取文件时出错");
            }, n.readAsText(t);
        }, document.body.appendChild(input), input.click();
        setTimeout(cleanup, 3e5);
    } catch (e) {
        clog.error(e), show.error("导入数据时出错: " + errorMessage(e));
    }
}

/** Create encrypted backup and upload via WebDAV. */
/** @param {string} folderName @param {WebDavHandle} webdavService */
export async function backupDataByWebDav(folderName, webdavService) {
    const t = await storageManager.getSetting(), n = t.webDavUrl;
    if (!n) return void show.error("请填写webDav服务地址并保存后, 再试此功能");
    const a = t.webDavUsername;
    if (!a) return void show.error("请填写webDav用户名并保存后, 再试此功能");
    if (!t.webDavPassword) return void show.error("请填写webDav密码并保存后, 再试此功能");
    const r = loading();
    try {
        const i = await decryptCredential(t.webDavPassword);
        if (!i) return void show.error("请填写webDav密码并保存后, 再试此功能");
        const s = utils.getNowStr("_", "_") + ".json";
        let o = JSON.stringify(await storageManager.exportData());
        o = await encryptData(o);
        const e = webdavService.createClient({ url: n, username: a, password: i });
        await e.backup(folderName, s, o), show.ok("备份完成");
    } catch (l) {
        clog.error(l), show.error(errorMessage(l));
    } finally {
        r.close();
    }
}

/** List WebDAV backups and open the file list dialog. */
/** @param {string} folderName @param {Function} openFileListDialogFn @param {WebDavHandle} webdavService */
export async function backupListBtnByWebDav(folderName, openFileListDialogFn, webdavService) {
    const t = await storageManager.getSetting(), n = t.webDavUrl;
    if (!n) return void show.error("请填写webDav服务地址并保存后, 再试此功能");
    const a = t.webDavUsername;
    if (!a) return void show.error("请填写webDav用户名并保存后, 再试此功能");
    if (!t.webDavPassword) return void show.error("请填写webDav密码并保存后, 再试此功能");
    const s = loading();
    try {
        const i = await decryptCredential(t.webDavPassword);
        if (!i) return void show.error("请填写webDav密码并保存后, 再试此功能");
        const e = webdavService.createClient({ url: n, username: a, password: i }), files = await e.getBackupList(folderName);
        openFileListDialogFn(files, e, "WebDav");
    } catch (o) {
        clog.error(o), show.error(`发生错误: ${errorMessage(o)}`);
    } finally {
        s.close();
    }
}

/** Mobile-specific backup file list dialog using card-based UI. */
/** @param {BackupFile[]} e @param {WebDavHandle} t @param {string} n @param {string} folderName @param {ShowDiffPreview} showDiffPreviewFn @param {DialogHandle} dialog */
function openFileListDialogMobile(e, t, n, folderName, showDiffPreviewFn, dialog) {
    const formatSize = (/** @type {number} */ size) => {
        const units = ["B", "KB", "MB", "GB", "TB", "PB"];
        let i = 0, s = size;
        for (; s >= 1024 && i < units.length - 1;) s /= 1024, i++;
        return `${s % 1 == 0 ? s.toFixed(0) : s.toFixed(2)} ${units[i]}`;
    };
    const renderCards = (/** @type {BackupFile[]} */ files) => {
        if (!files || files.length === 0) {
            return '<div class="jhs-backup-empty">暂无数据</div>';
        }
        return files.map((file, /** @type {number} */ idx) => `
                <div class="jhs-backup-card" data-idx="${idx}">
                    <div class="jhs-backup-card-name">${escapeHtml(file.name)}</div>
                    <div class="jhs-backup-card-meta">${formatSize(file.size)} · ${utils.getNowStr("-", ":", file.createTime)}</div>
                    <div class="jhs-backup-card-actions">
                        <button class="jhs-btn jhs-backup-btn jhs-backup-btn-danger" data-action="delete" data-idx="${idx}">删除</button>
                        <button class="jhs-btn jhs-backup-btn jhs-backup-btn-primary" data-action="download" data-idx="${idx}">下载</button>
                        <button class="jhs-btn jhs-backup-btn jhs-backup-btn-success" data-action="import" data-idx="${idx}">导入</button>
                    </div>
                </div>
            `).join("");
    };
    const containerId = "jhs-backup-card-list";
    dialog.open({
        type: 1,
        title: n + "备份文件",
        content: `<div id="${containerId}" class="jhs-backup-cards">${renderCards(e)}</div>`,
        area: utils.getResponsiveArea(["800px", "70%"]),
        anim: -1,
        success: (/** @type {HTMLElement} */ layerEl) => {
            const container = $(layerEl).find(`#${containerId}`);
            container.on("click", ".jhs-backup-btn", async (/** @type {MouseEvent} */ ev) => {
                const btn = $(ev.currentTarget);
                const action = btn.data("action");
                const idx = btn.data("idx");
                const file = e[idx];
                if (!file) return;
                if (action === "delete") {
                    dialog.confirm(`是否删除 ${file.name} ?`, {
                        icon: 3, title: "提示", btn: ["确定", "取消"]
                    }, async (/** @type {number} */ confirmIdx) => {
                        dialog.close(confirmIdx);
                        let load = loading();
                        try {
                            await t.deleteFile(file.fileId);
                            e = await t.getBackupList(folderName);
                            container.html(renderCards(e));
                            dialog.alert("删除成功");
                        } catch (err) {
                            clog.error(err), show.error(`发生错误: ${errorMessage(err)}`);
                        } finally { load.close(); }
                    });
                } else if (action === "download") {
                    let load = loading();
                    try {
                        const data = await decryptData(await t.getFileContent(file.fileId));
                        utils.download(data, file.name);
                    } catch (err) {
                        clog.error(err), show.error("下载失败: " + err);
                    } finally { load.close(); }
                } else if (action === "import") {
                    let load = loading();
                    try {
                        let data = await t.getFileContent(file.fileId);
                        data = await decryptData(data);
                        const parsed = JSON.parse(data);
                        const currentData = await storageManager.exportData();
                        const diff = await storageManager.diffData(currentData, parsed);
                        load.close();
                        showDiffPreviewFn(diff, null, parsed);
                    } catch (err) {
                        load.close(), clog.error(err), show.error("预览失败: " + errorMessage(err));
                    }
                }
            });
        }
    });
}

/** Desktop backup file list dialog using Tabulator table. */
/** @param {BackupFile[]} e @param {WebDavHandle} t @param {string} n @param {string} folderName @param {ShowDiffPreview} showDiffPreviewFn @param {DialogHandle} dialog */
export function openFileListDialog(e, t, n, folderName, showDiffPreviewFn, dialog) {
    if (utils.isMobileMode()) {
        openFileListDialogMobile(e, t, n, folderName, showDiffPreviewFn, dialog);
        return;
    }
    dialog.open({
        type: 1,
        title: n + "备份文件",
        content: '\n                <div class="jhs-table-dialog"> \n                    <div id="table-container" class="jhs-table-dialog__content"></div>\n                </div>\n            ',
        area: utils.getResponsiveArea([ "800px", "70%" ]),
        anim: -1,
        success: (/** @type {HTMLElement} */ a) => {
            const tableRoot = $(a).find(".jhs-table-dialog__content").get(0) || $(a).find("#table-container").get(0);
            const i = createJhsTable((/** @type {any} */ (globalThis)).Tabulator, tableRoot, {
                pagination: !1,
                layout: "fitColumns",
                placeholder: "暂无数据",
                virtualDom: !0,
                data: e,
                responsiveLayout: "collapse",
                responsiveLayoutCollapse: !0,
                columnDefaults: {
                    headerHozAlign: "center",
                    hozAlign: "center"
                },
                columns: [ {
                    title: "文件名",
                    field: "name",
                    width: 200,
                    headerSort: !1,
                    responsive: 0
                }, {
                    title: "文件大小",
                    field: "size",
                    responsive: 1,
                    headerSort: !1,
                    formatter: (/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ n) => {
                        const a = [ "B", "KB", "MB", "GB", "TB", "PB" ];
                        let i = 0, s = e.getData().size;
                        for (;s >= 1024 && i < a.length - 1; ) s /= 1024, i++;
                        return `${s % 1 == 0 ? s.toFixed(0) : s.toFixed(2)} ${a[i]}`;
                    }
                }, {
                    title: "备份日期",
                    field: "createTime",
                    responsive: 2,
                    headerSort: !1,
                    formatter: (/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ n) => {
                        const a = e.getData();
                        return `${utils.getNowStr("-", ":", a.createTime)}`;
                    }
                }, {
                    title: "操作",
                    minWidth: 250,
                    responsive: 0,
                    headerSort: !1,
                    formatter: (/** @type {any} */ e, /** @type {any} */ a, /** @type {(callback: () => void) => void} */ s) => {
                        const o = e.getData();
                        return s((() => {
                            const a = e.getElement().querySelector(".backup-delete"), s = e.getElement().querySelector(".backup-download"), r = e.getElement().querySelector(".backup-import");
                            a && a.addEventListener("click", ((/** @type {MouseEvent} */ e) => {
                                dialog.confirm(`是否删除 ${o.name} ?`, {
                                    icon: 3,
                                    title: "提示",
                                    btn: [ "确定", "取消" ]
                                }, (async (/** @type {number} */ e) => {
                                    dialog.close(e);
                                    let a = loading();
                                    try {
                                        await t.deleteFile(o.fileId);
                                        let e = await t.getBackupList(folderName);
                                        i.replaceData(e), dialog.alert("删除成功");
                                    } catch (s) {
                                        clog.error(s), show.error(`发生错误: ${errorMessage(s)}`);
                                    } finally {
                                        a.close();
                                    }
                                }));
                            })), s && s.addEventListener("click", (async (/** @type {MouseEvent} */ e) => {
                                let a = loading();
                                try {
                                    const e = await decryptData(await t.getFileContent(o.fileId));
                                        utils.download(e, o.name);
                                } catch (i) {
                                    clog.error(i), show.error("下载失败: " + i);
                                } finally {
                                    a.close();
                                }
                            })), r && r.addEventListener("click", (async (/** @type {MouseEvent} */ e) => {
                                let a = loading();
                                try {
                                    let e = await t.getFileContent(o.fileId);
                                    e = await decryptData(e);
                                    const n = JSON.parse(e), i = await storageManager.exportData(), s = await storageManager.diffData(i, n);
                                    a.close(), showDiffPreviewFn(s, null, n);
                                } catch (i) {
                                    a.close(), clog.error(i), show.error("预览失败: " + errorMessage(i));
                                }
                            }));
                        })), '\n                                    <button type="button" class="jhs-btn jhs-btn--danger backup-delete">删除</button>\n                                    <button type="button" class="jhs-btn jhs-btn--secondary backup-download">下载</button>\n                                    <button type="button" class="jhs-btn jhs-btn--primary backup-import">导入</button>\n                                ';
                    }
                } ]
            });
        }
    });
}

/** Export all data as a downloadable JSON file. */
export async function exportSettingData() {
    try {
        const e = JSON.stringify(await storageManager.exportData()), t = `${utils.getNowStr("_", "_")}.json`;
        utils.download(e, t), show.ok("数据导出成功");
    } catch (t) {
        clog.error(t), show.error("导出数据时出错: " + errorMessage(t));
    }
}
