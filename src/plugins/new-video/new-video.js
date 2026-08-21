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
                clog.error("IndexedDB open error:", e.target.errorCode), t(new Error("Failed to open IndexedDB"));
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
                clog.error("IndexedDB set error:", e.target.errorCode), a(new Error("Failed to write to IndexedDB"));
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
                clog.error("读取 IndexedDB 失败:", a);
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

class NewVideoPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "currentPage", 1), i(this, "pageSize", 30), i(this, "nvCurrentPage", 1), i(this, "nvPageSize", 60), i(this, "nvFlatListCache", null), i(this, "nvSortBy", "publishTime_desc");
    }
    getName() {
        return "NewVideoPlugin";
    }
    getStartupMode() {
        return "idle";
    }
    async initCss() {
        return `
            <style>
                .newVideoToolBox { display:flex; flex-direction:column; width:100%; height:100%; min-width:0; min-height:0; box-sizing:border-box; overflow:hidden; padding:var(--jhs-space-3); }
                .jhs-new-video-toolbar { display:flex; align-items:center; justify-content:space-between; gap:var(--jhs-space-3); margin-bottom:var(--jhs-space-3); }
                .jhs-new-video-toolbar__actions, .jhs-new-video-toolbar__filters { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); }
                .jhs-new-video-toolbar select { min-width:150px; }
                #actress-card-container { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); gap:var(--jhs-space-3); width:100%; min-width:0; max-width:1680px; box-sizing:border-box; margin:0 auto; padding:var(--jhs-space-1); overflow-x:hidden; overflow-y:auto; }
                .actress-card { position:relative; display:flex; flex-direction:column; min-width:0; padding:var(--jhs-space-4); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); }
                .actress-card.is-paused { background:var(--jhs-surface-2); }
                .actress-card__badges { display:flex; align-items:center; gap:var(--jhs-space-1); margin-bottom:var(--jhs-space-3); }
                .actress-card__profile { display:grid; grid-template-columns:64px minmax(0,1fr); align-items:center; gap:var(--jhs-space-3); color:inherit; text-decoration:none; }
                .actress-card-avatar { width:64px; height:64px; border-radius:50%; object-fit:cover; background:var(--jhs-surface-2); }
                .actress-card-name { overflow:hidden; color:var(--jhs-text); font-size:var(--jhs-font-size-lg); font-weight:700; text-overflow:ellipsis; white-space:nowrap; }
                .actress-card-allname { overflow:hidden; margin-top:var(--jhs-space-1); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); text-overflow:ellipsis; white-space:nowrap; }
                .actress-card__meta { display:grid; gap:var(--jhs-space-2); margin:var(--jhs-space-3) 0; }
                .actress-card__meta-row { display:grid; grid-template-columns:76px minmax(0,1fr); gap:var(--jhs-space-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .actress-card__meta-row dt { color:var(--jhs-text-faint); }
                .actress-card__meta-row dd { overflow:hidden; margin:0; color:var(--jhs-text); text-overflow:ellipsis; white-space:nowrap; }
                .actress-card__note { min-height:20px; margin-bottom:var(--jhs-space-3); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .actress-card__actions { display:flex; align-items:center; gap:var(--jhs-space-2); margin-top:auto; }
                .actress-card__actions .btn-check-actress { flex:1; }
                .actress-card__menu { position:relative; }
                .actress-card__menu summary { list-style:none; }
                .actress-card__menu summary::-webkit-details-marker { display:none; }
                .actress-card__menu-popover { position:absolute; right:0; bottom:calc(100% + var(--jhs-space-1)); z-index:var(--jhs-z-elevated); min-width:128px; padding:var(--jhs-space-1); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); box-shadow:var(--jhs-shadow-md); }
                .actress-card__menu-popover button { width:100%; justify-content:flex-start; }
                .card-tag.is-uncensored { color:var(--jhs-status-down); background:var(--jhs-status-down-tint); }
                .card-tag.is-censored { color:var(--jhs-status-watch); background:var(--jhs-status-watch-tint); }
                .card-tag.is-unknown { color:var(--jhs-text-muted); background:var(--jhs-surface-2); }
                #new-video-list-container { display:none; flex:1; min-width:0; min-height:0; overflow-x:hidden; overflow-y:auto; }
                #new-video-list-footer { display:none; padding:var(--jhs-space-2) 0; border-top:1px solid var(--jhs-border); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .jhs-new-video-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr)); gap:var(--jhs-space-3); width:100%; min-width:0; box-sizing:border-box; padding:var(--jhs-space-1); }
                .nv-card__link { display:block; color:inherit; text-decoration:none; }
                .nv-card__cover { position:relative; width:100%; overflow:hidden; aspect-ratio:3/2; border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }
                .nv-cover-img { width:100%; height:100%; object-fit:cover; cursor:zoom-in; }
                .nv-card__empty { display:flex; align-items:center; justify-content:center; height:100%; color:var(--jhs-text-faint); font-size:var(--jhs-font-size-xs); }
                .nv-card__rating { position:absolute; top:var(--jhs-space-1); right:var(--jhs-space-1); }
                .nv-card__body { padding:var(--jhs-space-2) var(--jhs-space-1); }
                .nv-card__title, .nv-card__actress { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .nv-card__title { color:var(--jhs-text); font-size:var(--jhs-font-size-sm); font-weight:700; }
                .nv-card__actress, .nv-card__date { color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
                .jhs-new-video-pagination { padding:var(--jhs-space-3) 0; border-top:1px solid var(--jhs-border); text-align:center; }
                .jhs-form-dialog { display:grid; gap:var(--jhs-space-3); padding:var(--jhs-space-4); }
                .jhs-avatar-editor { display:grid; grid-template-columns:100px minmax(0,1fr); gap:var(--jhs-space-3); align-items:start; }
                .jhs-avatar-editor__preview { width:100px; height:100px; border:2px solid var(--jhs-border); border-radius:50%; object-fit:cover; }
                .jhs-avatar-editor__actions { margin-top:var(--jhs-space-2); }
                .jhs-form-dialog__body, .jhs-form-field { display:grid; gap:var(--jhs-space-1); }
                .jhs-form-label, .jhs-form-dialog__title { color:var(--jhs-text); font-size:var(--jhs-font-size-sm); font-weight:600; }
                .jhs-form-dialog :where(.jhs-field,.jhs-select,.jhs-textarea) { width:100%; }
                .jhs-form-dialog .jhs-textarea { min-height:60px; overflow-y:hidden; }
                .jhs-option-row { display:flex; align-items:center; gap:var(--jhs-space-2); min-height:36px; }
                #actress-pagination { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:var(--jhs-space-1); }
                @media (max-width:767px) { .jhs-new-video-toolbar { align-items:stretch; flex-direction:column; } .jhs-new-video-toolbar select, .jhs-new-video-toolbar .jhs-btn { min-height:44px; } .page-number-btn { display:none !important; } }
            </style>
        `;
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
        this._viewMode = "card", this.nvFlatListCache = null, this.nvCurrentPage = 1;
        const e = this.getBean("TaskPlugin"), t = await storageManager.getSetting(), n = localStorage.getItem(e.lastCheckFavoriteActressTimeKey) || "无", a = t.checkFavoriteActress_IntervalTime, i = localStorage.getItem(e.lastCheckNewVideoTimeKey) || "无", s = t.checkNewVideo_intervalTime;
        let o = `
            <div class="newVideoToolBox jhs-ui">
                <div class="jhs-new-video-toolbar" role="toolbar" aria-label="新作品工作区工具">
                    <div class="jhs-new-video-toolbar__actions">
                        <button type="button" class="jhs-btn jhs-btn--secondary" id="checkFavoriteActress" data-tip="上次自动同步时间: ${n}; 检测间隔时间: ${a}小时">${this.actressSvg}<span>手动同步演员</span></button>
                        <button type="button" class="jhs-btn jhs-btn--secondary" id="checkNewVideo" data-tip="上次检测时间: ${i}; 检测间隔时间: ${s}小时">${this.newSvg}<span>手动检测最新作品</span></button>
                        <button type="button" class="jhs-btn jhs-btn--ghost" id="toSetting">${this.settingSvg}<span>配置</span></button>
                        <span id="checkNewVideoMsg" role="status" aria-live="polite"></span>
                    </div>
                    <div class="jhs-new-video-toolbar__filters">
                        <select id="paramActressType" class="jhs-select-source" aria-label="演员类型"><option value="all" selected>所有</option><option value="uncensored">无码</option><option value="censored">有码</option><option value="">未知</option></select>
                        <select id="nvCategoryFilter" class="jhs-select-source jhs-is-hidden" aria-label="新作品类别"><option value="all" selected>所有</option><option value="uncensored">无码</option><option value="censored">有码</option><option value="">未知</option><option value="vr">VR</option></select>
                        <select id="paramSortBy" class="jhs-select-source" aria-label="演员排序">
                            <option value="default" selected>默认排序</option><optgroup label="发行时间"><option value="lastPublishTime_desc">发行时间 新→旧</option><option value="lastPublishTime_asc">发行时间 旧→新</option></optgroup><optgroup label="检测时间"><option value="lastCheckTime_desc">检测时间 新→旧</option><option value="lastCheckTime_asc">检测时间 旧→新</option></optgroup><optgroup label="新作品数"><option value="newVideoCount_desc">新作品数 多→少</option><option value="newVideoCount_asc">新作品数 少→多</option></optgroup>
                        </select>
                        <select id="nvSortBy" class="jhs-select-source jhs-is-hidden" aria-label="新作品排序"><option value="publishTime_desc" selected>发行时间 新→旧</option><option value="publishTime_asc">发行时间 旧→新</option><option value="voteCount_desc">评价人数 多→少</option><option value="voteCount_asc">评价人数 少→多</option><option value="actress_asc">演员名 A→Z</option><option value="actress_desc">演员名 Z→A</option><option value="carNum_asc">番号 A→Z</option><option value="carNum_desc">番号 Z→A</option></select>
                        <button type="button" class="jhs-btn jhs-btn--secondary" id="toggleViewMode">新作品列表</button>
                        <button type="button" class="jhs-btn jhs-btn--ghost" id="reLoad">${this.refreshSvg}<span>刷新</span></button>
                    </div>
                </div>
                <div id="actress-card-container" class="jhs-scrollbar"></div>
                <div id="new-video-list-container"></div>
                <div id="new-video-list-footer"></div>
                <div id="actress-pagination"></div>
            </div>`;
        layer.open({
            type: 1,
            title: '<span class="jhs-dialog-title" data-tip="数据来源: 女优页面首页,含磁链分类">新作品检测</span>',
            content: o,
            scrollbar: !1,
            area: utils.getDialogArea("workspace"),
            anim: -1,
            success: async (e, t) => {
                JhsSelect.enhance(e), this.loadData(), this.bindClick(), utils.setupEscClose(t);
            }
        });
    }
    bindClick() {
        const e = this.getBean("TaskPlugin");
        $("#reLoad").on("click", (e => {
            this.loadData(), $("#checkNewVideoMsg").text("");
        })), $("#new-video-list-container").on("click", ".nv-card__link", (async e => {
            const t = $(e.currentTarget).closest(".nv-card").attr("data-car");
            if (!t) return;
            try {
                await storageManager.removeNewVideoList([ t ]), "list" === this._viewMode && await this.renderNewVideoList(),
                window.refresh();
            } catch (n) { clog.error("移除新作品标记失败:", n); }
        })), $("#toSetting").on("click", (e => {
            this.getBean("SettingPlugin").openSettingDialog("task-panel", (() => {
                $("#setting-checkFavoriteActress").css({
                    border: "1px solid var(--jhs-status-filter)"
                }), $("#setting-checkNewVideo").css({
                    border: "1px solid var(--jhs-status-filter)"
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
                    clog.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
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
                    clog.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
                }));
            }));
        })), $("#paramActressType").on("change", (e => {
            "list" === this._viewMode ? this.renderNewVideoList() : this.loadData();
        })), $("#paramSortBy").on("change", (e => {
            this.loadData();
        })), $("#nvSortBy").on("change", (e => {
            this.nvSortBy = $("#nvSortBy").val(), this.nvCurrentPage = 1, this.nvRenderPage();
        })), $("#nvCategoryFilter").on("change", (e => {
            "list" === this._viewMode && this.renderNewVideoList();
        })), $("#toggleViewMode").on("click", (e => {
            this._viewMode = "list" === this._viewMode ? "card" : "list";
            const t = "list" === this._viewMode;
            $("#actress-card-container").toggle(!t), $("#actress-pagination").toggle(!t),
            $("#new-video-list-container").toggle(t), $("#new-video-list-footer").toggle(t),
            JhsSelect.setVisible("#paramSortBy", !t), JhsSelect.setVisible("#nvSortBy", t),
            JhsSelect.setVisible("#paramActressType", !t), JhsSelect.setVisible("#nvCategoryFilter", t),
            $("#toggleViewMode").text(t ? "演员视图" : "新作品列表"),
            t ? this.renderNewVideoList() : this.loadData();
        }));
    }
    loadData() {
        this.currentPage = 1;
        this.renderActressCards().catch(e => {
            clog.error("加载演员卡片失败:", e);
            show.error("加载数据失败");
            const container = $("#actress-card-container");
            container.empty().append($('<div class="jhs-state jhs-state--error"></div>').append(document.createTextNode("加载数据失败 "),
            $('<button type="button" class="jhs-btn jhs-btn--secondary">重试</button>').on("click", (() => this.loadData()))));
        });
    }
    async renderActressCards() {
        const e = $("#actress-card-container");
        if (!e.length) return;
        e.html('<div class="jhs-state jhs-state--loading" role="status">加载中...</div>');
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
        const sortedActresses = utils.genericSort(t, sortMap[sortBy] || defaultSort);
        const totalCount = sortedActresses.length, totalPages = Math.ceil(totalCount / this.pageSize), pageStart = (this.currentPage - 1) * this.pageSize, pageEnd = pageStart + this.pageSize;
        const pageActresses = sortedActresses.slice(pageStart, pageEnd), javDbUrl = await this.getBean("OtherSitePlugin").getJavDbUrl(), taskPlugin = this.getBean("TaskPlugin"), ruleTime = await storageManager.getSetting("checkNewVideo_ruleTime") || 8760;
        if (0 === pageActresses.length) {
            e.html('<div class="jhs-state jhs-state--empty">暂无数据</div>');
            return void this.renderPagination(totalCount, totalPages);
        }
        const escapeCardHtml = value => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
        const cardsHtml = pageActresses.map((actress => {
            const allNames = Array.isArray(actress.allName) ? actress.allName.join("，") : "";
            const escapedAllNames = escapeCardHtml(allNames), escapedName = escapeCardHtml(actress.name || ""), escapedRemark = escapeCardHtml(actress.remark || "");
            const newVideoCount = this.getPendingNewVideoCount(actress, _carSet);
            const effectivePublishTime = newVideoCount > 0 ? actress.lastPublishTime || "" : "";
            const profileUrl = `${javDbUrl}/actors/${actress.starId}?t=d`;
            let isPaused = !1;
            effectivePublishTime && (isPaused = !taskPlugin.isUnnecessaryCheck(effectivePublishTime, ruleTime));
            let typeLabel = "未知", typeClass = "is-unknown";
            actress.actressType === A ? (typeLabel = "无码", typeClass = "is-uncensored") : actress.actressType === D && (typeLabel = "有码", typeClass = "is-censored");
            const publishText = effectivePublishTime ? effectivePublishTime : 0 === newVideoCount && actress.lastPublishTime ? "已全部标记" : "暂无记录";
            const noteText = isPaused ? `停更 ${ruleTime / 24 / 365} 年以上，下轮任务不再检测` : escapedRemark || "暂无备注";
            return `
                <article class="actress-card ${isPaused ? "is-paused" : ""}" data-starId="${actress.starId}">
                    <div class="actress-card__badges">
                        <span class="jhs-badge jhs-badge--soft card-new-count-tag" data-tip="最新作品数量: ${newVideoCount}">${newVideoCount} 新</span>
                        <span class="jhs-badge card-tag ${typeClass}">${typeLabel}</span>
                        ${isPaused ? '<span class="jhs-badge jhs-badge--neutral">停更</span>' : ""}
                    </div>
                    <a class="actress-card__profile" href="${profileUrl}" target="_blank" rel="noopener noreferrer">
                        <img src="${actress.avatar || "https://c0.jdbstatic.com/images/actor_unknow.jpg"}" alt="${escapedAllNames}" class="actress-card-avatar" loading="lazy">
                        <span><span class="actress-card-name">${escapedName}</span><span class="actress-card-allname" title="${escapedAllNames}">${escapedAllNames || "暂无别名"}</span></span>
                    </a>
                    <dl class="actress-card__meta">
                        <div class="actress-card__meta-row"><dt>最近作品</dt><dd title="${publishText}">${publishText}</dd></div>
                        <div class="actress-card__meta-row"><dt>上次检测</dt><dd>${actress.lastCheckTime || "暂无记录"}</dd></div>
                    </dl>
                    <p class="actress-card__note" title="${noteText}">${noteText}</p>
                    <div class="actress-card__actions">
                        <button type="button" class="jhs-btn jhs-btn--primary btn-check-actress" data-starId="${actress.starId}">${this.checkSvg}<span>重新检测</span></button>
                        <button type="button" class="jhs-btn jhs-btn--icon jhs-btn--ghost btn-delete-actress" aria-label="取消收藏 ${escapedName}" title="取消收藏" data-starId="${actress.starId}">${this.deleteSvg}</button>
                        <details class="actress-card__menu">
                            <summary class="jhs-btn jhs-btn--icon jhs-btn--ghost" aria-label="更多操作" title="更多操作">•••</summary>
                            <div class="actress-card__menu-popover" role="menu">
                                <button type="button" class="jhs-btn jhs-btn--ghost btn-edit-actress" role="menuitem" data-starId="${actress.starId}">${this.editSvg}<span>编辑资料</span></button>
                            </div>
                        </details>
                    </div>
                </article>`;
        })).join("");
        e.html(cardsHtml), $(".btn-delete-actress").off("click").on("click", (e => {
            e.preventDefault();
            const t = $(e.currentTarget).attr("data-starId"), n = sortedActresses.find((e => e.starId === t));
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
            const t = $(e.currentTarget).attr("data-starId"), n = sortedActresses.find((e => e.starId === t));
            n ? this.editActress(n) : show.error(`未找到 starId 为 ${t} 的女优记录。`);
        })), $(".btn-check-actress").off("click").on("click", (e => {
            e.preventDefault(), navigator.locks.request(taskPlugin.singleTaskKey, {
                ifAvailable: !0
            }, (async t => {
                if (!t) return void show.error("当前有定时任务在后台执行中, 无法发起手动任务");
                const n = $(e.currentTarget).attr("data-starId"), i = sortedActresses.find((e => e.starId === n));
                await taskPlugin.checkOneNewVideo(i);
            })).catch((e => {
                clog.error("锁任务出现错误:", e), clog.error("锁任务出现错误:", e);
            }));
        })), $(".actress-card__menu").on("keydown", (event => {
            if ("Escape" !== event.key) return;
            event.preventDefault();
            const details = $(event.currentTarget);
            details.prop("open", !1).find("summary").trigger("focus");
        })).on("click", "[role='menuitem']", (event => {
            $(event.currentTarget).closest("details").prop("open", !1);
        })), this.renderPagination(totalCount, totalPages), show.ok("加载完成");
    }
    async getNewVideoFlatList() {
        const e = await storageManager.getFavoriteActressList(), t = await storageManager.getCarMap(), n = $("#nvCategoryFilter").val() || "all", a = [];
        for (const i of e) {
            if ("all" !== n && "vr" !== n && i.actressType !== n) continue;
            if (!Array.isArray(i.newVideoList)) continue;
            for (const e of i.newVideoList) {
                const o = "string" == typeof e ? e : e.carNum;
                if (t.has(o)) continue;
                if ("vr" === n && !/VR/i.test(o)) continue;
                const s = "object" == typeof e ? e : {};
                a.push({ carNum: o, coverUrl: s.coverUrl || "", title: s.title || "", publishTime: s.publishTime || "", actressName: i.name || "", starId: i.starId || "", score: s.score || 0, voteCount: s.voteCount || 0, url: s.url || "" });
            }
        }
        return a.sort(((e, t) => (t.publishTime || "").localeCompare(e.publishTime || ""))), a;
    }
    async loadCoverForItems(e) {
        const t = await this.getBean("OtherSitePlugin").getJavDbUrl(), n = {};
        for (const a of e) {
            if (n[a.starId]) continue;
            if (e.every((e => e.starId !== a.starId || e.coverUrl))) continue;
            n[a.starId] = !0;
            try {
                const i = await gmHttp.get(`${t}/actors/${a.starId}?t=d`), s = utils.htmlTo$dom(i);
                s.find(".movie-list .item").each(((e, n) => {
                    const i = $(n), o = i.find(".video-title strong").text().trim(), r = i.find("img").attr("src") || "";
                    if (!o || !r) return;
                    let l = r;
                    if (!l.startsWith("http")) {
                        l = l.startsWith("/") ? t + l : t + "/" + l;
                    }
                    const c = l.replace("thumbs", "covers"), d = i.find(".video-title").text().replace(o, "").trim();
                    $(`.nv-card[data-car="${o}"]`).each(((e, t) => {
                        const n = $(t), i = n.find("img");
                        if (i.length) {
                            i.attr("src", c).on("error", (function() { $(this).hide().next().show(); }));
                        } else {
                            const e = n.find(".nv-placeholder");
                            if (e.length) {
                                e.replaceWith(`<img class="nv-cover-img" src="${c}" loading="lazy" onerror="this.classList.add('jhs-is-hidden');this.nextElementSibling.classList.remove('jhs-is-hidden');"><div class="nv-card__empty jhs-is-hidden">无封面</div>`);
                            }
                        }
                        d && n.attr("title", d);
                    }));
                }));
            } catch (i) { clog.warn("获取演员封面失败:", a.actressName, i); }
        }
    }
    async renderNewVideoList() {
        const e = $("#new-video-list-container");
        if (!e.length) return;
        e.html('<div class="jhs-state jhs-state--loading" role="status">加载中...</div>');
        let t;
        try {
            t = await this.getNewVideoFlatList();
        } catch (n) {
            return clog.error(n), void e.html(`<div class="jhs-state jhs-state--error" role="alert">加载失败: ${escapeHtml(n.message)}</div>`);
        }
        if (0 === t.length) return e.html('<div class="jhs-state jhs-state--empty">暂无待鉴定的新作品</div>'),
        void $("#new-video-list-footer").html("");
        this.nvFlatListCache = t, this.nvCurrentPage = 1, this.nvSortBy = $("#nvSortBy").val() || "publishTime_desc";
        const a = new Set;
        for (const i of t) a.add(i.actressName);
        $("#new-video-list-footer").html(`<span>共 <b>${t.length}</b> 个待鉴定番号，涉及 <b>${a.size}</b> 位演员</span>
            <button type="button" class="jhs-btn jhs-btn--soft" id="batchMarkWatched">全部标记已看</button>
            <button type="button" class="jhs-btn jhs-btn--soft" id="batchMarkDownloaded">全部标记已下载</button>`);
        this.nvRenderPage(), this.loadCoverForItems(t).catch((e => clog.warn("封面加载异常:", e)));
        $("#batchMarkWatched").off("click").on("click", (async () => {
            if (!this.nvFlatListCache || 0 === this.nvFlatListCache.length) return;
            utils.q({ clientX: 0, clientY: 0 }, `确认将 ${this.nvFlatListCache.length} 个番号全部标记为已看?`, (async () => {
                const e = this.nvFlatListCache.map((e => ({ carNum: e.carNum, url: `/search?q=${encodeURIComponent(e.carNum)}`, names: e.actressName, actionType: p })));
                try { await storageManager.saveCarList(e), show.ok(`已标记 ${e.length} 个`), this.renderNewVideoList(), this.showNewVideoCount(); } catch (n) { show.error("标记失败: " + n.message); }
            }));
        })), $("#batchMarkDownloaded").off("click").on("click", (async () => {
            if (!this.nvFlatListCache || 0 === this.nvFlatListCache.length) return;
            utils.q({ clientX: 0, clientY: 0 }, `确认将 ${this.nvFlatListCache.length} 个番号全部标记为已下载?`, (async () => {
                const e = this.nvFlatListCache.map((e => ({ carNum: e.carNum, url: `/search?q=${encodeURIComponent(e.carNum)}`, names: e.actressName, actionType: g })));
                try { await storageManager.saveCarList(e), show.ok(`已标记 ${e.length} 个`), this.renderNewVideoList(), this.showNewVideoCount(); } catch (n) { show.error("标记失败: " + n.message); }
            }));
        }));
    }
    nvSortList(e) {
        const t = this.nvSortBy || "publishTime_desc", [n, a] = t.split("_");
        return e.slice().sort(((e, t) => {
            let i = 0;
            switch (n) {
              case "publishTime":
                i = (e.publishTime || "").localeCompare(t.publishTime || "");
                break;
              case "actress":
                i = (e.actressName || "").localeCompare(t.actressName || "");
                break;
              case "carNum":
                i = (e.carNum || "").localeCompare(t.carNum || "");
                break;
              case "voteCount":
                i = (e.voteCount || 0) - (t.voteCount || 0);
                break;
            }
            return "desc" === a ? -i : i;
        }));
    }
    nvRenderPage() {
        const e = this.nvFlatListCache;
        if (!e || 0 === e.length) return;
        const t = this.nvSortList(e), n = this.nvPageSize, a = (this.nvCurrentPage - 1) * n, i = a + n, s = t.slice(a, i), o = Math.ceil(t.length / n), r = this.getBean("OtherSitePlugin").getJavDbUrl().then((r => {
            const l = $("#new-video-list-container");
            let c = "";
            c += '<div id="nv-grid" class="jhs-new-video-grid">';
            for (const n of s) {
                const e = escapeHtml(n.carNum), t = escapeHtml(n.title || n.carNum), a = n.coverUrl ? n.coverUrl.replace("thumbs", "covers") : "", i = n.url || `${r}/search?q=${encodeURIComponent(n.carNum)}`;
                let o = `番号: ${e}\\n演员: ${escapeHtml(n.actressName)}\\n发行: ${n.publishTime || "未知"}`;
                n.voteCount && (o += `\\n评价人数: ${n.voteCount}`);
                const l = n.voteCount ? `<span class="jhs-badge jhs-badge--neutral nv-card__rating">${n.voteCount}人评价</span>` : "";
                c += `<div class="nv-card" data-car="${e}" title="${o}">`;
                c += `<a class="nv-card__link" href="${i}" target="_blank" rel="noopener noreferrer">`;
                c += `<div class="nv-card__cover">`;
                a ? c += `<img class="nv-cover-img" src="${a}" data-full="${a}" loading="lazy" onerror="this.classList.add('jhs-is-hidden');this.nextElementSibling.classList.remove('jhs-is-hidden');">${l}<div class="nv-card__empty jhs-is-hidden">无封面</div>` : c += `<div class="nv-placeholder nv-card__empty">加载中...</div>`;
                c += `</div>`;
                c += `<div class="nv-card__body">`;
                c += `<div class="nv-card__title" title="${e}">${e}</div>`;
                c += `<div class="nv-card__actress" title="${escapeHtml(n.actressName)}">${escapeHtml(n.actressName)}</div>`;
                n.publishTime && (c += `<div class="nv-card__date">${n.publishTime}</div>`);
                c += `</div></a></div>`;
            }
            c += "</div>";
            if (o > 1) {
                c += '<div id="nv-pagination-bar" class="jhs-new-video-pagination">';
                this.nvCurrentPage > 1 && (c += `<button type="button" class="jhs-btn jhs-btn--secondary pagination-btn" data-nvpage="${this.nvCurrentPage - 1}">上一页</button>`);
                let e = Math.max(1, this.nvCurrentPage - 2), n = Math.min(o, e + 4);
                n - e < 4 && (e = Math.max(1, n - 4));
                for (let t = e; t <= n; t++) c += `<button type="button" class="jhs-btn ${t === this.nvCurrentPage ? "jhs-btn--primary is-current" : "jhs-btn--secondary"} pagination-btn" data-nvpage="${t}" ${t === this.nvCurrentPage ? 'aria-current="page"' : ""}>${t}</button>`;
                this.nvCurrentPage < o && (c += `<button type="button" class="jhs-btn jhs-btn--secondary pagination-btn" data-nvpage="${this.nvCurrentPage + 1}">下一页</button>`),
                c += `<span class="jhs-pagination__summary">第 ${this.nvCurrentPage}/${o} 页，共 ${t.length} 条</span>`, c += "</div>";
            }
            l.html(c), l.find(".pagination-btn").off("click").on("click", (e => {
                const n = parseInt($(e.currentTarget).data("nvpage"));
                n >= 1 && n <= o && n !== this.nvCurrentPage && (this.nvCurrentPage = n, this.nvRenderPage(), l.scrollTop(0));
            })), window.imageHoverPreviewObj ? window.imageHoverPreviewObj.bindEvents() : window.imageHoverPreviewObj = new ImageHoverPreview({
                selector: ".nv-cover-img", dataAttribute: "data-full"
            });
        }));
    }
    async editActress(e) {
        const t = e.name, n = e.avatar, a = e.remark || "", i = Array.isArray(e.allName) ? e.allName.join("，") : "", s = Array.isArray(e.newVideoList) ? e.newVideoList.map((e => "string" == typeof e ? e : e.carNum)).join("，") : "", o = e.starId, l = e.actressType || "", c = `\n            <div class="jhs-form-dialog">\n                <div class="jhs-avatar-editor">\n                    <img id="edit-avatar-preview" src="${n}" alt="Avatar Preview" \n                         class="jhs-avatar-editor__preview">\n                    <div class="jhs-form-dialog__body">\n                        <label class="jhs-form-label">头像链接:</label>\n                        <input type="text" id="edit-actress-avatar" value="${n}" \n                               class="jhs-field">\n                       <div class="jhs-toolbar jhs-avatar-editor__actions">\n                            <button type="button" id="search-avatar-btn" \n                                class="jhs-btn jhs-btn--primary">\n                                搜索头像\n                            </button>\n                            <button type="button" id="select-cdn-btn" \n                                class="jhs-btn jhs-btn--secondary">\n                                选择 CDN 源\n                            </button>\n                        </div>\n                    </div>\n                </div>\n                <div class="jhs-form-field">\n                    <label class="jhs-form-label">主名称:</label>\n                    <input type="text" id="edit-actress-name" value="${t}" \n                           class="jhs-field">\n                </div>\n                <div class="jhs-form-field">\n                    <label class="jhs-form-label">所有别名(用逗号隔开):</label>\n                    <textarea id="edit-actress-allname" class="jhs-textarea">${i}</textarea>\n                </div>\n                <div class="jhs-form-field">\n                    <label class="jhs-form-label">演员类别:</label>\n                    <select id="actressType" class="jhs-select-source">\n                        <option value="" ${"" === l ? "selected" : ""}>未知</option>\n                        <option value="censored" ${"censored" === l ? "selected" : ""}>有码</option>\n                        <option value="uncensored" ${"uncensored" === l ? "selected" : ""}>无码</option>\n                    </select>\n                </div>\n                <div class="jhs-form-field">\n                    <label class="jhs-form-label">最新作品(用逗号隔开):</label>\n                    <textarea id="edit-actress-newvideolist" class="jhs-textarea">${s}</textarea>\n                </div>\n                <div class="jhs-form-field">\n                    <label class="jhs-form-label">备注:</label>\n                   <textarea id="edit-remark" class="jhs-textarea">${a}</textarea>\n                </div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: `编辑女优: ${t} (${o})`,
            area: utils.getDialogArea("sm"),
            content: c,
            btn: [ "保存", "取消" ],
            success: (e, t) => {
                JhsSelect.enhance(e);
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
                        const e = at, t = tt.map(((t, n) => `\n        <label class="jhs-option-row" for="cdn-${n}">\n            <input type="radio" id="cdn-${n}" name="cdn-source" value="${n}" ${n === e ? "checked" : ""}>\n            <span>${t.name} ${t.json.includes("jsdelivr") ? "(推荐)" : ""}</span>\n        </label>\n    `)).join(""), n = `\n        <div class="jhs-form-dialog">\n            <p class="jhs-form-dialog__title">请选择头像数据源 (当前: ${tt[e].name}):</p>\n            ${t}\n            <p class="jhs-helper-text">切换源会清除本地缓存的数据，并在下次搜索时重新加载。</p>\n        </div>\n    `;
                        layer.open({
                            type: 1,
                            title: "选择 CDN 源",
                            area: utils.getResponsiveArea([ "400px", "auto" ]),
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
                    await this.renderActressCards();
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
        if (0 === t) return a = '<span class="jhs-pagination__summary">共 0 条记录</span>', void i.html(a);
        n > 1 && t > 5 && (a += '<button class="jhs-btn pagination-btn" data-page="1">首页</button>'),
        n > 1 && (a += `<button class="jhs-btn pagination-btn" data-page="${n - 1}">上一页</button>`);
        let s = Math.max(1, n - Math.floor(2.5)), o = Math.min(t, s + 5 - 1);
        o - s < 4 && (s = Math.max(1, o - 5 + 1));
        for (let r = s; r <= o; r++) {
            a += `<button class="jhs-btn pagination-btn page-number-btn ${r === n ? "active" : ""}" data-page="${r}">${r}</button>`;
        }
        n < t && (a += `<button class="jhs-btn pagination-btn" data-page="${n + 1}">下一页</button>`),
        n < t && t > 5 && (a += `<button class="jhs-btn pagination-btn" data-page="${t}">尾页</button>`),
        a += `<span class="jhs-pagination__summary">共 ${e} 条记录 (第 ${n}/${t} 页)</span>`,
        i.html(a), i.find(".pagination-btn").off("click").on("click", (e => {
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
        const o = s.map(((e, t) => `\n        <div id="wrapper-${t}" class="gfriends-image-item-wrapper">\n            <img alt="" src="${e}" data-url="${e}" class="gfriends-selectable-img" data-wrapper-id="wrapper-${t}" >\n            <div class="gfriends-size-tag" data-size-for="wrapper-${t}">...</div> \n        </div>\n    `)).join(""), r = `\n        <style>\n            /* 保持上一个回答的美化样式 */\n            #gfriends-image-list-container { padding: 15px; height: 100%; box-sizing: border-box; background-color: var(--jhs-surface-2); }\n            #gfriends-prompt { color: var(--jhs-text-muted); font-weight: 500; border-bottom: 1px solid var(--jhs-surface-2); padding-bottom: 10px; }\n            #gfriends-image-list { display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; }\n            .gfriends-image-item-wrapper {\n                width: 160px; height: 225px; /* 增加高度以容纳尺寸标签 */\n                overflow: hidden; border-radius: 6px;\n                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); transition: transform 0.2s ease, box-shadow 0.2s ease;\n                cursor: pointer; position: relative; \n                padding-bottom: 25px; /* 为尺寸标签留出空间 */\n            }\n            .gfriends-selectable-img {\n                width: 100%; height: 200px; /* 固定图片高度 */\n                object-fit: cover; border: 3px solid transparent; \n                border-radius: 6px; transition: border 0.2s ease;\n            }\n            .gfriends-image-item-wrapper:hover {\n                transform: translateY(-4px) scale(1.02);\n                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);\n            }\n            .gfriends-selectable-img.is-selected {\n                border-color: var(--jhs-accent);\n                box-shadow: 0 0 0 3px var(--jhs-accent);\n            }\n            /* 新增：尺寸标签样式 */\n            .gfriends-size-tag {\n                position: absolute;\n                bottom: 0; /* 定位到图片容器底部 */\n                left: 0;\n                right: 0;\n                height: 25px;\n                line-height: 25px;\n                text-align: center;\n                background-color: rgba(0, 0, 0, 0.7); /* 半透明背景 */\n                color: #fff;\n                font-size: 11px;\n                font-weight: bold;\n                border-bottom-left-radius: 6px;\n                border-bottom-right-radius: 6px;\n                user-select: none;\n            }\n        </style>\n        \n        <div id="gfriends-image-list-container">\n            <p id="gfriends-prompt" class="jhs-layout-bd59a2e1">\n                点击图片即可选择（初始共 ${s.length} 张）\n            </p>\n            <div class="jhs-layout-3fefafab">\n                <div id="gfriends-image-list">\n                    ${o}\n                </div>\n            </div>\n        </div>\n    `;
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
