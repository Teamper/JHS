class StatsPlugin extends X {
    getName() { return "StatsPlugin"; }
    async initCss() {
        return `
            <style>
                .jhs-stats { height:100%; padding:var(--jhs-space-4); overflow:auto; }
                .jhs-stats__metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); border-top:1px solid var(--jhs-border); border-left:1px solid var(--jhs-border); }
                .jhs-stats__metric { display:grid; gap:var(--jhs-space-1); padding:var(--jhs-space-4); border-right:1px solid var(--jhs-border); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface); }
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
        const cars = await storageManager.getCarList(), actresses = await storageManager.getFavoriteActressList(), blacklist = await storageManager.getBlacklist(), total = cars.length, statusMap = await storageManager.getStatusMap();
        const counts = { filter: statusMap[d].size, favorite: statusMap[h].size, hasDown: statusMap[g].size, hasWatch: statusMap[p].size };
        const actressCounts = {};
        cars.forEach((car => { car.names && car.names.split(" ").forEach((name => { name && (actressCounts[name] = (actressCounts[name] || 0) + 1); })); }));
        const topActresses = Object.entries(actressCounts).sort(((left, right) => right[1] - left[1])).slice(0, 10), topValue = topActresses[0]?.[1] || 1;
        const pending = total - counts.filter - counts.favorite - counts.hasDown - counts.hasWatch, carMap = await storageManager.getCarMap(), counter = this.getBean("NewVideoPlugin");
        let newVideos = 0;
        actresses.forEach((actress => { counter && (newVideos += counter.getPendingNewVideoCount(actress, carMap)); }));
        const metrics = [ [ "总记录", total ], [ "已收藏", counts.favorite ], [ "已下载", counts.hasDown ], [ "已观看", counts.hasWatch ], [ "已屏蔽", counts.filter ], [ "待鉴定", pending ], [ "收藏演员", actresses.length ], [ "黑名单演员", blacklist.length ], [ "新作品待看", newVideos ] ];
        const statusRows = [ [ "已收藏", counts.favorite, "var(--jhs-status-fav)" ], [ "已下载", counts.hasDown, "var(--jhs-status-down)" ], [ "已观看", counts.hasWatch, "var(--jhs-status-watch)" ], [ "已屏蔽", counts.filter, "var(--jhs-status-filter)" ], [ "待鉴定", pending, "var(--jhs-border-strong)" ] ];
        const row = (label, value, max, color) => `<div class="jhs-stats__row"><span class="jhs-stats__label" title="${escapeHtml(label)}">${escapeHtml(label)}</span><span class="jhs-stats__track"><span class="jhs-stats__bar" data-width="${max ? Math.round(value / max * 100) : 0}" data-color="${color}"></span></span><span class="jhs-stats__value">${value}${max === total && total ? ` (${Math.round(value / total * 100)}%)` : ""}</span></div>`;
        const dialogHtml = `<div class="jhs-stats jhs-scrollbar jhs-ui">
            <div class="jhs-stats__metrics">${metrics.map((metric => `<div class="jhs-stats__metric"><strong>${metric[1]}</strong><span>${metric[0]}</span></div>`)).join("")}</div>
            <section class="jhs-stats__group"><h3>状态分布</h3><div class="jhs-stats__rows">${statusRows.map((item => row(item[0], item[1], total, item[2]))).join("")}</div></section>
            ${topActresses.length ? `<section class="jhs-stats__group"><h3>Top 10 演员</h3><div class="jhs-stats__rows">${topActresses.map((item => row(item[0], item[1], topValue, "var(--jhs-accent)"))).join("")}</div></section>` : ""}
        </div>`;
        layer.open({ type: 1, title: "收藏统计", content: dialogHtml, scrollbar: !1, area: utils.getDialogArea("lg"), anim: -1, success: (layerElement, layerIndex) => {
            $(layerElement).find(".jhs-stats__bar").each((function() { $(this).css({ "--jhs-value": `${$(this).data("width")}%`, "--jhs-bar": $(this).data("color") }); }));
            utils.setupEscClose(layerIndex);
        } });
    }
}
