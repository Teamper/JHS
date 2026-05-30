class mt extends X {
    getName() {
        return "LocalPlugin";
    }
    async handle() {
        if (r && !window.location.href.includes("/actors/")) {
            this.baseUrl = "http://127.0.0.1:7890", this.canRun = !1;
            try {
                const result = await utils.pingLocalService(this.baseUrl, 3e4);
                this.canRun = result && result.ok;
            } catch (e) { this.canRun = !1, console.error("本地服务连通性检查失败:", e); }
            this.canRun && isListPage && utils.loopDetector((() => $("#addBlacklistBtn").length), (() => {
                this.createBtn();
            }), 1, 1e4, !1);
        }
    }
    createBtn() {
        $("#addBlacklistBtn").last().after('\n            <a id="archiveBtn" class="menu-btn main-tab-btn" style="background-color:#39babe !important;margin-left: 20px!important;"><span>视频归档</span></a>\n            <a id="checkSubtitleBtn" class="menu-btn main-tab-btn" style="background-color:#d08736 !important;"><span>检查字幕</span></a>\n        '),
        $("#archiveBtn").on("click", (e => {
            this.archiveFile().then();
        })), $("#checkSubtitleBtn").on("click", (e => {
            this.checkSubTitle().then();
        }));
    }
    async archiveFile() {
        let e = await storageManager.getCarList();
        const t = await gmHttp.post(this.baseUrl + "/archiveFile", {
            carList: e
        });
        let n = t.dataList, a = t.updateHasDownCarNumList;
        if (a && a.length) {
            const t = new Set(a), n = Array.from(t);
            for (const a of n) {
                const t = e.find((e => e.carNum === a));
                t && (await storageManager.saveCar({
                    carNum: a,
                    url: t.url,
                    actionType: g
                }), show.ok(`归档成功, ${a}标记为已下载`));
            }
        }
        n.length > 0 ? layer.open({
            type: 1,
            title: "归档信息",
            shadeClose: !0,
            scrollbar: !1,
            content: '\n                    <div style="height: 100%;overflow:hidden;"> \n                        <div id="archive-container" style="height: 100%;"></div>\n                    </div>\n                ',
            anim: -1,
            area: [ "50%", "70%" ],
            success: e => {
                new Tabulator("#archive-container", {
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
                        title: "信息",
                        field: "msg",
                        headerSort: !1,
                        formatter: (e, t, n) => {
                            const a = e.getData();
                            return "ok" === a.type ? `<span style="color:#58ad67">${a.msg}</span>` : `<span style="color:#c52323">${a.msg}</span>`;
                        }
                    }, {
                        title: "操作",
                        headerSort: !1,
                        width: 200,
                        formatter: (e, t, n) => {
                            const a = e.getData();
                            return n((() => {
                                var t;
                                null == (t = e.getElement().querySelector(".a-primary")) || t.addEventListener("click", (e => {
                                    gmHttp.get(this.baseUrl + "/openFilePath", {
                                        filePath: a.file ? String(a.file).replace(/\.\./g, "") : ""
                                    });
                                }));
                            })), '<a class="a-primary">打开路径</a>';
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
                });
            },
            end() {
                window.refresh && window.refresh();
            }
        }) : show.info("没有可归档文件");
    }
    async checkSubTitle() {
        let e = await storageManager.getCarList();
        let t = (await gmHttp.post(this.baseUrl + "/checkSubTitle", {
            dataList: e
        })).data;
        0 !== t.length ? layer.open({
            type: 1,
            title: "检测缺失字幕",
            shadeClose: !0,
            scrollbar: !1,
            content: '\n                    <div style="height: 100%;overflow:hidden;"> \n                        <div id="checkSubTitle-table-container" style="height: 100%;padding-bottom: 10px"></div>\n                    </div>\n                ',
            anim: -1,
            area: [ "70%", "70%" ],
            success: e => {
                new Tabulator("#checkSubTitle-table-container", {
                    layout: "fitColumns",
                    placeholder: "暂无数据",
                    virtualDom: !0,
                    data: t,
                    responsiveLayout: "collapse",
                    responsiveLayoutCollapse: !0,
                    columnDefaults: {
                        headerHozAlign: "center",
                        hozAlign: "center"
                    },
                    columns: [ {
                        title: "番号",
                        width: 150,
                        field: "carNum",
                        headerSort: !1,
                        formatter: (e, t, n) => {
                            const a = e.getData(), i = a.type;
                            return a.msg, "error" === i ? `<span style="color: #f40">${a.msg}</span>` : a.carNum;
                        }
                    }, {
                        title: "文件路径",
                        field: "filePath",
                        headerSort: !1,
                        formatter: (e, t, n) => e.getData().filePath
                    }, {
                        title: "操作",
                        headerSort: !1,
                        responsive: 0,
                        formatter: (e, t, n) => {
                            const a = e.getData();
                            return n((() => {
                                var t, n, i, s, o;
                                null == (t = e.getElement().querySelector(".a-success")) || t.addEventListener("click", (e => {
                                    gmHttp.get(this.baseUrl + "/openFilePath", {
                                        filePath: a.filePath ? String(a.filePath).replace(/\.\./g, "") : ""
                                    });
                                })), null == (n = e.getElement().querySelector(".a-info")) || n.addEventListener("click", (e => {
                                    let t = a.carNum, n = a.url;
                                    if (n) if (t.includes("FC2-")) {
                                        let e = this.parseMovieId(n);
                                        this.getBean("Fc2Plugin").openFc2Dialog(e, t, n);
                                    } else utils.openPage(n, t, !0, e); else show.error("没有找到url");
                                })), null == (i = e.getElement().querySelector(".a-warning")) || i.addEventListener("click", (e => {
                                    this.getBean("DetailPageButtonPlugin").searchXunLeiSubtitle(a.carNum);
                                })), null == (s = e.getElement().querySelector(".a-primary")) || s.addEventListener("click", (e => {
                                    utils.openPage("" + ("https://subtitlecat.com/index.php?search=" + a.carNum.replace("FC2-", "")), a.carNum.replace("FC2-", ""), !0, e);
                                })), null == (o = e.getElement().querySelector(".a-danger")) || o.addEventListener("click", (e => {
                                    const t = a.filePath.split("<br/>").filter((e => "" !== e.trim()));
                                    utils.q(e, `是否调用AI程序生成字幕,共${t.length}个视频文件`, (() => {
                                        this.aiSubtitle(t);
                                    }));
                                }));
                            })), '\n                                    <a class="a-success">打开路径</a>\n                                    <a class="a-info">详情页</a>\n                                    <a class="a-warning">迅雷字幕</a>\n                                    <a class="a-primary">SubTitleCat字幕</a>\n                                    <a class="a-danger">AI字幕</a>\n                                ';
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
                });
            },
            end() {
                window.refresh && window.refresh();
            }
        }) : show.info("视频字幕完整");
    }
    async aiSubtitle(e) {
        const t = await gmHttp.post(this.baseUrl + "/aiSubtitle", {
            fileList: e
        });
        200 === t.code ? show.info("已调用后台程序, 请自行确认") : show.error(t.msg);
    }
    checkHasDown() {
        this.allowRepeatDown = !1;
        $("#enable-magnets-filter").after('<a id="allowRepeatDown" class="menu-btn" style="background-color:#b8d747;margin-left: 5px"><span>关闭重复下载检验</span></a>'),
        $("#allowRepeatDown").on("click", (e => {
            this.allowRepeatDown = !this.allowRepeatDown, $("#allowRepeatDown span").text(this.allowRepeatDown ? "开启重复下载检验" : "关闭重复下载检验");
        }));
        let e = $('a[title="複製番號"]').attr("data-clipboard-text"), t = !1;
        $("#magnets-content .item a").on("click", (n => {
            let a = $(n.target).closest("a, button")[0] || n.target;
            if (t) t = !1; else {
                if (n.preventDefault(), this.allowRepeatDown) return t = !0, void a.click();
                gmHttp.get(baseUrl + "/checkHasDown?carNum=" + e).then((e => {
                    "no" === e.data ? (t = !0, a.click()) : show.info(e.msg, {
                        icon: 2
                    });
                }));
            }
        }));
    }
}
