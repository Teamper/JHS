/** Handle JSON file import via file input, run diff analysis, show preview. */
async function importSettingData(showDiffPreviewFn) {
    try {
        const input = document.createElement("input");
        input.type = "file", input.accept = ".json";
        const cleanup = () => { try { document.body.removeChild(input); } catch (e) {} };
        input.onchange = async e => {
            const t = e.target.files[0];
            if (!t) return void cleanup();
            const n = new FileReader;
            n.onload = async e => {
                cleanup();
                try {
                    const t = e.target.result.toString(), n = JSON.parse(t);
                    if (!n || "object" != typeof n || Array.isArray(n)) throw new Error("文件内容不是有效的数据对象");
                    const a = loading();
                    try {
                        const e = await storageManager.exportData(), t = await storageManager.diffData(e, n);
                        a.close(), showDiffPreviewFn(t, n, null);
                    } catch (i) {
                        a.close(), console.error(i), show.error("差异分析失败: " + i.message);
                    }
                } catch (t) {
                    console.error(t), show.error("导入失败：文件内容不是有效的JSON格式 " + t.message);
                }
            }, n.onerror = () => {
                cleanup(), show.error("读取文件时出错");
            }, n.readAsText(t);
        }, document.body.appendChild(input), input.click();
        setTimeout(cleanup, 3e5);
    } catch (e) {
        console.error(e), show.error("导入数据时出错: " + e.message);
    }
}

/** Create encrypted backup and upload via WebDAV. */
async function backupDataByWebDav(folderName) {
    const t = await storageManager.getSetting(), n = t.webDavUrl;
    if (!n) return void show.error("请填写webDav服务地址并保存后, 再试此功能");
    const a = t.webDavUsername;
    if (!a) return void show.error("请填写webDav用户名并保存后, 再试此功能");
    const i = await decryptCredential(t.webDavPassword);
    if (!i) return void show.error("请填写webDav密码并保存后, 再试此功能");
    let s = utils.getNowStr("_", "_") + ".json", o = JSON.stringify(await storageManager.exportData());
    o = await encryptData(o);
    let r = loading();
    try {
        const e = new De(n, a, i);
        await e.backup(folderName, s, o), show.ok("备份完成");
    } catch (l) {
        console.error(l), show.error(l.toString());
    } finally {
        r.close();
    }
}

/** List WebDAV backups and open the file list dialog. */
async function backupListBtnByWebDav(folderName, openFileListDialogFn) {
    const t = await storageManager.getSetting(), n = t.webDavUrl;
    if (!n) return void show.error("请填写webDav服务地址并保存后, 再试此功能");
    const a = t.webDavUsername;
    if (!a) return void show.error("请填写webDav用户名并保存后, 再试此功能");
    const i = await decryptCredential(t.webDavPassword);
    if (!i) return void show.error("请填写webDav密码并保存后, 再试此功能");
    let s = loading();
    try {
        const e = new De(n, a, i), t = await e.getBackupList(folderName);
        openFileListDialogFn(t, e, "WebDav");
    } catch (o) {
        console.error(o), show.error(`发生错误: ${o ? o.message : o}`);
    } finally {
        s.close();
    }
}

