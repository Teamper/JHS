class StatsPlugin extends BasePlugin {
    getName() { return "StatsPlugin"; }
    async initCss() {
        return `
            <style>
                .jhs-stats { height:100%; padding:var(--jhs-space-4); overflow:auto; }
                .jhs-stats__metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); border-top:1px solid var(--jhs-border); border-left:1px solid var(--jhs-border); }
                .jhs-stats__metric { display:grid; gap:var(--jhs-space-1); padding:var(--jhs-space-4); border:0; border-right:1px solid var(--jhs-border); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface); text-align:left; }
                button.jhs-stats__metric { cursor:pointer; }
                .jhs-stats__metric strong { color:var(--jhs-text); font-size:28px; line-height:1; }
                .jhs-stats__metric span { color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .jhs-stats__group { margin-top:var(--jhs-space-5); }
                .jhs-stats__group h3 { margin:0 0 var(--jhs-space-3); color:var(--jhs-text); font-size:var(--jhs-font-size-md); }
                .jhs-stats__rows { display:grid; gap:var(--jhs-space-2); }
                .jhs-stats__row { display:grid; grid-template-columns:90px minmax(0,1fr) 76px; align-items:center; gap:var(--jhs-space-3); min-height:32px; }
                .jhs-stats__label { overflow:hidden; color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); text-align:right; text-overflow:ellipsis; white-space:nowrap; }
                .jhs-stats__track { height:10px; overflow:hidden; border-radius:var(--jhs-radius-pill); background:var(--jhs-surface-2); }
                .jhs-stats__bar { display:block; width:var(--jhs-value,0%); height:100%; border-radius:inherit; background:var(--jhs-bar,var(--jhs-accent)); }
                .jhs-stats__value { color:var(--jhs-text-faint); font-size:var(--jhs-font-size-xs); }
                @media (max-width:767px) { .jhs-stats__metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .jhs-stats__row { grid-template-columns:72px minmax(0,1fr) 58px; gap:var(--jhs-space-2); } }
            </style>`;
    }
    async handle() { window.isListPage && this.createBtn(); }
    createBtn() {
        const e = '<button type="button" id="statsBtn" class="jhs-btn jhs-btn--secondary"><span>统计</span></button>';
        $("#newVideoBtn").after(e), $("#statsBtn").on("click", (() => this.openDialog()));
    }
    async openDialog() {
        const cars = await storageManager.getCarList(), actresses = await storageManager.getFavoriteActressList(), blacklist = await storageManager.getBlacklist(), activity = await stateService.getActivityLog(), total = cars.length;
        const counts = { manualBlocked: 0, favorite: 0, hasDown: 0, hasWatch: 0, pending: 0 };
        cars.forEach((car => { const flags = normalizeStateFlags(car.stateFlags); flags.blocked && counts.manualBlocked++, flags.favorite && counts.favorite++, flags.downloaded && counts.hasDown++, flags.watched && counts.hasWatch++, hasAnyState(flags) || counts.pending++; }));
        const actressCounts = new Map;
        cars.forEach((car => {
            const names = String(car.names || "").split(/[\s,，、]+/).filter(Boolean);
            if (car.starId) {
                const key = `id:${car.starId}`, current = actressCounts.get(key) || { starId: car.starId, name: names[0] || car.starId, count: 0 };
                current.count++, actressCounts.set(key, current);
            } else names.forEach((name => { const key = `name:${name}`, current = actressCounts.get(key) || { starId: "", name, count: 0 }; current.count++, actressCounts.set(key, current); }));
        }));
        const topActresses = [ ...actressCounts.values() ].sort(((left, right) => right.count - left.count || left.name.localeCompare(right.name))).slice(0, 10), topValue = topActresses[0]?.count || 1, javDbUrl = await this.getBean("OtherSitePlugin").getJavDbUrl();
        const pending = counts.pending, counter = this.getBean("NewVideoPlugin"), newVideos = counter ? await counter.getPendingNewVideoTotal() : 0, pageSummary = this.getBean("ListPagePlugin").getCurrentPageSummary();
        const metrics = [
            { label: "总记录", value: total, action: null },
            { label: "收藏", value: counts.favorite, action: null },
            { label: "下载", value: counts.hasDown, action: null },
            { label: "已看", value: counts.hasWatch, action: null },
            { label: "手动屏蔽", value: counts.manualBlocked, action: null },
            { label: "未鉴定", value: pending, action: null },
            { label: "收藏演员", value: actresses.length, action: null },
            { label: "黑名单演员", value: blacklist.length, action: null },
            { label: "新作品待处理", value: newVideos, action: "new-video" }
        ];
        const statusRows = [ [ "收藏", counts.favorite, "var(--jhs-status-fav)" ], [ "下载", counts.hasDown, "var(--jhs-status-down)" ], [ "已看", counts.hasWatch, "var(--jhs-status-watch)" ], [ "手动屏蔽", counts.manualBlocked, "var(--jhs-status-filter)" ], [ "未鉴定", pending, "var(--jhs-border-strong)" ] ];
        const row = (label, value, max, color, href = "") => `<div class="jhs-stats__row">${href ? `<a class="jhs-stats__label" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(label)}">${escapeHtml(label)}</a>` : `<span class="jhs-stats__label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`}<span class="jhs-stats__track"><span class="jhs-stats__bar" data-width="${max ? Math.round(value / max * 100) : 0}" data-color="${color}"></span></span><span class="jhs-stats__value">${value}${max === total && total ? ` (${Math.round(value / total * 100)}%)` : ""}</span></div>`;
        const trend = days => { const cutoff = Date.now() - days * 864e5, result = { identified: 0, downloaded: 0, watched: 0 }; activity.entries.filter((entry => "committed" === entry.commitState && Date.parse(entry.createdAt) >= cutoff)).forEach((entry => entry.changes.filter((change => "reverted" !== change.undoState)).forEach((change => { const before = normalizeStateFlags(change.before?.stateFlags), after = normalizeStateFlags(change.after?.stateFlags); !hasAnyState(before) && hasAnyState(after) && result.identified++, !before.downloaded && after.downloaded && result.downloaded++, !before.watched && after.watched && result.watched++; })))); return result; }, trend7 = trend(7), trend30 = trend(30);
        const coverageNote = activity.coverageStart ? `活动记录仅覆盖自 ${escapeHtml(activity.coverageStart)} 起` : "仅统计 6.4.0 及之后产生的操作记录";
        const renderMetric = metric => metric.action
            ? `<button type="button" class="jhs-btn jhs-stats__metric" data-action="${metric.action}"${metric.filter ? ` data-filter="${metric.filter}"` : ""}><strong>${metric.value}</strong><span>${metric.label}</span></button>`
            : `<div class="jhs-stats__metric"><strong>${metric.value}</strong><span>${metric.label}</span></div>`;
        const dialogHtml = `<div class="jhs-stats jhs-scrollbar jhs-ui">
            <section class="jhs-stats__group"><h3>全库概览</h3><div class="jhs-stats__metrics">${metrics.map(renderMetric).join("")}</div></section>
            <section class="jhs-stats__group"><h3>当前页面</h3><div class="jhs-stats__metrics">${renderMetric({ label: "屏蔽项", value: pageSummary.blockedItems, action: "filter", filter: "blockedItems" })}</div></section>
            <section class="jhs-stats__group"><h3>状态分布</h3><div class="jhs-stats__rows">${statusRows.map((item => row(item[0], item[1], total, item[2]))).join("")}</div></section>
            <section class="jhs-stats__group"><h3>活动趋势</h3><p class="jhs-helper-text">${coverageNote}</p><div class="jhs-stats__metrics"><div class="jhs-stats__metric"><strong>${trend7.identified}</strong><span>近 7 天新增鉴定</span></div><div class="jhs-stats__metric"><strong>${trend7.downloaded}</strong><span>近 7 天标记下载</span></div><div class="jhs-stats__metric"><strong>${trend7.watched}</strong><span>近 7 天标记观看</span></div><div class="jhs-stats__metric"><strong>${trend30.identified}</strong><span>近 30 天新增鉴定</span></div><div class="jhs-stats__metric"><strong>${trend30.downloaded}</strong><span>近 30 天标记下载</span></div><div class="jhs-stats__metric"><strong>${trend30.watched}</strong><span>近 30 天标记观看</span></div></div></section>
            ${topActresses.length ? `<section class="jhs-stats__group"><h3>Top 10 演员</h3><div class="jhs-stats__rows">${topActresses.map((item => row(item.name, item.count, topValue, "var(--jhs-accent)", new URL(item.starId ? `/actors/${encodeURIComponent(item.starId)}` : `/search?q=${encodeURIComponent(item.name)}`, javDbUrl).href))).join("")}</div></section>` : ""}
        </div>`;
        layer.open({ type: 1, title: "统计", content: dialogHtml, scrollbar: !1, area: utils.getDialogArea("lg"), anim: -1, success: (layerElement, layerIndex) => {
            $(layerElement).find(".jhs-stats__bar").each((function() { $(this).css({ "--jhs-value": `${$(this).data("width")}%`, "--jhs-bar": $(this).data("color") }); }));
            $(layerElement).find("button.jhs-stats__metric[data-action]").on("click", (event => {
                const metric = $(event.currentTarget), action = metric.data("action");
                layer.close(layerIndex);
                if ("new-video" === action) return this.getBean("NewVideoPlugin").openDialog();
                if ("filter" === action) this.getBean("ListPagePlugin").setQuickFilter(metric.data("filter"));
            }));
            utils.setupEscClose(layerIndex);
        } });
    }
}
