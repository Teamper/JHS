const Z = (e, t) => {
    if (!e || 0 === e.length) return null;
    const n = new Set(e);
    if (n.has(t)) return t;
    const a = L.map((e => e.quality)).reverse();
    for (const i of a) if (n.has(i)) return i;
    return e[0];
}, ee = "jhs_dmm_video";

class te {
    constructor(e, t = !0) {
        this.carNum = e, this.showErrorMessages = t;
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
            } catch (s) {
                clog.error(`API 请求失败，跳过 ${n}:`, s);
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
                c.length > 1 ? (t.attr("href", a), t.append('<span class="site-tag" style="top:-15px">多结果</span>'),
                t.css("backgroundColor", "#7bc73b"), i = "multiple") : (a = c[0].pageUrl, t.attr("href", a),
                t.css("backgroundColor", "#7bc73b"));
                const s = "jhs_other_site_dmm", o = localStorage.getItem(s) ? JSON.parse(localStorage.getItem(s)) : {};
                return o[this.carNum] = {
                    type: i,
                    url: a
                }, localStorage.setItem(s, JSON.stringify(o)), c;
            }
            clog.debug(`[${n}] API 返回结果数 ${l.result.result_count}，但无精确匹配的 Content ID。`);
        }
        clog.warn("所有关键词尝试均未找到匹配的Content ID, 解析Dmm视频失败");
        const i = $("#fanzaBtn");
        return i.attr("href", `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`),
        i.attr("title", "未查询到, 点击前往搜索页"), i.css("backgroundColor", "#de3333"), null;
    }
    async _extractTrailerLinks({contentId: e, serviceCode: t, floorCode: n}) {
        const a = `https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${e}/mtype=AhRVShI_/service=${t}/floor=${n}/mode=/`, i = await gmHttp.get(a, null, {
            "accept-language": "ja-JP,ja;q=0.9",
            Cookie: "age_check_done=1"
        });
        if ("string" != typeof i) throw clog.error(i), new Error("解析播放页内容失败, 非文本内容");
        if (i.includes("このサービスはお住まいの地域からは")) throw new Error("节点不可用，请将DMM域名分流到日本ip");
        const s = i.match(/const\s+args\s+=\s+(.*);/);
        if (!s) throw new Error("未在脚本中找到 const args = ... 变量");
        let o;
        try {
            ({bitrates: o} = JSON.parse(s[1]));
        } catch (d) {
            throw new Error(`解析播放器脚本 JSON 失败: ${d.message}`);
        }
        const r = {}, l = L.map((e => e.quality)).join("|"), c = new RegExp(`(${l})\\.mp4$`);
        if (!Array.isArray(o)) throw clog.error("解析画质链接失败: bitrates 字段不是一个数组或不存在"), new Error("解析画质链接失败: bitrates 字段不是一个数组或不存在");
        clog.debug("原始数据返回:", o);
        for (const h of o) {
            const e = null == h ? void 0 : h.src;
            if (!e || "string" != typeof e || !e.endsWith(".mp4")) continue;
            const t = e.match(c);
            let n = "";
            t && t[1] && (n = t[1]), n && !r[n] && (r[n] = e);
        }
        if (0 === Object.keys(r).length) throw new Error("未找到匹配要求的预览画质视频");
        return r;
    }
    async fetchVideo() {
        const e = this._checkCache();
        if (e) return e;
        let t;
        try {
            const e = this.carNum.toLowerCase();
            if (e.startsWith("heyzo") || /^(n\d+|\d+(-\d+)*)$/.test(e) || /^n\d+$/.test(e)) throw new Error("无码番号类型, 取消dmm解析");
            if (this.carNum.includes("VR-")) throw new Error("VR类型, 取消dmm解析");
            t = await this._searchContentIds();
        } catch (n) {
            clog.error("DMM API 搜索失败:", n);
            const e = $("#fanzaBtn");
            return e.attr("href", `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`),
            e.attr("title", "未查询到, 点击前往搜索页"), e.css("backgroundColor", "#de3333"), null;
        }
        if (!t || 0 === t.length) return null;
        try {
            const e = await Promise.any(t.map((e => this._extractTrailerLinks(e))));
            return this._updateCache(e), e;
        } catch (a) {
            const e = a.errors || [ a ];
            if (e.some((e => e.message.includes("节点不可用")))) this.showErrorMessages && show.error("节点不可用，请将DMM域名分流到日本ip"); else {
                const t = e[0].message || e[0];
                clog.error(`解析失败: ${t}`, e), this.showErrorMessages && show.error(`解析失败: ${t}`);
            }
            const t = $("#fanzaBtn");
            return t.attr("href", `https://www.dmm.co.jp/search/=/searchstr=${this.carNum}`),
            t.attr("title", "未查询到, 点击前往搜索页"), t.css("backgroundColor", "#de3333"), null;
        }
    }
}

const ne = async (e, t = !0) => new te(e, t).fetchVideo();

