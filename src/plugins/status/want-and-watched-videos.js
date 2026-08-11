class ze extends X {
    constructor() {
        super(...arguments), i(this, "type", null);
    }
    getName() {
        return "WantAndWatchedVideosPlugin";
    }
    async handle() {
        window.location.href.includes("/want_watch_videos") && ($("h3").append('<button type="button" class="jhs-btn jhs-btn--primary jhs-layout-481ed7e7" id="wantWatchBtn">导入至 JHS</button>'),
        $("#wantWatchBtn").on("click", (e => {
            this.type = h, this.importWantWatchVideos(e, "是否将 想看的影片 导入到 JHS-收藏?");
        }))), window.location.href.includes("/watched_videos") && ($("h3").append('<button type="button" class="jhs-btn jhs-btn--primary jhs-layout-481ed7e7" id="wantWatchBtn">导入至 JHS</button>'),
        $("#wantWatchBtn").on("click", (e => {
            this.type = g, this.importWantWatchVideos(e, "是否将 看过的影片 导入到 JHS-已下载?");
        })));
    }
    importWantWatchVideos(e, t) {
        utils.q(null, `${t} <br/> <span class="jhs-task-emphasis">执行此功能前请记得备份数据</span>`, (async () => {
            let e = loading();
            try {
                await this.parseMovieList();
            } catch (t) {
                console.error(t);
            } finally {
                e.close();
            }
        }));
    }
    async parseMovieList(e) {
        let t, n;
        e ? (t = e.find(this.getSelector().itemSelector), n = e.find(".pagination-next").attr("href")) : (t = $(this.getSelector().itemSelector),
        n = $(".pagination-next").attr("href"));
        for (const i of t) {
            const e = $(i), t = e.find("a").attr("href"), n = e.find(".video-title strong").text().trim(), s = e.find(".meta").text().trim();
            if (t && n) try {
                if (await storageManager.getCar(n)) {
                    show.info(`${n} 已存在, 跳过`);
                    continue;
                }
                await storageManager.saveCar({
                    carNum: n,
                    url: t,
                    names: null,
                    actionType: this.type,
                    publishTime: s
                });
            } catch (a) {
                console.error(`保存失败 [${n}]:`, a);
            }
        }
        n ? (show.info("发现下一页，正在解析:", n), await new Promise((e => setTimeout(e, 1e3))),
        $.ajax({
            url: n,
            method: "GET",
            success: e => {
                const t = new DOMParser, n = $(t.parseFromString(e, "text/html"));
                this.parseMovieList(n);
            },
            error: function(e) {
                console.error(e), show.error("加载下一页失败:" + e.message);
            }
        })) : (show.ok("导入结束!"), window.refresh());
    }
}
