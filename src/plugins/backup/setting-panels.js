/** Render the network/external requests panel: circuit breaker status, domain stats. */
async function renderNetworkPanel() {
    const e = gmHttp.getCircuitBreakerStatus(), t = gmHttp.getDomainStats(), n = await storageManager.getSetting("circuitBreakerThreshold", 3), a = await storageManager.getSetting("circuitBreakerCooldown", 6e4);
    $("#circuitBreakerThreshold").val(n), $("#circuitBreakerCooldownSec").val(Math.round(a / 1e3));
    const i = Object.entries(e);
    if (i.length) {
        let t = '<table class="jhs-data-table"><tr><th>域名</th><th class="is-center">状态</th><th class="is-center">失败次数</th><th class="is-center">操作</th></tr>';
        for (const [n, a] of i) {
            const i = "open" === a.state ? "熔断" : "half-open" === a.state ? "半开" : "正常", s = "open" === a.state ? `剩余${Math.ceil((a.cooldownMs - (Date.now() - a.openTime)) / 1e3)}秒` : "";
            t += `<tr><td>${escapeHtml(n)}</td><td class="is-center">${i} ${s}</td><td class="is-center">${Number(a.failCount) || 0}</td><td class="is-center"><button type="button" class="jhs-btn jhs-btn--danger reset-breaker" data-domain="${escapeHtml(n)}">重置</button></td></tr>`;
        }
        t += '</table>', $("#site-health-table").html(t);
    } else $("#site-health-table").html('<p class="jhs-empty-note">暂无熔断记录</p>');
    const s = Object.entries(t).sort(((e, t) => t[1].count - e[1].count));
    if (s.length) {
        let e = '<table class="jhs-data-table"><tr><th>域名</th><th class="is-right">请求数</th><th class="is-right">错误数</th><th class="is-center">最后使用</th></tr>';
        for (const [t, n] of s) {
            const a = n.lastUsed ? new Date(n.lastUsed).toLocaleTimeString() : "-";
            e += `<tr><td>${escapeHtml(t)}</td><td class="is-right">${n.count}</td><td class="is-right ${n.errors > 0 ? "is-danger" : ""}">${n.errors}</td><td class="is-center">${a}</td></tr>`;
        }
        e += '</table>', e += `<p class="jhs-caption">共 ${s.length} 个域名</p>`, $("#domain-stats-table").html(e);
    } else $("#domain-stats-table").html('<p class="jhs-empty-note">暂无统计数据</p>');
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
    if (0 === e.length) return void $("#snapshot-list").html('<div class="jhs-empty-note">暂无快照，点击上方按钮创建</div>');
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
                                    clog.error(t), show.error("恢复失败: " + t.message);
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
                                } catch (t) { clog.error(t), show.error("删除失败: " + t.message); }
                            }));
                        }));
                    })), '<button type="button" class="jhs-btn jhs-btn--primary snap-restore">恢复</button> <button type="button" class="jhs-btn jhs-btn--secondary snap-download">下载</button> <button type="button" class="jhs-btn jhs-btn--danger snap-delete">删除</button>';
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
    let s = '<div class="jhs-dialog-content">';
    s += '<div class="jhs-summary-grid">';
    s += `<div class="jhs-summary-card jhs-summary-card--success"><strong>${a.added}</strong><span>新增数据源</span></div>`;
    s += `<div class="jhs-summary-card jhs-summary-card--danger"><strong>${a.removed}</strong><span>缺失数据源</span></div>`;
    s += `<div class="jhs-summary-card jhs-summary-card--warning"><strong>${a.modified}</strong><span>有变更</span></div>`;
    s += `<div class="jhs-summary-card"><strong>${a.unchanged}</strong><span>无变化</span></div>`;
    s += '</div>';
    if (i.length > 0) {
        s += '<div class="jhs-scroll-frame"><table class="jhs-data-table"><thead><tr><th>数据源</th><th>状态</th><th class="is-center">当前</th><th class="is-center">导入</th><th class="is-center">新增</th><th class="is-center">删除</th><th class="is-center">修改</th></tr></thead><tbody>';
        const o = { added: "新增", removed: "缺失", modified: "变更", unchanged: "无变化" };
        for (const r of i) s += `<tr><td>${escapeHtml(r.store)}</td><td>${o[r.status] || r.status}</td><td class="is-center">${r.oldCount}</td><td class="is-center">${r.newCount}</td><td class="is-center is-success">${r.added || "-"}</td><td class="is-center is-danger">${r.removed || "-"}</td><td class="is-center is-warning">${r.modified || "-"}</td></tr>`;
        s += '</tbody></table></div>';
    } else {
        s += '<div class="jhs-empty-note">数据完全一致，无需导入</div>';
    }
    s += '<div class="jhs-warning-note">导入将覆盖当前数据，建议先创建快照备份</div>';
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
                clog.error(r), show.error("导入失败: " + r.message);
            } finally { o.close(); }
        }
    });
}

