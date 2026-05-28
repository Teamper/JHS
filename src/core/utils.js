class J {
    constructor() {
        return i(this, "intervalContainer", {}), i(this, "mimeTypes", {
            txt: "text/plain",
            html: "text/html",
            css: "text/css",
            csv: "text/csv",
            json: "application/json",
            xml: "application/xml",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            svg: "image/svg+xml",
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ppt: "application/vnd.ms-powerpoint",
            pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            zip: "application/zip",
            rar: "application/x-rar-compressed",
            "7z": "application/x-7z-compressed",
            mp3: "audio/mpeg",
            wav: "audio/wav",
            mp4: "video/mp4",
            webm: "video/webm",
            ogg: "audio/ogg"
        }), i(this, "timers", new Map), i(this, "insertStyle", (e => {
            e && (-1 === e.indexOf("<style>") && (e = "<style>" + e + "</style>"), $("head").append(e));
        })), i(this, "layerIndexStack", []), J.instance || (J.instance = this), J.instance;
    }
    importResource(e) {
        let t;
        e.indexOf("css") >= 0 ? (t = document.createElement("link"), t.setAttribute("rel", "stylesheet"),
        t.href = e) : (t = document.createElement("script"), t.setAttribute("type", "text/javascript"),
        t.src = e), document.documentElement.appendChild(t);
    }
    openPage(e, t, n, a) {
        if (n = n ?? !0, a && (a.ctrlKey || a.metaKey)) return void GM_openInTab(e.includes("http") ? e : window.location.origin + e, {
            insert: 0
        });
        let i = e;
        e.includes("/actors/") || e.includes("/star/") || (i = e.includes("?") ? `${e}&hideNav=1` : `${e}?hideNav=1`),
        layer.open({
            type: 2,
            title: t,
            content: i,
            scrollbar: !1,
            shadeClose: n,
            area: this.getResponsiveArea([ "85%", "90%" ]),
            isOutAnim: !1,
            anim: -1,
            success: (e, t) => {
                this.setupEscClose(t);
            }
        });
    }
    _handleGlobalEscKey(e) {
        if ("Escape" !== e.key && 27 !== e.keyCode) return;
        if (0 === this.layerIndexStack.length) return;
        const t = this.layerIndexStack[this.layerIndexStack.length - 1], n = $(`#layui-layer${t}`);
        let a = !1;
        if (n.find(".viewer-container").length > 0) a = !0; else {
            const e = n.find(`#layui-layer-iframe${t}`)[0];
            if (e && e.contentDocument) try {
                $(e.contentDocument).find(".viewer-container").length > 0 && (a = !0);
            } catch (i) {
                clog.warn("无法检查跨域 iframe 内的 .viewer-container");
            }
        }
        a || (this.layerIndexStack.pop(), layer.close(t));
    }
    setupEscClose(e) {
        var t;
        this._boundHandler || (this._boundHandler = this._handleGlobalEscKey.bind(this),
        $(document).off("keydown.globalLayerEsc"), $(document).on("keydown.globalLayerEsc", this._boundHandler)),
        -1 === this.layerIndexStack.indexOf(e) && this.layerIndexStack.push(e);
        const n = $(`#layui-layer-iframe${e}`), a = `keydown.layerEsc${e}`;
        try {
            const e = null == (t = n[0]) ? void 0 : t.contentDocument;
            if (e) {
                if ("yes" === n.attr("data-esc-bound")) return;
                $(e).off(a), $(e).on(a, this._boundHandler), n.attr("data-esc-bound", "yes");
            }
        } catch (i) {
            clog.error("iframe监听失败 (跨域或未加载完毕):", i);
        }
    }
    closePage() {
        storageManager.getSetting("needClosePage", "yes").then((e => {
            if ("yes" !== e) return;
            parent.document.documentElement.style.overflow = "auto";
            [ ".layui-layer-shade", ".layui-layer-move", ".layui-layer" ].forEach((function(e) {
                const t = parent.document.querySelectorAll(e);
                if (t.length > 0) {
                    const e = t.length > 1 ? t[t.length - 1] : t[0];
                    e.parentNode.removeChild(e);
                }
            })), window.close();
        }));
    }
    loopDetector(e, t, n = 20, a = 1e4, i = !0) {
        const s = Math.random(), o = (new Date).getTime(), r = e => {
            clearInterval(this.intervalContainer[s]), e && t && t(), delete this.intervalContainer[s];
        };
        this.intervalContainer[s] = setInterval((() => {
            const t = (new Date).getTime() - o;
            e() ? r(!0) : t >= a && r(i);
        }), n);
    }
    rightClick(e, t, n) {
        let a;
        "string" == typeof e ? a = document.querySelector(e) : e instanceof HTMLElement && (a = e),
        a || (console.warn("rightClick(), 容器无效或未提供，将使用 document.body 进行全局委托。"), a = document.body),
        "string" == typeof t && "" !== t.trim() ? a.addEventListener("contextmenu", (e => {
            const a = e.target.closest(t);
            a && n(e, a);
        })) : console.error("rightClick(), 必须提供有效的 targetSelector。");
    }
    q(e, t, n, a) {
        let i, s;
        e ? (i = e.clientX - 130, s = e.clientY - 120) : (i = window.innerWidth / 2 - 120,
        s = window.innerHeight / 2 - 120);
        let o = layer.confirm(t, {
            offset: [ s, i ],
            title: "提示",
            btn: [ "确定", "取消" ],
            shade: 0,
            zIndex: 999999991
        }, (function() {
            n && n(), layer.close(o);
        }), (function() {
            a && a();
        }));
    }
    getNowStr(e = "-", t = ":", n = null) {
        let a;
        a = n ? new Date(n) : new Date;
        const i = a.getFullYear(), s = String(a.getMonth() + 1).padStart(2, "0"), o = String(a.getDate()).padStart(2, "0"), r = String(a.getHours()).padStart(2, "0"), l = String(a.getMinutes()).padStart(2, "0"), c = String(a.getSeconds()).padStart(2, "0");
        return `${[ i, s, o ].join(e)} ${[ r, l, c ].join(t)}`;
    }
    formatDate(e, t = "-", n = ":") {
        let a;
        if (e instanceof Date) a = e; else {
            if ("string" != typeof e) throw new Error("Invalid date input: must be Date object or date string");
            if (a = new Date(e), isNaN(a.getTime())) throw new Error("Invalid date string");
        }
        const i = a.getFullYear(), s = String(a.getMonth() + 1).padStart(2, "0"), o = String(a.getDate()).padStart(2, "0"), r = String(a.getHours()).padStart(2, "0"), l = String(a.getMinutes()).padStart(2, "0"), c = String(a.getSeconds()).padStart(2, "0");
        return `${[ i, s, o ].join(t)} ${[ r, l, c ].join(n)}`;
    }
    getHourDifference(e, t) {
        const n = e.getTime(), a = t.getTime(), i = Math.abs(a - n) / 36e5;
        return Math.floor(i);
    }
    download(e, t) {
        show.info("开始请求下载...");
        const n = t.split(".").pop().toLowerCase();
        let a, i = this.mimeTypes[n] || "application/octet-stream";
        if (e instanceof Blob) a = e; else if (e instanceof ArrayBuffer || ArrayBuffer.isView(e)) a = new Blob([ e ], {
            type: i
        }); else if ("string" == typeof e && e.startsWith("data:")) {
            const t = atob(e.split(",")[1]), n = new ArrayBuffer(t.length), s = new Uint8Array(n);
            for (let e = 0; e < t.length; e++) s[e] = t.charCodeAt(e);
            a = new Blob([ s ], {
                type: i
            });
        } else a = new Blob([ e ], {
            type: i
        });
        const s = URL.createObjectURL(a), o = document.createElement("a");
        o.href = s, o.download = t, document.body.appendChild(o), o.click(), setTimeout((() => {
            document.body.removeChild(o), URL.revokeObjectURL(s);
        }), 100);
    }
    smoothScrollToTop(e = 500) {
        return new Promise((t => {
            const n = performance.now(), a = window.pageYOffset;
            window.requestAnimationFrame((function i(s) {
                const o = s - n, r = Math.min(o / e, 1), l = r < .5 ? 4 * r * r * r : 1 - Math.pow(-2 * r + 2, 3) / 2;
                window.scrollTo(0, a * (1 - l)), r < 1 ? window.requestAnimationFrame(i) : t();
            }));
        }));
    }
    simpleId() {
        return crypto.randomUUID().replace("-", "");
    }
    isUrl(e) {
        try {
            return new URL(e), !0;
        } catch (t) {
            return !1;
        }
    }
    setHrefParam(e, t) {
        const n = new URL(window.location.href);
        n.searchParams.set(e, t), window.history.pushState({}, "", n.toString());
    }
    getUrlParam(e, t) {
        const n = e.split("?")[1];
        if (!n) return null;
        const a = new RegExp(`(?:^|&)${t}=([^&]*)`), i = n.match(a);
        let s = "";
        return i && i[1] && (s = decodeURIComponent(i[1].replace(/\+/g, " "))), s ? "true" === s || "false" === s ? "true" === s.toLowerCase() : "string" != typeof s || "" === s.trim() || isNaN(Number(s)) ? s : Number(s) : s;
    }
    reBuildSignature() {
        return O();
    }
    getResponsiveArea(e) {
        const t = window.innerWidth;
        return t >= 1200 ? e || this.getDefaultArea() : t >= 768 ? [ "70%", "90%" ] : [ "95%", "95%" ];
    }
    getDefaultArea() {
        return [ "85%", "90%" ];
    }
    isMobile() {
        const e = navigator.userAgent.toLowerCase();
        return [ "iphone", "ipod", "ipad", "android", "blackberry", "windows phone", "nokia", "webos", "opera mini", "mobile", "mobi", "tablet" ].some((t => e.includes(t)));
    }
    copyToClipboard(e, t) {
        navigator.clipboard.writeText(t).then((() => show.info(`${e}已复制到剪切板, ${t}`))).catch((e => console.error("复制失败: ", e)));
    }
    htmlTo$dom(e) {
        const t = new DOMParser;
        return $(t.parseFromString(e, "text/html"));
    }
    addCookie(e, t = {}) {
        const {maxAge: n = 604800, path: a = "/", domain: i = "", secure: s = !1, sameSite: o = "Lax"} = t;
        e.split(";").forEach((e => {
            const t = e.trim();
            if (t) {
                const e = t.split("=");
                if (e.length >= 2 && e[0].trim()) {
                    let t = [ `${e[0].trim()}=${e.slice(1).join("=")}` ];
                    n > 0 && t.push(`max-age=${n}`), t.push(`path=${a}`), i && t.push(`domain=${i}`),
                    s && t.push("Secure"), o && t.push(`SameSite=${o}`), clog.debug("document.cookie = '" + t.join("; ") + "'"),
                    document.cookie = t.join("; ");
                }
            }
        }));
    }
    isHidden(e) {
        const t = e.jquery ? e[0] : e;
        return !t || (t.offsetWidth <= 0 && t.offsetHeight <= 0 || "none" === window.getComputedStyle(t).display);
    }
    time(e = "default", t = "s", n = 2) {
        if (this.timers.has(e)) {
            const t = this.timers.get(e), n = performance.now() - t.startTime;
            let a, i;
            return "s" === t.unit ? (a = (n / 1e3).toFixed(t.precision), i = "秒") : (a = n.toFixed(t.precision),
            i = "毫秒"), this.timers.delete(e), `${e}: ${a}${i}`;
        }
        this.timers.set(e, {
            startTime: performance.now(),
            unit: t,
            precision: n
        });
    }
    sleep(e = 1e3) {
        return new Promise((t => setTimeout(t, e)));
    }
    genericSort(e, t, n = !0) {
        if (!Array.isArray(e) || 0 === e.length) return [];
        if (!Array.isArray(t) || 0 === t.length) return [ ...e ];
        const a = [ ...e ], i = e => {
            if (e instanceof Date) return e;
            if ("string" == typeof e) {
                const t = new Date(e);
                if (!isNaN(t.getTime())) return t;
            }
            return e;
        };
        return a.sort(((e, a) => {
            for (const s of t) {
                const {key: t, order: o = "asc"} = s;
                let r = e, l = a;
                null != t && ("function" == typeof t ? (r = t(e), l = t(a)) : (r = e && "object" == typeof e ? e[t] : void 0,
                l = a && "object" == typeof a ? a[t] : void 0));
                const c = i(r), d = i(l);
                let h = 0;
                const g = null == r, p = null == l;
                if (g && p) return 0;
                if (g) return n ? 1 : -1;
                if (p) return n ? 1 : -1;
                if (h = c instanceof Date && d instanceof Date ? c.getTime() - d.getTime() : "number" == typeof r && "number" == typeof l ? r - l : "string" == typeof r && "string" == typeof l ? r.localeCompare(l) : String(r).localeCompare(String(l)),
                "desc" === o && (h *= -1), 0 !== h) return h;
            }
            return 0;
        }));
    }
    async retry(e, t = 3) {
        let n = 0;
        for (;n < t; ) try {
            const t = await e();
            return n > 0 && clog.debug(`[重试] 请求成功，共发起 ${n + 1} 次。`), t;
        } catch (a) {
            const e = String(a);
            if (e.includes("Just a moment") || e.includes("重定向") || e.toLowerCase().includes("404 not found")) throw a;
            if (n++, n === t) throw clog.debug(`[重试] 达到最大重试次数 (${t})，最终失败：`, a), a;
            clog.debug(`[重试] 请求失败，准备第 ${n + 1} 次重试, 错误信息: ${e}`);
        }
    }
}
