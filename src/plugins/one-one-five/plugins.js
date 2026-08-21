class OneOneFiveOfflinePlugin extends BasePlugin {
    constructor() {
        super(...arguments), this.BUTTON_COOLDOWN_MS = 2e3;
    }
    getName() { return "OneOneFiveOfflinePlugin"; }
    async initCss() {
        return "\n            <style>\n                .one115-offline-btn {\n                    background-color: var(--jhs-accent) !important;\n                    color: var(--jhs-accent-text-on) !important;\n                    border-color: var(--jhs-accent) !important;\n                }\n                .one115-offline-btn.loading {\n                    cursor: wait;\n                }\n                .one115-native-btn {\n                    margin-left: 6px;\n                    padding: 3px 8px;\n                    border-radius: 3px;\n                    border: 1px solid var(--jhs-accent);\n                    background: var(--jhs-accent);\n                    color: var(--jhs-accent-text-on) !important;\n                    cursor: pointer;\n                    font-size: 12px;\n                    line-height: 1.2;\n                }\n            </style>\n        ";
    }
    async handle() {
        if (!await storageManager.getSetting("enable115Offline", !1)) return;
        (r || l) && (this.bindSubmit(), this.injectNativeButtons());
    }
    bindSubmit() {
        $(document).off("click.jhs115", ".one115-offline-btn").on("click.jhs115", ".one115-offline-btn", (async event => {
            event.preventDefault(), event.stopPropagation();
            const button = $(event.currentTarget);
            const magnet = button.attr("data-magnet") || button.siblings("[data-magnet]").first().data("magnet") || button.closest(".magnet-result, .item, td").find('a[href^="magnet:"]').first().attr("href");
            if (!magnet) return show.error("未找到磁力链接");
            await this.submitMagnet(event, magnet, button);
        }));
    }
    injectNativeButtons() {
        if (!window.isDetailPage) return;
        r && utils.loopDetector((() => $("#magnets-content .item").length > 0), (() => this.injectJavDbButtons()));
        l && utils.loopDetector((() => $("#magnet-table td a[href^='magnet:']").length > 0), (() => this.injectJavBusButtons()));
    }
    injectJavDbButtons() {
        $("#magnets-content .item").each(((index, element) => {
            const item = $(element);
            const magnet = item.find("a[href^='magnet:']").first().attr("href") || item.find(".copy-to-clipboard").attr("data-clipboard-text");
            magnet && 0 === item.find(".one115-offline-btn").length && item.find(".buttons").first().append(`<button class="jhs-btn jhs-btn--secondary one115-offline-btn" data-magnet="${escapeHtml(magnet)}" type="button">115离线</button>`);
        }));
    }
    injectJavBusButtons() {
        $("#magnet-table td a[href^='magnet:']").each(((index, element) => {
            const link = $(element);
            const magnet = link.attr("href");
            magnet && 0 === link.siblings(".one115-offline-btn").length && link.after(`<button class="jhs-btn one115-native-btn one115-offline-btn" data-magnet="${escapeHtml(magnet)}" type="button">115离线</button>`);
        }));
    }
    async submitMagnet(event, magnet, button) {
        if (button.hasClass("loading")) return;
        const originalText = button.text();
        try {
            button.addClass("loading").prop("disabled", !0).text("提交中");
            await new OneOneFiveClient().addOffline(magnet);
            show.ok("115 离线任务已创建");
            button.text("已提交");
            utils.q(event, "是否将该作品标记为已下载？", (async () => {
                const marked = await this.markCurrentVideoAsHasDown(button);
                marked && button.text("已标记");
            }));
        } catch (error) {
            clog.error("115 离线失败", error);
            if ("LOGIN_REQUIRED" === error.code) {
                if (await storageManager.getSetting("enable115LoginRedirect", !1)) {
                    window.open("https://115.com");
                    show.info("已打开 115 登录页面，登录后请返回当前页面重试");
                } else show.error((error.message || "115 未登录") + "，请先登录 https://115.com");
            } else if ("TASK_EXISTS" === error.code) utils.q(event, "该任务已在 115 离线列表中，是否前往查看？", (() => window.open("https://115.com/?tab=offline&mode=wangpan"))); else show.error(error.message || "115 离线失败");
            button.text(originalText);
        } finally {
            setTimeout((() => button.removeClass("loading").prop("disabled", !1)), this.BUTTON_COOLDOWN_MS);
        }
    }
    async markCurrentVideoAsHasDown(button) {
        try {
            const info = this.getOfflineVideoInfo(button);
            if (!info || !info.carNum || !info.url) return !1;
            const existing = await storageManager.getCar(info.carNum);
            if (existing && existing.status === g) return !1;
            await storageManager.saveCar({ carNum: info.carNum, url: info.url, names: info.actress || info.names || "", actionType: g, publishTime: info.publishTime });
            const detailButtonPlugin = this.getBean("DetailPageButtonPlugin");
            detailButtonPlugin && detailButtonPlugin.showStatus && await detailButtonPlugin.showStatus(info.carNum), window.refresh();
            return !0;
        } catch (error) {
            clog.error("115 离线成功后标记已下载失败:", error);
            show.error("115 离线已提交，但自动标记已下载失败：" + error);
            return !1;
        }
    }
    getOfflineVideoInfo(button) {
        if (window.isDetailPage) return this.getPageInfo();
        const item = button && button.closest ? button.closest(".item") : $();
        return item && item.length ? this.getBean("ListPagePlugin").findCarNumAndHref(item) : this.getPageInfo();
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