class ae extends X {
    getName() {
        return "PreviewVideoPlugin";
    }
    async initCss() {
        return "\n            .video-control-btn {\n                min-width:120px;\n                padding: 7px 12px;\n                font-size: 12px;\n                background: rgba(0,0,0,0.7);\n                color: white;\n                border: none;\n                border-radius: 4px;\n                cursor: pointer;\n            }\n            .video-control-btn.active {\n                background-color: #1890ff;\n                color: white;\n                font-weight: bold;\n                border: 2px solid #096dd9;\n            }\n        ";
    }
    async handle() {
        if (!isDetailPage) return;
        let e = await storageManager.getSetting();
        let t = $(".preview-video-container");
        t.on("click", (e => {
            utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => {
                this.handleVideo().then();
            }));
        }));
        await storageManager.getSetting("enableLoadPreviewVideo", _) !== _ || o.includes("autoPlay=1") || this.initDmm().then();
        let n = window.location.href;
        (n.includes("gallery-1") || n.includes("gallery-2")) && utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (() => {
            $(".fancybox-content #preview-video").length > 0 && this.handleVideo().then();
        })), n.includes("autoPlay=1") && t.length > 0 && t[0].click();
    }
    async initDmm() {
        try {
            const e = await ne(this.getPageInfo().carNum, !1);
            if (!e) return;
            let t = await storageManager.getSetting("videoQuality");
            clog.debug("解析其它画质预览视频", "设置-期望画质", t);
            const n = e[Z(Object.keys(e), t)];
            clog.log("切换其它画质预览视频: ", n);
            const a = $("#preview-video"), i = a.length ? a[0] : null, s = !i || utils.isHidden(a);
            if (a.length) {
                if (i) {
                    const e = i.currentTime;
                    a.attr("src", n), s || (clog.debug("播放器已手动打开, 变更进度条"), i.currentTime = e, i.play());
                }
            } else {
                clog.debug("JavDB没有视频播放元素, 开始创建...");
                const e = $(".column-video-cover img").attr("src");
                $(".preview-images").prepend(`\n                    <a class="preview-video-container" data-fancybox="gallery" href="#preview-video">\n                        <span>預告片</span>\n                        <img src="${e}" class="video-cover" style="width: 150px; height: auto;" alt="">\n                    </a>\n                `);
                $(".preview-video-container").on("click", (e => {
                    utils.loopDetector((() => $(".fancybox-content #preview-video").length > 0), (async () => {
                        await this.handleVideo();
                    }));
                }));
            }
        } catch (e) {
            clog.error("预加载dmm失败:", e);
        }
    }
    async handleVideo() {
        if (await storageManager.getSetting("enableLoadPreviewVideo", _) === C) return;
        const e = $("#preview-video");
        if (!e.length) return;
        const t = e.parent();
        t.css("position", "relative");
        const n = e[0], a = localStorage.getItem("jhs_videoMuted");
        a && (n.muted = "yes" === a), n.addEventListener("volumechange", (function() {
            localStorage.setItem("jhs_videoMuted", n.muted ? "yes" : "no");
        })), n.play();
        let i = this.getPageInfo().carNum;
        const s = await ne(i);
        let o = $("<div></div>").attr("id", "video-bottom-toolbar").css({
            display: "flex",
            gap: "5px",
            "align-items": "center",
            "flex-wrap": "wrap"
        }), r = $("<div></div>").css({
            display: "flex",
            gap: "5px",
            "align-items": "center"
        }), l = null;
        if (s) {
            let t = await storageManager.getSetting("videoQuality");
            l = Z(Object.keys(s), t);
            let a = s[l];
            e.attr("src") !== a && (e.attr("src", a), n.load(), n.play()), L.forEach((e => {
                let t = s[e.quality];
                if (t) {
                    const n = l === e.quality;
                    let a = $(`\n                    <button class="video-control-btn${n ? " active" : ""}" \n                            id="${e.id}" \n                            data-quality="${e.quality}"\n                            data-video-src="${t}"\n                            style="min-width: 40px; border: 1px solid #ccc; background-color: ${n ? "#007bff" : "#fff"}; color: ${n ? "white" : "black"};">\n                        ${e.text}\n                    </button>\n                `);
                    r.append(a);
                }
            }));
        }
        o.append(r);
        let c = $("<div></div>").css({
            display: "flex",
            gap: "5px",
            "align-items": "center",
            "margin-left": "auto"
        }), d = $(`<button class="menu-btn" id="video-filterBtn" style="min-width: 120px; background-color:#de3333;">屏蔽</button>`);
        c.append(d);
        let h = $(`<button class="menu-btn" id="video-favoriteBtn" style="min-width: 120px; background-color:#25b1dc;">收藏</button>`);
        c.append(h);
        let g = $(`<button class="menu-btn" id="speed-btn" style="min-width: 120px; background-color:#76b45d;">快进</button>`);
        c.append(g), o.append(c), t.append(o), o.on("click", ".video-control-btn", (async t => {
            const a = $(t.currentTarget), i = a.data("video-src");
            if (!a.hasClass("active")) try {
                const t = n.currentTime;
                e.attr("src", i), n.load(), n.currentTime = t, await n.play(), o.find(".video-control-btn").removeClass("active").css({
                    "background-color": "#fff",
                    color: "black"
                }), a.addClass("active").css({
                    "background-color": "#007bff",
                    color: "white"
                });
            } catch (s) {
                console.error("切换画质失败:", s);
            }
        })), $("#speed-btn").on("click", (() => {
            this.getBean("DetailPageButtonPlugin").speedVideo();
        })), utils.rightClick(document.body, "#speed-btn", (e => {
            this.getBean("DetailPageButtonPlugin").filterOne(e);
        })), $("#video-filterBtn").on("click", (e => {
            this.getBean("DetailPageButtonPlugin").filterOne(e);
        })), $("#video-favoriteBtn").on("click", (e => {
            this.getBean("DetailPageButtonPlugin").favoriteOne(e);
        }));
    }
}
