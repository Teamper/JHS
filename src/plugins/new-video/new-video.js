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

function aggregateNewVideoRecords(actresses, carMap, decisions, now = Date.now()) {
    const grouped = new Map;
    for (const actress of actresses) {
        if (!Array.isArray(actress.newVideoList)) continue;
        for (const raw of actress.newVideoList) {
            const item = "object" == typeof raw ? raw : {}, carNum = normalizeCarNum("string" == typeof raw ? raw : raw.carNum);
            if (!carNum) continue;
            const existing = grouped.get(carNum) || { carNum, coverUrl: "", title: "", publishTime: "", actresses: [], starIds: [], categories: new Set, score: 0, voteCount: 0, url: "", isVr: !1 };
            existing.coverUrl ||= item.coverUrl || "", existing.title ||= item.title || "", existing.publishTime = [ existing.publishTime, item.publishTime || "" ].sort().at(-1), existing.score = Math.max(existing.score, Number(item.score) || 0), existing.voteCount = Math.max(existing.voteCount, Number(item.voteCount) || 0), existing.url ||= item.url || "";
            existing.isVr ||= !0 === item.isVr || /(^|[^A-Z])VR([^A-Z]|$)/i.test(`${item.title || ""} ${(item.tags || []).join?.(" ") || ""} ${(item.categories || []).join?.(" ") || ""}`);
            actress.name && !existing.actresses.includes(actress.name) && existing.actresses.push(actress.name), actress.starId && !existing.starIds.includes(actress.starId) && existing.starIds.push(actress.starId), actress.actressType && existing.categories.add(actress.actressType), grouped.set(carNum, existing);
        }
    }
    return [ ...grouped.values() ].map((item => {
        const record = carMap.get(item.carNum), flags = normalizeStateFlags(record?.stateFlags), decision = decisions[item.carNum] || null, decisionState = !decision ? "pending" : "snoozed" === decision.action && decision.until && Date.parse(decision.until) <= now ? "pending" : decision.action;
        return { ...item, actressName: item.actresses.join("、"), starId: item.starIds[0] || "", categories: [ ...item.categories ], flags, decision, decisionState };
    }));
}

class NewVideoPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "currentPage", 1), i(this, "pageSize", 30), i(this, "nvCurrentPage", 1), i(this, "nvPageSize", 60), i(this, "nvFlatListCache", []), i(this, "nvAllItemsMap", new Map), i(this, "nvActressesCache", []), i(this, "nvCarMapCache", new Map), i(this, "nvSortBy", "publishTime_desc"), i(this, "nvSelected", new Set), i(this, "nvDecisionsCache", {}), i(this, "nvCoverCache", new Map), i(this, "nvActorCoverRequests", new Map), i(this, "nvRenderGeneration", 0), i(this, "nvSearchDebounced", null), i(this, "nvInvalidationTimer", null), i(this, "nvWorkspaceReloadPromise", null), i(this, "nvWorkspaceReloadDirty", !1), i(this, "nvWorkspaceMounted", !1), i(this, "nvEventUnsubscribe", null), i(this, "taskStatusUnsubscribe", null), i(this, "nvJavDbUrl", ""), i(this, "nvRuleTime", 8760);
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
                .jhs-new-video-view { flex:0 0 auto; }
                .jhs-new-video-batch { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--jhs-space-2); width:100%; }
                .jhs-new-video-batch__actions { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); }
                .jhs-new-video-batch__more { position:relative; }
                .jhs-new-video-batch__more summary { list-style:none; }
                .jhs-new-video-batch__more summary::-webkit-details-marker { display:none; }
                .jhs-new-video-batch__menu { top:auto; bottom:calc(100% + var(--jhs-space-1)); }
                .jhs-task-status-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-3); }
                .jhs-task-status { padding:var(--jhs-space-2) var(--jhs-space-3); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }
                .jhs-task-status__name { color:var(--jhs-text); font-weight:700; }
                .jhs-task-status__meta { display:block; margin-top:var(--jhs-space-1); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
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
                #gfriends-image-list-container { height:100%; box-sizing:border-box; padding:var(--jhs-space-4); background:var(--jhs-surface-2); }
                #gfriends-prompt { margin:0 0 var(--jhs-space-3); padding-bottom:var(--jhs-space-2); border-bottom:1px solid var(--jhs-border); color:var(--jhs-text-muted); font-weight:600; }
                #gfriends-image-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(144px,1fr)); gap:var(--jhs-space-3); }
                .gfriends-image-item-wrapper { display:grid; grid-template-rows:200px auto; min-height:44px; overflow:hidden; padding:0; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); color:var(--jhs-text); cursor:pointer; }
                .gfriends-image-item-wrapper:hover { border-color:var(--jhs-border-strong); background:var(--jhs-surface-hover); }
                .gfriends-image-item-wrapper:focus-visible { outline:2px solid var(--jhs-focus); outline-offset:2px; }
                .gfriends-image-item-wrapper[aria-pressed="true"] { border-color:var(--jhs-accent); box-shadow:0 0 0 2px var(--jhs-accent-tint); }
                .gfriends-selectable-img { width:100%; height:200px; object-fit:cover; }
                .gfriends-size-tag { min-height:28px; padding:var(--jhs-space-1) var(--jhs-space-2); border-top:1px solid var(--jhs-border); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); line-height:20px; text-align:center; }
                .jhs-form-dialog__body, .jhs-form-field { display:grid; gap:var(--jhs-space-1); }
                .jhs-form-label, .jhs-form-dialog__title { color:var(--jhs-text); font-size:var(--jhs-font-size-sm); font-weight:600; }
                .jhs-form-dialog :where(.jhs-field,.jhs-select,.jhs-textarea) { width:100%; }
                .jhs-form-dialog .jhs-textarea { min-height:60px; overflow-y:hidden; }
                .jhs-option-row { display:flex; align-items:center; gap:var(--jhs-space-2); min-height:36px; }
                #actress-pagination { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:var(--jhs-space-1); }
                @media (max-width:767px) { .jhs-new-video-toolbar { align-items:stretch; flex-direction:column; } .jhs-new-video-toolbar select, .jhs-new-video-toolbar .jhs-btn { min-height:44px; } .jhs-task-status-list { grid-template-columns:1fr; } .page-number-btn { display:none !important; } }
                @media (prefers-reduced-motion:reduce) { .gfriends-image-item-wrapper { transition:none; } }
            </style>
        `;
    }
    async handle() {
        this.nvEventUnsubscribe || (this.nvEventUnsubscribe = jhsEventBus.on("new-video-changed", (() => this.scheduleWorkspaceReload())));
        this.taskStatusUnsubscribe || (this.taskStatusUnsubscribe = jhsEventBus.on("task-status-changed", (() => this.isWorkspaceMounted() && this.renderTaskStatuses())));
        await this.showNewVideoCount();
    }
    isWorkspaceMounted() {
        return this.nvWorkspaceMounted && $(".newVideoToolBox").length > 0;
    }
    scheduleWorkspaceReload() {
        this.nvWorkspaceReloadDirty = !0;
        this.nvInvalidationTimer || (this.nvInvalidationTimer = setTimeout((() => {
            this.nvInvalidationTimer = null, void this.flushWorkspaceReload();
        }), 0));
    }
    async flushWorkspaceReload() {
        if (this.nvWorkspaceReloadPromise) return this.nvWorkspaceReloadPromise;
        return this.nvWorkspaceReloadPromise = (async () => {
            do {
                this.nvWorkspaceReloadDirty = !1, await this.showNewVideoCount();
                this.isWorkspaceMounted() && await this.reloadNewVideoWorkspaceData({ preservePage: !0 });
            } while (this.nvWorkspaceReloadDirty);
        })().catch((error => clog.error("新作品数据刷新失败", error))).finally((() => {
            this.nvWorkspaceReloadPromise = null;
        })), this.nvWorkspaceReloadPromise;
    }
    getPendingNewVideoCount(e, t) {
        return Array.isArray(e?.newVideoList) ? new Set(e.newVideoList.map((item => normalizeCarNum("string" == typeof item ? item : item.carNum))).filter((carNum => carNum && !t.has(carNum) && !this.isDecisionHidden(carNum)))).size : 0;
    }
    isDecisionHidden(carNum) {
        const decision = this.nvDecisionsCache[normalizeCarNum(carNum)];
        if (!decision) return !1;
        return "ignored" === decision.action || "snoozed" === decision.action && (!decision.until || Date.parse(decision.until) > Date.now());
    }
    async getPendingNewVideoTotal() {
        const e = await storageManager.getCarMap(), keys = new Set;
        this.nvDecisionsCache = await stateService.getNewVideoDecisions();
        (await storageManager.getFavoriteActressList()).forEach((actress => Array.isArray(actress.newVideoList) && actress.newVideoList.forEach((item => {
            const carNum = normalizeCarNum("string" == typeof item ? item : item.carNum);
            carNum && !e.has(carNum) && !this.isDecisionHidden(carNum) && keys.add(carNum);
        }))));
        return keys.size;
    }
    async showNewVideoCount() {
        const e = await this.getPendingNewVideoTotal();
        $("#newVideoCount").text(`${e}`);
    }
    async resetBtnTip() {
        const e = this.getBean("TaskPlugin"), t = await storageManager.getSetting(), n = localStorage.getItem(e.lastCheckFavoriteActressTimeKey) || "无", a = t.checkFavoriteActress_IntervalTime, i = localStorage.getItem(e.lastCheckNewVideoTimeKey) || "无", s = t.checkNewVideo_intervalTime;
        $("#checkFavoriteActress").attr("data-tip", `上次完整同步: ${n}; 检测间隔时间: ${a}小时`), $("#checkNewVideo").attr("data-tip", `上次整批检测: ${i}; 检测间隔时间: ${s}小时`);
    }
    async openDialog() {
        this.cleanupNewVideoWorkspace(), this._viewMode = "list" === localStorage.getItem("jhs_newVideoViewMode") ? "list" : "actress", this.currentPage = 1, this.nvCurrentPage = 1, this.nvSelected = new Set, this.nvCoverCache = new Map, this.nvActorCoverRequests = new Map, this.nvRenderGeneration++;
        const e = this.getBean("TaskPlugin"), t = await storageManager.getSetting(), n = localStorage.getItem(e.lastCheckFavoriteActressTimeKey) || "无", a = t.checkFavoriteActress_IntervalTime, i = localStorage.getItem(e.lastCheckNewVideoTimeKey) || "无", s = t.checkNewVideo_intervalTime;
        let o = `
            <div class="newVideoToolBox jhs-ui">
                <div class="jhs-new-video-toolbar" role="toolbar" aria-label="新作品工作区工具">
                    <div class="jhs-new-video-toolbar__actions">
                        <button type="button" class="jhs-btn jhs-btn--secondary" id="checkFavoriteActress" data-tip="上次完整同步: ${n}; 检测间隔时间: ${a}小时">${this.actressSvg}<span>手动同步演员</span></button>
                        <button type="button" class="jhs-btn jhs-btn--secondary" id="checkNewVideo" data-tip="上次整批检测: ${i}; 检测间隔时间: ${s}小时">${this.newSvg}<span>手动检测最新作品</span></button>
                        <button type="button" class="jhs-btn jhs-btn--ghost" id="toSetting">${this.settingSvg}<span>配置</span></button>
                        <span id="checkNewVideoMsg" role="status" aria-live="polite"></span>
                    </div>
                    <div class="jhs-new-video-toolbar__filters">
                        <select id="paramActressType" class="jhs-select-source" aria-label="演员类型"><option value="all" selected>所有</option><option value="uncensored">无码</option><option value="censored">有码</option><option value="">未知</option></select>
                        <input id="nvSearch" class="jhs-field jhs-is-hidden" type="search" placeholder="搜索番号、标题或演员" aria-label="搜索新作品">
                        <select id="nvCategoryFilter" class="jhs-select-source jhs-is-hidden" aria-label="新作品类别"><option value="all" selected>所有类别</option><option value="uncensored">无码</option><option value="censored">有码</option><option value="unknown">未知</option><option value="vr">VR</option></select>
                        <select id="nvStateFilter" class="jhs-select-source jhs-is-hidden" aria-label="作品状态"><option value="all">所有状态</option><option value="pending" selected>待处理</option><option value="favorite">已收藏</option><option value="downloaded">已下载</option><option value="watched">已观看</option><option value="blocked">已屏蔽</option></select>
                        <select id="nvDecisionFilter" class="jhs-select-source jhs-is-hidden" aria-label="新作决策"><option value="pending" selected>待处理</option><option value="ignored">已忽略</option><option value="snoozed">已暂缓</option><option value="all">所有决策</option></select>
                        <select id="paramSortBy" class="jhs-select-source" aria-label="演员排序">
                            <option value="default" selected>默认排序</option><optgroup label="发行时间"><option value="lastPublishTime_desc">发行时间 新→旧</option><option value="lastPublishTime_asc">发行时间 旧→新</option></optgroup><optgroup label="检测时间"><option value="lastCheckTime_desc">检测时间 新→旧</option><option value="lastCheckTime_asc">检测时间 旧→新</option></optgroup><optgroup label="新作品数"><option value="newVideoCount_desc">新作品数 多→少</option><option value="newVideoCount_asc">新作品数 少→多</option></optgroup>
                        </select>
                        <select id="nvSortBy" class="jhs-select-source jhs-is-hidden" aria-label="新作品排序"><option value="publishTime_desc" selected>发行时间 新→旧</option><option value="publishTime_asc">发行时间 旧→新</option><option value="voteCount_desc">评价人数 多→少</option><option value="voteCount_asc">评价人数 少→多</option><option value="actress_asc">演员名 A→Z</option><option value="actress_desc">演员名 Z→A</option><option value="carNum_asc">番号 A→Z</option><option value="carNum_desc">番号 Z→A</option></select>
                        <div class="jhs-segmented jhs-new-video-view" role="tablist" aria-label="新作品视图">
                            <button type="button" class="jhs-btn jhs-segmented__item" id="nvViewActress" role="tab" aria-controls="actress-card-container" data-view="actress">演员视图</button>
                            <button type="button" class="jhs-btn jhs-segmented__item" id="nvViewList" role="tab" aria-controls="new-video-list-container" data-view="list">新作品</button>
                        </div>
                        <button type="button" class="jhs-btn jhs-btn--ghost" id="reLoad">${this.refreshSvg}<span>刷新</span></button>
                    </div>
                </div>
                <div id="jhs-task-status-list" class="jhs-task-status-list" aria-live="polite"></div>
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
                this.nvWorkspaceMounted = !0, JhsSelect.enhance(e), this.bindClick(), this.applyViewMode(), this.renderTaskStatuses(), await this.reloadNewVideoWorkspaceData(), utils.setupEscClose(t);
            },
            end: () => this.cleanupNewVideoWorkspace()
        });
    }
    cleanupNewVideoWorkspace() {
        this.nvSearchDebounced?.cancel?.(), this.nvSearchDebounced = null, this.nvWorkspaceMounted = !1, this.nvRenderGeneration++, this.nvSelected.clear(), this.nvCoverCache = new Map, this.nvActorCoverRequests = new Map,
        this.nvAllItemsMap.clear(), this.nvFlatListCache = [], this.nvActressesCache = [], this.nvCarMapCache = new Map, this.nvDecisionsCache = {}, this.nvCurrentPageItems = [];
    }
    bindClick() {
        const taskPlugin = this.getBean("TaskPlugin");
        $("#reLoad").on("click", (() => {
            void this.reloadNewVideoWorkspaceData(), $("#checkNewVideoMsg").text("");
        })), $("#new-video-list-container").on("click", ".nv-card__link", (async e => {
            const t = $(e.currentTarget).closest(".nv-card").attr("data-car");
            if (!t) return;
            try {
                const enabled = await storageManager.getSetting("autoRemoveNewVideoMarkAfterBrowse", C);
                if (enabled !== _) return;
                await stateService.removeFromNewVideoList([ t ], "browse");
            } catch (n) {
                clog.error("移除新作品标记失败:", n);
            }
        })), $("#toSetting").on("click", (e => {
            this.getBean("SettingPlugin").openSettingDialog("task-panel", (() => {
                $("#setting-checkFavoriteActress").css({
                    border: "1px solid var(--jhs-status-filter)"
                }), $("#setting-checkNewVideo").css({
                    border: "1px solid var(--jhs-status-filter)"
                });
            }));
        }));
        $("#checkFavoriteActress").on("click", (event => {
            void this.runManualTask($(event.currentTarget), "同步中…", (async () => {
                if (!$('a[href*="/users/profile"]').length) return void show.error("未登录 JavDB，同步失败");
                await taskPlugin.checkFavoriteActress(!0);
            }));
        })), $("#checkNewVideo").on("click", (event => {
            void this.runManualTask($(event.currentTarget), "检测中…", (() => taskPlugin.checkNewVideo(!0)));
        })), $("#paramActressType").on("change", (e => {
            this.currentPage = 1, this.nvRenderGeneration++, "actress" === this._viewMode && this.renderActressCards();
        })), $("#paramSortBy").on("change", (e => {
            this.currentPage = 1, this.nvRenderGeneration++, "actress" === this._viewMode && this.renderActressCards();
        })), $("#nvSortBy").on("change", (e => {
            this.nvSortBy = $("#nvSortBy").val(), this.nvCurrentPage = 1, this.nvRenderGeneration++, this.renderNewVideoList();
        })), $("#nvCategoryFilter,#nvStateFilter,#nvDecisionFilter").on("change", (e => {
            this.nvCurrentPage = 1, this.nvRenderGeneration++, "list" === this._viewMode && this.renderNewVideoList();
        })), this.nvSearchDebounced = utils.debounce((() => {
            this.nvCurrentPage = 1, this.nvRenderGeneration++, "list" === this._viewMode && this.renderNewVideoList();
        }), 200), $("#nvSearch").on("input", this.nvSearchDebounced), $(".jhs-new-video-view").on("click", '[role="tab"]', (event => {
            this.setViewMode($(event.currentTarget).data("view"));
        })).on("keydown", '[role="tab"]', (event => {
            if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(event.key)) return;
            event.preventDefault();
            const tabs = $(event.delegateTarget).find('[role="tab"]'), index = tabs.index(event.currentTarget), next = "Home" === event.key ? 0 : "End" === event.key ? tabs.length - 1 : "ArrowRight" === event.key ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
            tabs.eq(next).trigger("click").trigger("focus");
        })), this.bindBatchActions();
    }
    async runManualTask(button, busyLabel, runner) {
        if (button.attr("aria-busy") === "true") return;
        const label = button.find("span").last(), previous = label.text();
        button.attr("aria-busy", "true").prop("disabled", !0), label.text(busyLabel);
        try {
            await navigator.locks.request(this.getBean("TaskPlugin").singleTaskKey, { ifAvailable: !0 }, (async lock => {
                if (!lock) return void show.error("后台任务正在运行，请稍后再试");
                await runner();
            }));
        } catch (error) {
            clog.error("手动任务执行失败", error), this.getBean("TaskPlugin").isNetworkBlocked(error) && show.error(error.message || "任务执行失败");
        } finally {
            button.removeAttr("aria-busy").prop("disabled", !1), label.text(previous), this.renderTaskStatuses();
        }
    }
    setViewMode(mode) {
        if (![ "actress", "list" ].includes(mode) || mode === this._viewMode) return;
        this._viewMode = mode, localStorage.setItem("jhs_newVideoViewMode", mode), "list" === mode ? this.nvCurrentPage = 1 : this.currentPage = 1, this.nvRenderGeneration++, this.applyViewMode(), this.renderCurrentView();
    }
    applyViewMode() {
        const list = "list" === this._viewMode;
        $("#actress-card-container").toggle(!list), $("#actress-pagination").toggle(!list), $("#new-video-list-container").toggle(list), $("#new-video-list-footer").toggle(list), JhsSelect.setVisible("#paramSortBy", !list), JhsSelect.setVisible("#nvSortBy", list), JhsSelect.setVisible("#paramActressType", !list), JhsSelect.setVisible("#nvCategoryFilter", list), JhsSelect.setVisible("#nvStateFilter", list), JhsSelect.setVisible("#nvDecisionFilter", list), $("#nvSearch").toggleClass("jhs-is-hidden", !list), $(".jhs-new-video-view [role='tab']").each(((index, tab) => {
            const active = $(tab).data("view") === this._viewMode;
            $(tab).attr({ "aria-selected": String(active), tabindex: active ? "0" : "-1" }).toggleClass("active", active);
        }));
    }
    renderCurrentView() {
        return "list" === this._viewMode ? this.renderNewVideoList() : this.renderActressCards();
    }
    loadData() {
        this.currentPage = 1;
        return this.reloadNewVideoWorkspaceData();
    }
    async reloadNewVideoWorkspaceData({ preservePage = !1 } = {}) {
        if (!this.isWorkspaceMounted()) return;
        const generation = ++this.nvRenderGeneration, container = "list" === this._viewMode ? $("#new-video-list-container") : $("#actress-card-container");
        renderStateView(container, { type: "loading", title: "加载中" });
        try {
            const [ actresses, carMap, decisions, javDbUrl, ruleTime ] = await Promise.all([ storageManager.getFavoriteActressList(), storageManager.getCarMap(), stateService.getNewVideoDecisions(), this.getBean("OtherSitePlugin").getJavDbUrl(), storageManager.getSetting("checkNewVideo_ruleTime", 8760) ]);
            if (!this.isWorkspaceMounted() || generation !== this.nvRenderGeneration) return;
            this.nvActressesCache = actresses, this.nvCarMapCache = carMap, this.nvDecisionsCache = decisions, this.nvJavDbUrl = javDbUrl, this.nvRuleTime = parseNumberSetting(ruleTime, 8760, { min: 0 });
            const items = aggregateNewVideoRecords(actresses, carMap, decisions), nextMap = new Map;
            items.forEach((item => nextMap.set(normalizeCarNum(item.carNum), { ...item, carNum: normalizeCarNum(item.carNum) }))), this.nvAllItemsMap = nextMap;
            for (const carNum of [ ...this.nvSelected ]) nextMap.has(carNum) || this.nvSelected.delete(carNum);
            preservePage || (this.currentPage = 1, this.nvCurrentPage = 1), await this.renderCurrentView(), this.renderTaskStatuses();
        } catch (error) {
            if (generation !== this.nvRenderGeneration || !this.isWorkspaceMounted()) return;
            clog.error("加载新作品工作区失败", error), renderStateView(container, { type: "error", title: "加载失败", description: error.message || String(error), actionLabel: "重试", onAction: () => this.reloadNewVideoWorkspaceData({ preservePage: !0 }) });
        }
    }
    renderTaskStatuses() {
        const container = $("#jhs-task-status-list");
        if (!container.length) return;
        const taskPlugin = this.getBean("TaskPlugin"), names = { favoriteActress: "演员同步", newVideo: "新作品", blacklist: "黑名单" }, labels = { idle: "正常", running: "运行中", pending: "等待下一次任务检查", due: "待运行" }, format = value => value ? new Date(value).toLocaleString() : "无";
        container.empty(), [ "favoriteActress", "newVideo", "blacklist" ].forEach((name => {
            const snapshot = taskPlugin.getTaskStatusSnapshot(name), item = $('<div class="jhs-task-status"></div>');
            item.append($('<span class="jhs-task-status__name"></span>').text(`${names[name]}：${labels[snapshot.state]}`)), item.append($('<span class="jhs-task-status__meta"></span>').text(`上次完成 ${format(snapshot.completedAt)}；下次检查 ${snapshot.nextAt ? format(snapshot.nextAt) : "立即"}`)), container.append(item);
        }));
    }
    async renderActressCards() {
        const e = $("#actress-card-container");
        if (!e.length) return;
        let t = [ ...this.nvActressesCache ];
        const n = $("#paramActressType").val();
        "all" !== n && (t = t.filter((e => e.actressType === n)));
        const _carSet = this.nvCarMapCache;
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
        totalPages > 0 && this.currentPage > totalPages && (this.currentPage = totalPages);
        const safePageStart = (this.currentPage - 1) * this.pageSize, pageActresses = sortedActresses.slice(safePageStart, safePageStart + this.pageSize), javDbUrl = this.nvJavDbUrl, taskPlugin = this.getBean("TaskPlugin"), ruleTime = this.nvRuleTime;
        if (0 === pageActresses.length) {
            renderStateView(e, { type: "empty", title: this.nvActressesCache.length ? "没有符合当前筛选条件的演员" : "暂无收藏演员" });
            return void this.renderPagination(totalCount, totalPages);
        }
        const cards = pageActresses.map((actress => {
            const allNames = Array.isArray(actress.allName) ? actress.allName.join("，") : "";
            const name = String(actress.name || ""), remark = String(actress.remark || ""), starId = String(actress.starId || "");
            const newVideoCount = this.getPendingNewVideoCount(actress, _carSet), latestPublishTime = actress.lastPublishTime || "";
            const profileUrl = normalizeHttpUrl(`/actors/${encodeURIComponent(starId)}?t=d`, javDbUrl), avatarUrl = normalizeHttpUrl(actress.avatar, javDbUrl) || "https://c0.jdbstatic.com/images/actor_unknow.jpg";
            const isPaused = shouldSkipStopped(latestPublishTime, ruleTime);
            let typeLabel = "未知", typeClass = "is-unknown";
            actress.actressType === A ? (typeLabel = "无码", typeClass = "is-uncensored") : actress.actressType === D && (typeLabel = "有码", typeClass = "is-censored");
            const publishText = String(latestPublishTime || "暂无记录"), noteText = isPaused ? `停更 ${ruleTime / 24 / 365} 年以上，下轮任务不再检测` : remark || "暂无备注";
            const card = $('<article class="actress-card"></article>').toggleClass("is-paused", isPaused).attr("data-starId", starId), badges = $('<div class="actress-card__badges"></div>');
            badges.append($("<span class=\"jhs-badge jhs-badge--soft card-new-count-tag\"></span>").attr("data-tip", `最新作品数量: ${newVideoCount}`).text(`${newVideoCount} 新`), $("<span class=\"jhs-badge card-tag\"></span>").addClass(typeClass).text(typeLabel)), isPaused && badges.append('<span class="jhs-badge jhs-badge--neutral">停更</span>');
            const profile = $('<a class="actress-card__profile" target="_blank" rel="noopener noreferrer"></a>').attr("href", profileUrl || "#"), identity = $("<span></span>").append($("<span class=\"actress-card-name\"></span>").text(name), $("<span class=\"actress-card-allname\"></span>").attr("title", allNames).text(allNames || "暂无别名"));
            profile.append($("<img class=\"actress-card-avatar\" loading=\"lazy\">").attr({ src: avatarUrl, alt: allNames }), identity);
            const meta = $('<dl class="actress-card__meta"></dl>').append($("<div class=\"actress-card__meta-row\"><dt>最近作品</dt></div>").append($("<dd></dd>").attr("title", publishText).text(publishText)), $('<div class="actress-card__meta-row"><dt>上次检测</dt></div>').append($("<dd></dd>").text(String(actress.lastCheckTime || "暂无记录")))), actions = $('<div class="actress-card__actions"></div>');
            const check = $('<button type="button" class="jhs-btn jhs-btn--secondary btn-check-actress"><span>重新检测</span></button>').attr("data-starId", starId).prepend(this.checkSvg), remove = $('<button type="button" class="jhs-btn jhs-btn--icon jhs-btn--ghost btn-delete-actress" title="取消收藏"></button>').attr({ "aria-label": `取消收藏 ${name}`, "data-starId": starId }).append(this.deleteSvg), edit = $('<button type="button" class="jhs-btn jhs-btn--ghost btn-edit-actress" role="menuitem"><span>编辑资料</span></button>').attr("data-starId", starId).prepend(this.editSvg);
            actions.append(check, remove, $('<details class="actress-card__menu"><summary class="jhs-btn jhs-btn--icon jhs-btn--ghost" aria-label="更多操作" title="更多操作">•••</summary><div class="actress-card__menu-popover" role="menu"></div></details>').find(".actress-card__menu-popover").append(edit).end());
            return card.append(badges, profile, meta, $("<p class=\"actress-card__note\"></p>").attr("title", noteText).text(noteText), actions)[0];
        }));
        e.empty().append(cards), $(".btn-delete-actress").off("click").on("click", (e => {
            e.preventDefault();
            const t = $(e.currentTarget).attr("data-starId"), n = sortedActresses.find((e => e.starId === t));
            utils.q(e, `是否取消收藏 ${n.name}?`, (async () => {
                let e = `${await this.getBean("OtherSitePlugin").getJavDbUrl()}/actors/${t}/uncollect`;
                const n = document.querySelector("meta[name=csrf-token]").content, a = await gmHttp.post(e, null, {
                    "x-csrf-token": n
                });
                a.includes("removeClass") ? (await storageManager.removeFavoriteActress(t), await jhsEventBus.emit("new-video-changed", { reason: "favorite-actress-removed" })) : (show.error("移除失败"),
                clog.error("移除失败,返回值:", a));
            }));
        })), $(".btn-edit-actress").off("click").on("click", (e => {
            e.preventDefault();
            const t = $(e.currentTarget).attr("data-starId"), n = sortedActresses.find((e => e.starId === t));
            n ? this.editActress(n) : show.error(`未找到 starId 为 ${t} 的女优记录。`);
        })), $(".btn-check-actress").off("click").on("click", (e => {
            e.preventDefault();
            const button = $(e.currentTarget), starId = button.attr("data-starId"), actress = sortedActresses.find((item => item.starId === starId));
            void this.runManualTask(button, "检测中…", (() => taskPlugin.checkOneNewVideo(actress)));
        })), $(".actress-card__menu").on("keydown", (event => {
            if ("Escape" !== event.key) return;
            event.preventDefault();
            const details = $(event.currentTarget);
            details.prop("open", !1).find("summary").trigger("focus");
        })).on("click", "[role='menuitem']", (event => {
            $(event.currentTarget).closest("details").prop("open", !1);
        })), this.renderPagination(totalCount, totalPages);
    }
    async getNewVideoFlatList() {
        const category = $("#nvCategoryFilter").val() || "all", stateFilter = $("#nvStateFilter").val() || "pending", decisionFilter = $("#nvDecisionFilter").val() || "pending", query = String($("#nvSearch").val() || "").trim().toUpperCase();
        return [ ...this.nvAllItemsMap.values() ].filter((item => {
            const categoryMatch = "all" === category || "vr" === category ? "all" === category || item.isVr : "unknown" === category ? 0 === item.categories.length : item.categories.includes(category);
            const stateMatch = "all" === stateFilter || "pending" === stateFilter ? "all" === stateFilter || !hasAnyState(item.flags) : !!item.flags[stateFilter];
            const decisionMatch = "all" === decisionFilter || item.decisionState === decisionFilter;
            const searchMatch = !query || `${item.carNum} ${item.title} ${item.actressName}`.toUpperCase().includes(query);
            return categoryMatch && stateMatch && decisionMatch && searchMatch;
        })).sort(((left, right) => (right.publishTime || "").localeCompare(left.publishTime || "")));
    }
    getActorCoverRequest(starId, requestMap) {
        const existing = requestMap.get(starId);
        if (existing) return existing;
        const request = gmHttp.get(`${this.nvJavDbUrl}/actors/${starId}?t=d`).then((html => {
            const page = utils.htmlTo$dom(html), covers = new Map;
            page.find(".movie-list .item").each(((index, element) => {
                const item = $(element), rawCarNum = item.find(".video-title strong").text().trim(), carNum = normalizeCarNum(rawCarNum), rawCover = item.find("img").attr("src") || "";
                if (!carNum || !rawCover) return;
                const coverUrl = new URL(rawCover, this.nvJavDbUrl).href.replace("thumbs", "covers"), title = item.find(".video-title").text().replace(rawCarNum, "").trim();
                covers.set(carNum, { coverUrl, title });
            }));
            return covers;
        })).finally((() => {
            requestMap.get(starId) === request && requestMap.delete(starId);
        }));
        return requestMap.set(starId, request), request;
    }
    async loadCoverForItems(items, generation = this.nvRenderGeneration) {
        return this.hydrateVisibleCovers(items, generation);
    }
    async hydrateVisibleCovers(items, generation) {
        const coverCache = this.nvCoverCache, requestMap = this.nvActorCoverRequests, starIds = [ ...new Set(items.filter((item => !item.coverUrl && !coverCache.has(normalizeCarNum(item.carNum)) && item.starId)).map((item => item.starId))) ];
        await mapLimit(starIds, 3, (async starId => {
            try {
                const covers = await this.getActorCoverRequest(starId, requestMap);
                if (generation !== this.nvRenderGeneration || coverCache !== this.nvCoverCache || !this.isWorkspaceMounted()) return;
                covers.forEach(((value, carNum) => {
                    coverCache.set(normalizeCarNum(carNum), value.coverUrl);
                    const card = $(".nv-card").filter(((_, element) => normalizeCarNum($(element).attr("data-car")) === normalizeCarNum(carNum)));
                    if (!card.length) return;
                    const image = $('<img class="nv-cover-img" loading="lazy">').attr({ src: value.coverUrl, "data-full": value.coverUrl }).on("error", (function() {
                        $(this).addClass("jhs-is-hidden").siblings(".nv-card__empty").removeClass("jhs-is-hidden");
                    }));
                    card.find(".nv-placeholder").replaceWith(image), card.find(".nv-card__empty").addClass("jhs-is-hidden"), value.title && card.attr("title", value.title);
                }));
                window.imageHoverPreviewObj?.bindEvents?.();
            } catch (error) {
                clog.warn(`获取演员封面失败: ${starId}`, error);
            }
        }));
    }
    async renderNewVideoList() {
        const container = $("#new-video-list-container"), generation = this.nvRenderGeneration;
        if (!container.length) return;
        const items = await this.getNewVideoFlatList();
        if (generation !== this.nvRenderGeneration || !this.isWorkspaceMounted()) return;
        this.nvFlatListCache = items, this.nvSortBy = $("#nvSortBy").val() || this.nvSortBy;
        const totalPages = Math.ceil(items.length / this.nvPageSize);
        this.nvCurrentPage = totalPages ? Math.min(this.nvCurrentPage, totalPages) : 1;
        if (!items.length) {
            const query = String($("#nvSearch").val() || "").trim(), filtered = [ "nvCategoryFilter", "nvStateFilter", "nvDecisionFilter" ].some((id => $("#" + id).val() !== ("nvCategoryFilter" === id ? "all" : "pending")));
            if (!this.nvAllItemsMap.size) renderStateView(container, { type: "empty", title: "暂无新作品记录" }); else if (query) renderStateView(container, { type: "empty", title: `没有找到“${query}”的作品`, actionLabel: "清除搜索", onAction: () => {
                $("#nvSearch").val(""), this.nvCurrentPage = 1, this.nvRenderGeneration++, this.renderNewVideoList();
            } }); else if (filtered) renderStateView(container, { type: "empty", title: "没有符合当前筛选条件的作品", actionLabel: "清除筛选", onAction: () => {
                JhsSelect.setValue("#nvCategoryFilter", "all", !1), JhsSelect.setValue("#nvStateFilter", "pending", !1), JhsSelect.setValue("#nvDecisionFilter", "pending", !1), this.nvCurrentPage = 1, this.nvRenderGeneration++, this.renderNewVideoList();
            } }); else renderStateView(container, { type: "empty", title: "暂无待处理的新作品" });
            return void this.renderBatchBar();
        }
        this.nvRenderPage(generation), this.renderBatchBar();
    }
    selectedItems() {
        return [ ...this.nvSelected ].map((carNum => this.nvAllItemsMap.get(normalizeCarNum(carNum)))).filter(Boolean);
    }
    applyProcessedSelection(result) {
        (result?.changed || []).map(normalizeCarNum).filter(Boolean).forEach((carNum => this.nvSelected.delete(carNum))), this.renderBatchBar();
    }
    async runBatchMutation(mutate, successLabel) {
        const items = this.selectedItems();
        if (!items.length) return void show.info("请先选择作品");
        try {
            const result = await mutate(items);
            this.applyProcessedSelection(result), result?.changed?.length ? show.ok(`${successLabel} ${result.changed.length} 个番号`) : show.info("没有需要更新的项目");
        } catch (error) {
            clog.error("批量操作失败", error), show.error(`批量操作失败: ${error.message || error}`);
        }
    }
    bindBatchActions() {
        const footer = $("#new-video-list-footer");
        footer.off(".jhsNvBatch").on("click.jhsNvBatch", "#nvSelectPage", (() => {
            (this.nvCurrentPageItems || []).forEach((item => this.nvSelected.add(normalizeCarNum(item.carNum)))), $("#new-video-list-container .nv-select").prop("checked", !0), this.renderBatchBar();
        })).on("click.jhsNvBatch", "#nvClearSelection", (() => {
            this.nvSelected.clear(), $("#new-video-list-container .nv-select").prop("checked", !1), this.renderBatchBar();
        })).on("click.jhsNvBatch", "#batchMarkFavorite,#batchMarkWatched,#batchMarkDownloaded", (event => {
            const flag = { batchMarkFavorite: "favorite", batchMarkWatched: "watched", batchMarkDownloaded: "downloaded" }[event.currentTarget.id];
            void this.runBatchMutation((items => stateService.patch(items.map((item => item.carNum)), { [flag]: !0 }, { type: "new-video-batch-state", records: items.map((item => ({ carNum: item.carNum, url: item.url || `/search?q=${encodeURIComponent(item.carNum)}`, names: item.actressName, publishTime: item.publishTime }))) })), "已处理");
        })).on("click.jhsNvBatch", "#batchIgnore", (() => void this.runBatchMutation((items => stateService.setNewVideoDecision(items.map((item => item.carNum)), "ignored")), "已忽略"))).on("click.jhsNvBatch", "#batchSnooze", (() => void this.runBatchMutation((items => stateService.setNewVideoDecision(items.map((item => item.carNum)), "snoozed", new Date(Date.now() + 7 * 864e5).toISOString())), "已暂缓"))).on("click.jhsNvBatch", "#batchRestore", (() => void this.runBatchMutation((items => stateService.setNewVideoDecision(items.map((item => item.carNum)), null)), "已恢复"))).on("click.jhsNvBatch", "#batchRemoveFromNewVideo", (event => {
            const items = this.selectedItems();
            items.length && utils.q(event, `确认将 ${items.length} 个作品从新作列表移除？<br>不会删除作品状态记录。`, (() => void this.runBatchMutation((selected => stateService.removeFromNewVideoList(selected.map((item => item.carNum)), "manual")), "已移除")));
        }));
    }
    renderBatchBar() {
        const footer = $("#new-video-list-footer");
        if (!footer.length) return;
        const actresses = new Set(this.nvFlatListCache.flatMap((item => item.actresses || [ item.actressName ])).filter(Boolean)), selected = this.nvSelected.size, visibleSelected = this.nvFlatListCache.filter((item => this.nvSelected.has(normalizeCarNum(item.carNum)))).length;
        if (!selected) return void footer.html(`<div class="jhs-new-video-batch"><span>共 <b>${this.nvFlatListCache.length}</b> 个番号，涉及 <b>${actresses.size}</b> 位演员</span><button type="button" class="jhs-btn jhs-btn--secondary" id="nvSelectPage">全选当前页</button></div>`);
        footer.html(`<div class="jhs-new-video-batch"><span>已选择 <b>${selected}</b> 项${visibleSelected !== selected ? `，当前结果中 ${visibleSelected} 项` : ""}</span><div class="jhs-new-video-batch__actions"><button type="button" class="jhs-btn jhs-btn--secondary" id="batchMarkFavorite">收藏</button><button type="button" class="jhs-btn jhs-btn--secondary" id="batchMarkWatched">已看</button><button type="button" class="jhs-btn jhs-btn--secondary" id="batchMarkDownloaded">已下载</button><details class="jhs-new-video-batch__more"><summary class="jhs-btn jhs-btn--ghost">更多 ▾</summary><div class="jhs-popover jhs-new-video-batch__menu is-open" role="menu"><button type="button" class="jhs-btn jhs-btn--ghost" role="menuitem" id="batchIgnore">忽略</button><button type="button" class="jhs-btn jhs-btn--ghost" role="menuitem" id="batchSnooze">暂缓 7 天</button><button type="button" class="jhs-btn jhs-btn--ghost" role="menuitem" id="batchRestore">恢复</button><button type="button" class="jhs-btn jhs-btn--danger" role="menuitem" id="batchRemoveFromNewVideo">从新作列表移除</button></div></details><button type="button" class="jhs-btn jhs-btn--ghost" id="nvClearSelection">取消选择</button></div></div>`);
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
    nvRenderPage(generation = this.nvRenderGeneration) {
        const e = this.nvFlatListCache;
        if (!e || 0 === e.length) return;
        const t = this.nvSortList(e), n = this.nvPageSize, a = (this.nvCurrentPage - 1) * n, i = a + n, s = t.slice(a, i), o = Math.ceil(t.length / n), r = this.nvJavDbUrl;
        this.nvCurrentPageItems = s;
        if (generation !== this.nvRenderGeneration) return;
            const l = $("#new-video-list-container");
            let c = "";
            c += '<div id="nv-grid" class="jhs-new-video-grid">';
            for (const n of s) {
                const key = normalizeCarNum(n.carNum), e = escapeHtml(key), t = escapeHtml(n.title || key), cachedCover = this.nvCoverCache.get(key), a = escapeHtml((cachedCover || n.coverUrl || "").replace("thumbs", "covers")), i = escapeHtml(n.url || `${r}/search?q=${encodeURIComponent(key)}`);
                let o = `番号: ${e}\\n演员: ${escapeHtml(n.actressName)}\\n发行: ${n.publishTime || "未知"}`;
                n.voteCount && (o += `\\n评价人数: ${n.voteCount}`);
                const l = n.voteCount ? `<span class="jhs-badge jhs-badge--neutral nv-card__rating">${n.voteCount}人评价</span>` : "";
                c += `<div class="nv-card" data-car="${e}" title="${o}"><label class="jhs-option-row"><input type="checkbox" class="nv-select" value="${e}" ${this.nvSelected.has(key) ? "checked" : ""}><span>选择</span></label>`;
                c += `<a class="nv-card__link" href="${i}" target="_blank" rel="noopener noreferrer">`;
                c += `<div class="nv-card__cover">`;
                a ? c += `<img class="nv-cover-img" src="${a}" data-full="${a}" loading="lazy" onerror="this.classList.add('jhs-is-hidden');this.nextElementSibling.classList.remove('jhs-is-hidden');">${l}<div class="nv-card__empty jhs-is-hidden">无封面</div>` : c += `<div class="nv-placeholder nv-card__empty">加载中...</div>`;
                c += `</div>`;
                c += `<div class="nv-card__body">`;
                c += `<div class="nv-card__title" title="${e}">${e}</div>`;
                c += `<div class="nv-card__actress" title="${escapeHtml(n.actressName)}">${escapeHtml(n.actressName)}</div>`;
                n.publishTime && (c += `<div class="nv-card__date">${n.publishTime}</div>`);
                n.decisionState && "pending" !== n.decisionState && (c += `<span class="jhs-badge jhs-badge--neutral">${"ignored" === n.decisionState ? "已忽略" : "已暂缓"}</span>`), c += `</div></a></div>`;
            }
            c += "</div>";
            if (o > 1) {
                c += '<div id="nv-pagination-bar" class="jhs-new-video-pagination">';
                this.nvCurrentPage > 1 && (c += `<button type="button" class="jhs-btn jhs-btn--secondary pagination-btn" data-nvpage="${this.nvCurrentPage - 1}">上一页</button>`);
                let e = Math.max(1, this.nvCurrentPage - 2), n = Math.min(o, e + 4);
                n - e < 4 && (e = Math.max(1, n - 4));
                for (let t = e; t <= n; t++) c += `<button type="button" class="jhs-btn jhs-btn--secondary ${t === this.nvCurrentPage ? "is-current" : ""} pagination-btn" data-nvpage="${t}" ${t === this.nvCurrentPage ? 'aria-current="page"' : ""}>${t}</button>`;
                this.nvCurrentPage < o && (c += `<button type="button" class="jhs-btn jhs-btn--secondary pagination-btn" data-nvpage="${this.nvCurrentPage + 1}">下一页</button>`),
                c += `<span class="jhs-pagination__summary">第 ${this.nvCurrentPage}/${o} 页，共 ${t.length} 条</span>`, c += "</div>";
            }
            l.html(c), l.find(".nv-cover-img").on("error", (function() { $(this).addClass("jhs-is-hidden").siblings(".nv-card__empty").removeClass("jhs-is-hidden"); })), l.find(".nv-select").on("change", (event => { const carNum = normalizeCarNum(event.currentTarget.value); event.currentTarget.checked ? this.nvSelected.add(carNum) : this.nvSelected.delete(carNum), this.renderBatchBar(); })), l.find(".pagination-btn").off("click").on("click", (e => {
                const n = parseInt($(e.currentTarget).data("nvpage"));
                n >= 1 && n <= o && n !== this.nvCurrentPage && (this.nvCurrentPage = n, this.nvRenderGeneration++, this.nvRenderPage(this.nvRenderGeneration), this.renderBatchBar(), l.scrollTop(0));
            })), window.imageHoverPreviewObj ? window.imageHoverPreviewObj.bindEvents() : window.imageHoverPreviewObj = new ImageHoverPreview({
                selector: ".nv-cover-img", dataAttribute: "data-full"
            }), void this.hydrateVisibleCovers(s, generation);
    }
    async editActress(e) {
        const t = String(e.name || ""), n = normalizeHttpUrl(e.avatar, this.nvJavDbUrl) || "", a = String(e.remark || ""), i = Array.isArray(e.allName) ? e.allName.join("，") : "", s = Array.isArray(e.newVideoList) ? e.newVideoList.map((e => "string" == typeof e ? e : e.carNum)).join("，") : "", o = String(e.starId || ""), l = e.actressType || "", safe = value => escapeHtml(String(value || "")), c = `\n            <div class="jhs-form-dialog">\n                <div class="jhs-avatar-editor">\n                    <img id="edit-avatar-preview" src="${safe(n)}" alt="Avatar Preview" \n                         class="jhs-avatar-editor__preview">\n                    <div class="jhs-form-dialog__body">\n                        <label class="jhs-form-label">头像链接:</label>\n                        <input type="text" id="edit-actress-avatar" value="${safe(n)}" \n                               class="jhs-field">\n                       <div class="jhs-toolbar jhs-avatar-editor__actions">\n                            <button type="button" id="search-avatar-btn" \n                                class="jhs-btn jhs-btn--secondary">\n                                搜索头像\n                            </button>\n                            <button type="button" id="select-cdn-btn" \n                                class="jhs-btn jhs-btn--secondary">\n                                选择 CDN 源\n                            </button>\n                        </div>\n                    </div>\n                </div>\n                <div class="jhs-form-field">\n                    <label class="jhs-form-label">主名称:</label>\n                    <input type="text" id="edit-actress-name" value="${safe(t)}" \n                           class="jhs-field">\n                </div>\n                <div class="jhs-form-field">\n                    <label class="jhs-form-label">所有别名(用逗号隔开):</label>\n                    <textarea id="edit-actress-allname" class="jhs-textarea">${safe(i)}</textarea>\n                </div>\n                <div class="jhs-form-field">\n                    <label class="jhs-form-label">演员类别:</label>\n                    <select id="actressType" class="jhs-select-source">\n                        <option value="" ${"" === l ? "selected" : ""}>未知</option>\n                        <option value="censored" ${"censored" === l ? "selected" : ""}>有码</option>\n                        <option value="uncensored" ${"uncensored" === l ? "selected" : ""}>无码</option>\n                    </select>\n                </div>\n                <div class="jhs-form-field">\n                    <label class="jhs-form-label">最新作品(用逗号隔开):</label>\n                    <textarea id="edit-actress-newvideolist" class="jhs-textarea">${safe(s)}</textarea>\n                </div>\n                <div class="jhs-form-field">\n                    <label class="jhs-form-label">备注:</label>\n                   <textarea id="edit-remark" class="jhs-textarea">${safe(a)}</textarea>\n                </div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: `编辑女优: ${safe(t)} (${safe(o)})`,
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
                    await jhsEventBus.emit("new-video-changed", { reason: "favorite-actress-edited" });
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
        n > 1 && t > 5 && (a += '<button type="button" class="jhs-btn pagination-btn" data-page="1">首页</button>'),
        n > 1 && (a += `<button type="button" class="jhs-btn pagination-btn" data-page="${n - 1}">上一页</button>`);
        let s = Math.max(1, n - Math.floor(2.5)), o = Math.min(t, s + 5 - 1);
        o - s < 4 && (s = Math.max(1, o - 5 + 1));
        for (let r = s; r <= o; r++) {
            a += `<button type="button" class="jhs-btn pagination-btn page-number-btn ${r === n ? "active" : ""}" data-page="${r}" ${r === n ? 'aria-current="page"' : ""}>${r}</button>`;
        }
        n < t && (a += `<button type="button" class="jhs-btn pagination-btn" data-page="${n + 1}">下一页</button>`),
        n < t && t > 5 && (a += `<button type="button" class="jhs-btn pagination-btn" data-page="${t}">尾页</button>`),
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
        const r = $('<div id="gfriends-image-list-container"><p id="gfriends-prompt"></p><div id="gfriends-image-list" role="group" aria-label="头像候选"></div></div>');
        r.find("#gfriends-prompt").text(`点击图片即可选择（初始共 ${s.length} 张）`);
        const avatarList = r.find("#gfriends-image-list");
        s.forEach(((url, index) => {
            const candidate = $('<button type="button" class="jhs-btn gfriends-image-item-wrapper" aria-pressed="false"></button>').attr({ "data-url": url, "aria-label": `选择第 ${index + 1} 张头像` });
            candidate.append($("<img class=\"gfriends-selectable-img\" alt=\"\">").attr("src", url)), candidate.append($('<span class="gfriends-size-tag">载入中</span>')), avatarList.append(candidate);
        }));
        let l = 0;
        layer.open({
            type: 1,
            title: `选择女优头像 (${s.length} 张)`,
            area: utils.getResponsiveArea([ "900px", "85%" ]),
            content: r[0],
            btn: [ "关闭" ],
            success: (e, t) => {
                const n = $(e), a = n.find(".gfriends-selectable-img"), i = n.find("#gfriends-prompt"), candidates = n.find(".gfriends-image-item-wrapper");
                a.each((function() {
                    const image = $(this), wrapper = image.closest(".gfriends-image-item-wrapper"), size = wrapper.find(".gfriends-size-tag");
                    image.on("load", (function() {
                        size.text(`${this.naturalWidth} x ${this.naturalHeight}`);
                    })), image.on("error", (function() {
                        wrapper.remove(), l++;
                        const e = s.length - l;
                        i.text(`点击图片即可选择（已移除 ${l} 张错误图片，剩余 ${e} 张）`), 0 === e && (show.error("所有搜索到的头像链接均已失效，无法选择。"),
                        layer.close(t));
                    })), this.complete && (this.naturalWidth > 0 ? image.trigger("load") : image.trigger("error"));
                })), candidates.on("click", (function() {
                    const candidate = $(this), url = candidate.attr("data-url");
                    $("#edit-actress-avatar").val(url), $("#edit-avatar-preview").attr("src", url), candidates.attr("aria-pressed", "false"),
                    candidate.attr("aria-pressed", "true"), setTimeout((() => {
                        layer.close(t);
                    }), 150);
                })), utils.setupEscClose(t);
            }
        });
    }
}
