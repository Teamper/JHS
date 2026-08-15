const Z = (e, t) => {
    if (!e || 0 === e.length) return null;
    const n = new Set(e);
    if (n.has(t)) return t;
    const a = L.map((e => e.quality)).reverse();
    for (const i of a) if (n.has(i)) return i;
    return e[0];
}, ee = "jhs_dmm_video";

class DmmPreviewParser {
    constructor(e) {
        this.carNum = e, this.lastError = null;
    }
    _checkCache() {
        const e = localStorage.getItem(ee) ? JSON.parse(localStorage.getItem(ee)) : {};
        return e[this.carNum] ? (clog.debug("缓存中存在预览视频信息", e[this.carNum]), e[this.carNum]) : null;
    }
    _updateCache(e) {
        const t = localStorage.getItem(ee) ? JSON.parse(localStorage.getItem(ee)) : {};
        t[this.carNum] = e, clog.debug("成功解析出预览视频并已缓存:", e), localStorage.setItem(ee, JSON.stringify(t));
    }
    async _searchContentIds() {
        const e = this.carNum, t = e.replace(/-/g, ""), n = [ {
            keyword: e.replace("-", "00"),
            name: "00-替换关键词"
        }, {
            keyword: e,
            name: "原始番号关键词"
        }, {
            keyword: t,
            name: "无连字符关键词"
        } ], a = e.toLowerCase();
        let hadSuccessfulRequest = !1;
        for (const o of n) {
            const {keyword: e, name: n} = o, i = e.toLowerCase();
            clog.debug(`--- 尝试使用 ${n} (${e}) 进行 API 搜索 ---`);
            const r = `https://api.dmm.com/affiliate/v3/ItemList?${new URLSearchParams({
                api_id: "UrwskPfkqQ0DuVry2gYL",
                affiliate_id: "10278-996",
                output: "json",
                site: "FANZA",
                sort: "match",
                keyword: e
            }).toString()}`;
            let l;
            try {
                l = await gmHttp.get(r);
                hadSuccessfulRequest = !0;
            } catch (s) {
                this.lastError = new ProviderError("dmm", "HTTP_ERROR", `DMM API 请求失败: ${s.message || s}`, {
                    cause: s,
                    url: r,
                    status: s?.status,
                    retryable: !0
                }), clog.error(`API 请求失败，跳过 ${n}:`, this.lastError);
                continue;
            }
            if (!l || !l.result || !l.result.result_count) {
                clog.debug("API 返回无结果，尝试下一个关键词。");
                continue;
            }
            const c = [];
            for (const s of l.result.items) {
                if (c.length >= 2) break;
                const e = s.content_id || "", o = s.maker_product || "";
                (e.includes(i.replace("-", "")) || a === o.toLowerCase() || e.includes(t.toLowerCase())) && (c.push({
                    serviceCode: s.service_code,
                    floorCode: s.floor_code,
                    contentId: e,
                    pageUrl: s.URL
                }), clog.debug(`[${n}] cid|makerProduct 匹配成功:`, e, o));
            }
            if (c.length > 0) {
                clog.debug(`--- 成功通过 ${n} 找到 Content IDs ---`);
                const t = $("#fanzaBtn");
                let a = `https://www.dmm.co.jp/search/=/searchstr=${e}`, i = "single";
                c.length > 1 ? (t.attr("href", a), t.append('<span class="site-tag jhs-layout-294497f1">多结果</span>'),
                t.css("backgroundColor", "var(--jhs-status-down)"), i = "multiple") : (a = c[0].pageUrl, t.attr("href", a),
                t.css("backgroundColor", "var(--jhs-status-down)"));
                const s = "jhs_other_site_dmm", o = localStorage.getItem(s) ? JSON.parse(localStorage.getItem(s)) : {};
                return o[this.carNum] = {
                    type: i,
                    url: a
                }, localStorage.setItem(s, JSON.stringify(o)), c;
            }
            clog.debug(`[${n}] API 返回结果数 ${l.result.result_count}，但无精确匹配的 Content ID。`);
        }
        hadSuccessfulRequest && (this.lastError = null);
        clog.warn("所有关键词尝试均未找到匹配的Content ID, 解析Dmm视频失败");
        const i = $("#fanzaBtn");
        return i.attr("href", `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`),
        i.attr("title", "未查询到, 点击前往搜索页"), i.css("backgroundColor", "var(--jhs-status-filter)"), null;
    }
    async _extractTrailerLinks({contentId: e, serviceCode: t, floorCode: n}) {
        const a = `https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${e}/mtype=AhRVShI_/service=${t}/floor=${n}/mode=/`, i = await gmHttp.get(a, null, {
            "accept-language": "ja-JP,ja;q=0.9",
            Cookie: "age_check_done=1"
        });
        if ("string" != typeof i) throw clog.error(i), new ProviderError("dmm", "PARSE_ERROR", "解析播放页内容失败, 非文本内容", {
            url: a
        });
        if (i.includes("このサービスはお住まいの地域からは")) throw new ProviderError("dmm", "REGION_BLOCKED", "DMM 预览源不可用，请将 DMM 域名分流到日本 IP", {
            url: a
        });
        const s = i.match(/const\s+args\s+=\s+(.*);/);
        if (!s) throw new ProviderError("dmm", "PARSE_ERROR", "未在脚本中找到 const args = ... 变量", {
            url: a
        });
        let o;
        try {
            ({bitrates: o} = JSON.parse(s[1]));
        } catch (d) {
            throw new ProviderError("dmm", "PARSE_ERROR", `解析播放器脚本 JSON 失败: ${d.message}`, {
                cause: d,
                url: a
            });
        }
        const r = {}, l = L.map((e => e.quality)).join("|"), c = new RegExp(`(${l})\\.mp4$`);
        if (!Array.isArray(o)) throw clog.error("解析画质链接失败: bitrates 字段不是一个数组或不存在"), new ProviderError("dmm", "PARSE_ERROR", "解析画质链接失败: bitrates 字段不是一个数组或不存在", {
            url: a
        });
        clog.debug("原始数据返回:", o);
        for (const h of o) {
            const e = null == h ? void 0 : h.src;
            if (!e || "string" != typeof e || !e.endsWith(".mp4")) continue;
            const t = e.match(c);
            let n = "";
            t && t[1] && (n = t[1]), n && !r[n] && (r[n] = e);
        }
        if (0 === Object.keys(r).length) throw new ProviderError("dmm", "PARSE_ERROR", "未找到匹配要求的预览画质视频", {
            url: a
        });
        return r;
    }
    async fetchVideo() {
        const carNum = normalizeCarNum(this.carNum);
        if (!carNum) return clog.warn("跳过 DMM 解析：番号不可用"), null;
        this.carNum = carNum;
        const e = this._checkCache();
        if (e) return e;
        let t;
        try {
            const e = this.carNum.toLowerCase();
            if (e.startsWith("heyzo") || /^(n\d+|\d+(-\d+)*)$/.test(e) || /^n\d+$/.test(e)) return clog.debug("无码番号类型，取消 DMM 解析"), null;
            if (this.carNum.includes("VR-")) return clog.debug("VR 类型，取消 DMM 解析"), null;
            t = await this._searchContentIds();
        } catch (n) {
            this.lastError = n instanceof ProviderError ? n : new ProviderError("dmm", "PARSE_ERROR", n.message || String(n), {
                cause: n
            }), clog.error("DMM API 搜索失败:", this.lastError);
            const e = $("#fanzaBtn");
            return e.attr("href", `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`),
            e.attr("title", "未查询到, 点击前往搜索页"), e.css("backgroundColor", "var(--jhs-status-filter)"), null;
        }
        if (!t || 0 === t.length) return null;
        try {
            const e = await Promise.any(t.map((e => this._extractTrailerLinks(e))));
            return this._updateCache(e), e;
        } catch (a) {
            const e = a.errors || [ a ];
            this.lastError = e.find((e => "REGION_BLOCKED" === e?.code)) || e.find((e => e instanceof ProviderError)) || new ProviderError("dmm", "PARSE_ERROR", e[0]?.message || String(e[0]), {
                cause: e[0]
            }), clog.error(`解析失败: ${this.lastError.message}`, e);
            const t = $("#fanzaBtn");
            return t.attr("href", `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`),
            t.attr("title", "未查询到, 点击前往搜索页"), t.css("backgroundColor", "var(--jhs-status-filter)"), null;
        }
    }
}

