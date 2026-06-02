class ce extends X {
    getName() {
        return "HighlightMagnetPlugin";
    }
    doFilterMagnet() {
        this.handleDb(), this.handleBus();
    }
    /** 给磁力行注入评分徽章（幂等：已有则跳过） */
    injectScoreBadge(el, title) {
        try {
            if (el.find(".jhs-magnet-score").length > 0) return;
            const score = calcMagnetScore({ title: title || "", seeders: 0 });
            const total = score.total;
            const label = total >= 70 ? "高" : total >= 40 ? "中" : "低";
            const color = total >= 70 ? "#22c55e" : total >= 40 ? "#f59e0b" : "#9ca3af";
            const tip = `分辨率:${score.resolution}/25 字幕:${score.subtitle}/20 做种:${score.seeders}/35 新鲜度:${score.freshness}/15`;
            el.append(`<span class="jhs-magnet-score" title="${tip}" style="display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:10px;font-size:11px;font-weight:600;color:#fff;background:${color};margin-left:6px;cursor:help;vertical-align:middle;">${label} ${total}</span>`);
        } catch (e) {}
    }
    handleDb() {
        if (!r) return;
        let e = $("#magnets-content .name");
        if (0 === e.length) return;
        const t = [ "4k", "-c", "-u", "-uc" ];
        let n = !1;
        e.each(((e, a) => {
            const i = $(a), s = i.text().toLowerCase(), o = t.some((e => s.includes(e)));
            const row = i.parent().parent().parent();
            row.addClass("magnet-row"), s.includes("4k") && i.css("color", "#f40"),
            o && (n = !0, row.addClass("high-quality"));
            this.injectScoreBadge(i, i.text());
        })), n ? $("#magnets-content .magnet-row").not(".high-quality").hide() : $("#enable-magnets-filter").addClass("do-hide");
    }
    handleBus() {
        l && isDetailPage && utils.loopDetector((() => $("#magnet-table td a").length > 0), (() => {
            const e = $("#magnet-table tr"), t = [ "4k", "-c", "-u", "-uc" ];
            let n = !1;
            e.each(((e, a) => {
                const i = $(a), s = i.find("td:first-child"), o = s.find("a:first-child"), r = s.find("a:nth-child(2)"), l = o.text().toLowerCase();
                l.includes("4k") && o.css("color", "#f40");
                (t.some((e => l.includes(e))) || r.length && r.text().includes("字幕")) && (n = !0,
                i.addClass("high-quality"));
                this.injectScoreBadge(o, o.text());
            })), n ? e.each(((e, t) => {
                const n = $(t);
                n.hasClass("high-quality") || n.hide();
            })) : $("#enable-magnets-filter").addClass("do-hide");
        }));
    }
    showAll() {
        if (r) {
            $("#magnets-content .item").toArray().forEach((e => $(e).show()));
        }
        l && $("#magnet-table tr").toArray().forEach((e => $(e).show()));
    }
}
