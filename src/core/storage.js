e = new WeakSet, t = async function(e, t, n) {
    let a;
    if (Array.isArray(e)) a = [ ...e ]; else {
        if (a = await this.forage.getItem(t) || [], a.includes(e)) {
            const t = `${e} ${n}已存在`;
            throw show.error(t), new Error(t);
        }
        a.push(e);
    }
    return await this._setItemAndInvalidate(t, a), a;
};

class StorageManager {
    constructor() {
        var t, s, o;
        if (t = this, (s = e).has(t) ? a("Cannot add the same private member more than once") : s instanceof WeakSet ? s.add(t) : s.set(t, o),
        i(this, "car_list_key", "car_list"), i(this, "filter_keyword_title_key", "filter_keyword_title"),
        i(this, "filter_keyword_review_key", "filter_keyword_review"), i(this, "setting_key", "setting"),
        i(this, "blacklist_key", "blacklist"), i(this, "blacklist_car_list_key", "blacklist_car_list"),
        i(this, "third_party_cache_key", "third_party_ttl_cache"),
        i(this, "favorite_actresses_key", "favorite_actresses"), i(this, "highlighted_tags_key", "highlighted_tags"),
        i(this, "_actressLock", Promise.resolve()), i(this, "forage", localforage.createInstance({
            driver: localforage.INDEXEDDB,
            name: "JAV-JHS",
            version: 1,
            storeName: "appData"
        })), i(this, "cacheCarList", null), i(this, "cacheBlacklist", null),
        i(this, "cacheTitleFilterKeyword", null), i(this, "cacheFavoriteActresses", null),
        i(this, "cache_filter_actor_actress_car_list", null), i(this, "cacheSettingObj", null),
        i(this, "cacheCarMap", null), i(this, "cacheStatusMap", null),
        i(this, "cacheBlacklistMap", null),
        i(this, "_pendingReads", new Map()), i(this, "_cacheGenerations", new Map()),
        i(this, "_cacheStats", { hits: 0, misses: 0 }),
        StorageManager.instance) throw new Error("StorageManager已被实例化过了!");
        StorageManager.instance = this;
    }
    async getDataVersion() { return await this.forage.getItem("data_version") || 0; }
    async setDataVersion(e) { await this.forage.setItem("data_version", e); }
    _getCacheGeneration(e) { return this._cacheGenerations.get(e) || 0; }
    _invalidateRead(e) {
        this._cacheGenerations.set(e, this._getCacheGeneration(e) + 1);
        this._pendingReads.delete(e);
    }
    /** 合并同一存储键的并发读取，并阻止失效前的旧读取回填缓存。 */
    async _readCached(e, t, n) {
        if (null !== this[e]) return this[e];
        const a = this._pendingReads.get(t);
        if (a) return a;
        const i = this._getCacheGeneration(t), s = this.forage.getItem(t).then((a) => {
            const s = a || n;
            return i === this._getCacheGeneration(t) && null === this[e] && (this[e] = s), s;
        }).finally(() => {
            this._pendingReads.get(t) === s && this._pendingReads.delete(t);
        });
        return this._pendingReads.set(t, s), s;
    }
    _invalidateCache(e = null) {
        const t = [ this.car_list_key, this.blacklist_key, this.filter_keyword_title_key, this.favorite_actresses_key, this.blacklist_car_list_key, this.setting_key ];
        (null === e ? t : t.includes(e) ? [ e ] : []).forEach((e => this._invalidateRead(e)));
        (!e || e === this.car_list_key) && (this.cacheCarList = null, this.cacheCarMap = null, this.cacheStatusMap = null);
        (!e || e === this.blacklist_key) && (this.cacheBlacklist = null, this.cacheBlacklistMap = null);
        (!e || e === this.filter_keyword_title_key) && (this.cacheTitleFilterKeyword = null);
        (!e || e === this.favorite_actresses_key) && (this.cacheFavoriteActresses = null);
        (!e || e === this.blacklist_car_list_key) && (this.cache_filter_actor_actress_car_list = null);
        (!e || e === this.setting_key) && (this.cacheSettingObj = null);
    }
    async _setItemAndInvalidate(e, t) {
        await this.forage.setItem(e, t);
        this._invalidateCache(e);
    }
    async withActressLock(fn) {
        let release;
        const lock = new Promise(r => release = r);
        const prev = this._actressLock;
        this._actressLock = this._actressLock.then(() => lock);
        await prev;
        try { return await fn(); } finally { release(); }
    }
    async _rawUpdateFavoriteActress(e) {
        const t = await this.getFavoriteActressList();
        const {starId: n, name: a, allName: i, avatar: s, lastCheckTime: o, newVideoList: r, lastPublishTime: l, actressType: c, remark: d} = e;
        if (!n) throw new Error("缺失starId");
        let h = t.find((e => e.starId === n));
        if (!h) return clog.error("未找到演员信息", n, a), !1;
        a && (h.name = a), i && (h.allName = i), s && (h.avatar = s), null != c && (h.actressType = c),
        o && (h.lastCheckTime = o), r && (h.newVideoList = r), l && (h.lastPublishTime = l),
        d && (h.remark = d), h.updateDate = utils.getNowStr(), await this._setItemAndInvalidate(this.favorite_actresses_key, t);
        return true;
    }
    async getCarList() {
        return this._readCached("cacheCarList", this.car_list_key, []);
    }
    async getCarMap() {
        if (null === this.cacheCarMap) {
            const e = await this.getCarList();
            this.cacheCarMap = createIndexedMap(e, "carNum");
        }
        return this.cacheCarMap;
    }
    async getStatusMap() {
        if (null === this.cacheStatusMap) {
            const e = await this.getCarList();
            this.cacheStatusMap = createStatusMap(e);
        }
        return this.cacheStatusMap;
    }
    async getCar(e) {
        return (await this.getCarMap()).get(e);
    }
    _saveSingleCar(e, t) {
        let {carNum: n, url: a, names: i, actionType: s, publishTime: o, starId: r} = e;
        if (!n) throw show.error("番号为空!"), new Error("番号为空!");
        if (!a) throw show.error("url为空!"), new Error("url为空!");
        a.includes("http") || (a = window.location.origin + a), i && (i = i.trim());
        let l = t.find((e => e.carNum === n));
        if (l) i && (l.names = i), a && (l.url = a), o && (l.publishTime = o), l.updateDate = utils.getNowStr(); else {
            let e = utils.getNowStr();
            l = {
                carNum: n,
                url: a,
                names: i,
                status: "",
                createDate: e,
                updateDate: e,
                publishTime: o
            }, r && (l.starId = r), t.push(l);
        }
        switch (s) {
          case d:
            if (l.status === d) {
                const e = `${n} 已在屏蔽列表中`;
                throw show.error(e), new Error(e);
            }
            l.status = d;
            break;

          case h:
            if (l.status === h) {
                const e = `${n} 已在收藏列表中`;
                throw show.error(e), new Error(e);
            }
            l.status = h;
            break;

          case g:
            if (l.status === g) { const e = `${n} 已标记为已下载`; throw show.error(e), new Error(e); }
            l.status = g;
            break;

          case p:
            if (l.status === p) { const e = `${n} 已标记为已观看`; throw show.error(e), new Error(e); }
            l.status = p;
            break;

          default:
            const e = "actionType错误, 请联系作者更正: " + s;
            throw show.error(e), new Error(e);
        }
    }
    async saveCar(e) {
        const t = await this.getCarList();
        this._saveSingleCar(e, t), await this._setItemAndInvalidate(this.car_list_key, t), await this.removeNewVideoList([ e.carNum ]);
    }
    async updateCarInfo(e) {
        let {carNum: t, url: n, names: a, actionType: i, publishTime: s, remark: o} = e;
        if (!t) throw show.error("番号为空!"), new Error("番号为空!");
        if (!n) throw show.error("url为空!"), new Error("url为空!");
        a && (a = a.trim());
        const r = await this.getCarList();
        let l = r.find((e => e.carNum === t));
        if (!l) {
            const e = "数据不存在: " + t;
            throw show.error(e), new Error(e);
        }
        switch (l.names = a, l.url = n, l.remark = o, l.updateDate = utils.getNowStr(),
        i) {
          case d:
            l.status = d;
            break;

          case h:
            l.status = h;
            break;

          case g:
            l.status = g;
            break;

          case p:
            l.status = p;
            break;

          default:
            const e = "actionType错误, 请联系作者更正: " + i;
            throw show.error(e), new Error(e);
        }
        await this._setItemAndInvalidate(this.car_list_key, r), await this.removeNewVideoList([ t ]);
    }
    async saveCarList(e) {
        if (!e || !Array.isArray(e) || 0 === e.length) throw show.error("记录列表为空!"), new Error("记录列表为空!");
        const t = await this.getCarList();
        for (const a of e) try {
            this._saveSingleCar(a, t);
        } catch (n) {
            throw n;
        }
        await this._setItemAndInvalidate(this.car_list_key, t), await this.removeNewVideoList(e.map((e => e.carNum)));
    }
    async removeNewVideoList(e) {
        return this.withActressLock(async () => {
            const t = await this.getFavoriteActressList();
            let n = !1;
            const a = t.map((t => {
                if (!t.newVideoList || !Array.isArray(t.newVideoList)) return t;
                const a = t.newVideoList.filter((t => {
                    const a = "string" == typeof t ? t : t.carNum, i = e.includes(a);
                    return i && (clog.log("移除关联女优新作品", t.name, a), n = !0), !i;
                }));
                const result = { ...t, newVideoList: a };
                if (a.length === 0 && t.lastPublishTime) result.lastPublishTime = null;
                return result;
            }));
            n && await this._setItemAndInvalidate(this.favorite_actresses_key, a);
        });
    }
    async removeCar(e) {
        const t = await this.getCarList(), n = t.length, a = t.filter((t => t.carNum !== e));
        return a.length === n ? (show.error(`${e} 不存在`), !1) : (await this._setItemAndInvalidate(this.car_list_key, a),
        !0);
    }
    async batchRemoveCars(e) {
        const t = await this.getCarList(), n = t.length, a = new Set(e), i = t.filter((e => !a.has(e.carNum))), s = n - i.length;
        return 0 !== s && (await this._setItemAndInvalidate(this.car_list_key, i), s);
    }
    async getBlacklist() {
        return this._readCached("cacheBlacklist", this.blacklist_key, []);
    }
    async getBlacklistMap() {
        if (null === this.cacheBlacklistMap) {
            const e = await this.getBlacklist();
            this.cacheBlacklistMap = createIndexedMap(e, "starId");
        }
        return this.cacheBlacklistMap;
    }
    async addBlacklistItem(e) {
        let {starId: t, name: n, allName: a, role: i, movieType: s, url: o} = e;
        if (!t) throw new Error("缺失starId");
        if (!n) throw new Error("缺失name");
        if (!i) throw new Error("缺失role");
        const r = await this.getBlacklist(), l = r.find((e => e.starId === t));
        if (l) l.url = o, l.role = i, l.movieType = s, clog.log("更新黑名单演员信息", l); else {
            const e = {
                starId: t,
                name: n,
                allName: a || [ n ],
                createTime: utils.getNowStr(),
                role: i,
                movieType: s,
                url: o
            };
            r.push(e), clog.log("增加黑名单演员信息", e);
        }
        await this._setItemAndInvalidate(this.blacklist_key, r);
    }
    async updateBlacklistItem(e) {
        if (!e || !e.starId) throw new Error("参数不全");
        const t = await this.getBlacklist(), n = t.find((t => t.starId === e.starId));
        if (!n) throw new Error(`未找到黑名单演员信息:${e.name} ${e.starId}`);
        e.checkTime && (n.checkTime = e.checkTime), e.lastPublishTime && (n.lastPublishTime = e.lastPublishTime),
        await this._setItemAndInvalidate(this.blacklist_key, t);
    }
    async deleteBlacklistItem(e) {
        const t = await this.getBlacklist(), n = t.filter((t => t.starId !== e));
        t.length !== n.length && await this._setItemAndInvalidate(this.blacklist_key, n);
    }
    async getBlacklistCarList() {
        return this._readCached("cache_filter_actor_actress_car_list", this.blacklist_car_list_key, []);
    }
    async batchSaveBlacklistCarList(e) {
        const t = await this.getBlacklistCarList(), n = JSON.parse(JSON.stringify(t));
        let a = !1, i = [];
        for (const s of e) {
            n.find((e => e.carNum === s.carNum)) || (this._saveSingleCar(s, n), clog.log(`屏蔽演员番号: <span class="jhs-layout-eeefd8c8">${escapeHtml(s.names)} ${escapeHtml(s.carNum)}</span>`),
            a = !0, i.push(s.carNum));
        }
        a && (await this._setItemAndInvalidate(this.blacklist_car_list_key, n), await this.removeNewVideoList(i),
        window.cleanCache_filter_actor_actress_car_list());
    }
    async removeBlacklistCarList(e) {
        const t = await this.getBlacklistCarList(), n = t.filter((t => t.starId !== e));
        n.length !== t.length && (await this._setItemAndInvalidate(this.blacklist_car_list_key, n),
        window.cleanCache_filter_actor_actress_car_list());
    }
    async getFavoriteActressList() {
        return this._readCached("cacheFavoriteActresses", this.favorite_actresses_key, []);
    }
    async addFavoriteActressList(e) {
        return this.withActressLock(async () => {
        const t = await this.getFavoriteActressList();
        let n = 0;
        for (const a of e) {
            let {starId: e, name: i, allName: s, avatar: o, lastCheckTime: r, lastPublishTime: l, actressType: c} = a;
            if (!e) throw new Error("缺失starId");
            if (!i) throw new Error("缺失name");
            s || (s = [ i ]);
            const d = "(無碼)";
            if (!c) {
                c = i.includes(d) || s.some((e => e.includes(d))) ? A : D;
            }
            i = i.replace(d, ""), s = s.map((e => e.replace(d, "")));
            let h = t.find((t => t.starId === e));
            if (h) {
                h.avatar && h.avatar.includes("https") || o && (clog.log(o), h.avatar = o, clog.log(`<span class="jhs-layout-eeefd8c8">补全女优头像: ${escapeHtml(i)}</span>`),
                n++), !h.actressType && c && (h.actressType = c, clog.log(`<span class="jhs-layout-eeefd8c8">补全女优类别: ${escapeHtml(i)} ${escapeHtml(c)}</span>`),
                n++), h.name.includes(d) && (h.name = i, h.allName = s, clog.log(`<span class="jhs-layout-eeefd8c8">更正女优名字: ${escapeHtml(i)} ${escapeHtml(s)}</span>`),
                n++);
                continue;
            }
            const g = utils.getNowStr();
            t.push({
                starId: e,
                name: i,
                allName: s,
                avatar: o,
                lastCheckTime: r,
                lastPublishTime: l,
                createDate: g,
                updateDate: g,
                actressType: c
            }), clog.log(`<span class="jhs-layout-eeefd8c8">同步JavDB已收藏的演员: ${escapeHtml(i)}</span>`), n++;
        }
        return n > 0 ? await this._setItemAndInvalidate(this.favorite_actresses_key, t) : clog.log("信息已记录, 无需要进行同步收藏的演员"),
        n;
        });
    }
    async removeFavoriteActress(e) {
        return this.withActressLock(async () => {
            const t = await this.getFavoriteActressList(), n = t.length, a = t.filter((t => t.starId !== e));
            return a.length === n ? (clog.error(`移除演员失败, ${e} 不存在`), !1) : (await this._setItemAndInvalidate(this.favorite_actresses_key, a), !0);
        });
    }
    async updateFavoriteActress(e) {
        return this.withActressLock(() => this._rawUpdateFavoriteActress(e));
    }
    async getHighlightedTags() {
        return await this.forage.getItem(this.highlighted_tags_key) || [];
    }
    async setHighlightedTags(e) {
        return await this.forage.setItem(this.highlighted_tags_key, e);
    }
    async saveTitleFilterKeyword(n) {
        if (await s(this, e, t).call(this, n, this.filter_keyword_title_key, "标题关键词"), Array.isArray(n)) return null;
        return this.withActressLock(async () => {
        const a = await this.getFavoriteActressList();
        let i = !1;
        const o = a.map((e => {
            if (!e.newVideoList || !Array.isArray(e.newVideoList)) return e;
            const t = e.newVideoList.filter((t => {
                const s = "string" == typeof t ? t : t.carNum, a = s.startsWith(n);
                return a && (clog.log("移除关联女优新作品", e.name, s), i = !0), !a;
            }));
            return {
                ...e,
                newVideoList: t
            };
        }));
        i && await this._setItemAndInvalidate(this.favorite_actresses_key, o);
        });
    }
    async getTitleFilterKeyword() {
        return this._readCached("cacheTitleFilterKeyword", this.filter_keyword_title_key, []);
    }
    async getReviewFilterKeywordList() {
        return await this.forage.getItem(this.filter_keyword_review_key) || [];
    }
    async saveReviewFilterKeyword(n) {
        return s(this, e, t).call(this, n, this.filter_keyword_review_key, "评论关键词");
    }
    async getSetting(e = null, t) {
        let n = await this._readCached("cacheSettingObj", this.setting_key, {});
        if (null === e) return n;
        const a = n[e];
        return a ? "true" === a || "false" === a ? "true" === a.toLowerCase() : "string" != typeof a || "" === a.trim() || isNaN(Number(a)) ? a : Number(a) : t;
    }
    getSettingSync(e, t) {
        if (!this.cacheSettingObj) return t;
        const n = this.cacheSettingObj[e];
        return n ? "true" === n || "false" === n ? "true" === n.toLowerCase() : "string" != typeof n || "" === n.trim() || isNaN(Number(n)) ? n : Number(n) : t;
    }
    async saveSetting(e) {
        e ? (await this._setItemAndInvalidate(this.setting_key, e), window.clean_cacheSettingObj()) : show.error("设置对象为空");
    }
    async saveSettingItem(e, t) {
        if (!e) return void show.error("key 不能为空");
        await navigator.locks.request("jhs_setting_lock", async () => {
            let n = await this.getSetting();
            n[e] = t, await this.saveSetting(n);
        }), window.clean_cacheSettingObj();
    }
    async importData(e) {
        const VALID_KEYS = new Set(["car_list", "filter_keyword_title", "filter_keyword_review", "setting", "blacklist", "blacklist_car_list", "third_party_ttl_cache", "favorite_actresses", "highlighted_tags"]);
        const t = [];
        for (const n in e) {
            if (!VALID_KEYS.has(n)) { clog.warn(`[导入] 跳过未知数据键: ${n}`); continue; }
            t.push(this._setItemAndInvalidate(n, e[n]));
        }
        await Promise.all(t);
        const n = [];
        await this.forage.iterate(((t, a) => {
            a in e || n.push(this.forage.removeItem(a));
        }));
        await Promise.all(n);
        this._invalidateCache();
    }
    async exportData() {
        const e = {};
        if (await this.forage.iterate(((t, n) => {
            e[n] = t;
        })), 0 === Object.keys(e).length) throw new Error("没有可导出的数据");
        return e;
    }
    async getThirdPartyCache() {
        return await this.forage.getItem(this.third_party_cache_key) || {};
    }
    async setThirdPartyCache(e) {
        await this.forage.setItem(this.third_party_cache_key, e || {});
    }
    async clearThirdPartyCache() {
        await this.forage.removeItem(this.third_party_cache_key);
    }
    async cachedRequest(e, t, n) {
        const a = Date.now(), i = await this.getThirdPartyCache(), s = i[e];
        if (s && s.time && a - s.time < (s.ttl || t)) return this._cacheStats.hits++, s.data;
        this._cacheStats.misses++;
        const loaded = await n(), customTtl = loaded && "object" === typeof loaded && "__jhsCacheTtl" in loaded ? loaded.__jhsCacheTtl : t;
        const o = loaded && "object" === typeof loaded && "__jhsCacheTtl" in loaded ? loaded.data : loaded;
        if (void 0 === o || null === o) return o;
        return i[e] = {
            time: a,
            ttl: customTtl,
            data: o
        }, await this.setThirdPartyCache(i), o;
    }
    getCacheHitStats() {
        const e = this._cacheStats.hits + this._cacheStats.misses;
        return {
            hits: this._cacheStats.hits,
            misses: this._cacheStats.misses,
            total: e,
            rate: e > 0 ? (this._cacheStats.hits / e * 100).toFixed(1) + "%" : "N/A"
        };
    }
    _groupDuplicateItems(e, t) {
        return groupDuplicateItems(e, t);
    }
    _dedupeByKey(e, t) {
        return dedupeByKey(e, t);
    }
    async inspectDataHealth() {
        const [e, t, n, a] = await Promise.all([ this.getCarList(), this.getFavoriteActressList(), this.getBlacklist(), this.getBlacklistCarList() ]), i = await this.getCarMap(), s = {
            checkedAt: utils.getNowStr(),
            totals: {
                carList: e.length,
                favoriteActresses: t.length,
                blacklist: n.length,
                blacklistCarList: a.length
            },
            fixable: [],
            readonly: []
        }, o = (e, t, n) => s.fixable.push({
            type: e,
            message: t,
            count: n
        }), r = (e, t, n) => s.readonly.push({
            type: e,
            message: t,
            count: n
        });
        const l = this._groupDuplicateItems(e, "carNum"), c = this._groupDuplicateItems(t, "starId"), d = this._groupDuplicateItems(n, "starId");
        l.length && o("duplicate-car", "重复番号记录", l.length), c.length && o("duplicate-actress", "重复收藏演员", c.length),
        d.length && o("duplicate-blacklist", "重复黑名单演员", d.length);
        const h = e.filter((e => e && e.actress)).length, g = a.filter((e => e && e.actress)).length, p = t.filter((e => e && Object.prototype.hasOwnProperty.call(e, "dbId"))).length, m = n.filter((e => e && ("key" in e || "recordTime" in e || "isActor" in e))).length;
        h + g + p + m > 0 && o("legacy-fields", "旧字段残留", h + g + p + m);
        const u = t.filter((e => e && e.name && !Array.isArray(e.allName))).length + n.filter((e => e && e.name && !Array.isArray(e.allName))).length;
        u && o("invalid-all-name", "演员别名不是数组", u);
        let f = 0;
        t.forEach((e => {
            Array.isArray(e?.newVideoList) && (f += e.newVideoList.filter((e => { const t = "string" == typeof e ? e : e.carNum; return i.has(t); })).length);
        })), f && o("stored-new-video", "新作品列表中已有鉴定记录", f);
        const v = e.filter((e => e && e.carNum && !e.url)).length;
        v && r("missing-url", "番号记录缺失 url，需要人工确认来源", v);
        const b = t.filter((e => e && !e.starId)).length + n.filter((e => e && !e.starId)).length;
        b && r("missing-star-id", "演员缺失 starId，需要人工确认身份", b);
        const w = new Set(n.map((e => e && e.starId)).filter(Boolean)), y = a.filter((e => e && e.starId && !w.has(e.starId))).length;
        return y && r("orphan-blacklist-car", "黑名单作品找不到关联演员", y), s;
    }
    async repairDataHealth() {
        let e = 0, t = await this.getCarList(), n = await this.getFavoriteActressList(), a = await this.getBlacklist(), i = await this.getBlacklistCarList();
        const s = this._dedupeByKey(t, "carNum");
        s.changed && (t = s.list, e++);
        const o = this._dedupeByKey(n, "starId");
        o.changed && (n = o.list, e++);
        const r = this._dedupeByKey(a, "starId");
        r.changed && (a = r.list, e++);
        t = t.map((t => {
            if (!t) return t;
            let n = !1;
            return void 0 !== t.actress && (t.names = t.actress, delete t.actress, n = !0), n && e++, t;
        })), i = i.map((t => {
            if (!t) return t;
            let n = !1;
            return void 0 !== t.actress && (t.names = t.actress, delete t.actress, n = !0), Object.prototype.hasOwnProperty.call(t, "type") && (delete t.type, n = !0),
            n && e++, t;
        })), n = n.map((t => {
            if (!t) return t;
            let n = !1;
            return Object.prototype.hasOwnProperty.call(t, "dbId") && (t.starId || (t.starId = t.dbId), delete t.dbId, n = !0), t.name && !Array.isArray(t.allName) && (t.allName = t.allName ? [ t.allName ] : [ t.name ],
            n = !0), n && e++, t;
        })), a = a.map((t => {
            if (!t) return t;
            let n = !1;
            return Object.prototype.hasOwnProperty.call(t, "isActor") && (t.role || (t.role = t.isActor ? B : P),
            delete t.isActor, n = !0), Object.prototype.hasOwnProperty.call(t, "recordTime") && (t.createTime || (t.createTime = t.recordTime), delete t.recordTime,
            n = !0), Object.prototype.hasOwnProperty.call(t, "key") && (delete t.key, n = !0), t.name && !Array.isArray(t.allName) && (t.allName = t.allName ? [ t.allName ] : [ t.name ],
            n = !0), n && e++, t;
        }));
        const l = new Set(t.filter((e => e && e.carNum)).map((e => e.carNum)));
        n = n.map((t => {
            if (!Array.isArray(t?.newVideoList)) return t;
            const n = t.newVideoList.filter((e => { const n = "string" == typeof e ? e : e.carNum; return !l.has(n); }));
            return n.length !== t.newVideoList.length && (t = {
                ...t,
                newVideoList: n
            }, 0 === n.length && t.lastPublishTime && (t.lastPublishTime = null), e++), t;
        })), await this._setItemAndInvalidate(this.car_list_key, t), await this._setItemAndInvalidate(this.favorite_actresses_key, n),
        await this._setItemAndInvalidate(this.blacklist_key, a), await this._setItemAndInvalidate(this.blacklist_car_list_key, i);
        return {
            fixedGroups: e,
            report: await this.inspectDataHealth()
        };
    }
    /** 数据迁移: 将旧版扁平键名重命名为新格式 */
    async merge_table_name() {
        let e = "filter_actor_actress_info_list", t = await this.forage.getItem(e) || [];
        t && t.length > 0 && (clog.debug("更正", e), await this._setItemAndInvalidate(this.blacklist_key, t)),
        await this.forage.removeItem(e), e = "favorite_actresses_info_list", t = await this.forage.getItem(e) || [],
        t && t.length > 0 && (clog.debug("更正", e), await this._setItemAndInvalidate(this.favorite_actresses_key, t)),
        await this.forage.removeItem(e), e = "car_list_filter_actor_actress", t = await this.forage.getItem(e) || [],
        t && t.length > 0 && (clog.debug("更正", e), await this._setItemAndInvalidate(this.blacklist_car_list_key, t)),
        await this.forage.removeItem(e), e = "title_filter_keyword", t = await this.forage.getItem(e) || [],
        t && t.length > 0 && (clog.debug("更正", e), await this._setItemAndInvalidate(this.filter_keyword_title_key, t)),
        await this.forage.removeItem(e), e = "review_filter_keyword", t = await this.forage.getItem(e) || [],
        t && t.length > 0 && (clog.debug("更正", e), await this._setItemAndInvalidate(this.filter_keyword_review_key, t)),
        await this.forage.removeItem(e), e = "highlightedTags", t = await this.forage.getItem(e) || [],
        t && t.length > 0 && (clog.debug("更正", e), await this._setItemAndInvalidate(this.highlighted_tags_key, t)),
        await this.forage.removeItem(e);
    }
    async clean_no_url_blacklist() {
        const [e, t] = await Promise.all([ this.getBlacklistCarList(), this.getBlacklist() ]);
        if (e.length && !e[0].actress) return;
        const n = new Set(t.map((e => e.name))), a = e.filter((e => !e.actress || n.has(e.actress)));
        e.length !== a.length && (clog.debug("清理 blacklistCarList 前", e.length), clog.debug("清理 blacklistCarList 后", a.length),
        await this._setItemAndInvalidate(this.blacklist_car_list_key, a));
        const i = new Set(a.map((e => e.actress)));
        let s = t.filter((e => i.has(e.name)));
        s = s.map((e => {
            const {key: t, recordTime: n, ...a} = e, i = a;
            return void 0 !== n && (i.createTime = n), i;
        })), (t.length !== s.length || t.some((e => "key" in e || "recordTime" in e))) && (clog.debug("清理 Blacklist 前", t.length),
        clog.debug("清理 Blacklist 后", s.length), await this._setItemAndInvalidate(this.blacklist_key, s));
    }
    async async_merge_other() {
        const e = await this.getSetting();
        let t = !1;
        const n = {
            enableCheckFilterActorActress: "enableCheckBlacklist",
            checkIntervalTime_filterActorActress: "checkBlacklist_intervalTime",
            checkIntervalTime_ruleTime: "checkNewVideo_ruleTime",
            checkIntervalTime_newVideo: "checkNewVideo_intervalTime",
            checkIntervalTime_favoriteActress: "checkFavoriteActress_IntervalTime"
        };
        for (const a in n) {
            const i = n[a];
            Object.prototype.hasOwnProperty.call(e, a) && (e[i] = e[a], delete e[a], t = !0);
        }
        e.checkFilterTime && (delete e.checkFilterTime, t = !0), e.checkFilterConcurrencyCount && (delete e.checkFilterConcurrencyCount,
        t = !0), e.checkFilterSleep && (delete e.checkFilterSleep, t = !0), t && (await this.saveSetting(e), clog.debug("配置数据已更正"));
    }
    /** 数据迁移: 补全黑名单条目缺失的 role/starId/allName/movieType 字段 */
    async merge_blacklist() {
        const e = await this.getBlacklist();
        if (!e || 0 === e.length) return;
        let t = !1;
        const n = e.map((e => {
            let n = !1;
            if (Object.prototype.hasOwnProperty.call(e, "isActor") && !e.role && (e.role = e.isActor ? B : P,
            delete e.isActor, n = !0), !e.starId && e.url) try {
                const t = new URL(e.url).pathname, a = t.split("/").filter((e => "" !== e.trim())).pop();
                e.starId !== a && (e.starId = a, n = !0);
            } catch (a) {
                clog.error("提取url-starId发生错误", e.url, a);
            }
            if (e.allName || (e.allName = e.name ? [ e.name ] : [], n = !0), e.movieType || (e.movieType = D,
            n = !0), e.url && e.url.includes("sort_type")) {
                const t = new URL(e.url);
                t.searchParams.delete("sort_type"), e.url = t.toString(), clog.debug("去除黑名单地址sort_type参数");
            }
            return n && (t = !0), e;
        }));
        t && (clog.debug("更正 Blacklist 数据结构"), await this._setItemAndInvalidate(this.blacklist_key, n));
        const a = await this.getBlacklistCarList();
        t = !1;
        const i = a.map((n => {
            if (!n.starId) {
                let a = e.find((e => e.name === n.actress));
                a && (n.starId = a.starId), t = !0;
            }
            return n.type && (delete n.type, t = !0), n;
        }));
        t && (clog.debug("更正 blacklistCarList 数据结构"), await this._setItemAndInvalidate(this.blacklist_car_list_key, i));
    }
    async merge_favoriteActress() {
        const e = await this.getFavoriteActressList();
        if (!e || 0 === e.length) return;
        let t = !1;
        const n = e.map((e => {
            let n = !1;
            return e.dbId && (e.starId = e.dbId, delete e.dbId, n = !0), n && (t = !0), e;
        }));
        t && (clog.debug("更正 favoriteActressesInfoList 数据结构"), await this._setItemAndInvalidate(this.favorite_actresses_key, n));
    }
    async merge_tow_car_list_table() {
        const e = await this.getBlacklistCarList(), t = await this.getCarList();
        let n = !1;
        const a = e.map((e => {
            let t = !1;
            return void 0 !== e.actress && (e.names = e.actress, delete e.actress, t = !0),
            t && (n = !0), e;
        }));
        n && (clog.debug("更正 blacklistCarList 数据结构 actress->names"), await this._setItemAndInvalidate(this.blacklist_car_list_key, a)),
        n = !1;
        const i = t.map((e => {
            let t = !1;
            return void 0 !== e.actress && (e.names = e.actress, delete e.actress, t = !0),
            t && (n = !0), e;
        }));
        n && (clog.debug("更正 carList 数据结构 actress->names"), await this._setItemAndInvalidate(this.car_list_key, i));
    }
    /* ───── 快照管理 ───── */
    _snapshotKey() { return "snapshots"; }
    _snapshotMetaKeys() { return [ "snapshots", "data_version" ]; }
    async _getSnapshots() { return await this.forage.getItem(this._snapshotKey()) || []; }
    async _saveSnapshots(e) { await this._setItemAndInvalidate(this._snapshotKey(), e); }
    async _withSnapshotLock(e) {
        return await navigator.locks.request("jhs_snapshot_lock", async () => await e());
    }
    async createSnapshot(e = "", t = "manual") {
        return this._withSnapshotLock(async () => {
            const n = await this._getSnapshots(), a = await this.exportData();
            for (const i of this._snapshotMetaKeys()) delete a[i];
            let i = 0;
            for (const s of Object.values(a)) Array.isArray(s) ? i += s.length : "object" == typeof s && s && i++;
            const s = {
                id: "snap_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
                name: e || utils.getNowStr(),
                source: t,
                time: utils.getNowStr(),
                itemCount: i,
                data: a
            };
            n.push(s), n.length > 10 && n.splice(0, n.length - 10);
            return await this._saveSnapshots(n), clog.log(`创建快照: ${s.name} (${t})`), s;
        });
    }
    async getSnapshotList() {
        return (await this._getSnapshots()).map((e => ({ id: e.id, name: e.name, source: e.source, time: e.time, itemCount: e.itemCount })));
    }
    async getSnapshot(e) {
        return (await this._getSnapshots()).find((t => t.id === e)) || null;
    }
    async deleteSnapshot(e) {
        return this._withSnapshotLock(async () => {
            const t = await this._getSnapshots(), n = t.filter((t => t.id !== e));
            if (n.length === t.length) return void clog.warn("删除快照失败, ID不存在: " + e);
            await this._saveSnapshots(n), clog.log("删除快照: " + e);
        });
    }
    async restoreSnapshot(e) {
        const t = await this.getSnapshot(e);
        if (!t) throw new Error("快照不存在: " + e);
        if (!t.data || "object" != typeof t.data) throw new Error("快照数据损坏");
        await this.createSnapshot("恢复前自动备份", "auto-restore");
        const n = { ...t.data };
        for (const a of this._snapshotMetaKeys()) delete n[a];
        await this.importData(n);
        clog.log("已恢复快照: " + t.name);
        return t;
    }
    /* ───── 差异对比引擎 ───── */
    _stableStringify(e) {
        if (null === e || "object" != typeof e) return JSON.stringify(e);
        if (Array.isArray(e)) return "[" + e.map((e => this._stableStringify(e))).join(",") + "]";
        return "{" + Object.keys(e).sort().map((t => JSON.stringify(t) + ":" + this._stableStringify(e[t]))).join(",") + "}";
    }
    diffData(e, t) {
        const n = new Set([ ...Object.keys(e), ...Object.keys(t) ]), a = {}, i = { added: 0, removed: 0, modified: 0, unchanged: 0 };
        for (const o of n) {
            const r = e[o], l = t[o];
            if (void 0 === r && void 0 === l) continue;
            if (void 0 === r) {
                const e = Array.isArray(l) ? l.length : 1;
                a[o] = { status: "added", oldCount: 0, newCount: e, added: Array.isArray(l) ? l : [], removed: [], modified: [] },
                i.added++;
            } else if (void 0 === l) {
                const t = Array.isArray(r) ? r.length : 1;
                a[o] = { status: "removed", oldCount: t, newCount: 0, added: [], removed: Array.isArray(r) ? r : [], modified: [] },
                i.removed++;
            } else if (Array.isArray(r) && Array.isArray(l)) {
                const e = this._diffArrays(r, l, o);
                a[o] = { status: e.status, oldCount: r.length, newCount: l.length, ...e },
                i[e.status]++;
            } else if ("object" == typeof r && "object" == typeof l && !Array.isArray(r) && !Array.isArray(l)) {
                const e = this._diffObjects(r, l);
                a[o] = { status: e.status, oldCount: Object.keys(r).length, newCount: Object.keys(l).length, added: [], removed: [], modified: e.changes },
                i[e.status]++;
            } else r === l ? (a[o] = { status: "unchanged", oldCount: 1, newCount: 1, added: [], removed: [], modified: [] },
            i.unchanged++) : (a[o] = { status: "modified", oldCount: 1, newCount: 1, added: [], removed: [], modified: [{ key: o, changes: { _value: [r, l] } }] },
            i.modified++);
        }
        return { summary: i, stores: a };
    }
    _getArrayKey(e) {
        return "car_list" === e || "blacklist_car_list" === e ? "carNum" : "blacklist" === e || "favorite_actresses" === e ? "starId" : null;
    }
    _diffArrays(e, t, n) {
        const a = this._getArrayKey(n);
        if (!a) {
            const n = this._stableStringify(e), i = this._stableStringify(t);
            if (n === i) return { status: "unchanged", added: [], removed: [], modified: [] };
            const s = new Set(e.map((e => this._stableStringify(e)))), o = new Set(t.map((e => this._stableStringify(e))));
            return { status: "modified", added: t.filter((e => !s.has(this._stableStringify(e)))), removed: e.filter((e => !o.has(this._stableStringify(e)))), modified: [] };
        }
        const i = new Map(e.map((e => [ e[a], e ]))), s = new Map(t.map((e => [ e[a], e ]))), o = [], r = [], l = [];
        for (const [c, d] of s) {
            const t = i.get(c);
            if (!t) o.push(d); else {
                const e = this._diffObjects(t, d);
                "unchanged" !== e.status && l.push({ key: c, changes: e.changes });
            }
        }
        for (const [c] of i) s.has(c) || r.push(i.get(c));
        const c = o.length + r.length + l.length;
        return { status: 0 === c ? "unchanged" : "modified", added: o, removed: r, modified: l };
    }
    _diffObjects(e, t) {
        const n = new Set([ ...Object.keys(e), ...Object.keys(t) ]), a = {};
        let i = 0;
        for (const s of n) {
            const o = e[s], r = t[s];
            this._stableStringify(o) !== this._stableStringify(r) && (a[s] = [ o, r ], i++);
        }
        return { status: 0 === i ? "unchanged" : "modified", changes: a };
    }
}
