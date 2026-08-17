class OneOneFiveOfflinePlugin extends BasePlugin {
    getName() { return "OneOneFiveOfflinePlugin"; }
    async handle() {
        if (!window.isDetailPage) return;
        if (!await storageManager.getSetting("enable115Offline", !1)) return;
        const client = new OneOneFiveClient();
        utils.loopDetector((() => $(".magnet-copy,.magnet-links").length > 0), (() => {
            $(".magnet-copy").each(((index, element) => { const box = $(element); box.find(".one115-offline-btn").length || box.append('<button type="button" class="jhs-btn magnet-hub-btn one115-offline-btn">115离线</button>'); }));
        }), 1, 1e4, !1);
        $(document).off("click.jhs115", ".one115-offline-btn").on("click.jhs115", ".one115-offline-btn", (async event => {
            const magnet = $(event.currentTarget).siblings("[data-magnet]").first().data("magnet") || $(event.currentTarget).closest(".magnet-result").find('a[href^="magnet:"]').attr("href");
            if (!magnet) return show.error("未找到磁力链接");
            try { await client.addOffline(magnet); show.ok("115 离线任务已创建"); utils.q(event, "是否将该作品标记为已下载？", (async () => { const info = this.getPageInfo(); await storageManager.saveCar({ ...info, actionType: g }); show.ok("已标记为已下载"); })); } catch (error) { clog.error("115 离线失败", error); show.error(error.message); }
        }));
    }
}
class OneOneFiveMatchPlugin extends BasePlugin {
    getName() { return "OneOneFiveMatchPlugin"; }
    async handle() {
        if (!await storageManager.getSetting("enable115Match", !1)) return;
        if (!isDetailPage) return this.matchListPage();
        const carNum = this.getPageInfo().carNum, keyword = normalize115Keyword(carNum); if (!keyword) return;
        const host = $(".movie-panel-info,.container .info").first(); host.append('<div class="panel-block jhs-115-match"><strong>115匹配：</strong><span>匹配中</span></div>');
        try {
            const cacheMinutes = Math.max(1, Number(await storageManager.getSetting("oneOneFiveCacheMinutes", 60)) || 60), matches = await storageManager.cachedRequest(`115match:${carNum}`, cacheMinutes * 6e4, (() => new OneOneFiveClient().search(keyword)));
            const box = $(".jhs-115-match").empty().append("<strong>115匹配：</strong>");
            if (!matches.length) return void box.append(document.createTextNode("未匹配 "), $('<button type="button" class="jhs-btn jhs-btn--ghost">重试</button>').on("click", (() => location.reload())));
            matches.forEach((match => { const row = $('<span class="jhs-115-match-row"></span>'), playUrl = build115PlayUrl(match); playUrl ? row.append($("<a></a>").addClass("jhs-btn jhs-btn--secondary").attr({ href: playUrl, target: "_blank" }).text(`${match.name} (${format115Size(match.size)})`)) : row.append($("<span></span>").text(`${match.name} (${format115Size(match.size)}) · 不可播放`)); match.fileId && row.append($("<button type=\"button\" class=\"jhs-btn jhs-btn--ghost jhs-115-rename\">重命名</button>").data("match", match)); box.append(row); }));
            box.on("click", ".jhs-115-rename", (event => this.renameWithPreview(event, $(event.currentTarget).data("match"), carNum)));
        } catch (error) { const box = $(".jhs-115-match").empty().append("<strong>115匹配：</strong>", document.createTextNode("未登录或请求失败 ")); box.append('<a class="jhs-btn jhs-btn--ghost" href="https://115.com" target="_blank">去登录</a>', $('<button type="button" class="jhs-btn jhs-btn--ghost">重试</button>').on("click", (() => location.reload()))); clog.error("115 匹配失败", error); }
    }
    async matchListPage() {
        const cards = $(".movie-list .item,.masonry .item").get().filter((element => { const rect = element.getBoundingClientRect(); return rect.bottom >= 0 && rect.top <= window.innerHeight; })), client = new OneOneFiveClient(), concurrency = Math.max(1, Math.min(10, Number(await storageManager.getSetting("oneOneFiveConcurrency", 4)) || 4)), cacheMinutes = Math.max(1, Number(await storageManager.getSetting("oneOneFiveCacheMinutes", 60)) || 60);
        await mapLimit(cards, concurrency, (async element => { try {
            const card = $(element), carNum = normalizeCarNum(card.find(".video-title strong").first().text()); if (!carNum) return;
            const matches = await storageManager.cachedRequest(`115match:${carNum}`, cacheMinutes * 6e4, (() => client.search(normalize115Keyword(carNum))));
            const badge = $("<button type=\"button\" class=\"jhs-btn jhs-btn--ghost jhs-115-list-match\"></button>").text(matches.length ? `匹配${matches.length}个` : "未匹配").data("matches", matches);
            card.find(".video-title").first().prepend(badge);
            badge.on("click", (() => { if (1 === matches.length) return window.open(build115PlayUrl(matches[0]), "_blank"); const links = matches.map((match => `<a href="${escapeHtml(build115PlayUrl(match))}" target="_blank">${escapeHtml(match.name)}</a>`)).join("<br>"); layer.open({ type: 1, title: `${carNum} 115匹配`, content: `<div class="jhs-dialog-content">${links || "未匹配"}</div>`, area: utils.getResponsiveArea(["560px", "auto"]) }); }));
        } catch (error) { const card = $(element); card.find(".video-title").first().prepend($('<button type="button" class="jhs-btn jhs-btn--ghost">失败·重试</button>').one("click", (() => this.matchListPage()))); clog.warn("115 单卡匹配失败", error); } }));
    }
    renameWithPreview(event, match, carNum) {
        const nextName = preview115Rename(match.name, carNum, { uppercase: !0, keepSuffix: !0 });
        utils.q(event, `确认重命名？<br>${escapeHtml(match.name)}<br>→ ${escapeHtml(nextName)}`, (async () => { await new OneOneFiveClient().rename(match.fileId, nextName); show.ok("重命名完成"); }));
    }
}
class OneOneFiveRenamePlugin extends BasePlugin { getName() { return "OneOneFiveRenamePlugin"; } }
