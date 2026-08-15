class TaskPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "singleTaskKey", "checkNewActressActorFilterCar"),
        i(this, "taskConfig", null), i(this, "storageQueue", new StorageQueue), i(this, "lastCheckFavoriteActressTimeKey", "jhs_time_checkFavoriteActress"),
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
                o > 0 && (clog.debug(`剩余任务数: <span class="jhs-task-emphasis">${o}</span>`), await utils.sleep(n));
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
            this.isNetworkBlocked(e) ? clog.warn(`后台检测已停止: ${e.message}`) : (clog.error("锁任务出现错误:", e),
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
    /** 确保所有任务入口均已具备配置和站点地址。 */
    async ensureReady() {
        this.taskConfig || await this.loadConfig(), this.javDbUrl || (this.javDbUrl = await this.getBean("OtherSitePlugin").getJavDbUrl());
        if (!this.javDbUrl) throw new Error("JavDB 地址未配置");
    }
    async checkBlacklist(e) {
        await this.ensureReady();
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
        })), clog.log(`<span class="jhs-task-emphasis">检测屏蔽黑名单, 总任务数: ${r.length}, 并发限制:${n}, 请求间隔时间:${a}ms</span>`);
        const c = this.getBean("BlacklistPlugin");
        await this.limitConcurrency(r, n, a, (async e => {
            let {starId: t, name: n, url: a} = e;
            try {
                clog.log("正在检屏黑名单演员:", n, a), $("#checkBlacklistMsg").text(`正在检屏黑名单演员: ${n} ${a}`);
                const e = await gmHttp.get(a), i = utils.htmlTo$dom(e);
                await this.storageQueue.addTask((async () => {
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
        localStorage.setItem(this.lastCheckBlacklistTimeKey, d), clog.log('<span class="jhs-task-emphasis">-------- END 检测屏蔽黑名单 END --------</span>'),
        $("#checkBlacklistMsg").text("检测屏蔽黑名单, 结束"), await this.getBean("BlacklistPlugin").resetBtnTip();
    }
    async checkFavoriteActress() {
        await this.ensureReady();
        const e = `${this.javDbUrl}/users/collection_actors`, t = [];
        await this.scrapeActorInfo(e, t), clog.log("所有演员信息已收集, 总计数量:", t.length), $("#checkNewVideoMsg").text("同步完成"),
        t.length > 0 && (await storageManager.addFavoriteActressList(t), localStorage.setItem(this.lastCheckFavoriteActressTimeKey, utils.getNowStr()),
        await this.getBean("NewVideoPlugin").resetBtnTip());
    }
    async scrapeActorInfo(e, t) {
        clog.log(`正在抓取页面: ${e}`), $("#checkNewVideoMsg").text(`正在解析已收藏的演员: ${e}`);
        let nextUrl = null;
        try {
            const responseText = await gmHttp.get(e), $page = utils.htmlTo$dom(responseText);
            const parsedPage = parseJavDbActorList($page, this.javDbUrl);
            t.push(...parsedPage.actors), nextUrl = parsedPage.nextUrl;
        } catch (n) {
            throw clog.error(`抓取 ${e} 时发生错误，停止本轮同步:`, n), n;
        }
        if (nextUrl) await this.scrapeActorInfo(nextUrl, t);
    }
    async checkNewVideo(e) {
        await this.ensureReady();
        const result = { success: 0, parseFailed: 0, networkFailed: 0, skippedStopped: 0, skippedInterval: 0, aborted: 0 }, t = await storageManager.getFavoriteActressList();
        if (!t.length) return this.renderCheckResult(result, "没有需要检测的演员（当前收藏为空）"), result;
        const n = utils.genericSort(t, [ {
            key: e => {
                var t;
                return (null == (t = e.newVideoList) ? void 0 : t.length) ?? 0;
            },
            order: "desc"
        }, {
            key: "lastPublishTime",
            order: "desc"
        } ]), a = this.taskConfig.checkConcurrencyCount, i = this.taskConfig.checkRequestSleep, s = this.taskConfig.checkNewVideo_intervalTime, o = this.taskConfig.checkNewVideo_ruleTime, r = localStorage.getItem(this.lastCheckNewVideoTimeKey);
        if (!e && r && this.isUnnecessaryCheck(r, s)) return result.skippedInterval = t.length,
        clog.debug(`检测新作品, 上次检测时间: ${r} 检测间隔时间: ${s}小时 未到时间`), this.renderCheckResult(result, "检测间隔未到"), result;
        const l = [], c = [];
        for (const m of n) {
            const {lastCheckTime: t, lastPublishTime: n, name: a} = m;
            !e && t && this.isUnnecessaryCheck(t, s) ? result.skippedInterval++ : !n || 0 === o || this.isUnnecessaryCheck(n, o) ? l.push(m) : (result.skippedStopped++,
            c.push(`检测新作品: ${a} ${n} 停更超过${o / 24 / 365}年,跳过检测`));
        }
        if (0 === l.length) return this.renderCheckResult(result, "没有需要检测的演员"), result;
        c.forEach((e => {
            clog.log(e);
        })), clog.log(`<span class="jhs-task-emphasis">检测最新作品, 总任务数: ${l.length}, 并发限制:${a}, 请求间隔时间:${i}ms</span>`);
        const d = await storageManager.getTitleFilterKeyword(), h = await storageManager.getBlacklistCarList(), g = new Set(h.map((e => e.carNum)));
        try {
            await this.limitConcurrency(l, a, i, (async e => {
            const {lastCheckTime: t, name: n, starId: a} = e;
            let i = `${this.javDbUrl}/actors/${a}?t=d`;
            try {
                clog.log("正在检测最新作品, 演员:", n, i), $("#checkNewVideoMsg").text(`正在检测最新作品, 演员: ${n}`);
                const e = await gmHttp.get(i), t = utils.htmlTo$dom(e);
                try {
                    await this.storageQueue.addTask((async () => this.parsePage(t, T, a, n, d, g))), result.success++;
                } catch (e) {
                    result.parseFailed++, clog.error("解析或保存演员作品失败:", i, e);
                }
            } catch (s) {
                if (this.isNetworkBlocked(s)) throw result.networkFailed++, s;
                result.networkFailed++, clog.error("检测演员信息发生网络错误:", i, s), clog.error("检测演员信息发生网络错误:", i, s);
            }
            })), await this.storageQueue.waitAllFinished();
        } catch (error) {
            if (!this.isNetworkBlocked(error)) throw error;
            result.aborted = Math.max(0, l.length - result.success - result.parseFailed - result.networkFailed), clog.warn(`网络阻断，本轮停止，未执行 ${result.aborted}`);
        }
        result.success > 0 && 0 === result.parseFailed + result.networkFailed + result.aborted && localStorage.setItem(this.lastCheckNewVideoTimeKey, utils.getNowStr()),
        clog.log('<span class="jhs-task-emphasis">检测最新作品---结束</span>'), this.renderCheckResult(result);
        const p = this.getBean("NewVideoPlugin");
        await p.loadData(), await p.resetBtnTip();
        return result;
    }
    renderCheckResult(result, prefix = "检测结束") {
        const message = `${prefix}：成功 ${result.success}，解析失败 ${result.parseFailed}，网络失败 ${result.networkFailed}，停更跳过 ${result.skippedStopped}，间隔跳过 ${result.skippedInterval}${result.aborted ? `，未执行 ${result.aborted}` : ""}`;
        $("#checkNewVideoMsg").text(message), clog.log(message);
    }
    async parsePage(e, site, t, n, a, i) {
        const selector = this.getSelector(site);
        site === I && e.find(".avatar-box").length > 0 && e.find(".avatar-box").parent().remove();
        const pageState = parseDetailPage(e, {
            boxSelector: site === I ? `${selector.boxSelector}, #waterfall` : selector.boxSelector,
            requestDomItemSelector: selector.requestDomItemSelector
        });
        if ("valid" !== pageState.state) throw clog.error("新作品检测-解析列表失败"), new Error("新作品检测-解析列表失败");
        const s = pageState.items, o = e.find(selector.nextPageSelector).attr("href");
        if (0 === s.length) return await storageManager.updateFavoriteActress({
            starId: t,
            lastCheckTime: utils.getNowStr(),
            newVideoList: []
        }), 0;
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
        p.length > 0 && clog.log(`<span class="jhs-task-emphasis">检测出新作品, ${n}, 共${p.length}部</span>`),
        await storageManager.updateFavoriteActress({
            starId: t,
            lastCheckTime: utils.getNowStr(),
            newVideoList: p,
            lastPublishTime: d
        });
        return p.length;
    }
    async checkOneNewVideo(e) {
        await this.ensureReady();
        const t = await storageManager.getTitleFilterKeyword(), n = await storageManager.getBlacklistCarList(), a = new Set(n.map((e => e.carNum))), {lastCheckTime: i, name: s, starId: o} = e;
        let r = `${this.javDbUrl}/actors/${o}?t=d`;
        const l = $("#checkNewVideoMsg");
        try {
            clog.log("正在检测最新作品, 演员:", s, r), l.text(`正在检测最新作品, 演员: ${s}`);
            const e = await gmHttp.get(r), n = utils.htmlTo$dom(e);
            await this.parsePage(n, T, o, s, t, a), clog.log('<span class="jhs-task-emphasis">检测最新作品---结束</span>'),
            l.text("检测完毕");
            this.getBean("NewVideoPlugin").loadData();
        } catch (c) {
            clog.error("检测屏蔽演员信息, 发生错误:", r, c), show.error("检测屏蔽演员信息, 发生错误:" + c, "bottom", "right"),
            l.text(`检测屏蔽演员信息, 发生错误: ${r}`);
        }
    }
}
