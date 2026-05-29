const tt = [ {
    name: "jsDelivr (全球CDN)",
    json: "https://cdn.jsdelivr.net/gh/gfriends/gfriends/Filetree.json",
    base: "https://cdn.jsdelivr.net/gh/gfriends/gfriends/Content/"
}, {
    name: "GitHub Raw (备用)",
    json: "https://raw.githubusercontent.com/gfriends/gfriends/master/Filetree.json",
    base: "https://raw.githubusercontent.com/gfriends/gfriends/master/Content/"
} ], nt = "jhs_img_cdn_index";

let at = parseInt(localStorage.getItem(nt) || "0", 10);

(at >= tt.length || at < 0) && (at = 0);

let it = tt[at].json, st = tt[at].base;

const ot = "filetreeStore", rt = "filetree_data", lt = {
    db: null,
    async open() {
        return this.db ? this.db : new Promise(((e, t) => {
            const n = indexedDB.open("GfriendsAvatarDB", 1);
            n.onupgradeneeded = e => {
                this.db = e.target.result, this.db.objectStoreNames.contains(ot) || this.db.createObjectStore(ot);
            }, n.onsuccess = t => {
                this.db = t.target.result, e(this.db);
            }, n.onerror = e => {
                console.error("IndexedDB open error:", e.target.errorCode), t(new Error("Failed to open IndexedDB"));
            };
        }));
    },
    async get(e) {
        return await this.open(), new Promise((t => {
            const n = this.db.transaction([ ot ], "readonly").objectStore(ot).get(e);
            n.onsuccess = () => t(n.result), n.onerror = () => t(null);
        }));
    },
    async set(e, t) {
        return await this.open(), new Promise(((n, a) => {
            const i = this.db.transaction([ ot ], "readwrite").objectStore(ot).put(t, e);
            i.onsuccess = () => n(), i.onerror = e => {
                console.error("IndexedDB set error:", e.target.errorCode), a(new Error("Failed to write to IndexedDB"));
            };
        }));
    }
};

let ct = null, dt = null;

function ht(e) {
    if (!e || !e.Content) return null;
    const t = {}, n = e.Content;
    for (const a in n) {
        const e = encodeURIComponent(a);
        for (const i in n[a]) {
            let s = i.replace(/\.jpg$/i, "").split("-")[0];
            s.startsWith("AI-Fix-") && (s = s.substring(7));
            const o = s.toLowerCase().trim();
            if (o.length > 0) {
                const s = n[a][i], r = s.indexOf("?");
                let l, c = "";
                r > -1 ? (l = encodeURIComponent(s.substring(0, r)), c = s.substring(r)) : l = encodeURIComponent(s);
                const d = `${st}${e}/${l}${c}`;
                t[o] || (t[o] = []), t[o].includes(d) || t[o].push(d);
            }
        }
    }
    return t;
}

async function gt(e) {
    let t = loading();
    try {
        await async function() {
            if (ct && dt) return ct;
            let e = null;
            try {
                e = await lt.get(rt);
            } catch (a) {
                console.error("读取 IndexedDB 失败:", a);
            }
            if (e && e.Content && (ct = e, dt = ht(e), dt)) return ct;
            show.info("正在载入头像数据源...");
            const t = await fetch(it);
            if (!t.ok) throw new Error(`请求头像源失败: ${t.status}`);
            const n = await t.json();
            if (n && n.Content) {
                ct = n, dt = ht(n);
                try {
                    await lt.set(rt, n), clog.debug("载入头像数据源并写入缓存成功!");
                } catch (a) {
                    clog.error(a), show.error("头像数据源写入缓存失败，可能磁盘已满或其他权限问题。");
                }
                return ct;
            }
            clog.error(n);
            throw new Error("解析头像数据源失败");
        }();
    } catch (i) {
        return show.error(i), [];
    } finally {
        t.close();
    }
    if (!dt) return [];
    const n = new Set, a = e.map((e => e.toLowerCase().trim())).filter((e => e.length > 0));
    if (0 === a.length) return [];
    for (const s of a) {
        const e = dt[s];
        e && e.forEach((e => n.add(e)));
    }
    return Array.from(n);
}

