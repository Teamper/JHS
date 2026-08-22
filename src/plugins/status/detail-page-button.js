class DetailPageButtonPlugin extends BasePlugin {
    getName() {
        return "DetailPageButtonPlugin";
    }
    constructor() {
        super(), this.answerCount = 1, this.stateBinding = null;
    }
    async handle() {
        this.hideVideoControls(), window.isDetailPage && (await this.createMenuBtn(), await this.autoRemoveNewVideoMark());
    }
    async autoRemoveNewVideoMark() {
        try {
            const e = await storageManager.getSetting("autoRemoveNewVideoMarkAfterBrowse", C);
            if (e !== _) return;
            const t = this.getPageInfo();
            if (!t.carNum) return;
            await stateService.removeFromNewVideoList([ t.carNum ], "browse");
        } catch (e) { clog.error("自动移除新作品标记失败:", e); }
    }
    async createMenuBtn() {
        const e = this.getPageInfo(), t = e.carNum, n = `\n            <div class="jhs-detail-btn-row jhs-layout-e2965a97">\n                <div class="jhs-layout-1e90930a">\n                    <button type="button" id="filterBtn" class="jhs-btn jhs-btn--filter jhs-layout-44293084">\n                        <span>${m}</span>\n                    </button>\n                    <button type="button" id="favoriteBtn" class="jhs-btn jhs-btn--fav jhs-layout-44293084">\n                        <span>${v}</span>\n                    </button>\n                    <button type="button" id="hasDownBtn" class="jhs-btn jhs-btn--down jhs-layout-44293084">\n                        <span>${y}</span>\n                    </button>\n                    <button type="button" id="hasWatchBtn" class="jhs-btn jhs-btn--watch jhs-layout-44293084">\n                        <span>${k}</span>\n                    </button>\n                </div>\n        \n                <div class="jhs-layout-1e90930a">\n                    <button type="button" id="enable-magnets-filter" class="jhs-btn jhs-btn--watch jhs-layout-5f3e3549">\n                        <span id="magnets-span">关闭磁力过滤</span>\n                    </button>\n                    <button type="button" id="magnetSearchBtn" class="jhs-btn jhs-btn--accent jhs-layout-44293084">\n                        <span>磁力搜索</span>\n                    </button>\n                    <button type="button" id="xunLeiSubtitleBtn" class="jhs-btn jhs-btn--accent jhs-layout-44293084">\n                        <span>字幕 (迅雷)</span>\n                    </button>\n                    <button type="button" id="search-subtitle-btn" class="jhs-btn jhs-btn--accent jhs-layout-f43f0d6d">\n                        <span>字幕 (SubTitleCat)</span>\n                    </button>\n                </div>\n            </div>\n        `;
        const workspaceSlot = this.getBean("DetailWorkspacePlugin")?.getSlot("summary-actions");
        workspaceSlot?.length ? workspaceSlot.append(n) : r ? $(".tabs").after(n) : l && $("#mag-submit-show").before(n), $("#magnetSearchBtn").on("click", (async () => {
            let t = await this.getBean("MagnetHubPlugin").createMagnetHub(e.carNum);
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
        $("#xunLeiSubtitleBtn").on("click", (() => this.searchXunLeiSubtitle(t)));
        if (!t) {
            $("#filterBtn, #favoriteBtn, #hasDownBtn, #hasWatchBtn, #magnetSearchBtn, #xunLeiSubtitleBtn, #search-subtitle-btn").prop("disabled", !0).attr("title", "番号不可用");
            return void clog.warn("详情操作不可用：番号不可用");
        }
        this.stateBinding = detailStateController.bind({ root: document, carNum: t, activityType: "detail-state", getRecord: () => this.getStateRecord() });
    }
    async showStatus(e) {
        return detailStateController.render({ root: document, carNum: e });
    }
    getStateRecord() {
        const info = this.getPageInfo();
        return { carNum: info.carNum, url: info.url, names: info.actress, publishTime: info.publishTime };
    }
    getStateBinding() {
        if (this.stateBinding) return this.stateBinding;
        const info = this.getPageInfo();
        return this.stateBinding = { root: document, layerIndex: null, carNum: normalizeCarNum(info.carNum), getRecord: () => this.getStateRecord(), activityType: "detail-state", selectors: {} };
    }
    async favoriteOne(event) {
        return detailStateController.requestToggle(this.getStateBinding(), "favorite", event);
    }
    async hasDownOne(event) {
        return detailStateController.requestToggle(this.getStateBinding(), "downloaded", event);
    }
    async hasWatchOne(event) {
        return detailStateController.requestToggle(this.getStateBinding(), "watched", event);
    }
    searchXunLeiSubtitle(e) {
        let t = loading();
        gmHttp.get(`https://api-shoulei-ssl.xunlei.com/oracle/subtitle?gcid=&cid=&name=${e}`).then((t => {
            let n = t.data;
            n && 0 !== n.length ? layer.open({
                type: 1,
                title: "迅雷字幕",
                content: '\n                    <div class="jhs-layout-8ddc7c91"> \n                        <div id="xunlei-table-container" class="jhs-layout-583c2485"></div>\n                    </div>\n                ',
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
                                    const n = t.getElement().querySelector(".subtitle-preview-btn"), a = t.getElement().querySelector(".subtitle-download-btn");
                                    n && n.addEventListener("click", (async t => {
                                        let n = i.url, a = e + "." + i.ext;
                                        this.previewSubtitle(n, a);
                                    })), a && a.addEventListener("click", (async t => {
                                        let n = i.url, a = e + "." + i.ext, s = await gmHttp.get(n);
                                        utils.download(s, a);
                                    }));
                                })), '\n                                        <button type="button" class="jhs-btn jhs-btn--secondary subtitle-preview-btn">预览</button>\n                                        <button type="button" class="jhs-btn jhs-btn--primary subtitle-download-btn">下载</button>\n                                    ';
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
            clog.error(e), show.error(e);
        })).finally((() => {
            t.close();
        }));
    }
    async filterOne(e, t) {
        e && e.preventDefault();
        return detailStateController.requestToggle(this.getStateBinding(), "blocked", e);
    }
    hideVideoControls() {
        $(document).on("mouseenter", "#preview-video", (function() {
            $(this).prop("controls", !0);
        }));
    }
    async previewSubtitle(e, t) {
        if (!e) return void clog.error("未提供文件URL");
        const n = e.split(".").pop().toLowerCase();
        if ("ass" === n || "srt" === n) try {
            let a = await gmHttp.get(e), i = "字幕预览";
            "ass" === n ? i = "ASS字幕预览 - " + t : "srt" === n && (i = "SRT字幕预览 - " + t);
            const s = a.split("\n");
            let o = "";
            const r = String(s.length).length;
            s.forEach(((e, t) => {
                const n = String(t + 1).padStart(r, " ");
                o += `<span class="jhs-code-line-number">${n}. </span>${e}\n`;
            }));
            const l = o;
            layer.open({
                type: 1,
                title: i,
                area: utils.getResponsiveArea([ "80%", "80%" ]),
                scrollbar: !1,
                content: `<div class="jhs-code-viewer">${l}</div>`,
                btn: [ "下载", "关闭" ],
                btn1: function(e, n, i) {
                    return utils.download(a, t), !1;
                }
            });
        } catch (a) {
            show.error(`预览失败: ${a.message}`), clog.error("预览字幕文件出错:", a);
        } else show.error("仅支持预览ASS和SRT字幕文件");
    }
}
