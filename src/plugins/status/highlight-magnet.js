class HighlightMagnetPlugin extends BasePlugin {
    async initCss() {
        return `<style>.jhs-magnet-score{display:inline-flex;align-items:center;gap:3px;margin-left:6px;padding:1px 6px;border-radius:10px;font-size:11px;font-weight:600;vertical-align:middle;cursor:help}</style>`;
    }
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
            const color = total >= 70 ? "var(--jhs-status-down)" : total >= 40 ? "var(--jhs-status-watch)" : "var(--jhs-surface-2)";
            const onColor = total >= 70 ? "var(--jhs-status-down-on)" : total >= 40 ? "var(--jhs-status-watch-on)" : "var(--jhs-text-muted)";
            const tip = `分辨率:${score.resolution}/25 字幕:${score.subtitle}/20 做种:${score.seeders}/35 新鲜度:${score.freshness}/15`;
            const badge = $(`<span class="jhs-magnet-score" title="${tip}">${label} ${total}</span>`).css({ color: onColor, backgroundColor: color });
            el.append(badge);
        } catch (e) { clog.debug("磁力评分徽章注入失败，已忽略", e); }
    }
    getQualitySignals(title, hasSubtitleTag = !1) {
        const value = String(title || "").toLowerCase(), resolution = /(?:4k|2160p|1080p|720p)/.exec(value)?.[0] || "", subtitle = hasSubtitleTag || /(?:-c\b|-u(?:c)?\b|chinese|中字|字幕)/.test(value);
        return { resolution, subtitle, recognized: !!resolution || subtitle, highQuality: "4k" === resolution || "2160p" === resolution || subtitle };
    }
    updateFilterHint(hasMatch) {
        $("#enable-magnets-filter").removeClass("do-hide").attr("data-tip", hasMatch ? "仅显示识别到的高质量或字幕磁力" : "未识别到可过滤项，当前未隐藏磁力");
    }
    handleDb() {
        if (!r) return;
        let e = $("#magnets-content .name");
        if (0 === e.length) return void this.updateFilterHint(!1);
        let n = !1;
        e.each(((e, a) => {
            const i = $(a), s = i.text().toLowerCase(), o = this.getQualitySignals(s);
            const row = i.parent().parent().parent();
            row.removeClass("high-quality").show();
            row.addClass("magnet-row"), s.includes("4k") && i.css("color", "var(--jhs-status-filter-text)"),
            o.highQuality && (n = !0, row.addClass("high-quality"));
            this.injectScoreBadge(i, i.text());
        })), n && $("#magnets-content .magnet-row").not(".high-quality").hide(), this.updateFilterHint(n);
    }
    handleBus() {
        l && isDetailPage && utils.loopDetector((() => $("#magnet-table td a").length > 0), (() => {
            const e = $("#magnet-table tr");
            let n = !1;
            e.each(((e, a) => {
                const i = $(a), s = i.find("td:first-child"), o = s.find("a:first-child"), r = s.find("a:nth-child(2)"), l = o.text().toLowerCase();
                i.removeClass("high-quality").show();
                l.includes("4k") && o.css("color", "var(--jhs-status-filter-text)");
                this.getQualitySignals(l, r.length > 0 && r.text().includes("字幕")).highQuality && (n = !0,
                i.addClass("high-quality"));
                this.injectScoreBadge(o, o.text());
            }));
            n && e.each(((e, t) => {
                const n = $(t);
                n.hasClass("high-quality") || n.hide();
            })), this.updateFilterHint(n);
        }));
    }
    showAll() {
        $("#enable-magnets-filter").removeClass("do-hide").removeAttr("data-tip");
        if (r) {
            $("#magnets-content .item").toArray().forEach((e => $(e).show()));
        }
        l && $("#magnet-table tr").toArray().forEach((e => $(e).show()));
    }
}