class pt extends X {
    constructor() {
        super(...arguments), i(this, "currentPage", 1), i(this, "pageSize", 30);
    }
    getName() {
        return "NewVideoPlugin";
    }
    async initCss() {
        return "\n            <style>\n                #actress-card-container {\n                    display: grid;\n                    grid-template-columns: repeat(auto-fill, minmax(243px, 1fr)); /* 响应式3-5列 */\n                    gap: 20px;\n                    padding-bottom: 20px;\n                    padding-right: 10px;\n                    background: #f9f9f9;\n                    border-radius: 5px;\n                    overflow-y: auto;\n                }\n                .actress-card {\n                    background: #fff;\n                    border: 1px solid #e0e0e0;\n                    border-radius: 8px;\n                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);\n                    padding: 15px;\n                    text-align: center;\n                    display: flex;\n                    flex-direction: column;\n                    justify-content: space-between;\n                    position: relative;\n                    overflow: hidden;\n                }\n                .actress-card:hover {\n                    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.15);\n                }\n                .actress-card-name {\n                    font-size: 1.2em;\n                    font-weight: bold;\n                    color: #007bff;\n                    margin-top: 10px;\n                }\n                .actress-card-allname {\n                    font-size: 0.9em;\n                    color: #999;\n                    margin-top: 5px;\n                    height: 30px; /* 保证高度一致性 */\n                    overflow: hidden;\n                    white-space: nowrap;      /* 防止文字换行 */\n                    text-overflow: ellipsis;  /* 当文本溢出时，显示省略号 */\n                }\n                .actress-card-avatar {\n                    width: 100px;\n                    height: 100px;\n                    border-radius: 50%;\n                    object-fit: contain;\n                    margin: 0 auto;\n                    border: 4px solid #f0f0f0;\n                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);\n                }\n                \n                .card-tag {\n                    position: absolute;\n                    top: 15px; /* 调整标签距离顶部的距离 */\n                    right: -50px; /* 调整标签距离右侧的距离，负值让它移到外面一点 */\n                    \n                    width: 150px; /* 标签的宽度，影响斜角长度 */\n                    padding: 5px 0; /* 上下内边距 */\n                    text-align: center;\n                    \n                    background-color: #ff4757; /* 标签颜色 */\n                    color: white; /* 文字颜色 */\n                    font-size: 14px;\n                    font-weight: bold;\n                    z-index: 10; /* 确保标签在其他内容之上 */\n                \n                    /* 3. 核心：旋转标签，使其倾斜 */\n                    transform: rotate(45deg); /* 45度斜角 */\n                    \n                    /* 可选：添加一些阴影或边框效果 */\n                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);\n                }\n                \n                .card-new-count-tag {\n                    position: absolute;\n                    top: 5px;\n                    left: 5px;\n                    text-align: center;\n                    font-size: 14px;\n                    font-weight: bold;\n                    z-index: 10;\n                }\n                \n                #actress-pagination {\n                    padding-top: 10px;\n                    text-align: center;\n                    border-top: 1px solid #ddd;\n                }\n                @media (max-width: 600px) {\n                    .page-number-btn {\n                        display: none !important;\n                    }\n                }\n                \n                \n                .card-btn {\n                    width: 44px;\n                    height: 44px;\n                    border-radius: 50%;\n                    display: flex;\n                    justify-content: center;\n                    align-items: center;\n                    text-decoration: none;\n                    border: none;\n                    cursor: pointer;\n                    background: linear-gradient(145deg, #e0e0e0 0%, #f7f7f7 100%);\n                    box-shadow: 8px 8px 16px rgba(0, 0, 0, 0.08),\n                                -8px -8px 16px rgba(255, 255, 255, 1.0);\n                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);\n                }\n                \n                .card-btn svg,\n                .card-btn svg path {\n                    transition: fill 0.3s ease;\n                }\n                \n                .card-btn:hover {\n                    box-shadow: inset 5px 5px 10px rgba(0, 0, 0, 0.1),\n                                inset -5px -5px 10px rgba(255, 255, 255, 0.9);\n                    transform: scale(0.97);\n                    background: #e0e0e0;\n                }\n                \n                .btn-check-actress svg path {\n                    fill: #4CAF50;\n                }\n                .btn-check-actress:hover svg path {\n                    fill: #388E3C;\n                }\n                \n                .btn-edit-actress svg path {\n                    fill: #FFC107;\n                }\n                .btn-edit-actress:hover svg path {\n                    fill: #FFB300;\n                }\n                \n                .btn-delete-actress svg path {\n                    fill: #F44336;\n                }\n                .btn-delete-actress:hover svg path {\n                    fill: #D32F2F;\n                }\n            </style>\n        ";
    }
    async handle() {
        await this.showNewVideoCount();
    }
    getPendingNewVideoCount(e, t) {
        return Array.isArray(e?.newVideoList) ? e.newVideoList.filter((e => { const n = "string" == typeof e ? e : e.carNum; return !t.has(n); })).length : 0;
    }
    async getPendingNewVideoTotal() {
        const e = await storageManager.getCarMap();
        return (await storageManager.getFavoriteActressList()).reduce(((t, n) => t + this.getPendingNewVideoCount(n, e)), 0);
    }
    async showNewVideoCount() {
        const e = await this.getPendingNewVideoTotal();
        $("#newVideoCount").text(`${e}`);
    }
    async resetBtnTip() {
        const e = this.getBean("TaskPlugin"), t = await storageManager.getSetting(), n = localStorage.getItem(e.lastCheckFavoriteActressTimeKey) || "无", a = t.checkFavoriteActress_IntervalTime, i = localStorage.getItem(e.lastCheckNewVideoTimeKey) || "无", s = t.checkNewVideo_intervalTime;
        $("#checkFavoriteActress").attr("data-tip", `上次自动同步时间: ${n}; 检测间隔时间: ${a}小时`), $("#checkNewVideo").attr("data-tip", `上次检测时间: ${i}; 检测间隔时间: ${s}小时`);
    }
    async openDialog() {
        const e = this.getBean("TaskPlugin"), t = await storageManager.getSetting(), n = localStorage.getItem(e.lastCheckFavoriteActressTimeKey) || "无", a = t.checkFavoriteActress_IntervalTime, i = localStorage.getItem(e.lastCheckNewVideoTimeKey) || "无", s = t.checkNewVideo_intervalTime;
        let o = `\n            <div class="newVideoToolBox" style="display: flex; flex-direction: column; height: 100%; overflow: hidden; padding:10px">\n                <div style="margin-bottom: 15px;display: flex; justify-content: space-between;">\n                    <div>\n                        <a class="a-danger" id="checkFavoriteActress" data-tip="上次自动同步时间: ${n}; 检测间隔时间: ${a}小时">${this.actressSvg} &nbsp;&nbsp; 手动同步演员</a>\n                        <a class="a-warning" id="checkNewVideo" data-tip="上次检测时间: ${i}; 检测间隔时间: ${s}小时">${this.newSvg} &nbsp;&nbsp; 手动检测最新作品</a>\n                        <a class="a-info" id="toSetting">${this.settingSvg} &nbsp;&nbsp; 配置</a>\n                        <span id="checkNewVideoMsg"></span>\n                    </div>\n                    <div style="display: flex; align-items: flex-start;">\n                        <select id="paramActressType" style="text-align: center; height: 100%; min-width: 150px; border: 1px solid #ddd; margin-right: 10px">\n                            <option value="all" selected>所有</option>\n                            <option value="uncensored">无码</option>\n                            <option value="censored">有码</option>\n                            <option value="">未知</option>\n                        </select>\n                        <select id="paramSortBy" style="text-align: center; height: 100%; min-width: 150px; border: 1px solid #ddd; margin-right: 10px">\n                            <option value="default" selected>默认排序</option>\n                            <optgroup label="发行时间">\n                                <option value="lastPublishTime_desc">发行时间 新→旧</option>\n                                <option value="lastPublishTime_asc">发行时间 旧→新</option>\n                            </optgroup>\n                            <optgroup label="检测时间">\n                                <option value="lastCheckTime_desc">检测时间 新→旧</option>\n                                <option value="lastCheckTime_asc">检测时间 旧→新</option>\n                            </optgroup>\n                            <optgroup label="新作品数">\n                                <option value="newVideoCount_desc">新作品数 多→少</option>\n                                <option value="newVideoCount_asc">新作品数 少→多</option>\n                            </optgroup>\n                        </select>\n                        <a class="a-normal" id="toggleViewMode" style="margin-left: 10px;">📋 新作品列表</a>\n                        <a class="a-normal" id="reLoad">${this.refreshSvg} &nbsp;&nbsp; 刷新</a>\n                    </div>\n\n                </div>\n                <div id="actress-card-container" class="jhs-scrollbar"></div>\n                <div id="new-video-list-container" style="display:none; flex:1; overflow:hidden;"></div>\n                <div id="new-video-list-footer" style="display:none; padding:8px 0; border-top:1px solid #eee; font-size:13px; color:#666;"></div>\n                <div id="actress-pagination"></div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: '<span style="padding: 0 10px;" data-tip="数据来源: 女优页面首页,含磁链分类">新作品检测 ❓</span>',
            content: o,
            scrollbar: !1,
            area: utils.getResponsiveArea([ "80%", "90%" ]),
            anim: -1,
            success: async (e, t) => {
                this.loadData(), this.bindClick(), utils.setupEscClose(t);
            }
        });
    }
    bindClick() {
        const e = this.getBean("TaskPlugin");
        $("#reLoad").on("click", (e => {
            this.loadData(), $("#checkNewVideoMsg").text("");
        })), $("#toSetting").on("click", (e => {
            this.getBean("SettingPlugin").openSettingDialog("task-panel", (() => {
                $("#setting-checkFavoriteActress").css({
                    border: "1px solid #f40"
                }), $("#setting-checkNewVideo").css({
                    border: "1px solid #f40"
                });
            }));
        }));
        $("#checkFavoriteActress").on("click", (t => {
            utils.q({
                clientX: t.clientX,
                clientY: t.clientY + 20
            }, "是否手动同步演员?", (() => {
                navigator.locks.request(e.singleTaskKey, {
                    ifAvailable: !0
                }, (async t => {
                    if (!t) return void show.error("当前有定时任务在后台执行中, 无法发起手动任务");
                    $('a[href*="/users/profile"]').length > 0 ? (await e.checkFavoriteActress(), this.loadData()) : show.error("未登录JavDb, 同步失败");
                })).catch((e => {
                    console.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
                }));
            }));
        })), $("#checkNewVideo").on("click", (t => {
            utils.q({
                clientX: t.clientX,
                clientY: t.clientY + 20
            }, "是否手动检测最新作品?", (() => {
                navigator.locks.request(e.singleTaskKey, {
                    ifAvailable: !0
                }, (async t => {
                    t ? await e.checkNewVideo(!0) : show.error("当前有定时任务在后台执行中, 无法发起手动任务");
                })).catch((e => {
                    console.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
                }));
            }));
        })), $("#paramActressType").on("change", (e => {
            "list" === this._viewMode ? this.renderNewVideoList() : this.loadData();
        })), $("#paramSortBy").on("change", (e => {
            this.loadData();
        })), $("#toggleViewMode").on("click", (e => {
            this._viewMode = "list" === this._viewMode ? "card" : "list";
            const t = "list" === this._viewMode;
            $("#actress-card-container").toggle(!t), $("#actress-pagination").toggle(!t),
            $("#new-video-list-container").toggle(t), $("#new-video-list-footer").toggle(t),
            $("#paramSortBy").parent().toggle(!t),
            $("#toggleViewMode").text(t ? "👤 演员视图" : "📋 新作品列表"),
            t ? this.renderNewVideoList() : this.loadData();
        }));
    }
    loadData() {
        this.currentPage = 1;
        this.renderActressCards().catch(e => {
            clog.error("加载演员卡片失败:", e);
            show.error("加载数据失败");
        });
    }
    async renderActressCards() {
        const e = $("#actress-card-container");
        if (!e.length) return;
        e.html('<div style="text-align:center; padding: 40px; color: #999;">加载中...</div>');
        let t = await storageManager.getFavoriteActressList();
        const n = $("#paramActressType").val();
        "all" !== n && (t = t.filter((e => e.actressType === n)));
        const _carSet = await storageManager.getCarMap();
        const _newVideoCount = e => this.getPendingNewVideoCount(e, _carSet);
        const sortBy = $("#paramSortBy").val();
        const sortMap = {
            "lastPublishTime_desc": [{ key: "lastPublishTime", order: "desc" }],
            "lastPublishTime_asc":  [{ key: "lastPublishTime", order: "asc" }],
            "lastCheckTime_desc":   [{ key: "lastCheckTime", order: "desc" }],
            "lastCheckTime_asc":    [{ key: "lastCheckTime", order: "asc" }],
            "newVideoCount_desc":   [{ key: _newVideoCount, order: "desc" }],
            "newVideoCount_asc":    [{ key: _newVideoCount, order: "asc" }]
        };
        const defaultSort = [{
            key: _newVideoCount,
            order: "desc"
        }, {
            key: "lastPublishTime",
            order: "desc"
        }];
        const a = utils.genericSort(t, sortMap[sortBy] || defaultSort);
        const i = a.length, s = Math.ceil(i / this.pageSize), o = (this.currentPage - 1) * this.pageSize, r = o + this.pageSize, l = a.slice(o, r), c = await this.getBean("OtherSitePlugin").getJavDbUrl(), d = this.getBean("TaskPlugin"), h = await storageManager.getSetting("checkNewVideo_ruleTime") || 8760;
        if (0 === l.length) {
            e.html('<div style="text-align:center; padding: 40px; color: #999;">暂无数据</div>');
            return void this.renderPagination(i, s);
        }
        const _escHtml = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
        const g = l.map((e => {
            const a = Array.isArray(e.allName) ? e.allName.join("，") : "";
            const _a = _escHtml(a), _name = _escHtml(e.name || ""), _remark = _escHtml(e.remark || "");
            const _newCount = this.getPendingNewVideoCount(e, _carSet);
            const _effectivePublishTime = _newCount > 0 ? (e.lastPublishTime || "") : "";
            const i = `${c}/actors/${e.starId}?t=d`;
            let s = !1;
            _effectivePublishTime && (s = !d.isUnnecessaryCheck(_effectivePublishTime, h));
            let o = "未知", r = "#9E9E9E";
            e.actressType === A ? (o = "无码", r = "#4CAF50") : e.actressType === D && (o = "有码",
            r = "#FF9800");
            let l = "";
            return s && (l = "background: linear-gradient(145deg, #e0e0e0 0%, #cabdbd 100%);box-shadow: none"),
            `\n                <div class="actress-card" data-starId="${e.starId}" style="${s ? "background: #d4cece; " : ""}min-height: 370px;">\n                    <a href="${i}" target="_blank" style="text-decoration: none; color: inherit; display: block; flex-grow: 1;">\n                        <img src="${e.avatar || "https://c0.jdbstatic.com/images/actor_unknow.jpg"}" alt="${_a}" class="actress-card-avatar">\n                    </a>\n\n                    <div>\n                        <a href="${i}" target="_blank" style="text-decoration: none; color: inherit; display: block; flex-grow: 1;">\n                            <div class="actress-card-name">${_name}</div>\n                        </a>\n                        <div class="actress-card-allname" title="${_a}">${_a}</div>\n                    </div>\n\n                    <div style="font-size: 0.8em; margin-top: 5px;">\n                         <span>上次检测: ${e.lastCheckTime || ""}</span>\n                    </div>\n                    <div style="font-size: 0.8em; margin-top: 5px; min-height: 1.2em;">\n                         <span>${_effectivePublishTime ? "最后发行作品: " + _effectivePublishTime : (_newCount === 0 && e.lastPublishTime ? "已全部标记" : "")}</span>\n                    </div>\n\n                    <div style="font-size: 0.7em; color: #cc4444; margin-top: 5px; min-height: 18px">\n                         <span>${s ? "停更" + h / 24 / 365 + "年以上, 下轮任务不再进行检测" : ""}</span>\n                    </div>\n\n                    <div style="font-size: 0.8em; margin-top: 5px; color: #3765c5; min-height: 10px">\n                         <span>${_remark}</span>\n                    </div>\n\n                    <div style="margin-top: 10px;display: flex; justify-content:center; gap: 10px;">\n                        <a title="编辑" class="card-btn btn-edit-actress" style="${l}" data-starId="${e.starId}">${this.editSvg}</a>\n                        <a title="取消收藏" class="card-btn btn-delete-actress" style="${l}" data-starId="${e.starId}">${this.deleteSvg}</a>\n                        <a title="重新检测该演员" class="card-btn btn-check-actress" style="${l}" data-starId="${e.starId}">${this.checkSvg}</a>\n                    </div>\n\n                    <div class="card-tag" style="background-color:${r}">${o}</div>\n                    <div class="card-new-count-tag" data-tip="最新作品数量: ${_newCount}">🔔 ${_newCount}</div>\n                </div>\n            `;
        })).join("");
        e.html(g), $(".btn-delete-actress").off("click").on("click", (e => {
            e.preventDefault();
            const t = $(e.currentTarget).attr("data-starId"), n = a.find((e => e.starId === t));
            utils.q(e, `是否取消收藏 ${n.name}?`, (async () => {
                let e = `${await this.getBean("OtherSitePlugin").getJavDbUrl()}/actors/${t}/uncollect`;
                const n = document.querySelector("meta[name=csrf-token]").content, a = await gmHttp.post(e, null, {
                    "x-csrf-token": n
                });
                a.includes("removeClass") ? (await storageManager.removeFavoriteActress(t), this.loadData(), this.showNewVideoCount()) : (show.error("移除失败"),
                clog.error("移除失败,返回值:", a));
            }));
        })), $(".btn-edit-actress").off("click").on("click", (e => {
            e.preventDefault();
            const t = $(e.currentTarget).attr("data-starId"), n = a.find((e => e.starId === t));
            n ? this.editActress(n) : show.error(`未找到 starId 为 ${t} 的女优记录。`);
        })), $(".btn-check-actress").off("click").on("click", (e => {
            e.preventDefault(), navigator.locks.request(d.singleTaskKey, {
                ifAvailable: !0
            }, (async t => {
                if (!t) return void show.error("当前有定时任务在后台执行中, 无法发起手动任务");
                const n = $(e.currentTarget).attr("data-starId"), i = a.find((e => e.starId === n));
                await d.checkOneNewVideo(i);
            })).catch((e => {
                console.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
            }));
        })), this.renderPagination(i, s), show.ok("加载完成");
    }
    async getNewVideoFlatList() {
        const e = await storageManager.getFavoriteActressList(), t = await storageManager.getCarMap(), n = $("#paramActressType").val(), a = [];
        for (const i of e) {
            if ("all" !== n && i.actressType !== n) continue;
            if (!Array.isArray(i.newVideoList)) continue;
            for (const e of i.newVideoList) {
                const n = "string" == typeof e ? e : e.carNum;
                if (t.has(n)) continue;
                const s = "object" == typeof e ? e : {};
                a.push({ carNum: n, coverUrl: s.coverUrl || "", title: s.title || "", publishTime: s.publishTime || "", actressName: i.name || "", starId: i.starId || "" });
            }
        }
        return a.sort(((e, t) => (t.publishTime || "").localeCompare(e.publishTime || ""))), a;
    }
    async renderNewVideoList() {
        const e = $("#new-video-list-container");
        if (!e.length) return;
        e.html('<div style="text-align:center;padding:40px;color:#999;">加载中...</div>');
        const t = await this.getNewVideoFlatList(), n = await this.getBean("OtherSitePlugin").getJavDbUrl();
        if (0 === t.length) return e.html('<div style="text-align:center;padding:40px;color:#999;">暂无待鉴定的新作品</div>'),
        void $("#new-video-list-footer").html("");
        const a = new Set, i = new Set;
        for (const r of t) a.add(r.actressName), i.add(r.carNum);
        let s = "";
        s += '<div style="display:flex;flex-wrap:wrap;gap:12px;padding:5px;">';
        for (const r of t) {
            const e = escapeHtml(r.carNum), t = escapeHtml(r.title || r.carNum), a = r.coverUrl ? r.coverUrl.replace("thumbs", "covers") : "", i = `${n}/search?q=${encodeURIComponent(r.carNum)}`;
            s += `<div class="nv-card" data-car="${e}" style="width:180px;cursor:pointer;" title="${t}">`;
            s += `<a href="${i}" target="_blank" style="display:block;text-decoration:none;color:inherit;">`;
            s += `<div style="width:180px;height:120px;overflow:hidden;border-radius:6px;background:#f0f0f0;">`;
            a ? s += `<img src="${a}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:12px;\\'>无封面</div>';">` : s += `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:12px;">无封面</div>`;
            s += `</div>`;
            s += `<div style="padding:6px 2px;">`;
            s += `<div style="font-size:12px;font-weight:bold;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e}</div>`;
            s += `<div style="font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(r.actressName)}</div>`;
            r.publishTime && (s += `<div style="font-size:10px;color:#aaa;">${r.publishTime}</div>`);
            s += `</div></a></div>`;
        }
        s += "</div>", e.html(s), $("#new-video-list-footer").html(`<span>共 <b>${t.length}</b> 个待鉴定番号，涉及 <b>${a.size}</b> 位演员</span>\n            <a class="a-normal" id="batchMarkWatched" style="margin-left:15px;">全部标记已看</a>\n            <a class="a-normal" id="batchMarkDownloaded" style="margin-left:8px;">全部标记已下载</a>`);
        $("#batchMarkWatched").off("click").on("click", (async () => {
            if (0 === t.length) return;
            utils.q({ clientX: 0, clientY: 0 }, `确认将 ${t.length} 个番号全部标记为已看?`, (async () => {
                const e = t.map((e => ({ carNum: e.carNum, url: `/search?q=${encodeURIComponent(e.carNum)}`, names: e.actressName, actionType: p })));
                try { await storageManager.saveCarList(e), show.ok(`已标记 ${e.length} 个`), this.renderNewVideoList(), this.showNewVideoCount(); } catch (n) { show.error("标记失败: " + n.message); }
            }));
        })), $("#batchMarkDownloaded").off("click").on("click", (async () => {
            if (0 === t.length) return;
            utils.q({ clientX: 0, clientY: 0 }, `确认将 ${t.length} 个番号全部标记为已下载?`, (async () => {
                const e = t.map((e => ({ carNum: e.carNum, url: `/search?q=${encodeURIComponent(e.carNum)}`, names: e.actressName, actionType: g })));
                try { await storageManager.saveCarList(e), show.ok(`已标记 ${e.length} 个`), this.renderNewVideoList(), this.showNewVideoCount(); } catch (n) { show.error("标记失败: " + n.message); }
            }));
        }));
    }
    async editActress(e) {
        const t = e.name, n = e.avatar, a = e.remark || "", i = Array.isArray(e.allName) ? e.allName.join("，") : "", s = Array.isArray(e.newVideoList) ? e.newVideoList.map((e => "string" == typeof e ? e : e.carNum)).join("，") : "", o = e.starId, r = "width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; min-height: 60px; overflow-y: hidden;", l = e.actressType || "", c = `\n            <div style="padding: 20px;">\n                <div style="margin-bottom: 15px; text-align: center;">\n                    <img id="edit-avatar-preview" src="${n}" alt="Avatar Preview" \n                         style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: 2px solid #ddd;">\n                    <div style="text-align: left">\n                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">头像链接:</label>\n                        <input type="text" id="edit-actress-avatar" value="${n}" \n                               style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">\n                       <div style="display: flex; gap: 5px; margin-top: 5px;">\n                            <button type="button" id="search-avatar-btn" \n                                style="flex-grow: 1; padding: 8px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">\n                                搜索头像\n                            </button>\n                            <button type="button" id="select-cdn-btn" \n                                style="width: 100px; padding: 8px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">\n                                选择 CDN 源\n                            </button>\n                        </div>\n                    </div>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">主名称:</label>\n                    <input type="text" id="edit-actress-name" value="${t}" \n                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">所有别名(用逗号隔开):</label>\n                    <textarea id="edit-actress-allname" style="${r}">${i}</textarea>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">演员类别:</label>\n                    <select id="actressType" style="width: 100%; padding: 10px; border: 1px solid #ddd;">\n                        <option value="" ${"" === l ? "selected" : ""}>未知</option>\n                        <option value="censored" ${"censored" === l ? "selected" : ""}>有码</option>\n                        <option value="uncensored" ${"uncensored" === l ? "selected" : ""}>无码</option>\n                    </select>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">最新作品(用逗号隔开):</label>\n                    <textarea id="edit-actress-newvideolist" style="${r}">${s}</textarea>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">备注:</label>\n                   <textarea id="edit-remark" style="${r}">${a}</textarea>\n                </div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: `编辑女优: ${t} (${o})`,
            area: utils.getResponsiveArea(["500px", "750px"]),
            content: c,
            btn: [ "保存", "取消" ],
            success: (e, t) => {
                const n = e => {
                    e.css("height", "auto"), e.css("height", e[0].scrollHeight + 15 + "px");
                };
                $("#edit-actress-avatar").on("input", (function() {
                    const e = $(this).val();
                    $("#edit-avatar-preview").attr("src", e);
                }));
                const a = $("#edit-actress-allname");
                a.on("input", (function() {
                    n($(this));
                })), n(a);
                const i = $("#edit-actress-newvideolist");
                i.on("input", (function() {
                    n($(this));
                })), n(i), $("#search-avatar-btn").on("click", (async () => {
                    await this.searchAvatar();
                })), $("#select-cdn-btn").on("click", (async () => {
                    await async function() {
                        const e = at, t = tt.map(((t, n) => `\n        <div style="margin-bottom: 10px;">\n            <input type="radio" id="cdn-${n}" name="cdn-source" value="${n}" ${n === e ? "checked" : ""} style="margin-right: 10px;">\n            <label for="cdn-${n}">${t.name} ${t.json.includes("jsdelivr") ? "(推荐)" : ""}</label>\n        </div>\n    `)).join(""), n = `\n        <div style="padding: 20px;">\n            <p style="margin-bottom: 15px; font-weight: bold; color: #333;">请选择头像数据源 (当前: ${tt[e].name}):</p>\n            ${t}\n            <p style="margin-top: 20px; color: #555; font-size: 12px;">切换源会清除本地缓存的数据，并在下次搜索时重新加载。</p>\n        </div>\n    `;
                        layer.open({
                            type: 1,
                            title: "选择 CDN 源",
                            area: [ "400px", "auto" ],
                            content: n,
                            btn: [ "确定", "取消" ],
                            success: (e, t) => {
                                utils.setupEscClose(t);
                            },
                            yes: async e => {
                                const t = $('input[name="cdn-source"]:checked').val(), n = parseInt(t, 10);
                                if (n !== at) {
                                    at = n, localStorage.setItem(nt, n.toString()), it = tt[n].json, st = tt[n].base,
                                    ct = null, dt = null;
                                    try {
                                        await lt.set(rt, null);
                                    } catch (a) {
                                        clog.error("清除 IndexedDB 缓存失败:", a);
                                    }
                                    show.ok(`CDN 源已切换为: ${tt[n].name}`), layer.close(e);
                                } else layer.close(e);
                            }
                        });
                    }();
                })), utils.setupEscClose(t);
            },
            yes: async t => {
                const n = $("#edit-actress-avatar").val().trim(), a = $("#edit-actress-name").val().trim(), i = $("#edit-actress-allname").val().trim(), s = $("#edit-actress-newvideolist").val().trim(), o = $("#edit-remark").val().trim(), r = $("#actressType").val();
                if (!a) return show.error("主名称不能为空"), !1;
                const l = i.split(/[\uff0c,]/).map((e => e.trim())).filter((e => e.length > 0)), c = s.split(/[\uff0c,]/).map((e => e.trim())).filter((e => e.length > 0));
                e.avatar = n, e.name = a, e.allName = l, e.newVideoList = c, e.actressType = r,
                e.remark = o;
                try {
                    await storageManager.updateFavoriteActress(e);
                    this.renderActressCards().then();
                    this.showNewVideoCount();
                    show.ok(`女优 ${a} 信息已更新`);
                    layer.close(t);
                } catch(err) {
                    show.error("修改失败: " + (err.message || err));
                }
            }
        });
    }
    renderPagination(e, t) {
        const n = this.currentPage;
        let a = "";
        const i = $("#actress-pagination");
        if (0 === t) return a = '<span style="color: #666;">共 0 条记录</span>', void i.html(a);
        n > 1 && t > 5 && (a += '<button class="pagination-btn" data-page="1" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">首页</button>'),
        n > 1 && (a += `<button class="pagination-btn" data-page="${n - 1}" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">上一页</button>`);
        let s = Math.max(1, n - Math.floor(2.5)), o = Math.min(t, s + 5 - 1);
        o - s < 4 && (s = Math.max(1, o - 5 + 1));
        for (let r = s; r <= o; r++) {
            a += `<button class="pagination-btn page-number-btn ${r === n ? "active" : ""}" data-page="${r}" style="padding: 8px 12px; margin: 0 3px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; ${r === n ? "background: #007bff; color: white; border-color: #007bff;" : ""}">${r}</button>`;
        }
        n < t && (a += `<button class="pagination-btn" data-page="${n + 1}" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">下一页</button>`),
        n < t && t > 5 && (a += `<button class="pagination-btn" data-page="${t}" style="padding: 8px 12px; margin: 0 5px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">尾页</button>`),
        a += `<span style="margin-left: 20px; color: #666;">共 ${e} 条记录 (第 ${n}/${t} 页)</span>`,
        i.html(a), $(".pagination-btn").off("click").on("click", (e => {
            if ($(e.currentTarget).is("[disabled]")) return;
            const n = parseInt($(e.currentTarget).data("page"));
            n >= 1 && n <= t && n !== this.currentPage && (this.currentPage = n, this.renderActressCards());
        }));
    }
    async searchAvatar() {
        const e = $("#edit-actress-name"), t = $("#edit-actress-allname"), n = e.val().trim(), a = t.val().trim().split(/[\uff0c,]/).map((e => e.trim())).filter((e => e.length > 0));
        if (n && a.unshift(n), 0 === a.length) return void show.error("请先填写女优主名称或别名进行搜索。");
        const i = loading("正在搜索头像...");
        let s = [];
        try {
            s = await gt(a);
        } catch (c) {
            return void show.error(`头像数据加载或搜索失败: ${c.message || c}`);
        } finally {
            i.close();
        }
        if (0 === s.length) return void show.error(`未找到与 '${a.join("、")}' 相关的头像。请检查名称。`);
        const o = s.map(((e, t) => `\n        <div id="wrapper-${t}" class="gfriends-image-item-wrapper">\n            <img alt="" src="${e}" data-url="${e}" class="gfriends-selectable-img" data-wrapper-id="wrapper-${t}" >\n            <div class="gfriends-size-tag" data-size-for="wrapper-${t}">...</div> \n        </div>\n    `)).join(""), r = `\n        <style>\n            /* 保持上一个回答的美化样式 */\n            #gfriends-image-list-container { padding: 15px; height: 100%; box-sizing: border-box; background-color: #f8f9fa; }\n            #gfriends-prompt { color: #555; font-weight: 500; border-bottom: 1px solid #eee; padding-bottom: 10px; }\n            #gfriends-image-list { display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; }\n            .gfriends-image-item-wrapper {\n                width: 160px; height: 225px; /* 增加高度以容纳尺寸标签 */\n                overflow: hidden; border-radius: 6px;\n                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); transition: transform 0.2s ease, box-shadow 0.2s ease;\n                cursor: pointer; position: relative; \n                padding-bottom: 25px; /* 为尺寸标签留出空间 */\n            }\n            .gfriends-selectable-img {\n                width: 100%; height: 200px; /* 固定图片高度 */\n                object-fit: cover; border: 3px solid transparent; \n                border-radius: 6px; transition: border 0.2s ease;\n            }\n            .gfriends-image-item-wrapper:hover {\n                transform: translateY(-4px) scale(1.02);\n                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);\n            }\n            .gfriends-selectable-img.is-selected {\n                border-color: #ff6347;\n                box-shadow: 0 0 0 3px #ff6347;\n            }\n            /* 新增：尺寸标签样式 */\n            .gfriends-size-tag {\n                position: absolute;\n                bottom: 0; /* 定位到图片容器底部 */\n                left: 0;\n                right: 0;\n                height: 25px;\n                line-height: 25px;\n                text-align: center;\n                background-color: rgba(0, 0, 0, 0.7); /* 半透明背景 */\n                color: #fff;\n                font-size: 11px;\n                font-weight: bold;\n                border-bottom-left-radius: 6px;\n                border-bottom-right-radius: 6px;\n                user-select: none;\n            }\n        </style>\n        \n        <div id="gfriends-image-list-container">\n            <p id="gfriends-prompt" style="text-align: center; font-size: 15px; margin-bottom: 15px;">\n                点击图片即可选择（初始共 ${s.length} 张）\n            </p>\n            <div style="overflow-y: auto; height: calc(100% - 40px);">\n                <div id="gfriends-image-list">\n                    ${o}\n                </div>\n            </div>\n        </div>\n    `;
        let l = 0;
        layer.open({
            type: 1,
            title: `选择女优头像 (${s.length} 张)`,
            area: utils.getResponsiveArea([ "900px", "85%" ]),
            content: r,
            btn: [ "关闭" ],
            success: (e, t) => {
                const n = $(e), a = n.find(".gfriends-selectable-img"), i = n.find("#gfriends-prompt");
                a.each((function() {
                    const e = $(this), a = e.data("wrapper-id"), o = n.find(`#${a}`), r = n.find(`.gfriends-size-tag[data-size-for="${a}"]`);
                    e.on("load", (function() {
                        const e = this.naturalWidth, t = this.naturalHeight;
                        r.text(`${e} x ${t}`);
                    })), e.on("error", (function() {
                        o.remove(), l++;
                        const e = s.length - l;
                        i.text(`点击图片即可选择（已移除 ${l} 张错误图片，剩余 ${e} 张）`), 0 === e && (show.error("所有搜索到的头像链接均已失效，无法选择。"),
                        layer.close(t));
                    })), this.complete && (this.naturalWidth > 0 ? e.trigger("load") : e.trigger("error"));
                })), a.on("click", (function() {
                    const e = $(this), n = e.data("url");
                    $("#edit-actress-avatar").val(n), $("#edit-avatar-preview").attr("src", n), a.removeClass("is-selected"),
                    e.addClass("is-selected"), setTimeout((() => {
                        layer.close(t);
                    }), 150);
                })), utils.setupEscClose(t);
            }
        });
    }
}
