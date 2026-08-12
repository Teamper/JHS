class SubTitleCatPlugin extends BasePlugin {
    getName() {
        return "SubTitleCatPlugin";
    }
    handle() {
        $(".t-banner-inner").hide(), $("#navbar").hide();
        let e = new URLSearchParams(window.location.search).get("search").toLowerCase(), t = $(".sub-table tr td a").toArray(), n = 0;
        t.forEach((t => {
            let a = $(t);
            a.text().toLowerCase().includes(e) ? n++ : a.parent().parent().hide();
        })), 0 === n && show.error("该番号无字幕!");
        const a = $(".sec-title"), i = a.html().replace(/^\d+/, n);
        a.html(i);
    }
}
