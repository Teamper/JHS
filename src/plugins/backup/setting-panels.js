/** Render the network/external requests panel: circuit breaker status, domain stats. */
async function renderNetworkPanel() {
    const e = gmHttp.getCircuitBreakerStatus(), t = gmHttp.getDomainStats(), n = await storageManager.getSetting("circuitBreakerThreshold", 3), a = await storageManager.getSetting("circuitBreakerCooldown", 6e4);
    $("#circuitBreakerThreshold").val(n), $("#circuitBreakerCooldownSec").val(Math.round(a / 1e3));
    const i = Object.entries(e);
    if (i.length) {
        let t = '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
        t += '<tr style="background:#f0f0f0;"><th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">域名</th><th style="text-align:center;padding:6px;border-bottom:1px solid #ddd;">状态</th><th style="text-align:center;padding:6px;border-bottom:1px solid #ddd;">失败次数</th><th style="text-align:center;padding:6px;border-bottom:1px solid #ddd;">操作</th></tr>';
        for (const [n, a] of i) {
            const i = "open" === a.state ? "熔断" : "half-open" === a.state ? "半开" : "正常", s = "open" === a.state ? `剩余${Math.ceil((a.cooldownMs - (Date.now() - a.openTime)) / 1e3)}秒` : "";
            t += `<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:4px 6px;">${escapeHtml(n)}</td><td style="text-align:center;padding:4px 6px;">${i} ${s}</td><td style="text-align:center;padding:4px 6px;">${Number(a.failCount) || 0}</td><td style="text-align:center;padding:4px 6px;"><a class="a-danger reset-breaker" data-domain="${escapeHtml(n)}">重置</a></td></tr>`;
        }
        t += '</table>', $("#site-health-table").html(t);
    } else $("#site-health-table").html('<p style="color:#888;font-size:13px;">暂无熔断记录</p>');
    const s = Object.entries(t).sort(((e, t) => t[1].count - e[1].count));
    if (s.length) {
        let e = '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
        e += '<tr style="background:#f0f0f0;"><th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">域名</th><th style="text-align:right;padding:6px;border-bottom:1px solid #ddd;">请求数</th><th style="text-align:right;padding:6px;border-bottom:1px solid #ddd;">错误数</th><th style="text-align:center;padding:6px;border-bottom:1px solid #ddd;">最后使用</th></tr>';
        for (const [t, n] of s) {
            const a = n.lastUsed ? new Date(n.lastUsed).toLocaleTimeString() : "-";
            e += `<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:4px 6px;">${escapeHtml(t)}</td><td style="text-align:right;padding:4px 6px;">${n.count}</td><td style="text-align:right;padding:4px 6px;color:${n.errors > 0 ? "#e74c3c" : "#333"};">${n.errors}</td><td style="text-align:center;padding:4px 6px;">${a}</td></tr>`;
        }
        e += '</table>', e += `<p style="color:#888;font-size:12px;margin-top:8px;">共 ${s.length} 个域名</p>`, $("#domain-stats-table").html(e);
    } else $("#domain-stats-table").html('<p style="color:#888;font-size:13px;">暂无统计数据</p>');
    $(".reset-breaker").off("click").on("click", (e => {
        const t = $(e.target).data("domain");
        gmHttp.resetCircuitBreaker(t), show.ok(`已重置 ${t} 的熔断状态`), renderNetworkPanel();
    })), $("#resetAllBreakersBtn").off("click").on("click", (() => {
        gmHttp.resetAllCircuitBreakers(), show.ok("已重置全部熔断状态"), renderNetworkPanel();
    })), $("#clearDomainStatsBtn").off("click").on("click", (() => {
        gmHttp.clearDomainStats(), show.ok("已清空域名统计"), renderNetworkPanel();
    }));
}