/** Mobile-specific backup file list dialog using card-based UI. */
function openFileListDialogMobile(e, t, n, folderName, showDiffPreviewFn) {
    const formatSize = (size) => {
        const units = ["B", "KB", "MB", "GB", "TB", "PB"];
        let i = 0, s = size;
        for (; s >= 1024 && i < units.length - 1;) s /= 1024, i++;
        return `${s % 1 == 0 ? s.toFixed(0) : s.toFixed(2)} ${units[i]}`;
    };
    const renderCards = (files) => {
        if (!files || files.length === 0) {
            return '<div class="jhs-backup-empty">暂无数据</div>';
        }
        return files.map((file, idx) => `
                <div class="jhs-backup-card" data-idx="${idx}">
                    <div class="jhs-backup-card-name">${escapeHtml(file.name)}</div>
                    <div class="jhs-backup-card-meta">${formatSize(file.size)} · ${utils.getNowStr("-", ":", file.createTime)}</div>
                    <div class="jhs-backup-card-actions">
                        <button class="jhs-backup-btn jhs-backup-btn-danger" data-action="delete" data-idx="${idx}">删除</button>
                        <button class="jhs-backup-btn jhs-backup-btn-primary" data-action="download" data-idx="${idx}">下载</button>
                        <button class="jhs-backup-btn jhs-backup-btn-success" data-action="import" data-idx="${idx}">导入</button>
                    </div>
                </div>
            `).join("");
    };
    const containerId = "jhs-backup-card-list";
    layer.open({
        type: 1,
        title: n + "备份文件",
        content: `<div id="${containerId}" style="padding:0 4px;">${renderCards(e)}</div>`,
        area: utils.getResponsiveArea(["800px", "70%"]),
        anim: -1,
        success: (layerEl) => {
            const container = $(layerEl).find(`#${containerId}`);
            container.on("click", ".jhs-backup-btn", async (ev) => {
                const btn = $(ev.currentTarget);
                const action = btn.data("action");
                const idx = btn.data("idx");
                const file = e[idx];
                if (!file) return;
                if (action === "delete") {
                    layer.confirm(`是否删除 ${file.name} ?`, {
                        icon: 3, title: "提示", btn: ["确定", "取消"]
                    }, async (confirmIdx) => {
                        layer.close(confirmIdx);
                        let load = loading();
                        try {
                            await t.deleteFile(file.fileId);
                            e = await t.getBackupList(folderName);
                            container.html(renderCards(e));
                            layer.alert("删除成功");
                        } catch (err) {
                            console.error(err), show.error(`发生错误: ${err ? err.message : err}`);
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
                        load.close(), console.error(err), show.error("预览失败: " + (err ? err.message : err));
                    }
                }
            });
        }
    });
}

/** Desktop backup file list dialog using Tabulator table. */
function openFileListDialog(e, t, n, folderName, showDiffPreviewFn) {
    if (utils.isMobileMode()) {
        openFileListDialogMobile(e, t, n, folderName, showDiffPreviewFn);
        return;
    }
    layer.open({
        type: 1,
        title: n + "备份文件",
        content: '\n                <div style="height: 100%;overflow:hidden;"> \n                    <div id="table-container" style="margin:auto auto !important;"></div>\n                </div>\n            ',
        area: utils.getResponsiveArea([ "800px", "70%" ]),
        anim: -1,
        success: a => {
            const i = new Tabulator("#table-container", {
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
                    formatter: (e, t, n) => {
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
                    formatter: (e, t, n) => {
                        const a = e.getData();
                        return `${utils.getNowStr("-", ":", a.createTime)}`;
                    }
                }, {
                    title: "操作",
                    minWidth: 250,
                    responsive: 0,
                    headerSort: !1,
                    formatter: (e, a, s) => {
                        const o = e.getData();
                        return s((() => {
                            const a = e.getElement().querySelector(".a-danger"), s = e.getElement().querySelector(".a-primary"), r = e.getElement().querySelector(".a-success");
                            a && a.addEventListener("click", (e => {
                                layer.confirm(`是否删除 ${o.name} ?`, {
                                    icon: 3,
                                    title: "提示",
                                    btn: [ "确定", "取消" ]
                                }, (async e => {
                                    layer.close(e);
                                    let a = loading();
                                    try {
                                        await t.deleteFile(o.fileId);
                                        let e = await t.getBackupList(folderName);
                                        i.replaceData(e), layer.alert("删除成功");
                                    } catch (s) {
                                        console.error(s), show.error(`发生错误: ${s ? s.message : s}`);
                                    } finally {
                                        a.close();
                                    }
                                }));
                            })), s && s.addEventListener("click", (async e => {
                                let a = loading();
                                try {
                                    const e = await decryptData(await t.getFileContent(o.fileId));
                                        utils.download(e, o.name);
                                } catch (i) {
                                    clog.error(i), show.error("下载失败: " + i);
                                } finally {
                                    a.close();
                                }
                            })), r && r.addEventListener("click", (async e => {
                                let a = loading();
                                try {
                                    let e = await t.getFileContent(o.fileId);
                                    e = await decryptData(e);
                                    const n = JSON.parse(e), i = await storageManager.exportData(), s = await storageManager.diffData(i, n);
                                    a.close(), showDiffPreviewFn(s, null, n);
                                } catch (i) {
                                    a.close(), console.error(i), show.error("预览失败: " + (i ? i.message : i));
                                }
                            }));
                        })), '\n                                    <a class="a-danger">删除</a>\n                                    <a class="a-primary">下载</a>\n                                    <a class="a-success">导入</a>\n                                ';
                    }
                } ],
                locale: "zh-cn",
                langs: {
                    "zh-cn": {
                        pagination: {
                            first: "首页",
                            first_title: "首页",
                            last: "尾页",
                            last_title: "尾页",
                            prev: "上一页",
                            prev_title: "上一页",
                            next: "下一页",
                            next_title: "下一页",
                            all: "所有",
                            page_size: "每页行数"
                        }
                    }
                }
            });
        }
    });
}

/** Export all data as a downloadable JSON file. */
async function exportSettingData() {
    try {
        const e = JSON.stringify(await storageManager.exportData()), t = `${utils.getNowStr("_", "_")}.json`;
        utils.download(e, t), show.ok("数据导出成功");
    } catch (t) {
        console.error(t), show.error("导出数据时出错: " + t.message);
    }
}
