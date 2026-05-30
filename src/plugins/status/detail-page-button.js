class ye extends X {
    getName() {
        return "DetailPageButtonPlugin";
    }
    constructor() {
        super(), this.answerCount = 1;
    }
    async handle() {
        this.hideVideoControls(), window.isDetailPage && this.createMenuBtn();
    }
    async createMenuBtn() {
        const e = this.getPageInfo(), t = e.carNum, n = `\n            <div class="jhs-detail-btn-row" style="margin: 10px auto; display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap;gap: 20px;">\n                <div style="display: flex; gap: 10px; flex-wrap:wrap;">\n                    <a id="filterBtn" class="menu-btn" style="width: 120px; background-color:${f}; color: white; text-align: center; padding: 8px 0;">\n                        <span>${m}</span>\n                    </a>\n                    <a id="favoriteBtn" class="menu-btn" style="width: 120px; background-color:${w}; color: white; text-align: center; padding: 8px 0;">\n                        <span>${v}</span>\n                    </a>\n                    <a id="hasDownBtn" class="menu-btn" style="width: 120px; background-color:${x}; color: white; text-align: center; padding: 8px 0;">\n                        <span>${y}</span>\n                    </a>\n                    <a id="hasWatchBtn" class="menu-btn" style="width: 120px; background-color:${S}; color: white; text-align: center; padding: 8px 0;">\n                        <span>${k}</span>\n                    </a>\n                </div>\n        \n                <div style="display: flex; gap: 10px; flex-wrap:wrap;">\n                    <a id="enable-magnets-filter" class="menu-btn" style="width: 140px; background-color: #c2bd4c; color: white; text-align: center; padding: 8px 0;">\n                        <span id="magnets-span">关闭磁力过滤</span>\n                    </a>\n                    <a id="magnetSearchBtn" class="menu-btn" style="width: 120px; background: linear-gradient(to right, rgb(245,140,1), rgb(84,161,29)); color: white; text-align: center; padding: 8px 0;">\n                        <span>磁力搜索</span>\n                    </a>\n                    <a id="xunLeiSubtitleBtn" class="menu-btn" style="width: 120px; background: linear-gradient(to left, #375f7c, #2196F3); color: white; text-align: center; padding: 8px 0;">\n                        <span>字幕 (迅雷)</span>\n                    </a>\n                    <a id="search-subtitle-btn" class="menu-btn" style="width: 160px; background: linear-gradient(to bottom, #8d5656, rgb(196,159,91)); color: white; text-align: center; padding: 8px 0;">\n                        <span>字幕 (SubTitleCat)</span>\n                    </a>\n                </div>\n            </div>\n        `;
        r && $(".tabs").after(n), l && $("#mag-submit-show").before(n), $("#favoriteBtn").on("click", (() => this.favoriteOne())),
        $("#filterBtn").on("click", (e => this.filterOne(e))), $("#hasDownBtn").on("click", (async () => this.hasDownOne())),
        $("#hasWatchBtn").on("click", (async () => this.hasWatchOne())), $("#magnetSearchBtn").on("click", (() => {
            let t = this.getBean("MagnetHubPlugin").createMagnetHub(e.carNum);
            layer.open({
                type: 1,
                title: "磁力搜索 " + e.carNum,
                content: '<div id="magnetHubBox"></div>',
                area: utils.getResponsiveArea([ "60%", "80%" ]),
                scrollbar: !1,
                success: () => {
                    $("#magnetHubBox").append(t);
                }
            });
        }));
        const a = this.getBean("HighlightMagnetPlugin"), i = await storageManager.getSetting("enableMagnetsFilter", _);
        $("#magnets-span").text(i === _ ? "关闭磁力过滤" : "开启磁力过滤"), i === _ && a.doFilterMagnet(),
        $("#enable-magnets-filter").on("click", (e => {
            let t = $("#magnets-span");
            "关闭磁力过滤" === t.text() ? (a.showAll(), t.text("开启磁力过滤"), storageManager.saveSettingItem("enableMagnetsFilter", C)) : (a.doFilterMagnet(),
            t.text("关闭磁力过滤"), storageManager.saveSettingItem("enableMagnetsFilter", _));
        })), $("#search-subtitle-btn").on("click", (e => utils.openPage(`https://subtitlecat.com/index.php?search=${t}`, t, !1, e))),
        $("#xunLeiSubtitleBtn").on("click", (() => this.searchXunLeiSubtitle(t))), this.showStatus(t).then();
    }
    async showStatus(e) {
        const t = $("#filterBtn span"), n = $("#favoriteBtn span"), a = $("#hasDownBtn span"), i = $("#hasWatchBtn span");
        t.text(m), n.text(v), a.text(y), i.text(k);
        const o = await storageManager.getCar(e);
        if (o) switch (o.status) {
          case d:
            t.text(u);
            break;

          case h:
            n.text(b);
            break;

          case g:
            a.text("已标记下载");
            break;

          case p:
            i.text("已标记观看");
        }
    }
    async favoriteOne() {
        try {
            let e = this.getPageInfo();
            await storageManager.saveCar({
                carNum: e.carNum,
                url: e.url,
                names: e.actress,
                actionType: h,
                publishTime: e.publishTime
            }), this.showStatus(e.carNum).then(), window.refresh(), utils.closePage();
        } catch (t) { console.error("收藏操作失败:", t), show.error("操作失败"); }
    }
    async hasDownOne() {
        try {
            let e = this.getPageInfo();
            await storageManager.saveCar({
                carNum: e.carNum,
                url: e.url,
                names: e.actress,
                actionType: g,
                publishTime: e.publishTime
            }), this.showStatus(e.carNum).then(), window.refresh(), utils.closePage();
        } catch (t) { console.error("标记已下载失败:", t), show.error("操作失败"); }
    }
    async hasWatchOne() {
        try {
            let e = this.getPageInfo();
            await storageManager.saveCar({
                carNum: e.carNum,
                url: e.url,
                names: e.actress,
                actionType: p,
                publishTime: e.publishTime
            }), this.showStatus(e.carNum).then(), window.refresh(), utils.closePage();
        } catch (t) { console.error("标记已观看失败:", t), show.error("操作失败"); }
    }
    searchXunLeiSubtitle(e) {
        let t = loading();
        gmHttp.get(`https://api-shoulei-ssl.xunlei.com/oracle/subtitle?gcid=&cid=&name=${e}`).then((t => {
            let n = t.data;
            n && 0 !== n.length ? layer.open({
                type: 1,
                title: "迅雷字幕",
                content: '\n                    <div style="height: 100%;overflow:hidden;"> \n                        <div id="xunlei-table-container" style="height: 100%;padding-bottom: 20px"></div>\n                    </div>\n                ',
                scrollbar: !1,
                area: utils.getResponsiveArea([ "60%", "70%" ]),
                anim: -1,
                success: (t, a) => {
                    new Tabulator("#xunlei-table-container", {
                        layout: "fitColumns",
                        placeholder: "暂无数据",
                        virtualDom: !0,
                        data: n,
                        responsiveLayout: "collapse",
                        responsiveLayoutCollapse: !0,
                        columnDefaults: {
                            headerHozAlign: "center",
                            hozAlign: "center"
                        },
                        columns: [ {
                            title: "文件名",
                            field: "name",
                            headerSort: !1,
                            responsive: 0
                        }, {
                            title: "类型",
                            field: "ext",
                            headerSort: !1,
                            responsive: 0
                        }, {
                            title: "操作",
                            responsive: 0,
                            headerSort: !1,
                            formatter: (t, n, a) => {
                                const i = t.getData();
                                return a((() => {
                                    const n = t.getElement().querySelector(".a-primary"), a = t.getElement().querySelector(".a-success");
                                    n && n.addEventListener("click", (async t => {
                                        let n = i.url, a = e + "." + i.ext;
                                        this.previewSubtitle(n, a);
                                    })), a && a.addEventListener("click", (async t => {
                                        let n = i.url, a = e + "." + i.ext, s = await gmHttp.get(n);
                                        utils.download(s, a);
                                    }));
                                })), '\n                                        <a class="a-primary">预览</a>\n                                        <a class="a-success">下载</a>\n                                    ';
                            }
                        } ],
                        locale: "zh-cn",
                        langs: {
                            "zh-cn": {
                                pagination: {
                                    first: "首页",
                                    first_title: "首页",
                                    last: "尾页",
                                    last_title: "尾页",
                                    prev: "上一页",
                                    prev_title: "上一页",
                                    next: "下一页",
                                    next_title: "下一页",
                                    all: "所有",
                                    page_size: "每页行数"
                                }
                            }
                        }
                    }), utils.setupEscClose(a);
                }
            }) : show.error("迅雷中找不到相关字幕!");
        })).catch((e => {
            console.error(e), show.error(e);
        })).finally((() => {
            t.close();
        }));
    }
    async filterOne(e, t) {
        e && e.preventDefault();
        let n = this.getPageInfo();
        t ? (await storageManager.saveCar({
            carNum: n.carNum,
            url: n.url,
            names: n.actress,
            actionType: d,
            publishTime: n.publishTime
        }), this.showStatus(n.carNum).then(), window.refresh(), utils.closePage(), layer.closeAll(),
        this.answerCount = 1) : utils.q(e, `是否屏蔽${n.carNum}?`, (async () => {
            await storageManager.saveCar({
                carNum: n.carNum,
                url: n.url,
                names: n.actress,
                actionType: d,
                publishTime: n.publishTime
            }), this.showStatus(n.carNum).then(), window.refresh(), utils.closePage();
        }), (() => {
            this.answerCount = 1;
        }));
    }
    hideVideoControls() {
        $(document).on("mouseenter", "#preview-video", (function() {
            $(this).prop("controls", !0);
        }));
    }
    async previewSubtitle(e, t) {
        if (!e) return void console.error("未提供文件URL");
        const n = e.split(".").pop().toLowerCase();
        if ("ass" === n || "srt" === n) try {
            let a = await gmHttp.get(e), i = "字幕预览";
            "ass" === n ? i = "ASS字幕预览 - " + t : "srt" === n && (i = "SRT字幕预览 - " + t);
            const s = a.split("\n");
            let o = "";
            const r = String(s.length).length;
            s.forEach(((e, t) => {
                const n = String(t + 1).padStart(r, " ");
                o += `<span style="color:#AAA;">${n}. </span>${e}\n`;
            }));
            const l = o;
            layer.open({
                type: 1,
                title: i,
                area: utils.getResponsiveArea([ "80%", "80%" ]),
                scrollbar: !1,
                content: `<div style="padding:15px 5px;background:#1E1E1E;color:#FFF;font-family:Consolas,Monaco,monospace;white-space:pre-wrap;overflow:auto;height:100%;">${l}</div>`,
                btn: [ "下载", "关闭" ],
                btn1: function(e, n, i) {
                    return utils.download(a, t), !1;
                }
            });
        } catch (a) {
            show.error(`预览失败: ${a.message}`), console.error("预览字幕文件出错:", a);
        } else show.error("仅支持预览ASS和SRT字幕文件");
    }
}