/** Render the snapshot list as a Tabulator table with restore/download/delete actions. */
async function renderSnapshotPanel() {
    const e = await storageManager.getSnapshotList(), t = {
        "manual": "手动创建",
        "auto-import": "导入前自动",
        "auto-repair": "修复前自动",
        "auto-restore": "恢复前自动"
    };
    if (0 === e.length) return void $("#snapshot-list").html('<div style="text-align:center;color:#999;padding:30px;">暂无快照，点击上方按钮创建</div>');
    $("#snapshot-list").find(".tabulator").length && $("#snapshot-list").empty();
    const n = new Tabulator("#snapshot-list", {
        layout: "fitColumns",
        placeholder: "暂无数据",
        data: e,
        columnDefaults: { headerHozAlign: "center", hozAlign: "center" },
        columns: [
            { title: "名称", field: "name", width: 200, headerSort: !1 },
            { title: "来源", field: "source", width: 100, headerSort: !1, formatter: e => t[e.getValue()] || e.getValue() },
            { title: "时间", field: "time", width: 170, headerSort: !1 },
            { title: "数据量", field: "itemCount", width: 80, headerSort: !1 },
            {
                title: "操作", minWidth: 220, headerSort: !1, formatter: (e, t, a) => {
                    const i = e.getData();
                    return a((() => {
                        const t = e.getElement().querySelector(".snap-restore"), a = e.getElement().querySelector(".snap-download"), s = e.getElement().querySelector(".snap-delete");
                        t && t.addEventListener("click", (async e => {
                            utils.q(e, `恢复到快照「${escapeHtml(i.name)}」? 当前数据会自动备份。`, (async () => {
                                let e = loading();
                                try {
                                    await storageManager.restoreSnapshot(i.id), show.ok("恢复成功, 页面将刷新"), setTimeout(() => location.reload(), 1e3);
                                } catch (t) {
                                    console.error(t), show.error("恢复失败: " + t.message);
                                } finally { e.close(); }
                            }));
                        })), a && a.addEventListener("click", (async e => {
                            let t = loading();
                            try {
                                const e = await storageManager.getSnapshot(i.id);
                                if (!e) throw new Error("快照不存在");
                                utils.download(JSON.stringify(e.data), `snapshot_${escapeHtml(i.name)}.json`), show.ok("下载成功");
                            } catch (n) { show.error("下载失败: " + n.message); } finally { t.close(); }
                        })), s && s.addEventListener("click", (async e => {
                            utils.q(e, `删除快照「${escapeHtml(i.name)}」?`, (async () => {
                                try {
                                    await storageManager.deleteSnapshot(i.id), show.ok("已删除"), renderSnapshotPanel();
                                } catch (t) { console.error(t), show.error("删除失败: " + t.message); }
                            }));
                        }));
                    })), '<a class="a-success snap-restore">恢复</a> <a class="a-primary snap-download">下载</a> <a class="a-danger snap-delete">删除</a>';
                }
            }
        ],
        locale: "zh-cn"
    });
}

/** Show a data diff preview dialog before importing data. */
function showDiffPreview(e, t, n = null) {
    const a = e.summary, i = [];
    for (const [s, o] of Object.entries(e.stores)) {
        if ("unchanged" === o.status) continue;
        const e = { store: s, status: o.status, oldCount: o.oldCount, newCount: o.newCount, added: o.added.length, removed: o.removed.length, modified: o.modified.length };
        i.push(e);
    }
    let s = '<div style="padding:15px;">';
    s += '<div style="display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap;">';
    s += `<div style="flex:1;min-width:100px;background:#f0fff4;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:bold;color:#7bc73b">${a.added}</div><div style="font-size:12px;color:#888">新增数据源</div></div>`;
    s += `<div style="flex:1;min-width:100px;background:#fff5f5;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:bold;color:#de3333">${a.removed}</div><div style="font-size:12px;color:#888">缺失数据源</div></div>`;
    s += `<div style="flex:1;min-width:100px;background:#fff8e1;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:bold;color:#f59e0b">${a.modified}</div><div style="font-size:12px;color:#888">有变更</div></div>`;
    s += `<div style="flex:1;min-width:100px;background:#f5f5f5;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:bold;color:#999">${a.unchanged}</div><div style="font-size:12px;color:#888">无变化</div></div>`;
    s += '</div>';
    if (i.length > 0) {
        s += '<div style="max-height:350px;overflow:auto;border:1px solid #eee;border-radius:5px;">';
        s += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
        s += '<thead><tr style="background:#f5f5f5;"><th style="padding:8px;text-align:left;">数据源</th><th style="padding:8px;">状态</th><th style="padding:8px;">当前</th><th style="padding:8px;">导入</th><th style="padding:8px;">新增</th><th style="padding:8px;">删除</th><th style="padding:8px;">修改</th></tr></thead><tbody>';
        const o = { added: "新增", removed: "缺失", modified: "变更", unchanged: "无变化" };
        for (const r of i) s += `<tr style="border-bottom:1px solid #eee;"><td style="padding:6px 8px;">${escapeHtml(r.store)}</td><td style="padding:6px 8px;">${o[r.status] || r.status}</td><td style="padding:6px 8px;text-align:center;">${r.oldCount}</td><td style="padding:6px 8px;text-align:center;">${r.newCount}</td><td style="padding:6px 8px;text-align:center;color:#7bc73b;">${r.added || "-"}</td><td style="padding:6px 8px;text-align:center;color:#de3333;">${r.removed || "-"}</td><td style="padding:6px 8px;text-align:center;color:#f59e0b;">${r.modified || "-"}</td></tr>`;
        s += '</tbody></table></div>';
    } else {
        s += '<div style="text-align:center;color:#999;padding:20px;">数据完全一致，无需导入</div>';
    }
    s += '<div style="margin-top:12px;color:#e74c3c;font-size:12px;">导入将覆盖当前数据，建议先创建快照备份</div>';
    s += '</div>';
    const r = layer.open({
        type: 1,
        title: "数据差异预览",
        content: s,
        area: utils.getResponsiveArea(["700px", "auto"]),
        btn: ["确认导入", "取消"],
        anim: -1,
        yes: async s => {
            layer.close(s);
            let o = loading();
            try {
                await storageManager.createSnapshot("导入前自动备份", "auto-import"),
                n ? (await storageManager.importData(n), show.ok("导入成功!"), void setTimeout(() => location.reload(), 1e3)) : t && (await storageManager.importData(t), show.ok("导入成功!"), void setTimeout(() => location.reload(), 1e3));
            } catch (r) {
                console.error(r), show.error("导入失败: " + r.message);
            } finally { o.close(); }
        }
    });
}

