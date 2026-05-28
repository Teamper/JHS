class Ce extends X {
    getName() {
        return "ListPageButtonPlugin";
    }
    async handle() {
        if (!window.isListPage) return;
        await this.createMenuBtn(), this.bindEvent();
        await storageManager.getSetting("autoPage") === _ ? $("#sort-toggle-btn").hide() : this.sortItems().then();
    }
    async createMenuBtn() {
        if (r) {
            const e = o.includes("/actors/");
            let t = $(".main-tabs, .tabs"), n = "加入黑名单", a = "#d22020", i = "", s = null;
            if (e) {
                t = $(".toolbar, .section-addition").filter(":last");
                const e = await storageManager.getBlacklist(), i = this.getActressPageInfo();
                e.find((e => e.starId === i.starId)) && (n = "已加入黑名单", a = "#885d5d");
            } else o.includes("/tags") && utils.loopDetector((() => $("#jhs-check-tag").text().trim()), (async () => {
                const e = $("#addBlacklistBtn");
                e.attr("data-tip", "将当前分类标签加入到黑名单, 后续有作品更新也会纳入屏蔽中");
                const t = $("#jhs-check-tag").text().trim();
                if (!t) return;
                const n = "no-" + t, a = await storageManager.getBlacklist();
                s = a.find((e => e.starId === n)), s && (e.css("backgroundColor", "#885d5d"), $("#addBlacklistBtn span").text("已加入黑名单"));
            }));
            const r = o.includes("advanced_search");
            r ? t = $("h2.section-title") : i = "flex-grow:1;";
            const l = localStorage.getItem("jhs_sortMethod"), d = "当前排序方式: " + ("rateCount" === l ? "评价人数" : "date" === l ? "时间" : "默认");
            t.append(`\n                <div style="display: flex;align-items: center; ${i} ">\n                    <a id="waitCheckBtn" class="menu-btn main-tab-btn" style="background-color:#56c938 !important;"><span>打开待鉴定</span></a>\n                    ${e ? `\n                     <a id="addBlacklistBtn" class="menu-btn main-tab-btn" style="background-color:${a} !important;" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n}</span></a>\n                     <a id="filterAllVideo" class="menu-btn main-tab-btn" style="background-color:#e8ab39 !important;" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>一键屏蔽所有作品</span></a>\n                     <a id="favoriteAllVideo" class="menu-btn main-tab-btn" style="background-color:#25b1dc !important;" data-tip="一键收藏当前页面所有作品"><span>一键收藏所有作品</span></a>\n                     <a id="hasDownAllVideo" class="menu-btn main-tab-btn" style="background-color:#7bc73b !important;margin-right: 30px!important;" data-tip="一键标记当前页面所有作品为已下载"><span>一键已下载所有作品</span></a>\n                    ` : ""}\n                    ${o.includes("/tags") ? `\n                      <a id="addBlacklistBtn" class="menu-btn main-tab-btn" style="background-color:${a} !important;" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n}</span></a>\n                    ` : ""}\n                </div>\n                <div style="display: flex;align-items: center;">\n                    <a id="newVideoBtn" class="menu-btn main-tab-btn" style="background-color:#2c6cc0 !important;"><span>新作品检测 (<span id="newVideoCount">0</span>)</span></a>\n                    <a id="blacklistBtn" class="menu-btn main-tab-btn" style="background-color:#34393f !important;"><span>演员黑名单</span></a>\n                    ${c || r ? "" : `<a id="sort-toggle-btn" class="menu-btn main-tab-btn" style="background-color:#8783ab !important;"> ${d} </a>`}\n                </div>\n            `);
        }
        if (l) {
            const e = o.includes("/star/");
            let t = "加入黑名单", n = "#d22020";
            if (e) {
                const e = await storageManager.getBlacklist(), a = this.getActressPageInfo();
                e.find((e => e.starId === a.starId)) && (t = "已加入黑名单", n = "#885d5d");
            }
            $(".masonry").parent().prepend(`\n                <div style="margin: 10px; display: flex;">\n                    <a id="waitCheckBtn" class="menu-btn main-tab-btn" style="background-color:#56c938 !important;"><span>打开待鉴定</span></a>\n                    ${e ? `    \n                        <a id="addBlacklistBtn" class="menu-btn main-tab-btn" style="background-color:${n} !important;" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${t}</span></a>\n                        <a id="filterAllVideo" class="menu-btn main-tab-btn" style="background-color:#e8ab39 !important;" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>一键屏蔽所有作品</span></a>\n                        <a id="favoriteAllVideo" class="menu-btn main-tab-btn" style="background-color:#25b1dc !important;" data-tip="一键收藏当前页面所有作品"><span>一键收藏所有作品</span></a>\n                        <a id="hasDownAllVideo" class="menu-btn main-tab-btn" style="background-color:#7bc73b !important;" data-tip="一键标记当前页面所有作品为已下载"><span>一键已下载所有作品</span></a>\n                    ` : '<a id="blacklistBtn" class="menu-btn main-tab-btn" style="background-color:#34393f !important;"><span>演员黑名单</span></a>'}\n                </div>\n            `);
        }
    }
    bindEvent() {
        $("#waitCheckBtn").on("click", (e => {
            this.openWaitCheck(e).then();
        })), $("#newVideoBtn").on("click", (e => {
            this.getBean("NewVideoPlugin").openDialog();
        })), $("#blacklistBtn").on("click", (e => {
            this.getBean("BlacklistPlugin").openBlacklistDialog();
        })), $("#sort-toggle-btn").on("click", (e => {
            const t = localStorage.getItem("jhs_sortMethod");
            let n;
            n = t && "default" !== t ? "rateCount" === t ? "date" : "default" : "rateCount";
            const a = {
                default: "默认",
                rateCount: "评价人数",
                date: "时间"
            }[n];
            $(e.target).text(`当前排序方式: ${a}`), localStorage.setItem("jhs_sortMethod", n), this.sortItems().then();
        }));
        const e = this.getBean("BlacklistPlugin");
        $("#addBlacklistBtn").on("click", (async t => {
            await e.addBlacklist(t);
        })), $("#filterAllVideo").on("click", (async t => {
            let n = {
                clientX: t.clientX,
                clientY: t.clientY + 80
            }, a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            let i = a.text().trim().split(",")[0];
            utils.q(n, "一键屏蔽视频列表?", (async () => {
                this.loadObj = loading();
                try {
                    await e.filterAllVideo(i), window.refresh();
                } catch (t) {
                    console.error(t);
                } finally { this.loadObj.close(); }
            }));
        })), $("#favoriteAllVideo").on("click", (async t => {
            let n = {clientX: t.clientX, clientY: t.clientY + 80}, a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            let i = a.text().trim().split(",")[0];
            utils.q(n, "一键收藏所有可见作品?", (async () => {
                this.loadObj = loading();
                try { await e.batchSaveAllVideos(i, h), window.refresh(); } catch (t) { console.error(t); } finally { this.loadObj.close(); }
            }));
        })), $("#hasDownAllVideo").on("click", (async t => {
            let n = {clientX: t.clientX, clientY: t.clientY + 80}, a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            let i = a.text().trim().split(",")[0];
            utils.q(n, "一键已下载所有可见作品?", (async () => {
                this.loadObj = loading();
                try { await e.batchSaveAllVideos(i, g), window.refresh(); } catch (t) { console.error(t); } finally { this.loadObj.close(); }
            }));
        }));
    }
    async sortItems() {
        if (o.includes("handle") || o.includes("advanced_search")) return;
        const e = await storageManager.getSetting("autoPage");
        if (c || e === _) return;
        const t = localStorage.getItem("jhs_sortMethod");
        if (!t) return;
        $(".movie-list .item").each((function(e) {
            $(this).attr("data-original-index") || $(this).attr("data-original-index", e);
        }));
        const n = $(".movie-list"), a = $(".item", n);
        if ("default" === t) a.sort((function(e, t) {
            return $(e).data("original-index") - $(t).data("original-index");
        })).appendTo(n); else {
            const e = a.get();
            e.sort((function(e, n) {
                if ("rateCount" === t) {
                    const t = e => {
                        const t = $(e).find(".score .value").text().match(/由(\d+)人/);
                        return t ? parseFloat(t[1]) : 0;
                    };
                    return t(n) - t(e);
                }
                {
                    const t = e => {
                        const t = $(e).find(".meta").text().trim();
                        return new Date(t);
                    };
                    return t(n) - t(e);
                }
            })), n.empty().append(e);
        }
    }
    async openWaitCheck() {
        let e = this.getSelector();
        const t = await storageManager.getSetting("waitCheckCount", 5), n = [ u, b, y, k ];
        let a = 0;
        $(`${e.itemSelector}:visible`).each(((e, i) => {
            if (a >= t) return !1;
            const s = $(i);
            if (n.some((e => s.find(`span.tag:contains('${e}')`).length > 0))) return;
            const {carNum: o, aHref: r} = this.getBean("ListPagePlugin").findCarNumAndHref(s);
            if (o.includes("FC2-")) {
                const e = this.parseMovieId(r);
                this.getBean("Fc2Plugin").openFc2Page(e, o, r);
            } else {
                let e = r + (r.includes("?") ? "&autoPlay=1" : "?autoPlay=1");
                window.open(e);
            }
            a++;
        })), 0 === a && show.info("没有需鉴定的视频");
    }
}