/** Render the plugin management panel: categorized plugin list, timing, errors, cache stats. */
async function renderPluginMgmtPanel() {
    const disabled = JSON.parse(await storageManager.getSetting("disabledPlugins", "[]"));
    const allNames = unsafeWindow.pluginManager.getPluginNames();
    const { categories, corePlugins, pluginMeta } = getPluginCategories();
    const registeredSet = new Set(allNames);
    let html = "";
    for (const [catKey, cat] of Object.entries(categories)) {
        const visiblePlugins = cat.plugins.filter(p => registeredSet.has(p));
        if (!visiblePlugins.length) continue;
        html += '<section class="jhs-plugin-group">';
        html += `<h4 class="jhs-plugin-group__title">${escapeHtml(cat.label)}</h4>`;
        for (const pName of visiblePlugins) {
            const isCore = corePlugins.includes(pName);
            const isDisabled = disabled.includes(pName);
            const productName = pluginMeta[pName]?.[0] || pName;
            html += '<div class="jhs-plugin-row">';
            html += `<span class="jhs-plugin-copy" title="内部插件名：${escapeHtml(pName)}"><strong>${escapeHtml(productName)}</strong></span>`;
            if (isCore) {
                html += '<span class="jhs-badge jhs-badge--neutral">核心</span>';
            } else {
                html += `<input type="checkbox" class="mini-switch pm-toggle" data-plugin="${escapeHtml(pName)}" ${isDisabled ? "" : "checked"}>`;
            }
            html += `</div>`;
        }
        html += `</section>`;
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
    const startup = unsafeWindow.pluginManager.getStartupReport?.(), timings = unsafeWindow.pluginManager.getTimings();
    const formatMs = value => Number.isFinite(value) ? value.toFixed(1) : "0.0";
    let startupHtml = startup ? `<div class="jhs-inline-metrics"><span>就绪: <strong>${formatMs(startup.readyMs)} ms</strong></span><span>注册: ${formatMs(startup.registrationMs)} ms</span><span>样式: ${formatMs(startup.cssMs)} ms</span><span>即时插件: ${formatMs(startup.immediateMs)} ms</span><span>空闲任务: ${startup.idleCompleted}/${startup.idleCompleted + startup.idlePending}</span></div><p class="jhs-caption">就绪耗时不包含 @require 下载及浏览器脚本解析时间。</p>` : "";
    if (timings.length) {
        const sorted = [...timings].sort((a, b) => b.elapsed - a.elapsed);
        let tHtml = '<table class="jhs-data-table"><tr><th>插件</th><th class="is-center">阶段</th><th class="is-right">耗时(ms)</th><th class="is-center">状态</th></tr>';
        for (const t of sorted) {
            const stateClass = t.status === "disabled" ? "is-muted" : t.elapsed > 500 ? "is-slow" : t.elapsed > 200 ? "is-warning" : "";
            const statusText = t.status === "disabled" ? "已禁用" : t.status === "error" ? "错误" : t.status === "pending-idle" ? "等待空闲" : t.status === "skipped-mobile" ? "移动端跳过" : "正常";
            tHtml += `<tr><td class="${stateClass}">${escapeHtml(t.name)}</td><td class="is-center">${t.startupMode === "idle" ? "空闲" : "即时"}</td><td class="is-right ${stateClass}">${t.elapsed.toFixed(1)}</td><td class="is-center">${statusText}</td></tr>`;
        }
        tHtml += '</table>';
        $("#plugin-timing-table").html(startupHtml + tHtml);
    } else {
        $("#plugin-timing-table").html(startupHtml + '<p class="jhs-empty-note">暂无数据，刷新页面后自动采集。</p>');
    }
    const errorLog = unsafeWindow.pluginManager.getErrorLog();
    if (errorLog.length) {
        let eHtml = '<table class="jhs-data-table"><tr><th>时间</th><th>插件</th><th>阶段</th><th>错误信息</th></tr>';
        for (const err of [...errorLog].reverse()) {
            eHtml += `<tr><td class="is-muted">${escapeHtml(err.time.substring(11, 19))}</td><td>${escapeHtml(err.plugin)}</td><td>${escapeHtml(err.phase)}</td><td class="is-danger">${escapeHtml(err.message)}</td></tr>`;
        }
        eHtml += '</table>';
        $("#plugin-error-log").html(eHtml);
    } else {
        $("#plugin-error-log").text("无错误记录");
    }
    const cacheStats = storageManager.getCacheHitStats();
    $("#cache-hit-stats").html(`<div class="jhs-inline-metrics"><span>命中: <strong>${cacheStats.hits}</strong></span><span>未命中: <strong>${cacheStats.misses}</strong></span><span>总计: <strong>${cacheStats.total}</strong></span><span>命中率: <strong>${cacheStats.rate}</strong></span></div>`);
}

/** Render the data health check panel with totals and issue breakdown. */
async function renderDataHealthPanel() {
    const e = $("#health-data-display");
    if (!e.length) return;
    e.text("体检中...");
    try {
        const t = await storageManager.inspectDataHealth(), n = t.fixable.reduce(((e, t) => e + t.count), 0), a = t.readonly.reduce(((e, t) => e + t.count), 0), i = t => t.length ? t.map((e => `<li><strong>${escapeHtml(e.message)}</strong>：${e.count}</li>`)).join("") : "<li>无</li>";
        e.html(`
                <div class="jhs-summary-grid">
                    <div>番号记录：<strong>${t.totals.carList}</strong></div>
                    <div>收藏演员：<strong>${t.totals.favoriteActresses}</strong></div>
                    <div>黑名单演员：<strong>${t.totals.blacklist}</strong></div>
                    <div>黑名单作品：<strong>${t.totals.blacklistCarList}</strong></div>
                </div>
                <div class="jhs-health-summary">体检时间：${escapeHtml(t.checkedAt)}；可修复问题 <strong>${n}</strong> 项，只读问题 <strong>${a}</strong> 项。</div>
                <div class="jhs-health-columns">
                    <div><h4>可安全修复</h4><ul>${i(t.fixable)}</ul></div>
                    <div><h4>仅报告</h4><ul>${i(t.readonly)}</ul></div>
                </div>
            `);
    } catch (t) {
        clog.error(t), e.text("体检失败: " + t);
    }
}

/** Repair data health issues after auto-backing up current data. */
async function repairDataHealthWithBackup() {
    const e = JSON.stringify(await storageManager.exportData()), t = `health-backup-${utils.getNowStr("_", "_")}.json`;
    utils.download(e, t);
    const n = await storageManager.repairDataHealth();
    show.ok(`已修复 ${n.fixedGroups} 组数据问题，修复前备份已下载`), await renderDataHealthPanel();
}
