class ce extends X {
    getName() {
        return "HighlightMagnetPlugin";
    }
    doFilterMagnet() {
        this.handleDb(), this.handleBus();
    }
    handleDb() {
        if (!r) return;
        let e = $("#magnets-content .name");
        if (0 === e.length) return;
        const t = [ "4k", "-c", "-u", "-uc" ];
        let n = !1;
        e.each(((e, a) => {
            const i = $(a), s = i.text().toLowerCase(), o = t.some((e => s.includes(e)));
            i.parent().parent().parent().addClass("magnet-row"), s.includes("4k") && i.css("color", "#f40"),
            o && (n = !0, i.parent().parent().parent().addClass("high-quality"));
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
