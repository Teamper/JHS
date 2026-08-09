class et extends X {
    constructor() {
        super(...arguments), i(this, "singleTaskKey", "checkNewActressActorFilterCar"),
        i(this, "taskConfig", null), i(this, "storageQueue", new ve), i(this, "lastCheckFavoriteActressTimeKey", "jhs_time_checkFavoriteActress"),
        i(this, "lastCheckBlacklistTimeKey", "jhs_time_checkBlacklist"), i(this, "lastCheckNewVideoTimeKey", "jhs_time_checkNewVideo");
    }
    getName() {
        return "TaskPlugin";
    }
    getStartupMode() {
        return "idle";
    }
    async limitConcurrency(e, t, n, a) {
        this.showIsRun();
        let i = 0, s = !1;
        const o = Math.max(1, Math.min(t, e.length)), r = Array.from({ length: o }, (async () => {
            for (;!s; ) {
                const t = i++;
                if (t >= e.length) return;
                try {
                    await a(e[t]);
                } catch (e) {
                    if (this.isNetworkBlocked(e)) throw s = !0, e;
                    throw e;
                }
                const o = e.length - i;
                o > 0 && (clog.debug(`剩余任务数: <span style="color: #f40">${o}</span>`), await utils.sleep(n));
            }
        }));
        const l = await Promise.allSettled(r), c = l.find((e => "rejected" === e.status));
        if (c) throw c.reason;
    }
    isNetworkBlocked(e) {
        return !0 === e?._cfBlocked || !0 === e?._circuitBroken;
    }
    isUnnecessaryCheck(e, t) {
        if (!t) throw new Error("未传入checkIntervalTime");
        t = parseInt(t);
        return utils.getHourDifference(new Date(e), new Date) < t;
    }
    handle() {
        return this.doTask();
    }
    showIsRun() {
        show.info("正在执行检测任务中, 请勿关闭当前窗口", {
            duration: 3e3
        });
    }
    async doTask() {
        if (isListPage) return await this.loadConfig(), this.javDbUrl = await this.getBean("OtherSitePlugin").getJavDbUrl(),
        navigator.locks.request(this.singleTaskKey, {
            ifAvailable: !0
        }, (async e => {
            if (e) {
                if (isListPage && (this.taskConfig.enableCheckBlacklist === _ ? await this.checkBlacklist() : clog.warn("自动检测屏蔽黑名单-禁用"),
                !l)) {
                    if (this.taskConfig.enableCheckFavoriteActress === _) {
                        const e = localStorage.getItem(this.lastCheckFavoriteActressTimeKey), t = this.taskConfig.checkFavoriteActress_IntervalTime, n = e && this.isUnnecessaryCheck(e, t), a = $('a[href*="/users/profile"]').length > 0;
                        n && clog.debug(`检测同步演员, 上次检测时间: ${e} 检测间隔时间: ${t}小时 未到时间`), !n && a && await this.checkFavoriteActress();
                    } else clog.warn("自动同步已收藏的演员-禁用");
                    this.taskConfig.enableCheckNewVideo === _ ? await this.checkNewVideo() : clog.warn("自动检测已收藏演员的最新作品-禁用");
                }
            } else clog.debug("争夺任务锁失败, 跳过执行");
        })).catch((e => {
            this.isNetworkBlocked(e) ? clog.warn(`后台检测已停止: ${e.message}`) : (console.error("锁任务出现错误:", e),
            clog.error("锁任务出现错误:", e));
        })).finally((() => {
            setTimeout((() => {
                this.doTask();
            }), 3e5);
        }));
    }
    async loadConfig() {
        const e = await storageManager.getSetting();
        this.taskConfig = {
            checkConcurrencyCount: e.checkConcurrencyCount ? Number(e.checkConcurrencyCount) : 2,
            checkRequestSleep: e.checkRequestSleep ? Number(e.checkRequestSleep) : 100,
            enableCheckBlacklist: e.enableCheckBlacklist || _,
            checkBlacklist_intervalTime: e.checkBlacklist_intervalTime ? Number(e.checkBlacklist_intervalTime) : 12,
            checkBlacklist_ruleTime: e.checkBlacklist_ruleTime ? Number(e.checkBlacklist_ruleTime) : 8760,
            enableCheckFavoriteActress: e.enableCheckFavoriteActress || _,
            checkFavoriteActress_IntervalTime: e.checkFavoriteActress_IntervalTime ? Number(e.checkFavoriteActress_IntervalTime) : 24,
            enableCheckNewVideo: e.enableCheckNewVideo || _,
            checkNewVideo_intervalTime: e.checkNewVideo_intervalTime ? Number(e.checkNewVideo_intervalTime) : 12,
            checkNewVideo_ruleTime: e.checkNewVideo_ruleTime ? Number(e.checkNewVideo_ruleTime) : 8760
        };
    }
    async checkBlacklist(e) {
        let t = await storageManager.getBlacklist();
        if (0 === t.length) return;
        t = t.sort(((e, t) => e.createTime < t.createTime ? 1 : e.createTime > t.createTime ? -1 : 0));
        const n = this.taskConfig.checkConcurrencyCount, a = this.taskConfig.checkRequestSleep, i = this.taskConfig.checkBlacklist_intervalTime, s = this.taskConfig.checkBlacklist_ruleTime, o = localStorage.getItem(this.lastCheckBlacklistTimeKey);
        if (!e && o && this.isUnnecessaryCheck(o, i)) return void clog.debug(`检测黑名单, 上次检测时间: ${o} 检测间隔时间: ${i}小时 未到时间`);
        const r = [], l = [];
        for (const h of t) {
            let t = h.name, n = h.checkTime, a = h.lastPublishTime, o = h.url;
            if (new URL(window.location.href).hostname === new URL(o).hostname) {
                if (e || !n || !this.isUnnecessaryCheck(n, i)) if (!a || 0 === s || this.isUnnecessaryCheck(a, s)) r.push(h); else {
                    let e = `检测黑名单: ${t} ${a} 停更超过${s / 24 / 365}年,跳过检测`;
                    l.push(e), $("#checkBlacklistMsg").text(e);
                }
            } else clog.log("黑名单地址非同域名,跳过", o);
        }
        if (0 === r.length) return;
        l.forEach((e => {
            clog.log(e);
        })), clog.log(`<span style='color: #f40'>检测屏蔽黑名单, 总任务数: ${r.length}, 并发限制:${n}, 请求间隔时间:${a}ms</span>`);
        const c = this.getBean("BlacklistPlugin");
        await this.limitConcurrency(r, n, a, (async e => {
            let {starId: t, name: n, url: a} = e;
            try {
                clog.log("正在检屏黑名单演员:", n, a), $("#checkBlacklistMsg").text(`正在检屏黑名单演员: ${n} ${a}`);
                const e = await gmHttp.get(a), i = utils.htmlTo$dom(e);
                this.storageQueue.addTask((async () => {
                    let {lastPublishTime: e} = await c.parseAndSaveFilterInfo(i, n, t);
                    await storageManager.updateBlacklistItem({
                        starId: t,
                        name: n,
                        checkTime: utils.getNowStr(),
                        lastPublishTime: e
                    });
                }));
            } catch (i) {
                if (this.isNetworkBlocked(i)) throw i;
                $("#checkBlacklistMsg").text(`检测屏蔽演员信息, 发生错误: ${a}`), clog.error("检测屏蔽演员信息, 发生错误:", a, i),
                show.error("检测屏蔽演员信息, 发生错误:" + i, "bottom", "right");
            }
        })), await this.storageQueue.waitAllFinished();
        const d = utils.getNowStr();
        localStorage.setItem(this.lastCheckBlacklistTimeKey, d), clog.log('<span style="color: #f40">-------- END 检测屏蔽黑名单 END --------</span>'),
        $("#checkBlacklistMsg").text("检测屏蔽黑名单, 结束"), this.getBean("BlacklistPlugin").resetBtnTip().then();
    }
    async checkFavoriteActress() {
        const e = `${this.javDbUrl}/users/collection_actors`, t = [];
        await this.scrapeActorInfo(e, t), clog.log("所有演员信息已收集, 总计数量:", t.length), $("#checkNewVideoMsg").text("同步完成"),
        t.length > 0 && (await storageManager.addFavoriteActressList(t), localStorage.setItem(this.lastCheckFavoriteActressTimeKey, utils.getNowStr()),
        this.getBean("NewVideoPlugin").resetBtnTip().then());
    }
    async scrapeActorInfo(e, t) {
        clog.log(`正在抓取页面: ${e}`), $("#checkNewVideoMsg").text(`正在解析已收藏的演员: ${e}`);
        let nextUrl = null;
        try {
            const n = await gmHttp.get(e), a = utils.htmlTo$dom(n);
            a.find("#actors .actor-box a").each(((e, n) => {
                const a = $(n), i = a.attr("title"), s = a.attr("href");
                if (i && s) {
                    const e = i.split(",").map((e => e.trim())).filter((e => e.length > 0)), n = e[0] || "", o = new URL(s, this.javDbUrl).pathname.split("/").filter((e => e.length > 0));
                    let r = "";
                    o.length > 0 && (r = o[o.length - 1]);
                    let l = D;
                    const c = a.find("img").attr("src"), d = a.find(".info");
                    d.length && d.text().trim().includes("無碼") && (l = A), t.push({
                        starId: r,
                        name: n,
                        allName: e,
                        avatar: c,
                        actressType: l,
                        lastCheckTime: null,
                        lastUpdateTime: null
                    });
                }
            }));
            const i = a.find(".pagination-next").attr("href");
            if (i) nextUrl = new URL(i, this.javDbUrl).href;
        } catch (n) {
            throw clog.error(`抓取 ${e} 时发生错误，停止本轮同步:`, n), n;
        }
        if (nextUrl) await this.scrapeActorInfo(nextUrl, t);
    }
    async checkNewVideo(e) {
        const t = await storageManager.getFavoriteActressList(), n = utils.genericSort(t, [ {
            key: e => {
                var t;
                return (null == (t = e.newVideoList) ? void 0 : t.length) ?? 0;
            },
            order: "desc"
        }, {
            key: "lastPublishTime",
            order: "desc"
        } ]), a = this.taskConfig.checkConcurrencyCount, i = this.taskConfig.checkRequestSleep, s = this.taskConfig.checkNewVideo_intervalTime, o = this.taskConfig.checkNewVideo_ruleTime, r = localStorage.getItem(this.lastCheckNewVideoTimeKey);
        if (!e && r && this.isUnnecessaryCheck(r, s)) return void clog.debug(`检测新作品, 上次检测时间: ${r} 检测间隔时间: ${s}小时 未到时间`);
        const l = [], c = [];
        for (const m of n) {
            const {lastCheckTime: t, lastPublishTime: n, name: a} = m;
            !e && t && this.isUnnecessaryCheck(t, s) || (!n || 0 === o || this.isUnnecessaryCheck(n, o) ? l.push(m) : c.push(`检测新作品: ${a} ${n} 停更超过${o / 24 / 365}年,跳过检测`));
        }
        if (0 === l.length) return;
        c.forEach((e => {
            clog.log(e);
        })), clog.log(`<span style='color: #f40'>检测最新作品, 总任务数: ${l.length}, 并发限制:${a}, 请求间隔时间:${i}ms</span>`);
        const d = await storageManager.getTitleFilterKeyword(), h = await storageManager.getBlacklistCarList(), g = new Set(h.map((e => e.carNum)));
        await this.limitConcurrency(l, a, i, (async e => {
            const {lastCheckTime: t, name: n, starId: a} = e;
            let i = `${this.javDbUrl}/actors/${a}?t=d`;
            try {
                clog.log("正在检测最新作品, 演员:", n, i), $("#checkNewVideoMsg").text(`正在检测最新作品, 演员: ${n}`);
                const e = await gmHttp.get(i), t = utils.htmlTo$dom(e);
                this.storageQueue.addTask((async () => {
                    await this.parsePage(t, a, n, d, g);
                }));
            } catch (s) {
                if (this.isNetworkBlocked(s)) throw s;
                clog.error("检测屏蔽演员信息, 发生错误:", i, s), console.error("检测屏蔽演员信息, 发生错误:", i, s), show.error("检测屏蔽演员信息, 发生错误:" + s, "bottom", "right");
            }
        })), await this.storageQueue.waitAllFinished(), localStorage.setItem(this.lastCheckNewVideoTimeKey, utils.getNowStr()),
        clog.log('<span style="color: #f40">检测最新作品---结束</span>'), $("#checkNewVideoMsg").text("检测完毕");
        const p = this.getBean("NewVideoPlugin");
        p.loadData(), p.resetBtnTip().then();
    }
    async parsePage(e, t, n, a, i) {
        let s, o, r = !1, l = T;
        if (e.text().includes(I) && (r = !0, l = I), r && e.find(".avatar-box").length > 0 && e.find(".avatar-box").parent().remove(),
        s = e.find(this.getSelector(l).requestDomItemSelector), o = e.find(this.getSelector(l).nextPageSelector).attr("href"),
        o && 0 === s.length) throw clog.error("新作品检测-解析列表失败"), show.error("新作品检测-解析列表失败"),
        new Error("新作品检测-解析列表失败");
        let c = [], d = null;
        for (const m of s) {
            const e = $(m), {carNum: s, url: o, title: r, publishTime: l} = this.getBean("ListPagePlugin").findCarNumAndHref(e);
            if (!s) continue;
            a.find((e => r.includes(e) || s.includes(e))) || (i.has(s) || (d || (d = l), (() => {
                let coverUrl = e.find("img").attr("src") || "";
                if (coverUrl && !coverUrl.startsWith("http")) {
                    coverUrl = coverUrl.startsWith("/") ? this.javDbUrl + coverUrl : this.javDbUrl + "/" + coverUrl;
                }
                let url = o || "";
                if (url && !url.startsWith("http")) {
                    url = url.startsWith("/") ? this.javDbUrl + url : this.javDbUrl + "/" + url;
                }
                const scoreText = e.find(".score .value, .score").text().trim();
                const score = parseFloat(scoreText) || 0;
                const voteMatch = scoreText.match(/由(\d+)人/);
                let voteCount = 0;
                if (voteMatch) {
                    voteCount = parseInt(voteMatch[1]);
                } else {
                    const voteText = e.find(".score .count, .meta .count").text().trim();
                    voteCount = parseInt(voteText.replace(/[^\d]/g, "")) || 0;
                }
                c.push({ carNum: s, coverUrl: coverUrl, title: r || "", publishTime: l || "", score: score, voteCount: voteCount, url: url });
            })()));
        }
        const h = await storageManager.getCarMap(), p = c.filter((e => !h.has(e.carNum)));
        p.length > 0 && clog.log(`<span style='color: #f40'>检测出新作品, ${n}, 共${p.length}部</span>`),
        await storageManager.updateFavoriteActress({
            starId: t,
            lastCheckTime: utils.getNowStr(),
            newVideoList: p,
            lastPublishTime: d
        });
    }
    async checkOneNewVideo(e) {
        const t = await storageManager.getTitleFilterKeyword(), n = await storageManager.getBlacklistCarList(), a = new Set(n.map((e => e.carNum))), {lastCheckTime: i, name: s, starId: o} = e;
        let r = `${this.javDbUrl}/actors/${o}?t=d`;
        const l = $("#checkNewVideoMsg");
        try {
            clog.log("正在检测最新作品, 演员:", s, r), l.text(`正在检测最新作品, 演员: ${s}`);
            const e = await gmHttp.get(r), n = utils.htmlTo$dom(e);
            await this.parsePage(n, o, s, t, a), clog.log('<span style="color: #f40">检测最新作品---结束</span>'),
            l.text("检测完毕");
            this.getBean("NewVideoPlugin").loadData();
        } catch (c) {
            clog.error("检测屏蔽演员信息, 发生错误:", r, c), show.error("检测屏蔽演员信息, 发生错误:" + c, "bottom", "right"),
            l.text(`检测屏蔽演员信息, 发生错误: ${r}`);
        }
    }
}
