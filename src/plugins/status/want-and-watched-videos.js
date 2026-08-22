class WantAndWatchedVideosPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "flag", null);
    }
    getName() {
        return "WantAndWatchedVideosPlugin";
    }
    async handle() {
        window.location.href.includes("/want_watch_videos") && ($("h3").append('<button type="button" class="jhs-btn jhs-btn--primary jhs-layout-481ed7e7" id="wantWatchBtn">导入至 JHS</button>'),
        $("#wantWatchBtn").on("click", (e => {
            this.flag = "favorite", this.importWantWatchVideos(e, "是否将想看的影片导入到 JHS 收藏？");
        }))), window.location.href.includes("/watched_videos") && ($("h3").append('<button type="button" class="jhs-btn jhs-btn--primary jhs-layout-481ed7e7" id="wantWatchBtn">导入至 JHS</button>'),
        $("#wantWatchBtn").on("click", (e => {
            this.flag = "watched", this.importWantWatchVideos(e, "是否将看过的影片导入到 JHS 已观看？");
        })));
    }
    importWantWatchVideos(e, t) {
        utils.q(null, `${t} <br/> <span class="jhs-task-emphasis">执行此功能前请记得备份数据</span>`, (async () => {
            let e = loading();
            try {
                const result = await this.parseMovieList();
                show.ok(`导入完成：成功 ${result.imported}，失败 ${result.failed}，共 ${result.pages} 页`);
            } catch (t) {
                clog.error(t), show.error(`导入失败：${t.message || t}`);
            } finally {
                e.close();
            }
        }));
    }
    async parseMovieList(e = null, result = { imported: 0, failed: 0, pages: 0 }) {
        let t, n;
        e ? (t = e.find(this.getSelector().itemSelector), n = e.find(".pagination-next").attr("href")) : (t = $(this.getSelector().itemSelector),
        n = $(".pagination-next").attr("href"));
        result.pages++, show.info(`正在导入第 ${result.pages} 页`);
        for (const i of t) {
            const e = $(i), t = e.find("a").attr("href"), n = e.find(".video-title strong").text().trim(), s = e.find(".meta").text().trim();
            if (t && n) try {
                this.flag && await stateService.patch(n, { [this.flag]: !0 }, { type: "javdb-list-import", record: { carNum: n, url: t, names: "", publishTime: s } }), result.imported++;
            } catch (a) {
                result.failed++, clog.error(`保存失败 [${n}]:`, a);
            }
        }
        if (!n) return result;
        await utils.sleep(1e3);
        const html = await gmHttp.get(new URL(n, window.location.href).href), nextPage = utils.htmlTo$dom(html);
        return this.parseMovieList(nextPage, result);
    }
}