/** 获取 DMM 预览源及可供界面判断的失败原因。 */
async function fetchDmmPreview(carNum) {
    const parser = new DmmPreviewParser(carNum), sources = await parser.fetchVideo();
    return {
        sources,
        error: parser.lastError
    };
}

class PreviewVideoPlugin extends BasePlugin {
    getName() {
        return "PreviewVideoPlugin";
    }
    async initCss() {
        return ".jhs-dmm-preview-player{display:none;width:100%;height:auto}.jhs-dmm-preview-player.is-active{display:block}.jhs-native-preview-hidden{display:none!important}";
    }
    async handle() {
        if (!isDetailPage) return;
        const trigger = $(".preview-video-container"), openVideo = () => {
            utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => {
                this.handleVideo().catch((error => clog.error("预览视频处理失败", error)));
            }));
        };
        trigger.off("click.jhsVideo").on("click.jhsVideo", openVideo);
        await storageManager.getSetting("enableLoadPreviewVideo", _) !== _ || o.includes("autoPlay=1") || this.initDmm();
        const url = window.location.href;
        (url.includes("gallery-1") || url.includes("gallery-2")) && openVideo(), url.includes("autoPlay=1") && trigger.length > 0 && trigger[0].click();
    }
    async initDmm() {
        try {
            const {sources} = await this.getDmmPreview();
            if (!sources) return;
            const $video = $("#preview-video"), video = $video[0];
            if (video) return;
            clog.debug("JavDB没有视频播放元素, 开始创建...");
            const cover = $(".column-video-cover img").attr("src");
            $(".preview-images").prepend(`\n                <a class="preview-video-container" data-fancybox="gallery" href="#preview-video">\n                    <span>预告片</span>\n                    <img src="${cover}" class="video-cover jhs-layout-8cf76fd7" alt="">\n                </a>\n            `), $(".preview-video-container").off("click.jhsVideo").on("click.jhsVideo", (() => {
                utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => this.handleVideo().catch((error => clog.error("预览视频处理失败", error)))));
            }));
        } catch (error) {
            clog.error("预加载 DMM 失败:", error);
        }
    }
    /** 复用单次 DMM 请求，避免预加载和点击处理重复抓取。 */
    getDmmPreview() {
        if (this.dmmPreviewPromise) return this.dmmPreviewPromise;
        this.dmmPreviewPromise = fetchDmmPreview(this.getPageInfo().carNum).then((result => {
            (result.error?.retryable || "HTTP_ERROR" === result.error?.code) && (this.dmmPreviewPromise = null);
            return result;
        }), (error => {
            this.dmmPreviewPromise = null;
            throw error;
        }));
        return this.dmmPreviewPromise;
    }
    /** 创建与 JavDB HLS 生命周期完全隔离的 DMM 播放器。 */
    createDmmPlayer($nativeVideo) {
        const $host = $nativeVideo.parent(), existing = $host.find("#jhs-preview-video");
        if (existing.length) return existing;
        const $player = $('<video id="jhs-preview-video" class="jhs-video-player jhs-dmm-preview-player" controls playsinline></video>');
        return $nativeVideo.after($player), $player;
    }
    /** 销毁 JHS 播放器并把播放权完整交回 JavDB。 */
    async restoreNativePlayer($nativeVideo, nativeVideo, notify = !1) {
        const $dmmVideo = $nativeVideo.parent().find("#jhs-preview-video"), dmmVideo = $dmmVideo[0];
        dmmVideo && (dmmVideo.pause(), $dmmVideo.removeAttr("src"), dmmVideo.load(), $dmmVideo.remove());
        $nativeVideo.removeClass("jhs-native-preview-hidden");
        return safePlay(nativeVideo, {
            context: "JavDB 原生预览回退",
            notify
        });
    }
    async handleVideo() {
        const $nativeVideo = $("#preview-video");
        if (!$nativeVideo.length) return;
        const $host = $nativeVideo.parent().css("position", "relative"), nativeVideo = $nativeVideo[0], muted = localStorage.getItem("jhs_videoMuted");
        void safePlay(nativeVideo, {
            context: "JavDB 原生预览",
            notify: !1
        });
        const dmmEnabled = await storageManager.getSetting("enableLoadPreviewVideo", _) !== C, dmmResult = dmmEnabled ? await this.getDmmPreview() : {
            sources: null,
            error: null
        }, {sources, error} = dmmResult, $toolbar = $("<div></div>").attr("id", "video-bottom-toolbar").addClass("jhs-video-toolbar"), $qualityList = $("<div></div>").addClass("jhs-video-quality-list").attr({
            role: "group",
            "aria-label": "视频画质"
        });
        $host.find("#video-bottom-toolbar").remove();
        let dmmPlayed = !1, $dmmVideo = null, dmmVideo = null;
        if (sources) {
            const preferredQuality = await storageManager.getSetting("videoQuality"), selectedQuality = Z(Object.keys(sources), preferredQuality), source = sources[selectedQuality];
            const currentTime = nativeVideo.currentTime;
            $dmmVideo = this.createDmmPlayer($nativeVideo), dmmVideo = $dmmVideo[0], dmmVideo.muted = !muted || "yes" === muted,
            $dmmVideo.off("volumechange.jhsVideo").on("volumechange.jhsVideo", (() => {
                localStorage.setItem("jhs_videoMuted", dmmVideo.muted ? "yes" : "no");
            })), $dmmVideo.attr("src", source), dmmVideo.load(), dmmVideo.currentTime = currentTime, $dmmVideo.addClass("is-active");
            dmmPlayed = await safePlay(dmmVideo, {
                context: "JavDB 高画质预览",
                notify: !1
            });
            if (!dmmPlayed && !dmmVideo.muted) dmmVideo.muted = !0, dmmPlayed = await safePlay(dmmVideo, {
                context: "JavDB 高画质预览静音重试",
                notify: !1
            });
            dmmPlayed ? (nativeVideo.pause(), $nativeVideo.addClass("jhs-native-preview-hidden")) : ($dmmVideo.removeClass("is-active"),
            await this.restoreNativePlayer($nativeVideo, nativeVideo, !0));
            dmmPlayed && L.forEach((quality => {
                const qualitySource = sources[quality.quality];
                if (!qualitySource) return;
                const active = dmmPlayed && selectedQuality === quality.quality;
                $qualityList.append($(`<button type="button" class="jhs-btn jhs-video-quality-btn${active ? " active" : ""}" data-quality="${quality.quality}" data-video-src="${qualitySource}" aria-pressed="${active ? "true" : "false"}">${quality.text}</button>`));
            }));
        }
        $toolbar.append($qualityList);
        const $actions = $("<div></div>").addClass("jhs-toolbar");
        $actions.append('<button type="button" class="jhs-btn jhs-btn--filter jhs-layout-3f0d74e1" id="video-filterBtn">屏蔽</button>', '<button type="button" class="jhs-btn jhs-btn--fav jhs-layout-2afc43dc" id="video-favoriteBtn">收藏</button>', '<button type="button" class="jhs-btn jhs-btn--down jhs-layout-5c319329" id="speed-btn">快进</button>'),
        $toolbar.append($actions), $host.append($toolbar), sources || await safePlay(nativeVideo, {
            context: "JavDB 预览视频",
            notify: !0,
            message: "REGION_BLOCKED" === error?.code ? error.message : "当前视频源无法播放"
        });
        $toolbar.off("click.jhsVideo").on("click.jhsVideo", ".jhs-video-quality-btn", (async event => {
            const $button = $(event.currentTarget);
            if ($button.hasClass("active")) return;
            try {
                if (!dmmVideo) return;
                const currentTime = dmmVideo.currentTime, previousSource = $dmmVideo.attr("src");
                $dmmVideo.attr("src", $button.data("video-src")), dmmVideo.load(), dmmVideo.currentTime = currentTime;
                const played = await safePlay(dmmVideo, {
                    context: "JavDB 画质切换",
                    notify: !1
                });
                if (played) $toolbar.find(".jhs-video-quality-btn").removeClass("active").attr("aria-pressed", "false"),
                $button.addClass("active").attr("aria-pressed", "true"); else {
                    previousSource && ($dmmVideo.attr("src", previousSource), dmmVideo.load(), dmmVideo.currentTime = currentTime);
                    const restored = previousSource && await safePlay(dmmVideo, {
                    context: "JavDB 画质切换回退",
                    notify: !1
                    });
                    restored || await this.restoreNativePlayer($nativeVideo, nativeVideo, !0);
                }
            } catch (playbackError) {
                clog.error("切换画质失败:", playbackError);
            }
        })), $("#speed-btn").off("click.jhsVideo").on("click.jhsVideo", (() => {
            dmmVideo && (dmmVideo.currentTime += 10);
        })),
        $toolbar.off("contextmenu.jhsVideo").on("contextmenu.jhsVideo", "#speed-btn", (event => (event.preventDefault(),
        this.getBean("DetailPageButtonPlugin").filterOne(event)))),
        $("#video-filterBtn").off("click.jhsVideo").on("click.jhsVideo", (event => this.getBean("DetailPageButtonPlugin").filterOne(event))),
        $("#video-favoriteBtn").off("click.jhsVideo").on("click.jhsVideo", (event => this.getBean("DetailPageButtonPlugin").favoriteOne(event)));
    }
}
