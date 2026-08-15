class BlacklistPlugin extends BasePlugin {
    getName() {
        return "BlacklistPlugin";
    }
    async initCss() {
        return `<style>
            .jhs-blacklist-layout { display:flex; flex-direction:column; height:100%; min-height:0; padding:var(--jhs-space-3) var(--jhs-space-4); overflow:hidden; }
            .jhs-blacklist-toolbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-2); }
            .jhs-blacklist-toolbar__group { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); }
            .jhs-blacklist-layout #table-container { flex:1; min-height:0; }
            .jhs-table-counter-note { margin-left:var(--jhs-space-2); }
        </style>`;
    }
    async addBlacklist(e) {
        let t = {
            clientX: e.clientX,
            clientY: e.clientY + 80
        };
        const n = $("#addBlacklistBtn span").text().includes("已加入");
        let a, i;
        if (o.includes("/tags")) {
            const e = new URL(o);
            e.searchParams.delete("page");
            const t = $("#jhs-check-tag").text().trim();
            a = {
                starId: "no-" + t,
                name: "虚拟演员-" + t,
                allName: [ "虚拟演员" ],
                role: "虚拟演员",
                movieType: t,
                blacklistUrl: e.toString()
            }, i = `是否将分类 <span class="jhs-task-emphasis">${t}</span> 加入到黑名单中?`, n && (i = `分类 <span class="jhs-task-emphasis">${t}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`);
        } else a = this.getActressPageInfo(), i = `是否将该演员 <span class="jhs-task-emphasis">${a.name}</span> 加入到黑名单中?`,
        n && (i = `演员 <span class="jhs-task-emphasis">${a.name}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`);
        const {starId: s, name: r, allName: c, role: d, movieType: h, blacklistUrl: g} = a;
        if (o.includes("page") && !o.includes("page=1") && (i += "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始"),
        l) {
            const e = o.split("/star/")[1].split("/");
            if (e.length > 1) {
                parseInt(e[1]) > 1 && (i += "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始");
            }
        }
        utils.q(t, i, (async () => {
            const e = this.getBean("TaskPlugin");
            navigator.locks.request(e.singleTaskKey, {
                ifAvailable: !0
            }, (async e => {
                if (clog.debug("获取锁", e), e) {
                    this.loadObj = loading();
                    try {
                        await storageManager.addBlacklistItem({
                            starId: s,
                            name: r,
                            allName: c,
                            role: d,
                            movieType: h,
                            url: g
                        }), await this.filterActorVideo(r, s);
                        const e = show.ok(`屏蔽结束,是否跳转到最后一页: ${this.lastPageLink}`, {
                            duration: -1,
                            close: !0,
                            onClick: () => {
                                e.closeShow(), window.location.href = this.lastPageLink;
                            }
                        });
                    } catch (t) {
                        clog.error(t);
                        const e = show.error("发生错误, 是否填转到解析失败的那一页? (点击并跳转)", {
                            duration: -1,
                            close: !0,
                            onClick: () => {
                                e.closeShow(), window.location.href = this.nextPageLink;
                            }
                        });
                    } finally {
                        this.loadObj.close();
                    }
                } else show.error("当前有定时任务在后台执行中, 无法发起此操作");
            })).catch((e => {
                clog.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
            }));
        }));
    }
    async resetBtnTip() {
        const e = this.getBean("TaskPlugin"), t = localStorage.getItem(e.lastCheckBlacklistTimeKey) || "无", n = await storageManager.getSetting("checkBlacklist_intervalTime", 12);
        this.checkBlacklist_ruleTime = await storageManager.getSetting("checkBlacklist_ruleTime", 8760),
        $("#checkBlacklistBtn").attr("data-tip", `上次检测时间: ${t}; 检测间隔时间: ${n}小时`);
    }
    async openBlacklistDialog() {
        const e = this.getBean("TaskPlugin"), t = await storageManager.getSetting();
        let n = `\n            <div class="jhs-layout-7cb3f981"> \n                 <div class="jhs-layout-da5a4919">\n                    <div class="jhs-layout-31a824a2">\n                        <button type="button" id="checkBlacklistBtn" class="jhs-btn jhs-btn--danger" data-tip="上次检测时间: ${localStorage.getItem(e.lastCheckBlacklistTimeKey) || "无"}; 检测间隔时间: ${t.checkBlacklist_intervalTime}小时">${this.blacklistSvg} &nbsp;手动检测黑名单</button>\n                        <button type="button" class="jhs-btn jhs-btn--secondary" id="toSetting">${this.settingSvg} &nbsp;&nbsp; 配置</button>\n                    </div>\n                    <div class="jhs-layout-31a824a2">\n                        <select id="dataType" class="jhs-select-source">\n                            <option value="" selected>所有</option>\n                            <option value="actor">男演员</option>\n                            <option value="actress">女演员</option>\n                        </select>\n                        <select id="statusType" class="jhs-select-source">\n                            <option value="" selected>--检测状态--</option>\n                            <option value="normal">正常检测</option>\n                            <option value="stop">停止检测</option>\n                        </select>\n                        <select id="urlType" data-tip="在演员页屏蔽时,是否选择了分类" class="jhs-select-source${r ? "" : " jhs-is-hidden"}">\n                            <option value="" selected>--屏蔽类型--</option>\n                            <option value="hasT">按所选分类屏蔽</option>\n                            <option value="noT">未筛选分类</option>\n                        </select>\n                        <input id="searchValue" type="text" placeholder="搜索演员" class="jhs-field">\n                        <button type="button" id="cleanQueryBtn" class="jhs-btn jhs-btn--secondary jhs-layout-21a4fe43">重置</button>\n                    </div>\n\n                </div>\n                <div id="table-container" class="jhs-layout-d44e70c7"></div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: "演员黑名单",
            content: n,
            scrollbar: !1,
            area: utils.getDialogArea("xl"),
            anim: -1,
            success: async t => {
                const dialog = $(t).find(".layui-layer-content > div").first().addClass("jhs-blacklist-layout").removeAttr("style"), toolbar = dialog.children("div").first().addClass("jhs-blacklist-toolbar").removeAttr("style");
                toolbar.children("div").addClass("jhs-blacklist-toolbar__group").removeAttr("style"), toolbar.find("select,input,a").removeAttr("style"), dialog.find("#table-container").removeAttr("style");
                JhsSelect.enhance(t);
                await this.loadTableData(), $(".layui-layer-content").on("click", "#cleanQueryBtn", (async e => {
                    $("#searchValue").val(""), JhsSelect.setValue("#dataType", ""), JhsSelect.setValue("#statusType", ""), await this.reloadTable();
                })).on("focusout keydown", "#searchValue", (async e => {
                    if ("focusout" === e.type || "Enter" === e.key) {
                        if ("Enter" === e.key && e.preventDefault(), "keydown" === e.type && "Enter" !== e.key) return;
                        JhsSelect.setValue("#dataType", ""), await this.reloadTable();
                    }
                })).on("change", "#dataType", (async () => {
                    $("#searchValue").val(""), await this.reloadTable();
                })).on("change", "#statusType", (async () => {
                    await this.reloadTable();
                })).on("change", "#urlType", (async () => {
                    await this.reloadTable();
                })).on("click", "#toSetting", (() => {
                    this.getBean("SettingPlugin").openSettingDialog("task-panel", (() => {
                        $("#setting-blacklist").css({
                            border: "1px solid var(--jhs-status-filter)"
                        });
                    }));
                })).on("click", ".open-url", (e => {
                    e.preventDefault();
                    const t = $(e.currentTarget), n = t.attr("data-url"), a = t.attr("data-name");
                    utils.openPage(n, a, !0, e);
                })).on("click", "#checkBlacklistBtn", (t => {
                    utils.q({
                        clientX: t.clientX,
                        clientY: t.clientY + 20
                    }, "是否手动检测黑名单?", (() => {
                        navigator.locks.request(e.singleTaskKey, {
                            ifAvailable: !0
                        }, (async t => {
                            t ? (await e.loadConfig(), await e.checkBlacklist(!0)) : show.error("当前有定时任务在后台执行中, 无法发起手动任务");
                        })).catch((e => {
                            clog.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
                        }));
                    }));
                }));
            },
            end: () => {
                this.tableObj && (this.tableObj.destroy(), this.tableObj = null), window.refresh();
            }
        });
    }
    async reloadTable() {
        if (!this.tableObj) return;
        const e = await this.getTableData();
        this.tableObj.setData(e);
    }
    async getTableData() {
        const e = this.getBean("TaskPlugin"), t = await storageManager.getBlacklist(), n = await storageManager.getBlacklistCarList(), a = $("#searchValue").val(), i = $("#statusType").val(), s = $("#dataType"), o = s.val(), r = $("#urlType").val(), l = t.length;
        let c = 0, d = 0;
        const h = t.map((t => {
            t.role === B ? c++ : t.role === P && d++;
            let n = !1;
            return t.lastPublishTime && (n = !e.isUnnecessaryCheck(t.lastPublishTime, this.checkBlacklist_ruleTime)),
            {
                ...t,
                isUnCheck: n
            };
        })).filter((e => !(a && !e.name.includes(a)) && (("normal" !== i || !e.isUnCheck) && (!("stop" === i && !e.isUnCheck) && (o ? e.role === o : !("hasT" === r && !e.url.includes("t=")) && ("noT" !== r || !e.url.includes("t=")))))));
        s.html(`\n            <option value="">所有 (${l})</option>\n            <option value="actor">男演员 (${c})</option>\n            <option value="actress">女演员 (${d})</option>\n        `),
        JhsSelect.setValue(s, o);
        const g = new Map;
        for (const m of n) {
            const e = m.starId;
            g.has(e) || g.set(e, []), g.get(e).push(m);
        }
        const p = h.map((e => {
            const t = e.starId, n = g.get(t) || [];
            return {
                ...e,
                carList: n,
                count: n.length
            };
        }));
        return this.currentCarCount = p.reduce(((e, t) => e + (t.count || 0)), 0), p;
    }
    async loadTableData() {
        this.checkBlacklist_ruleTime = await storageManager.getSetting("checkBlacklist_ruleTime") || 8760;
        const e = await this.getTableData();
        this.tableObj = new Tabulator("#table-container", {
            layout: "fitColumns",
            placeholder: "暂无数据",
            virtualDom: !0,
            data: e,
            pagination: !0,
            paginationMode: "local",
            paginationSize: 20,
            paginationSizeSelector: [ 20, 50, 100, 1e3, 99999 ],
            paginationCounter: (e, t, n, a, i) => `演员: ${a} &nbsp;&nbsp;&nbsp;番号总数: ${this.currentCarCount}  <span id="checkBlacklistMsg" class="jhs-table-counter-note"></span>`,
            responsiveLayout: "collapse",
            responsiveLayoutCollapse: !0,
            columnDefaults: {
                headerHozAlign: "center",
                hozAlign: "center"
            },
            index: "starId",
            columns: [ {
                title: "演员",
                field: "name",
                sorter: "string",
                minWidth: 100,
                responsive: 0,
                headerSort: !1,
                formatter: (e, t, n) => {
                    const a = e.getData();
                    return `<a class="open-url" data-url="${a.url}" href="${a.url}" data-name="${a.name}" target="_blank">${a.name}</a>`;
                }
            }, {
                title: "性别角色",
                field: "role",
                sorter: "string",
                width: 120,
                responsive: 5,
                formatter: (e, t, n) => {
                    const a = e.getData().role;
                    let i = a;
                    return a === B ? i = "男演员" : a === P && (i = "女演员"), i;
                }
            }, {
                title: "影视类别",
                field: "movieType",
                sorter: "string",
                width: 120,
                responsive: 5,
                formatter: (e, t, n) => {
                    const a = e.getData().movieType;
                    let i = a;
                    return a === D ? i = "有码" : a === A && (i = "无码"), i;
                }
            }, {
                title: "屏蔽类型",
                field: "url",
                sorter: "string",
                minWidth: 120,
                responsive: 4,
                visible: r,
                formatter: (e, t, n) => {
                    let a = e.getData().url.includes("t=");
                    return `<span class="jhs-badge ${a ? "jhs-badge--filter" : "jhs-badge--neutral"}">${a ? "按所选分类屏蔽" : "未筛选分类"}</span>`;
                }
            }, {
                title: "番号数量",
                field: "count",
                sorter: "number",
                width: 170,
                responsive: 1
            }, {
                title: "创建时间",
                field: "createTime",
                sorter: "string",
                width: 170,
                responsive: 5
            }, {
                title: "最后发行时间",
                field: "lastPublishTime",
                sorter: "string",
                width: 170,
                responsive: 1
            }, {
                title: "状态",
                field: "isUnCheck",
                sorter: "string",
                width: 120,
                responsive: 1,
                formatter: (e, t, n) => {
                    let a = "", i = "正常检测";
                    return e.getData().isUnCheck && (a = `停更${this.checkBlacklist_ruleTime / 24 / 365}年以上, 下轮任务不再进行检测`,
                    i = "停止检测"), `<span class="jhs-badge ${a ? "jhs-badge--filter" : "jhs-badge--neutral"}" data-tip="${a}">${i}</span>`;
                }
            }, {
                title: "操作",
                sorter: "string",
                cssClass: "action-cell-dropdown",
                minWidth: 150,
                responsive: 0,
                headerSort: !1,
                formatter: (e, t, n) => {
                    const a = e.getData();
                    return n((() => {
                        var t, n;
                        null == (t = e.getElement().querySelector(".delete-btn")) || t.addEventListener("click", (e => {
                            const t = a.name, n = a.starId;
                            t ? n ? utils.q(e, `是否移除对 ${t} 的屏蔽?`, (async () => {
                                await storageManager.removeBlacklistCarList(n), await storageManager.deleteBlacklistItem(n),
                                show.info("操作成功"), await this.reloadTable();
                            })) : show.error("获取starId失败") : show.error("获取名称失败");
                        })), null == (n = e.getElement().querySelector(".keyword-btn")) || n.addEventListener("click", (e => {
                            const t = a.carList.reduce(((e, t) => {
                                const n = t.carNum.split("-")[0] + "-";
                                return e[n] = (e[n] || 0) + 1, e;
                            }), {}), n = Object.entries(t).map((([e, t]) => ({
                                prefix: e,
                                count: t
                            }))).sort(((e, t) => t.count - e.count));
                            clog.debug(n);
                        }));
                    })), '<button type="button" class="jhs-btn jhs-btn--danger delete-btn"><span>删除</span></button>';
                }
            } ],
            initialSort: [ {
                column: "createTime",
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
        });
    }
    async filterAllVideo(e, t) {
        let n, a;
        if (t ? (l && t.find(".avatar-box").length > 0 && t.find(".avatar-box").parent().remove(),
        n = t.find(this.getSelector().requestDomItemSelector), a = t.find(this.getSelector().nextPageSelector).attr("href")) : (n = $(this.getSelector().itemSelector),
        a = $(this.getSelector().nextPageSelector).attr("href")), a && 0 === n.length) throw show.error("解析列表失败"),
        new Error("解析列表失败");
        for (const s of n) {
            const t = $(s), {carNum: n, url: a, publishTime: o} = this.getBean("ListPagePlugin").findCarNumAndHref(t);
            if (a && n) try {
                if (await storageManager.getCar(n)) continue;
                await storageManager.saveCar({
                    carNum: n,
                    url: a,
                    names: e,
                    actionType: d,
                    publishTime: o
                }), clog.log("屏蔽演员番号", e, n);
            } catch (i) {
                clog.error(`保存失败 [${n}]:`, i);
            }
        }
        if (a) {
            show.info("请不要关闭窗口, 正在解析下一页:" + a), await new Promise((e => setTimeout(e, 500)));
            const t = await gmHttp.get(a), n = new DOMParser, i = $(n.parseFromString(t, "text/html"));
            await this.filterAllVideo(e, i);
        } else show.ok("执行结束!"), window.refresh();
    }
    async batchSaveAllVideos(e, t) {
        let n, a;
        n = $(this.getSelector().itemSelector), a = $(this.getSelector().nextPageSelector).attr("href");
        if (a && 0 === n.length) throw show.error("解析列表失败"), new Error("解析列表失败");
        for (const i of n) {
            const n = $(i), {carNum: a, url: o, publishTime: r} = this.getBean("ListPagePlugin").findCarNumAndHref(n);
            if (o && a) try {
                if (await storageManager.getCar(a)) continue;
                await storageManager.saveCar({carNum: a, url: o, names: e, actionType: t, publishTime: r}), clog.log("批量操作", e, a, t);
            } catch (s) { clog.error(`保存失败 [${a}]:`, s); }
        }
        if (a) { show.info("请不要关闭窗口, 正在解析下一页:" + a), await new Promise((e => setTimeout(e, 500)));
            const i = await gmHttp.get(a), s = new DOMParser, o = $(s.parseFromString(i, "text/html"));
            await this.batchSaveAllVideos(e, t); }
        else show.ok("执行结束!"), window.refresh();
    }
    async filterActorVideo(e, t, n) {
        let {nextPageLink: a} = await this.parseAndSaveFilterInfo(n, e, t);
        if (this.nextPageLink = a, a) {
            let n;
            this.lastPageLink = a, show.info("请不要关闭窗口, 正在解析下一页:" + a);
            clog.log("正在请求下一页内容:", a);
            const i = await gmHttp.get(a);
            n = utils.htmlTo$dom(i);
            await this.filterActorVideo(e, t, n);
        } else show.ok("执行结束!"), window.refresh();
    }
    async parseAndSaveFilterInfo(e, t, n) {
        let a, i;
        if (e) {
            let t = !1, n = T;
            e.text().includes(I) && (t = !0, n = I), t && e.find(".avatar-box").length > 0 && e.find(".avatar-box").parent().remove(),
            a = e.find(this.getSelector(n).requestDomItemSelector), i = e.find(this.getSelector(n).nextPageSelector).attr("href");
        } else a = $(this.getSelector().itemSelector), i = $(this.getSelector().nextPageSelector).attr("href");
        if (i && 0 === a.length) return {
            nextPageLink: null,
            lastPublishTime: null
        };
        let s = [], o = null;
        for (const l of a) {
            const e = $(l), {carNum: a, url: i, publishTime: r} = this.getBean("ListPagePlugin").findCarNumAndHref(e);
            o || (o = r), i && a && s.push({
                carNum: a,
                url: i,
                names: t,
                actionType: d,
                starId: n,
                publishTime: r
            });
        }
        try {
            await storageManager.batchSaveBlacklistCarList(s);
        } catch (r) {
            clog.error("保存失败:", r), clog.error("保存失败:", r);
        }
        return {
            nextPageLink: i,
            lastPublishTime: o
        };
    }
}
