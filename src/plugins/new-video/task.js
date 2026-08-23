class TaskPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "singleTaskKey", "checkNewActressActorFilterCar"),
        i(this, "taskConfig", null), i(this, "storageQueue", new StorageQueue), i(this, "lastCheckFavoriteActressTimeKey", "jhs_time_checkFavoriteActress"),
        i(this, "lastCheckBlacklistTimeKey", "jhs_time_checkBlacklist"), i(this, "lastCheckNewVideoTimeKey", "jhs_time_checkNewVideo"),
        i(this, "lastCheckFavoriteActressAttemptKey", "jhs_time_checkFavoriteActress_attempt"), i(this, "lastCheckFavoriteActressNextKey", "jhs_time_checkFavoriteActress_next"),
        i(this, "lastCheckBlacklistAttemptKey", "jhs_time_checkBlacklist_attempt"), i(this, "lastCheckBlacklistNextKey", "jhs_time_checkBlacklist_next"),
        i(this, "lastCheckNewVideoAttemptKey", "jhs_time_checkNewVideo_attempt"), i(this, "lastCheckNewVideoNextKey", "jhs_time_checkNewVideo_next"),
        i(this, "taskTimer", null), i(this, "taskRunning", !1), i(this, "visibilityHandler", null), i(this, "pageHideHandler", null),
        i(this, "settingsHandler", null), i(this, "taskConfigDirty", !1), i(this, "configLoadPromise", null), i(this, "configLoadQueued", !1), i(this, "configRefreshPromise", null), i(this, "configRefreshQueued", !1),
        i(this, "activeTasks", new Set);
    }
    getName() {
        return "TaskPlugin";
    }
    getStartupMode() {
        return "idle";
    }
    async limitConcurrency(e, t, n, a) {
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
    createTaskResult(extra = {}) {
        return { attempted: !1, completed: !1, fatal: !1, success: 0, networkFailed: 0, parseFailed: 0, aborted: 0, skippedInterval: 0, skippedStopped: 0, ...extra };
    }
    async runBackgroundTask(name, runner) {
        try {
            return await runner();
        } catch (error) {
            if (this.isNetworkBlocked(error)) throw error;
            return clog.error(`${name}执行失败，继续后续后台任务`, error), this.createTaskResult({ attempted: !0, error });
        }
    }
    isUnnecessaryCheck(e, t) {
        if (!t) throw new Error("未传入checkIntervalTime");
        t = parseInt(t);
        return utils.getHourDifference(new Date(e), new Date) < t;
    }
    getTaskSchedule(name) {
        const schedules = {
            blacklist: { completedKey: this.lastCheckBlacklistTimeKey, attemptKey: this.lastCheckBlacklistAttemptKey, nextKey: this.lastCheckBlacklistNextKey, intervalSetting: "checkBlacklist_intervalTime", defaultInterval: 12 },
            favoriteActress: { completedKey: this.lastCheckFavoriteActressTimeKey, attemptKey: this.lastCheckFavoriteActressAttemptKey, nextKey: this.lastCheckFavoriteActressNextKey, intervalSetting: "checkFavoriteActress_IntervalTime", defaultInterval: 24 },
            newVideo: { completedKey: this.lastCheckNewVideoTimeKey, attemptKey: this.lastCheckNewVideoAttemptKey, nextKey: this.lastCheckNewVideoNextKey, intervalSetting: "checkNewVideo_intervalTime", defaultInterval: 12 }
        };
        if (!schedules[name]) throw new Error(`未知任务调度: ${name}`);
        return schedules[name];
    }
    getTaskScheduleState(name) {
        const schedule = this.getTaskSchedule(name), completed = parseTaskTimestamp(localStorage.getItem(schedule.completedKey)), attempt = parseTaskTimestamp(localStorage.getItem(schedule.attemptKey));
        return { ...schedule, completed, attempt, pending: null != attempt && (null == completed || attempt > completed) };
    }
    /** 返回当前标签页可证明的任务状态，不写入调度数据。 */
    getTaskStatusSnapshot(name) {
        const state = this.getTaskScheduleState(name), storedNext = parseTaskTimestamp(localStorage.getItem(state.nextKey));
        const nextAt = null == storedNext ? state.pending && null != state.attempt ? state.attempt + 3e5 : 0 : storedNext, now = Date.now();
        let status = "idle";
        if (this.activeTasks.has(name)) status = "running";
        else if (state.pending && now < nextAt) status = "pending";
        else if (null == storedNext || now >= nextAt) status = "due";
        return { name, state: status, completedAt: state.completed, attemptAt: state.attempt, nextAt, isPending: state.pending, pendingUntil: state.pending ? nextAt : null };
    }
    async emitTaskStatus(name, phase) {
        try {
            await globalThis.jhsEventBus?.emit?.("task-status-changed", { taskName: name, phase }, { broadcast: !1 });
        } catch (error) {
            clog.error(`任务状态通知失败: ${name}/${phase}`, error);
        }
    }
    async emitNewVideoChanged(reason, carNums = []) {
        try {
            await globalThis.jhsEventBus?.emit?.("new-video-changed", { reason, carNums: carNums.map(normalizeCarNum).filter(Boolean) });
        } catch (error) {
            clog.error("新作品状态通知失败", error);
        }
    }
    async withActiveTask(name, runner) {
        this.activeTasks.add(name);
        try {
            await this.emitTaskStatus(name, "started");
            return await runner();
        } finally {
            this.activeTasks.delete(name), await this.emitTaskStatus(name, "finished");
        }
    }
    async getLatestTaskInterval(name) {
        const schedule = this.getTaskSchedule(name);
        storageManager._invalidateCache?.(storageManager.setting_key);
        return parseNumberSetting(await storageManager.getSetting(schedule.intervalSetting, schedule.defaultInterval), schedule.defaultInterval, { min: Number.EPSILON });
    }
    async shouldStartTask(name, force = !1) {
        if (force) return !0;
        const schedule = this.getTaskSchedule(name), interval = await this.getLatestTaskInterval(name);
        const completed = parseTaskTimestamp(localStorage.getItem(schedule.completedKey)), attempt = parseTaskTimestamp(localStorage.getItem(schedule.attemptKey));
        let next = parseTaskTimestamp(localStorage.getItem(schedule.nextKey));
        if (null == next) {
            const pending = null != attempt && (null == completed || attempt > completed);
            next = pending ? attempt + 3e5 : null == completed ? 0 : completed + 36e5 * interval;
            localStorage.setItem(schedule.nextKey, String(next));
        }
        return Date.now() >= next;
    }
    beginTaskAttempt(name) {
        const schedule = this.getTaskSchedule(name), completed = parseTaskTimestamp(localStorage.getItem(schedule.completedKey));
        const now = Math.floor(Date.now() / 1e3) * 1e3, attempt = null == completed ? now : Math.max(now, completed + 1e3);
        localStorage.setItem(schedule.attemptKey, String(attempt)), localStorage.setItem(schedule.nextKey, String(attempt + 3e5));
        return attempt;
    }
    async finalizeTask(name, completed) {
        const schedule = this.getTaskSchedule(name);
        if (!completed) return localStorage.setItem(schedule.nextKey, String(Date.now() + 3e5));
        const attempt = parseTaskTimestamp(localStorage.getItem(schedule.attemptKey)) || 0, completedAt = Math.max(Math.floor(Date.now() / 1e3) * 1e3, attempt), interval = await this.getLatestTaskInterval(name);
        localStorage.setItem(schedule.completedKey, utils.getNowStr("-", ":", completedAt)), localStorage.setItem(schedule.nextKey, String(completedAt + 36e5 * interval));
    }
    async recalculateSchedules() {
        await this.loadConfig();
        for (const [name, interval] of [ [ "blacklist", this.taskConfig.checkBlacklist_intervalTime ], [ "favoriteActress", this.taskConfig.checkFavoriteActress_IntervalTime ], [ "newVideo", this.taskConfig.checkNewVideo_intervalTime ] ]) {
            const state = this.getTaskScheduleState(name);
            if (state.pending) continue;
            localStorage.setItem(state.nextKey, String(null == state.completed ? Date.now() : state.completed + 36e5 * interval));
        }
    }
    async invalidateConfig(recalculate = !1) {
        this.taskConfigDirty = !0;
        if (!recalculate) return;
        if (this.configRefreshPromise) return this.configRefreshQueued = !0, this.configRefreshPromise;
        return this.configRefreshPromise = (async () => {
            do {
                this.configRefreshQueued = !1, await this.recalculateSchedules();
            } while (this.configRefreshQueued);
        })().finally((() => {
            this.configRefreshPromise = null;
        })), this.configRefreshPromise;
    }
    handle() {
        if (!window.isListPage) return;
        this.visibilityHandler || (this.visibilityHandler = () => {
            document.hidden ? this.clearSchedule() : this.scheduleTask(0);
        }, this.pageHideHandler = () => this.clearSchedule(), document.addEventListener("visibilitychange", this.visibilityHandler),
        window.addEventListener("pagehide", this.pageHideHandler));
        this.settingsHandler || (this.settingsHandler = async () => {
            try {
                storageManager._invalidateCache?.(storageManager.setting_key), await this.invalidateConfig(!0), this.scheduleTask(0);
            } catch (error) {
                clog.error("任务设置刷新失败", error);
            }
        }, globalThis.jhsEventBus?.on?.("settings-changed", this.settingsHandler));
        return document.hidden ? void 0 : this.runAndSchedule();
    }
    clearSchedule() {
        this.taskTimer && (clearTimeout(this.taskTimer), this.taskTimer = null);
    }
    scheduleTask(e = 3e5) {
        if (!window.isListPage || document.hidden) return void this.clearSchedule();
        this.clearSchedule(), this.taskTimer = setTimeout((() => {
            this.taskTimer = null, void this.runAndSchedule();
        }), e);
    }
    async runAndSchedule() {
        if (this.taskRunning || !window.isListPage || document.hidden) return;
        this.taskRunning = !0;
        try { await this.doTask(); } finally {
            this.taskRunning = !1, this.scheduleTask();
        }
    }
    async doTask() {
        if (!window.isListPage) return;
        await this.loadConfig(), this.javDbUrl = await this.getBean("OtherSitePlugin").getJavDbUrl();
        return navigator.locks.request(this.singleTaskKey, {
            ifAvailable: !0
        }, (async e => {
            if (e) {
                if (window.isListPage && (this.taskConfig.enableCheckBlacklist === _ ? await this.runBackgroundTask("黑名单整批检测", (() => this.checkBlacklist())) : clog.warn("自动检测屏蔽黑名单-禁用"),
                !l)) {
                    if (this.taskConfig.enableCheckFavoriteActress === _) {
                        $('a[href*="/users/profile"]').length > 0 ? await this.runBackgroundTask("演员收藏同步", (() => this.checkFavoriteActress())) : clog.debug("未登录 JavDB，跳过自动同步演员");
                    } else clog.warn("自动同步已收藏的演员-禁用");
                    this.taskConfig.enableCheckNewVideo === _ ? await this.runBackgroundTask("新作品整批检测", (() => this.checkNewVideo())) : clog.warn("自动检测已收藏演员的最新作品-禁用");
                }
            } else clog.debug("争夺任务锁失败, 跳过执行");
        })).catch((e => {
            this.isNetworkBlocked(e) ? clog.warn(`后台检测已停止: ${e.message}`) : clog.error("锁任务出现错误:", e);
        }));
    }
    async loadConfig() {
        if (this.configLoadPromise) return this.configLoadQueued = !0, this.configLoadPromise;
        return this.configLoadPromise = (async () => {
            do {
                this.configLoadQueued = !1;
                const e = await storageManager.getSetting(), nextConfig = {
                    checkConcurrencyCount: parseNumberSetting(e.checkConcurrencyCount, 2, { min: 2, max: 5 }),
                    checkRequestSleep: parseNumberSetting(e.checkRequestSleep, 100, { min: 0, max: 3e3 }),
                    enableCheckBlacklist: e.enableCheckBlacklist || _,
                    checkBlacklist_intervalTime: parseNumberSetting(e.checkBlacklist_intervalTime, 12, { min: Number.EPSILON }),
                    checkBlacklist_ruleTime: parseNumberSetting(e.checkBlacklist_ruleTime, 8760, { min: 0 }),
                    enableCheckFavoriteActress: e.enableCheckFavoriteActress || _,
                    checkFavoriteActress_IntervalTime: parseNumberSetting(e.checkFavoriteActress_IntervalTime, 24, { min: Number.EPSILON }),
                    enableCheckNewVideo: e.enableCheckNewVideo || _,
                    checkNewVideo_intervalTime: parseNumberSetting(e.checkNewVideo_intervalTime, 12, { min: Number.EPSILON }),
                    checkNewVideo_ruleTime: parseNumberSetting(e.checkNewVideo_ruleTime, 8760, { min: 0 })
                };
                this.taskConfig = nextConfig, this.taskConfigDirty = !1;
            } while (this.configLoadQueued || this.taskConfigDirty);
            return this.taskConfig;
        })().finally((() => {
            this.configLoadPromise = null;
        })), this.configLoadPromise;
    }
    /** 确保所有任务入口均已具备配置和站点地址。 */
    async ensureReady() {
        (!this.taskConfig || this.taskConfigDirty) && await this.loadConfig(), this.javDbUrl || (this.javDbUrl = await this.getBean("OtherSitePlugin").getJavDbUrl());
        if (!this.javDbUrl) throw new Error("JavDB 地址未配置");
    }
    async resolveBlacklistSite(url) {
        try {
            const target = new URL(url), otherSite = this.getBean("OtherSitePlugin"), [ javDbUrl, javBusUrl ] = await Promise.all([ otherSite?.getJavDbUrl?.(), otherSite?.getJavBusUrl?.() ]);
            for (const [ configuredUrl, site ] of [ [ javDbUrl, T ], [ javBusUrl, I ] ]) {
                try {
                    if (configuredUrl && target.hostname === new URL(configuredUrl).hostname) return site;
                } catch (error) {
                    clog.warn(`忽略无效的站点配置: ${configuredUrl}`, error);
                }
            }
            const {site} = detectSite(url);
            return [ T, I ].includes(site) ? site : null;
        } catch (error) {
            return null;
        }
    }
    async checkBlacklist(force = !1) {
        await this.ensureReady();
        const result = this.createTaskResult({ skippedHost: 0 });
        if (!await this.shouldStartTask("blacklist", force)) return clog.debug("检测黑名单未到整批执行时间"), result;
        this.beginTaskAttempt("blacklist"), result.attempted = !0;
        return this.withActiveTask("blacklist", async () => {
            let blockedError = null, finalized = !1;
            try {
            let items = await storageManager.getBlacklist();
            items = items.sort(((left, right) => left.createTime < right.createTime ? 1 : left.createTime > right.createTime ? -1 : 0));
            const concurrency = this.taskConfig.checkConcurrencyCount, sleep = this.taskConfig.checkRequestSleep, interval = this.taskConfig.checkBlacklist_intervalTime, rule = this.taskConfig.checkBlacklist_ruleTime;
            const eligible = [], currentHostname = new URL(window.location.href).hostname;
            for (const item of items) {
                let itemUrl;
                try {
                    itemUrl = new URL(item.url);
                } catch (error) {
                    result.parseFailed++, clog.error("黑名单地址无效:", item.url, error);
                    continue;
                }
                if (currentHostname !== itemUrl.hostname) {
                    result.skippedHost++;
                    continue;
                }
                if (!force && item.checkTime && this.isUnnecessaryCheck(item.checkTime, interval)) result.skippedInterval++;
                else if (shouldSkipStopped(item.lastPublishTime, rule)) result.skippedStopped++;
                else {
                    const site = await this.resolveBlacklistSite(itemUrl.href);
                    site ? eligible.push({ item, site }) : (result.parseFailed++, clog.error(`不支持的黑名单来源站点: ${itemUrl.hostname}`));
                }
            }
            clog.log(`<span class="jhs-task-emphasis">检测屏蔽黑名单, 总任务数: ${eligible.length}, 并发限制:${concurrency}, 请求间隔时间:${sleep}ms</span>`);
            const blacklistPlugin = this.getBean("BlacklistPlugin");
            try {
                await this.limitConcurrency(eligible, concurrency, sleep, (async entry => {
                    const {item, site} = entry;
                    const {starId, name, url} = item;
                    let responseText;
                    try {
                        clog.log("正在检屏黑名单演员:", name, url), $("#checkBlacklistMsg").text(`正在检屏黑名单演员: ${name} ${url}`), responseText = await gmHttp.get(url);
                    } catch (error) {
                        result.networkFailed++;
                        if (this.isNetworkBlocked(error)) throw error;
                        return void clog.error("检测屏蔽演员网络错误:", url, error);
                    }
                    try {
                        const page = utils.htmlTo$dom(responseText);
                        await this.storageQueue.addTask((async () => {
                            const parsed = await blacklistPlugin.parseAndSaveFilterInfo(page, name, starId, site);
                            await storageManager.updateBlacklistItem({ starId, name, checkTime: utils.getNowStr(), lastPublishTime: parsed.lastPublishTime });
                        })), result.success++;
                    } catch (error) {
                        result.parseFailed++, clog.error("解析或保存黑名单演员失败:", url, error);
                    }
                })), await this.storageQueue.waitAllFinished();
            } catch (error) {
                if (!this.isNetworkBlocked(error)) throw error;
                blockedError = error, result.aborted = Math.max(0, eligible.length - result.success - result.parseFailed - result.networkFailed);
            }
            const completed = 0 === result.parseFailed + result.networkFailed + result.aborted;
            result.completed = completed, result.fatal = !!blockedError, await this.finalizeTask("blacklist", completed), finalized = !0, this.renderBlacklistResult(result, completed);
            try { await this.getBean("BlacklistPlugin").resetBtnTip(); } catch (error) { clog.error("刷新黑名单检测提示失败", error); }
            if (blockedError) throw blockedError;
            return result;
            } catch (error) {
                finalized || await this.finalizeTask("blacklist", !1), result.completed = !1, result.fatal = this.isNetworkBlocked(error);
                if (result.fatal) throw error;
                return result.parseFailed++, clog.error("黑名单整批检测失败", error), result;
            }
        });
    }
    renderBlacklistResult(result, completed) {
        const retry = completed ? "" : "，5 分钟后补偿未完成项", message = `黑名单整批检测：成功 ${result.success}，解析/存储失败 ${result.parseFailed}，网络失败 ${result.networkFailed}，停更跳过 ${result.skippedStopped}，间隔跳过 ${result.skippedInterval}，异站跳过 ${result.skippedHost}${result.aborted ? `，未执行 ${result.aborted}` : ""}${retry}`;
        $("#checkBlacklistMsg").text(message), clog.log(message);
    }
    async checkFavoriteActress(force = !1) {
        await this.ensureReady();
        const result = this.createTaskResult({ pages: 0, actorCount: 0 });
        if (!await this.shouldStartTask("favoriteActress", force)) return clog.debug("同步收藏演员未到整批执行时间"), result;
        this.beginTaskAttempt("favoriteActress"), result.attempted = !0;
        return this.withActiveTask("favoriteActress", async () => {
            try {
                const actors = [], sync = await this.scrapeActorInfo(`${this.javDbUrl}/users/collection_actors`, actors);
                actors.length > 0 && await storageManager.addFavoriteActressList(actors), result.success = actors.length, result.actorCount = actors.length, result.pages = sync.pages;
                await this.finalizeTask("favoriteActress", !0), result.completed = !0, clog.log("所有演员信息已收集, 总计数量:", actors.length), $("#checkNewVideoMsg").text(`完整同步完成：演员 ${actors.length}，页面 ${sync.pages}`);
                actors.length > 0 && await this.emitNewVideoChanged("favorite-actress-sync");
                return result;
            } catch (error) {
                result.completed = !1, error?._taskNetwork ? result.networkFailed++ : result.parseFailed++, result.fatal = this.isNetworkBlocked(error), await this.finalizeTask("favoriteActress", !1), $("#checkNewVideoMsg").text("演员同步失败，5 分钟后重试整轮"), clog.error("同步收藏演员失败", error);
                if (result.fatal) throw error;
                return result;
            }
        });
    }
    async scrapeActorInfo(startUrl, target = []) {
        const expected = new URL("/users/collection_actors", this.javDbUrl), visitedUrls = new Set;
        let currentUrl = new URL(startUrl, this.javDbUrl), pages = 0;
        for (;currentUrl; ) {
            try {
                if (currentUrl.origin !== expected.origin || currentUrl.pathname !== expected.pathname) throw new Error(`收藏演员分页地址越界: ${currentUrl.href}`);
                if (visitedUrls.has(currentUrl.href)) throw new Error(`收藏演员分页循环: ${currentUrl.href}`);
                if (pages >= 200) throw new Error("收藏演员分页超过 200 页");
                visitedUrls.add(currentUrl.href), pages++, clog.log(`正在抓取页面: ${currentUrl.href}`), $("#checkNewVideoMsg").text(`正在解析已收藏的演员: ${currentUrl.href}`);
                let responseText;
                try { responseText = await gmHttp.get(currentUrl.href); } catch (error) { throw error._taskNetwork = !0, error; }
                const page = utils.htmlTo$dom(responseText), parsed = parseJavDbActorList(page, currentUrl.href);
                if ("valid" !== parsed.state) throw Object.assign(new Error(`收藏演员页面无效: ${parsed.state}`), { _taskParse: !0 });
                if (parsed.isEmpty && parsed.nextUrl) throw Object.assign(new Error("收藏演员空页面包含下一页"), { _taskParse: !0 });
                target.push(...parsed.actors), currentUrl = parsed.nextUrl ? new URL(parsed.nextUrl, currentUrl.href) : null;
            } catch (error) {
                error._taskNetwork || Object.prototype.hasOwnProperty.call(error, "_taskParse") || (error._taskParse = !0);
                throw clog.error(`抓取 ${currentUrl?.href || startUrl} 时发生错误，停止本轮同步:`, error), error;
            }
        }
        return { actors: target, pages };
    }
    async checkNewVideo(force = !1) {
        await this.ensureReady();
        const result = this.createTaskResult();
        if (!await this.shouldStartTask("newVideo", force)) return clog.debug("检测新作品未到整批执行时间"), result;
        this.beginTaskAttempt("newVideo"), result.attempted = !0;
        return this.withActiveTask("newVideo", async () => {
            let blockedError = null, finalized = !1;
            try {
            const actresses = await storageManager.getFavoriteActressList(), sorted = utils.genericSort(actresses, [ {
                key: actress => actress.newVideoList?.length ?? 0,
                order: "desc"
            }, {
                key: "lastPublishTime",
                order: "desc"
            } ]), concurrency = this.taskConfig.checkConcurrencyCount, sleep = this.taskConfig.checkRequestSleep, interval = this.taskConfig.checkNewVideo_intervalTime, rule = this.taskConfig.checkNewVideo_ruleTime;
            const eligible = [];
            for (const actress of sorted) {
                if (!force && actress.lastCheckTime && this.isUnnecessaryCheck(actress.lastCheckTime, interval)) result.skippedInterval++;
                else if (shouldSkipStopped(actress.lastPublishTime, rule)) result.skippedStopped++;
                else eligible.push(actress);
            }
            clog.log(`<span class="jhs-task-emphasis">检测最新作品, 总任务数: ${eligible.length}, 并发限制:${concurrency}, 请求间隔时间:${sleep}ms</span>`);
            if (eligible.length > 0) {
                const titleKeywords = await storageManager.getTitleFilterKeyword(), blacklistCars = await storageManager.getBlacklistCarList(), blacklistSet = new Set(blacklistCars.map((item => item.carNum)));
                try {
                    await this.limitConcurrency(eligible, concurrency, sleep, (async actress => {
                        const {name, starId} = actress, url = `${this.javDbUrl}/actors/${starId}?t=d`;
                        try {
                            clog.log("正在检测最新作品, 演员:", name, url), $("#checkNewVideoMsg").text(`正在检测最新作品, 演员: ${name}`);
                            const responseText = await gmHttp.get(url), page = utils.htmlTo$dom(responseText);
                            try {
                                await this.storageQueue.addTask((async () => this.parsePage(page, T, starId, name, titleKeywords, blacklistSet))), result.success++;
                            } catch (error) {
                                result.parseFailed++, clog.error("解析或保存演员作品失败:", url, error);
                            }
                        } catch (error) {
                            if (this.isNetworkBlocked(error)) throw result.networkFailed++, error;
                            result.networkFailed++, clog.error("检测演员信息发生网络错误:", url, error);
                        }
                    })), await this.storageQueue.waitAllFinished();
                } catch (error) {
                    if (!this.isNetworkBlocked(error)) throw error;
                    blockedError = error, result.fatal = !0, result.aborted = Math.max(0, eligible.length - result.success - result.parseFailed - result.networkFailed), clog.warn(`网络阻断，本轮停止，未执行 ${result.aborted}`);
                }
            }
            const completed = 0 === result.parseFailed + result.networkFailed + result.aborted;
            result.completed = completed, await this.finalizeTask("newVideo", completed), finalized = !0, clog.log('<span class="jhs-task-emphasis">检测最新作品---结束</span>'), this.renderCheckResult(result, completed ? actresses.length ? "整批检测结束" : "收藏为空，整批检测完成" : "整批检测未完成，5 分钟后补偿未完成项");
            result.success > 0 && await this.emitNewVideoChanged("task-completed");
            if (blockedError) throw blockedError;
            return result;
            } catch (error) {
                finalized || await this.finalizeTask("newVideo", !1), result.completed = !1, result.fatal = this.isNetworkBlocked(error);
                if (result.fatal) throw error;
                return result.parseFailed++, this.renderCheckResult(result, "整批检测失败，5 分钟后补偿"), clog.error("新作品整批检测失败", error), result;
            }
        });
    }
    renderCheckResult(result, prefix = "检测结束") {
        const message = `${prefix}：成功 ${result.success}，解析/存储失败 ${result.parseFailed}，网络失败 ${result.networkFailed}，停更跳过 ${result.skippedStopped}，间隔跳过 ${result.skippedInterval}${result.aborted ? `，未执行 ${result.aborted}` : ""}`;
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
        if (0 === s.length && o) throw new Error("新作品检测-空列表包含下一页");
        if (0 === s.length) return await storageManager.updateFavoriteActress({
            starId: t,
            lastCheckTime: utils.getNowStr(),
            newVideoList: []
        }), 0;
        let c = [];
        const publishTimes = [];
        for (const m of s) {
            const e = $(m), {carNum: s, url: o, title: r, publishTime: l} = this.getBean("ListPagePlugin").findCarNumAndHref(e);
            l && publishTimes.push(l);
            if (!s) continue;
            a.find((e => r.includes(e) || s.includes(e))) || (i.has(s) || (() => {
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
            })());
        }
        const d = selectLatestPublishTime(publishTimes), h = await storageManager.getCarMap(), p = c.filter((e => !h.has(e.carNum)));
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
            await this.emitNewVideoChanged("single-actress-check");
        } catch (c) {
            clog.error("检测屏蔽演员信息, 发生错误:", r, c), show.error("检测屏蔽演员信息, 发生错误:" + c, "bottom", "right"),
            l.text(`检测屏蔽演员信息, 发生错误: ${r}`);
        }
    }
}
