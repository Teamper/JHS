class xe extends X {
    constructor() {
        super(...arguments), i(this, "tableObj", null);
    }
    getName() {
        return "HistoryPlugin";
    }
    async initCss() {
        return "\n            <style>\n                /* 下拉菜单容器（相对定位） */\n                .sub-btns {\n                    position: relative;\n                    display: inline-block;\n                }\n                \n                /* 下拉菜单内容（默认隐藏） */\n                .sub-btns-menu {\n                    display: none;\n                    position: absolute;\n                    right: 80px;\n                    top:-10px;\n                    background: white;\n                    padding:10px;\n                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);\n                    z-index: 100;\n                    border-radius: 4px;\n                    overflow: hidden;\n                }\n                \n                \n                /* 点击后显示菜单（JS 控制） */\n                .sub-btns-menu.show {\n                    display: flex !important;\n                    flex-direction: column;\n                }\n                \n                .table-link-param {\n                    cursor: pointer;\n                }\n            </style\n        ";
    }
    handleResize() {
        $(".navbar-search").is(":hidden") ? ($(".historyBtnBox").show(), $(".miniHistoryBtnBox").hide()) : ($(".historyBtnBox").hide(),
        $(".miniHistoryBtnBox").show());
    }
    handle() {
        r && ($(".navbar-end").prepend('<div class="navbar-item has-sub-btns is-hoverable historyBtnBox">\n                    <a id="historyBtn" class="navbar-link nav-btn" style="color: #aade66 !important;padding-right:15px !important;">\n                        鉴定记录\n                    </a>\n                </div>'),
        $(".navbar-search").css("margin-left", "0").before('\n                <div class="navbar-item miniHistoryBtnBox">\n                    <a id="miniHistoryBtn" class="navbar-link nav-btn" style="color: #aade66 !important;padding-left:0 !important;padding-right:0 !important;">\n                        鉴定记录\n                    </a>\n                </div>\n            '),
        this.handleResize(), $(window).resize((() => {
            this.handleResize();
        })), $("#historyBtn,#miniHistoryBtn").on("click", (e => this.openHistory()))), l && utils.loopDetector((() => $("#setting-btn").length), (() => {
            $("#top-right-box").append('\n                    <a id="historyBtn" class="menu-btn main-tab-btn" style="background-color:#b68625 !important;">\n                        鉴定记录\n                    </a>\n               '),
            $("#historyBtn,#miniHistoryBtn").on("click", (e => this.openHistory()));
        }), 1, 1e4, !1), this.bindClick();
    }
    openHistory() {
        let e = `\n            <div style="padding: 10px 20px; height: 100%;overflow:hidden;"> \n                 <div id="filterBox" style="display: flex;gap: 5px;">\n                    <select id="dataType" style="text-align: center;min-width: 150px;">\n                        <option value="all" selected>所有</option>\n                        <option value="filter">${u}</option>\n                        <option value="favorite">${b}</option>\n                        <option value="hasDown">${y}</option>\n                        <option value="hasWatch">${k}</option>\n                    </select>\n                    <input id="searchCarNum" type="text" placeholder="搜索番号|演员" style="padding: 4px 5px;">\n                    <a id="clearSearchbtn" class="a-info" style="margin-left: 0">重置</a>\n                </div>\n                <div id="allSelectBox" style="margin-top: 8px;display: none">\n                    <a class="menu-btn multiple-history-deleteBtn" style="background-color:#8c8080; color:white; margin-bottom: 5px;"> <span>移除</span> </a>\n                    <a class="menu-btn multiple-history-hasWatchBtn" style="background-color:${S};margin-bottom: 5px">${k}</a>\n                    <a class="menu-btn multiple-history-hasDownBtn" style="background-color:${x};margin-bottom: 5px">${y}</a>\n                    <a class="menu-btn multiple-history-favoriteBtn" style="background-color:${w};margin-bottom: 5px">${v}</a>\n                    <a class="menu-btn multiple-history-filterBtn" style="background-color:${f};margin-bottom: 5px">${m}</a>\n                </div>\n                <div id="table-container" style="height: calc(100% - 50px); overflow-x:hidden;"></div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: "鉴定记录",
            content: e,
            scrollbar: !1,
            shadeClose: !0,
            area: utils.getResponsiveArea([ "70%", "90%" ]),
            anim: -1,
            success: async e => {
                await this.loadTableData(), $(".layui-layer-content").on("click", "#clearSearchbtn", (async e => {
                    $("#searchCarNum").val(""), $("#dataType").val("all"), await this.reloadTable(),
                    $("#allSelectBox").hide();
                })).on("focusout keydown", "#searchCarNum", (async e => {
                    if ("focusout" === e.type || "Enter" === e.key) {
                        if ("Enter" === e.key && e.preventDefault(), "keydown" === e.type && "Enter" !== e.key) return;
                        await this.reloadTable();
                    }
                })).on("click", ".table-link-param", (async e => {
                    let t = $(e.currentTarget);
                    $("#searchCarNum").val(t.text()), await this.reloadTable();
                })).on("change", "#dataType", (async () => {
                    await this.reloadTable();
                }));
            },
            end: () => {
                this.tableObj && (this.tableObj.destroy(), this.tableObj = null), window.refresh();
            }
        });
    }
    async reloadTable() {
        this.tableObj.deselectRow(), this.tableObj.setPage(1);
    }
    bindClick() {
        document.addEventListener("click", (function(e) {
            if (e.target.closest(".sub-btns-toggle")) {
                const t = e.target.closest(".sub-btns").querySelector(".sub-btns-menu");
                document.querySelectorAll(".sub-btns-menu.show").forEach((e => {
                    e !== t && e.classList.remove("show");
                })), t.classList.toggle("show");
            } else document.querySelectorAll(".sub-btns-menu.show").forEach((e => {
                e.classList.remove("show");
            }));
        })), $(document).on("click", ".history-deleteBtn, .history-filterBtn, .history-favoriteBtn, .history-hasDownBtn, .history-hasWatchBtn, .history-detailBtn", (e => {
            e.preventDefault(), e.stopPropagation();
            const t = $(e.currentTarget), n = t.closest(".action-btns"), a = n.attr("data-car-num"), i = n.attr("data-href"), s = async e => {
                try {
                    await storageManager.saveCar({
                        carNum: a,
                        url: i,
                        names: null,
                        actionType: e
                    }), window.refresh(), await this.reloadTable();
                } catch (s) { console.error("历史记录操作失败:", s), show.error("操作失败"); }
            };
            t.hasClass("history-filterBtn") ? utils.q(e, `是否屏蔽${a}?`, (() => s(d))) : t.hasClass("history-favoriteBtn") ? s(h).then() : t.hasClass("history-hasDownBtn") ? s(g).then() : t.hasClass("history-hasWatchBtn") ? s(p).then() : t.hasClass("history-deleteBtn") ? this.handleDelete(e, a) : t.hasClass("history-detailBtn") && this.handleClickDetail(e, {
                carNum: a,
                url: i
            }).then();
        })), $(document).on("click", ".multiple-history-deleteBtn, .multiple-history-filterBtn, .multiple-history-favoriteBtn, .multiple-history-hasDownBtn, .multiple-history-hasWatchBtn", (e => {
            e.preventDefault(), e.stopPropagation();
            const t = $(e.currentTarget);
            let n = this.tableObj.getSelectedData(), a = "", i = "";
            t.hasClass("multiple-history-filterBtn") ? (a = "屏蔽", i = d) : t.hasClass("multiple-history-favoriteBtn") ? (a = "收藏",
            i = h) : t.hasClass("multiple-history-hasDownBtn") ? (a = "已下载", i = g) : t.hasClass("multiple-history-hasWatchBtn") ? (a = "已观看",
            i = p) : t.hasClass("multiple-history-deleteBtn") && (a = "移除", i = "delete"), utils.q(e, `当前已勾选${n.length}条数据, 是否全标记为 ${a}?`, (async () => {
                let e = loading();
                try {
                    if ("delete" === i) {
                        const e = n.map((e => e.carNum)), t = await storageManager.batchRemoveCars(e);
                        t > 0 ? show.ok(`已成功删除 ${t} 个番号`) : !1 === t && show.error("提供的番号中没有一个存在于列表中。");
                    } else {
                        const e = JSON.parse(JSON.stringify(n));
                        e.forEach((e => {
                            e.actionType = i;
                        })), await storageManager.saveCarList(e), show.ok("操作成功");
                    }
                    this.tableObj.deselectRow(), this.reloadTable().then();
                } catch (t) {
                    console.error(t);
                } finally {
                    e.close();
                }
            }));
        }));
    }
    async getDataList(e, t, n) {
        let a = await storageManager.getCarList();
        this.allCount = a.length, this.filterCount = 0, this.favoriteCount = 0, this.hasDownCount = 0,
        this.hasWatchCount = 0, this.waitCheckCount = 0, a.forEach((e => {
            switch (e.status) {
              case d:
                this.filterCount++;
                break;

              case h:
                this.favoriteCount++;
                break;

              case g:
                this.hasDownCount++;
                break;

              case p:
                this.hasWatchCount++;
                break;

              default:
                this.waitCheckCount++;
            }
        })), $('#dataType option[value="all"]').text(`所有 (${this.allCount})`), $('#dataType option[value="waitCheck"]').text(`待鉴定 (${this.waitCheckCount})`),
        $('#dataType option[value="filter"]').text(`${u} (${this.filterCount})`),
        $('#dataType option[value="favorite"]').text(`${b} (${this.favoriteCount})`), $('#dataType option[value="hasDown"]').text(`${y} (${this.hasDownCount})`),
        $('#dataType option[value="hasWatch"]').text(`${k} (${this.hasWatchCount})`);
        const i = $("#dataType").val();
        let s = "all" === i ? a : "waitCheck" === i ? a.filter((e => "" === e.status || !e.status)) : a.filter((e => e.status === i));
        const o = $("#searchCarNum").val().trim();
        if (o) {
            let e = o.toLowerCase().replace("-c", "").replace("-uc", "").replace("-4k", "");
            s = s.filter((t => {
                const n = t.carNum.toLowerCase().includes(e);
                const a = (t.names ? t.names : "").toLowerCase().includes(e);
                return n || a;
            }));
        }
        if (n && n.length > 0) {
            const e = n[0], t = e.field, a = e.dir;
            s.sort(((e, n) => {
                const i = e[t], s = n[t], o = null == i || "" === i, r = null == s || "" === s;
                return o && !r ? 1 : !o && r ? -1 : o && r ? 0 : i < s ? "asc" === a ? -1 : 1 : i > s ? "asc" === a ? 1 : -1 : 0;
            }));
        }
        const r = s.length, l = Math.ceil(r / t), c = (e - 1) * t, m = c + t;
        return s = s.slice(c, m), {
            maxPage: l,
            dataList: s,
            totalCount: r
        };
    }
    async loadTableData() {
        this.tableObj = new Tabulator("#table-container", {
            layout: "fitColumns",
            placeholder: "暂无数据",
            virtualDom: !0,
            pagination: !0,
            paginationMode: "remote",
            sortMode: "remote",
            ajaxURL: "queryRealm",
            dataLoader: !1,
            ajaxRequestFunc: async (e, t, n) => {
                const a = n.page, i = n.size, s = n.sort;
                return await this.getDataList(a, i, s);
            },
            dataReceiveParams: {
                last_page: "maxPage",
                last_row: "totalCount",
                data: "dataList"
            },
            paginationSize: 50,
            paginationSizeSelector: [ 50, 100, 1e3, 99999 ],
            paginationCounter: (e, t, n, a, i) => `共 ${a} 条记录`,
            responsiveLayout: "collapse",
            responsiveLayoutCollapse: !0,
            columnDefaults: {
                headerHozAlign: "center",
                hozAlign: "center"
            },
            selectableRowsPersistence: !1,
            index: "carNum",
            columns: [ {
                formatter: "rowSelection",
                titleFormatter: "rowSelection",
                hozAlign: "center",
                headerSort: !1,
                responsive: 0,
                width: 40,
                titleFormatterParams: {
                    rowRange: "active"
                },
                cellClick: (e, t) => {
                    t.getRow().toggleSelect();
                }
            }, {
                title: "番号",
                field: "carNum",
                width: 120,
                sorter: "string",
                responsive: 0,
                formatter: (e, t, n) => {
                    const a = e.getData().carNum, i = a.indexOf("-");
                    if (-1 === i) return a;
                    return `<a class="table-link-param">${a.substring(0, i + 1)}</a>${a.substring(i + 1)}`;
                }
            }, {
                title: "演员",
                field: "names",
                minWidth: 200,
                sorter: "string",
                responsive: 5,
                headerSort: !0,
                formatter: (e, t, n) => (e.getData().names || "").split(" ").filter((e => "" !== e.trim())).map((e => `<a class="table-link-param">${e}</a>`)).join(" ")
            }, {
                title: "创建时间",
                field: "createDate",
                width: 170,
                sorter: "string",
                responsive: 4
            }, {
                title: "修改时间",
                field: "updateDate",
                width: 170,
                sorter: "string",
                responsive: 4
            }, {
                title: "发行时间",
                field: "publishTime",
                width: 170,
                sorter: "string",
                responsive: 4
            }, {
                title: "来源",
                field: "url",
                width: 80,
                sorter: "string",
                responsive: 5,
                hozAlign: "left",
                formatter: (e, t, n) => {
                    let a = e.getData().url;
                    return a ? a.includes("javdb") ? '<span style="color:#d34f9e">Javdb</span>' : a.includes("javbus") ? '<span style="color:#eaa813">JavBus</span>' : a.includes("123av") ? '<span style="color:#eaa813">123Av</span>' : `<span style="color:#050505">${a}</span>` : "";
                }
            }, {
                title: "状态",
                field: "status",
                width: 100,
                sorter: "string",
                responsive: 1,
                headerSort: !1,
                formatter: (e, t, n) => {
                    const a = e.getData().status;
                    let i = "", s = "";
                    switch (a) {
                      case "filter":
                        i = f, s = m;
                        break;

                      case "favorite":
                        i = w, s = v;
                        break;

                      case "hasDown":
                        i = x, s = y;
                        break;

                      case "hasWatch":
                        i = S, s = k;
                        break;

                      default:
                        s = a;
                    }
                    return `<span style="color:${i}">${s}</span>`;
                }
            }, {
                title: "备注",
                field: "remark",
                width: 100,
                sorter: "string",
                responsive: 6
            }, {
                title: "操作",
                sorter: "string",
                minWidth: 150,
                cssClass: "action-cell-dropdown",
                responsive: 0,
                headerSort: !1,
                formatter: (e, t, n) => {
                    const a = e.getData();
                    return n((() => {
                        var t;
                        null == (t = e.getElement().querySelector(".history-editBtn")) || t.addEventListener("click", (e => {
                            this.editRecord(a);
                        }));
                    })), `\n                            <div class="action-btns" style="display: flex; gap: 5px;justify-content:center" data-car-num="${a.carNum}" data-href="${a.url ? a.url : ""}">\n                                <div class="sub-btns">\n                                    <a class="menu-btn sub-btns-toggle" style="background-color:#c59d36; color:white; margin-bottom: 5px;">\n                                        <span>变更</span>\n                                    </a>\n                                    <div class="sub-btns-menu">\n                                        <a class="menu-btn history-editBtn" style="background-color:#007bff; color:white; margin-bottom: 5px;"> <span>编辑</span> </a>\n                                        <a class="menu-btn history-deleteBtn" style="background-color:#8c8080; color:white; margin-bottom: 5px;"> <span>移除</span> </a>\n                                        <a class="menu-btn history-hasWatchBtn" style="background-color:${S};margin-bottom: 5px">${k}</a>\n                                        <a class="menu-btn history-hasDownBtn" style="background-color:${x};margin-bottom: 5px">${y}</a>\n                                        <a class="menu-btn history-favoriteBtn" style="background-color:${w};margin-bottom: 5px">${v}</a>\n                                        <a class="menu-btn history-filterBtn" style="background-color:${f};margin-bottom: 5px">${m}</a>\n                                    </div>\n                                </div>\n                                \n                                <a class="menu-btn history-detailBtn" style="background-color:#3397de; color:white; margin-bottom: 5px;"> <span>详情页</span> </a>\n                                \n                            </div>\n                        `;
                }
            } ],
            initialSort: [ {
                column: "updateDate",
                dir: "desc"
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
        }), this.tableObj.on("rowSelectionChanged", ((e, t, n, a) => {
            const i = $("#allSelectBox"), s = $("#filterBox");
            e && e.length > 0 ? (s.hide(), i.show()) : (s.show(), i.hide());
        })), this.tableObj.on("rowDblClick", (function(e, t) {
            t.toggleSelect();
        })), this.tableObj.on("tableBuilt", (async () => {}));
    }
    handleDelete(e, t) {
        utils.q(e, `是否移除${t}?`, (async () => {
            await storageManager.removeCar(t), this.getBean("ListPagePlugin").showCarNumBox(t),
            this.reloadTable(null).then();
        }));
    }
    async handleClickDetail(e, t) {
        if (r) if (t.carNum.includes("FC2-")) {
            const e = this.parseMovieId(t.url);
            this.getBean("Fc2Plugin").openFc2Dialog(e, t.carNum, t.url);
        } else {
            if (!t.url) return void window.open("/search?q=" + t.carNum, "_blank");
            utils.openPage(t.url, t.carNum, !1, e);
        }
        if (l) {
            let n = t.url;
            if (n.includes("javdb")) if (t.carNum.includes("FC2-")) {
                const e = this.parseMovieId(n);
                await this.getBean("Fc2Plugin").openFc2Page(e, t.carNum, n);
            } else window.open(n, "_blank"); else utils.openPage(t.url, t.carNum, !1, e);
        }
    }
    async editRecord(e) {
        const t = e.carNum, n = e.names || "", a = e.url || "", i = e.status, s = e.remark || "", o = "width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; min-height: 60px; overflow-y: hidden;", r = "width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;", l = [ {
            value: d,
            text: m
        }, {
            value: h,
            text: v
        }, {
            value: g,
            text: y
        }, {
            value: p,
            text: k
        } ];
        clog.debug(l);
        const c = `\n            <div style="padding: 20px;">\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">番号:</label>\n                    <input type="text" id="edit-carNum" value="${t}" style="${r} background-color: #f0f0f0;" readonly>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">演员 (用空格隔开):</label>\n                    <textarea id="edit-names" style="${o}">${n}</textarea>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">状态:</label>\n                    <select id="edit-status" style="width: 100%; padding: 10px; border: 1px solid #ddd;">\n                        <option value="" ${"" === i ? "selected" : ""}>-- 请选择 --</option>\n                        ${l.map((e => `\n                            <option value="${e.value}" ${i === e.value ? "selected" : ""}>${e.text}</option>\n                        `)).join("")}\n                    </select>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">链接:</label>\n                    <input type="text" id="edit-url" value="${a}" style="${r}">\n                </div>\n                \n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">备注:</label>\n                    <textarea id="edit-remark" style="${o}">${s}</textarea>\n                </div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: `编辑记录: ${t}`,
            area: utils.getResponsiveArea([ "500px", "650px" ]),
            content: c,
            btn: [ "保存", "取消" ],
            success: (e, t) => {
                const n = e => {
                    e.css("height", "auto"), e.css("height", e[0].scrollHeight + 15 + "px");
                }, a = $("#edit-names");
                a.on("input", (function() {
                    n($(this));
                })), n(a);
                const i = $("#edit-remark");
                i.on("input", (function() {
                    n($(this));
                })), n(i);
            },
            yes: async t => {
                const n = $("#edit-names").val().trim(), a = $("#edit-status").val(), i = $("#edit-url").val().trim(), s = $("#edit-remark").val().trim();
                if (!a) return show.error("请选择状态"), !1;
                const o = {
                    ...e,
                    names: n,
                    actionType: a,
                    url: i,
                    remark: s
                };
                await storageManager.updateCarInfo(o), this.tableObj.setData(), layer.close(t);
            }
        });
    }
}