/** Render the plugin management panel: categorized plugin list, timing, errors, cache stats. */
async function renderPluginMgmtPanel() {
    const disabled = JSON.parse(await storageManager.getSetting("disabledPlugins", "[]"));
    const allNames = unsafeWindow.pluginManager.getPluginNames();
    const { categories, corePlugins } = getPluginCategories();
    const registeredSet = new Set(allNames);
    let html = "";
    for (const [catKey, cat] of Object.entries(categories)) {
        const visiblePlugins = cat.plugins.filter(p => registeredSet.has(p));
        if (!visiblePlugins.length) continue;
        html += `<div style="border:1px solid #eee;border-radius:8px;padding:10px;margin-bottom:10px;">`;
        html += `<div style="font-weight:bold;font-size:14px;margin-bottom:8px;">${escapeHtml(cat.label)}</div>`;
        for (const pName of visiblePlugins) {
            const isCore = corePlugins.includes(pName);
            const isDisabled = disabled.includes(pName);
            html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;">`;
            html += `<span style="font-size:13px;">${escapeHtml(pName)}${isCore ? ' <span style="color:#888;font-size:11px;">[核心]</span>' : ""}</span>`;
            if (isCore) {
                html += `<input type="checkbox" class="mini-switch" checked disabled>`;
            } else {
                html += `<input type="checkbox" class="mini-switch pm-toggle" data-plugin="${escapeHtml(pName)}" ${isDisabled ? "" : "checked"}>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }
    $("#plugin-mgmt-list").html(html);
    const enabledCount = allNames.length - disabled.length;
    $("#pm-total").text(allNames.length);
    $("#pm-enabled").text(enabledCount);
    $("#pm-disabled").text(disabled.length);
    $(".pm-toggle").off("change").on("change", async (e) => {
        const name = $(e.target).data("plugin");
        let list = JSON.parse(await storageManager.getSetting("disabledPlugins", "[]"));
        if ($(e.target).is(":checked")) {
            list = list.filter(x => x !== name);
        } else {
            if (!list.includes(name)) list.push(name);
        }
        await storageManager.saveSettingItem("disabledPlugins", JSON.stringify(list));
        const all = unsafeWindow.pluginManager.getPluginNames();
        $("#pm-total").text(all.length);
        $("#pm-enabled").text(all.length - list.length);
        $("#pm-disabled").text(list.length);
        show.ok(`插件 "${name}" 已${$(e.target).is(":checked") ? "启用" : "禁用"}，刷新后生效`);
    });
    const timings = unsafeWindow.pluginManager.getTimings();
    if (timings.length) {
        const sorted = [...timings].sort((a, b) => b.elapsed - a.elapsed);
        let tHtml = '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
        tHtml += '<tr style="background:#f0f0f0;"><th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">插件</th><th style="text-align:right;padding:6px;border-bottom:1px solid #ddd;">耗时(ms)</th><th style="text-align:center;padding:6px;border-bottom:1px solid #ddd;">状态</th></tr>';
        for (const t of sorted) {
            const color = t.status === "disabled" ? "#ccc" : t.elapsed > 500 ? "#e74c3c" : t.elapsed > 200 ? "#f39c12" : "#333";
            const statusText = t.status === "disabled" ? "已禁用" : t.status === "error" ? "错误" : "正常";
            tHtml += `<tr><td style="padding:4px 6px;border-bottom:1px solid #f0f0f0;color:${color}">${escapeHtml(t.name)}</td><td style="text-align:right;padding:4px 6px;border-bottom:1px solid #f0f0f0;color:${color};font-weight:${t.elapsed > 500 ? "bold" : "normal"}">${t.elapsed.toFixed(1)}</td><td style="text-align:center;padding:4px 6px;border-bottom:1px solid #f0f0f0;">${statusText}</td></tr>`;
        }
        tHtml += '</table>';
        $("#plugin-timing-table").html(tHtml);
    } else {
        $("#plugin-timing-table").html('<p style="color:#888;font-size:13px;">暂无数据，刷新页面后自动采集。</p>');
    }
    const errorLog = unsafeWindow.pluginManager.getErrorLog();
    if (errorLog.length) {
        let eHtml = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
        eHtml += '<tr style="background:#f0f0f0;"><th style="text-align:left;padding:4px;">时间</th><th style="text-align:left;padding:4px;">插件</th><th style="text-align:left;padding:4px;">阶段</th><th style="text-align:left;padding:4px;">错误信息</th></tr>';
        for (const err of [...errorLog].reverse()) {
            eHtml += `<tr><td style="padding:3px 4px;border-bottom:1px solid #f0f0f0;color:#888;white-space:nowrap;">${escapeHtml(err.time.substring(11, 19))}</td><td style="padding:3px 4px;border-bottom:1px solid #f0f0f0;">${escapeHtml(err.plugin)}</td><td style="padding:3px 4px;border-bottom:1px solid #f0f0f0;">${escapeHtml(err.phase)}</td><td style="padding:3px 4px;border-bottom:1px solid #f0f0f0;color:#e74c3c;word-break:break-all;">${escapeHtml(err.message)}</td></tr>`;
        }
        eHtml += '</table>';
        $("#plugin-error-log").html(eHtml);
    } else {
        $("#plugin-error-log").text("无错误记录");
    }
    const cacheStats = storageManager.getCacheHitStats();
    $("#cache-hit-stats").html(`<div style="display:flex;gap:15px;flex-wrap:wrap;"><span>命中: <strong style="color:#7bc73b">${cacheStats.hits}</strong></span><span>未命中: <strong style="color:#e74c3c">${cacheStats.misses}</strong></span><span>总计: <strong>${cacheStats.total}</strong></span><span>命中率: <strong style="color:#25b1dc">${cacheStats.rate}</strong></span></div>`);
}

/** Render the data health check panel with totals and issue breakdown. */
async function renderDataHealthPanel() {
    const e = $("#health-data-display");
    if (!e.length) return;
    e.text("体检中...");
    try {
        const t = await storageManager.inspectDataHealth(), n = t.fixable.reduce(((e, t) => e + t.count), 0), a = t.readonly.reduce(((e, t) => e + t.count), 0), i = t => t.length ? t.map((e => `<li><strong>${escapeHtml(e.message)}</strong>：${e.count}</li>`)).join("") : "<li>无</li>";
        e.html(`
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:12px;">
                    <div>番号记录：<strong>${t.totals.carList}</strong></div>
                    <div>收藏演员：<strong>${t.totals.favoriteActresses}</strong></div>
                    <div>黑名单演员：<strong>${t.totals.blacklist}</strong></div>
                    <div>黑名单作品：<strong>${t.totals.blacklistCarList}</strong></div>
                </div>
                <div style="margin-bottom:8px;">体检时间：${escapeHtml(t.checkedAt)}；可修复问题 <strong>${n}</strong> 项，只读问题 <strong>${a}</strong> 项。</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div><div style="font-weight:bold;margin-bottom:4px;">可安全修复</div><ul>${i(t.fixable)}</ul></div>
                    <div><div style="font-weight:bold;margin-bottom:4px;">仅报告</div><ul>${i(t.readonly)}</ul></div>
                </div>
            `);
    } catch (t) {
        console.error(t), e.text("体检失败: " + t);
    }
}

/** Repair data health issues after auto-backing up current data. */
async function repairDataHealthWithBackup() {
    const e = JSON.stringify(await storageManager.exportData()), t = `health-backup-${utils.getNowStr("_", "_")}.json`;
    utils.download(e, t);
    const n = await storageManager.repairDataHealth();
    show.ok(`已修复 ${n.fixedGroups} 组数据问题，修复前备份已下载`), await renderDataHealthPanel();
}
