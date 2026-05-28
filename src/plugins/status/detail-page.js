class Q extends X {
    getName() {
        return "DetailPagePlugin";
    }
    constructor() {
        super();
    }
    handle() {
        window.isDetailPage && ($(".video-meta-panel a").each((function() {
            const e = $(this).attr("href");
            e && (e.startsWith("http://") || e.startsWith("https://") || e.startsWith("/")) && $(this).attr("target", "_blank");
        })));
    }
}
