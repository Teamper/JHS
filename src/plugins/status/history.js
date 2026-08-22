class HistoryPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "tableObj", null);
    }
    getName() {
        return "HistoryPlugin";
    }
    async initCss() {
        return `
            <style>
                .jhs-history-layout { display:flex; flex-direction:column; height:100%; min-height:0; padding:var(--jhs-space-3) var(--jhs-space-4); overflow:hidden; }
                #filterBox, #allSelectBox { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-2); }
                #table-container { flex:1; min-height:0; overflow-x:hidden; }
                .sub-btns { position:relative; display:inline-block; }
                .sub-btns-menu { position:absolute; top:calc(100% + var(--jhs-space-1)); right:0; z-index:var(--jhs-z-popover); display:none; min-width:156px; padding:var(--jhs-space-1); overflow:hidden; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); box-shadow:var(--jhs-shadow-md); }
                .sub-btns-menu.show { display:grid !important; gap:var(--jhs-space-1); }
                .sub-btns-menu .jhs-btn { width:100%; justify-content:flex-start; }
                .table-link-param { cursor:pointer; }
                .action-btns { display:flex; justify-content:center; gap:var(--jhs-space-2); }
                .jhs-history-edit-field { width:100%; padding:8px; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); }
                .jhs-history-edit-field[readonly] { background:var(--jhs-input-bg); }
                textarea.jhs-history-edit-field { min-height:60px; overflow-y:hidden; }
            </style>`;
    }
    handleResize() {
        $(".navbar-search").is(":hidden") ? ($(".historyBtnBox").show(), $(".miniHistoryBtnBox").hide()) : ($(".historyBtnBox").hide(),
        $(".miniHistoryBtnBox").show());
    }
    async handle() {
        r && ($(".navbar-end").prepend('<div class="navbar-item has-sub-btns is-hoverable historyBtnBox">\n                    <button type="button" id="historyBtn" class="jhs-btn navbar-link nav-btn jhs-nav-btn">鉴定记录</button>\n                </div>'),
        $(".navbar-search").css("margin-left", "0").before('\n                <div class="navbar-item miniHistoryBtnBox">\n                    <button type="button" id="miniHistoryBtn" class="jhs-btn navbar-link nav-btn jhs-nav-btn">鉴定记录</button>\n                </div>\n            '),
        this.handleResize(), $(window).resize((() => {
            this.handleResize();
        })), $("#historyBtn,#miniHistoryBtn").on("click", (e => this.openHistory()))), l && await this.createBusButton(), this.bindClick();
    }
    async createBusButton() {
        const ready = await new Promise((resolve => {
            const startedAt = Date.now(), timer = setInterval((() => {
                if ($("#setting-btn").length && $("#top-right-box").length) return clearInterval(timer), resolve(!0);
                Date.now() - startedAt >= 2500 && (clearInterval(timer), resolve(!1));
            }), 25);
        }));
        if (!ready) return void clog.warn("鉴定记录入口未创建：JavBus 顶部工具区未就绪");
        $("#top-right-box").append('<button type="button" id="historyBtn" class="jhs-btn jhs-btn--secondary">鉴定记录</button>'),
        $("#historyBtn,#miniHistoryBtn").on("click", (e => this.openHistory()));
    }
    openHistory() {
        let e = `\n            <div class="jhs-layout-7cb3f981"> \n                 <div id="filterBox" class="jhs-layout-53809f1e">\n                    <select id="dataType" class="jhs-select-source">\n                        <option value="all" selected>所有</option>\n                        <option value="filter">${u}</option>\n                        <option value="favorite">${b}</option>\n                        <option value="hasDown">${y}</option>\n                        <option value="hasWatch">${k}</option>\n                    </select>\n                    <input id="searchCarNum" type="text" placeholder="搜索番号|演员" class="jhs-field">\n                    <button type="button" id="clearSearchbtn" class="jhs-btn jhs-btn--secondary jhs-layout-21a4fe43">重置</button>\n                </div>\n                <div id="allSelectBox" class="jhs-layout-66253c00">\n                    <button type="button" class="jhs-btn jhs-btn--dark multiple-history-deleteBtn jhs-layout-7daea5fa"> <span>移除</span> </button>\n                    <button type="button" class="jhs-btn jhs-btn--watch multiple-history-hasWatchBtn jhs-layout-2e003268">${k}</button>\n                    <button type="button" class="jhs-btn jhs-btn--down multiple-history-hasDownBtn jhs-layout-2e003268">${y}</button>\n                    <button type="button" class="jhs-btn jhs-btn--fav multiple-history-favoriteBtn jhs-layout-2e003268">${v}</button>\n                    <button type="button" class="jhs-btn jhs-btn--filter multiple-history-filterBtn jhs-layout-2e003268">${m}</button>\n                </div>\n                <div id="table-container" class="jhs-layout-81eaab28"></div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: "鉴定记录",
            content: e,
            scrollbar: !1,
            shadeClose: !0,
            area: utils.getDialogArea("xl"),
            anim: -1,
            success: async e => {
                JhsSelect.enhance(e);
                await this.loadTableData(), $(".layui-layer-content").on("click", "#clearSearchbtn", (async e => {
                    $("#searchCarNum").val(""), JhsSelect.setValue("#dataType", "all"), await this.reloadTable(),
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
                const button = e.target.closest(".sub-btns-toggle"), t = button.closest(".sub-btns").querySelector(".sub-btns-menu");
                document.querySelectorAll(".sub-btns-menu.show").forEach((e => {
                    e !== t && (e.classList.remove("show"), e.previousElementSibling?.setAttribute("aria-expanded", "false"));
                })), t.classList.toggle("show"), button.setAttribute("aria-expanded", String(t.classList.contains("show")));
            } else document.querySelectorAll(".sub-btns-menu.show").forEach((e => {
                e.classList.remove("show"), e.previousElementSibling?.setAttribute("aria-expanded", "false");
            }));
        })), $(document).on("keydown", ".sub-btns", (e => {
            const menu = $(e.currentTarget).find(".sub-btns-menu"), items = menu.find('[role="menuitem"]'), current = items.index(document.activeElement);
            if ("Escape" === e.key) return e.preventDefault(), menu.removeClass("show"), $(e.currentTarget).find(".sub-btns-toggle").attr("aria-expanded", "false").trigger("focus");
            if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(e.key) || !menu.hasClass("show")) return;
            e.preventDefault();
            const next = "Home" === e.key ? 0 : "End" === e.key ? items.length - 1 : "ArrowDown" === e.key ? (current + 1 + items.length) % items.length : (current - 1 + items.length) % items.length;
            items.eq(next).trigger("focus");
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
                } catch (s) { clog.error("历史记录操作失败:", s), show.error("操作失败"); }
            };
            t.hasClass("history-filterBtn") ? utils.q(e, `是否屏蔽${a}?`, (() => s(d))) : t.hasClass("history-favoriteBtn") ? void s(h) : t.hasClass("history-hasDownBtn") ? void s(g) : t.hasClass("history-hasWatchBtn") ? void s(p) : t.hasClass("history-deleteBtn") ? this.handleDelete(e, a) : t.hasClass("history-detailBtn") && void this.handleClickDetail(e, {
                carNum: a,
                url: i
            }).catch((error => clog.error("历史详情打开失败", error)));
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
                        window.refresh(), t > 0 ? show.ok(`已成功删除 ${t} 个番号`) : !1 === t && show.error("提供的番号中没有一个存在于列表中。");
                    } else {
                        const e = JSON.parse(JSON.stringify(n));
                        e.forEach((e => {
                            e.actionType = i;
                        })), await storageManager.saveCarList(e), window.refresh(), show.ok("操作成功");
                    }
                    this.tableObj.deselectRow(), await this.reloadTable();
                } catch (t) {
                    clog.error(t);
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
                    return `<button type="button" class="jhs-btn jhs-btn--ghost jhs-btn--sm table-link-param">${a.substring(0, i + 1)}</button>${a.substring(i + 1)}`;
                }
            }, {
                title: "演员",
                field: "names",
                minWidth: 200,
                sorter: "string",
                responsive: 5,
                headerSort: !0,
                formatter: (e, t, n) => (e.getData().names || "").split(" ").filter((e => "" !== e.trim())).map((e => `<button type="button" class="jhs-btn jhs-btn--ghost jhs-btn--sm table-link-param">${e}</button>`)).join(" ")
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
                    return a ? `<span class="jhs-badge jhs-badge--neutral">${a.includes("javdb") ? "JavDB" : a.includes("javbus") ? "JavBus" : a.includes("123av") ? "123AV" : "其他"}</span>` : "";
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
                    let i = "neutral", s = "";
                    switch (a) {
                      case "filter":
                        i = "filter", s = m;
                        break;

                      case "favorite":
                        i = "fav", s = v;
                        break;

                      case "hasDown":
                        i = "down", s = y;
                        break;

                      case "hasWatch":
                        i = "watch", s = k;
                        break;

                      default:
                        s = a;
                    }
                    return `<span class="jhs-badge jhs-badge--soft jhs-badge--${i}">${s || "待鉴定"}</span>`;
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
                    })), `
                        <div class="action-btns" data-car-num="${a.carNum}" data-href="${a.url ? a.url : ""}">
                            <button type="button" class="jhs-btn jhs-btn--secondary history-detailBtn"><span>查看</span></button>
                            <div class="sub-btns">
                                <button type="button" class="jhs-btn jhs-btn--ghost sub-btns-toggle" aria-haspopup="menu" aria-expanded="false"><span>更多操作</span></button>
                                <div class="sub-btns-menu" role="menu">
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-editBtn" role="menuitem"><span>编辑</span></button>
                                    <button type="button" class="jhs-btn jhs-btn--danger history-deleteBtn" role="menuitem"><span>移除</span></button>
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-hasWatchBtn" role="menuitem">${k}</button>
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-hasDownBtn" role="menuitem">${y}</button>
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-favoriteBtn" role="menuitem">${v}</button>
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-filterBtn" role="menuitem">${m}</button>
                                </div>
                            </div>
                        </div>`;
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
            await storageManager.removeCar(t), window.refresh(), this.getBean("ListPagePlugin").showCarNumBox(t),
            await this.reloadTable(null);
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
        const t = e.carNum, n = e.names || "", a = e.url || "", i = e.status, s = e.remark || "", l = [ {
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
        const c = `\n            <div class="jhs-layout-8cddc29a">\n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">番号:</label>\n                    <input type="text" id="edit-carNum" value="${t}" class="jhs-field jhs-history-edit-field" readonly>\n                </div>\n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">演员 (用空格隔开):</label>\n                    <textarea id="edit-names" class="jhs-textarea jhs-history-edit-field">${n}</textarea>\n                </div>\n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">状态:</label>\n                    <select id="edit-status" class="jhs-select-source">\n                        <option value="" ${"" === i ? "selected" : ""}>-- 请选择 --</option>\n                        ${l.map((e => `\n                            <option value="${e.value}" ${i === e.value ? "selected" : ""}>${e.text}</option>\n                        `)).join("")}\n                    </select>\n                </div>\n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">链接:</label>\n                    <input type="text" id="edit-url" value="${a}" class="jhs-field jhs-history-edit-field">\n                </div>\n                \n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">备注:</label>\n                    <textarea id="edit-remark" class="jhs-textarea jhs-history-edit-field">${s}</textarea>\n                </div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: `编辑记录: ${t}`,
            area: utils.getDialogArea("sm"),
            content: c,
            btn: [ "保存", "取消" ],
            success: (e, t) => {
                JhsSelect.enhance(e);
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
