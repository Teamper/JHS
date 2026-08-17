class Utils {
    constructor() {
        return i(this, "intervalContainer", {}), i(this, "waitSequence", 0), i(this, "mimeTypes", {
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
            const t = (Array.isArray(e) ? e : [ e ]).filter(Boolean);
            if (0 === t.length) return;
            const n = t.map((e => e.replace(/^\s*<style[^>]*>/i, "").replace(/<\/style>?\s*$/i, ""))).filter(Boolean).join("\n"), a = document.createElement("style");
            n && (a.textContent = n, document.head.append(a));
        })), i(this, "layerIndexStack", []), Utils.instance || (Utils.instance = this), Utils.instance;
    }
    importResource(e) {
        let t;
        e.indexOf("css") >= 0 ? (t = document.createElement("link"), t.setAttribute("rel", "stylesheet"),
        t.href = e) : (t = document.createElement("script"), t.setAttribute("type", "text/javascript"),
        t.src = e), document.documentElement.appendChild(t);
    }
    openPage(e, t, n, a) {
        n = n ?? !0;
        const destination = new URL(e, window.location.origin), carNum = normalizeCarNum(t), isMovieDetail = /^\/v\/[^/]+/.test(destination.pathname);
        isMovieDetail && carNum && destination.searchParams.set("jhsCarNum", carNum);
        if (a && (a.ctrlKey || a.metaKey)) return void GM_openInTab(destination.href, {
            insert: 0
        });
        destination.pathname.includes("/actors/") || destination.pathname.includes("/star/") || destination.searchParams.set("hideNav", "1");
        layer.open({
            type: 2,
            title: t,
            content: destination.href,
            scrollbar: !1,
            shadeClose: n,
            area: this.getDialogArea("workspace"),
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
        const s = ++this.waitSequence;
        let o = null, r = null, l = null, c = !1;
        const d = () => {
            o?.disconnect(), clearTimeout(r), clearTimeout(l), clearInterval(this.intervalContainer[s]?.fallback),
            delete this.intervalContainer[s];
        }, h = e => {
            if (c) return;
            c = !0, d(), e && t && t();
        }, g = () => {
            if (c) return;
            e() && h(!0);
        }, p = () => {
            c || (clearTimeout(r), r = setTimeout(g, Math.max(0, n)));
        };
        this.intervalContainer[s] = {};
        if (e()) return void h(!0);
        if ("function" == typeof MutationObserver && document.documentElement) o = new MutationObserver(p),
        o.observe(document.documentElement, { childList: !0, subtree: !0, characterData: !0 }); else this.intervalContainer[s].fallback = setInterval(g, Math.max(100, n));
        l = setTimeout((() => {
            if (c) return;
            let t = !1;
            try { t = e(); } catch (e) { clog.error("DOM 等待条件执行失败", e); }
            h(t || i);
        }), Math.max(0, a));
    }
    rightClick(e, t, n) {
        let a;
        "string" == typeof e ? a = document.querySelector(e) : e instanceof HTMLElement && (a = e),
        a || (clog.warn("rightClick(), 容器无效或未提供，将使用 document.body 进行全局委托。"), a = document.body),
        "string" == typeof t && "" !== t.trim() ? a.addEventListener("contextmenu", (e => {
            const a = e.target.closest(t);
            a && n(e, a);
        })) : clog.error("rightClick(), 必须提供有效的 targetSelector。");
    }
    q(e, t, n, a) {
        let o;
        if (this.isMobileMode()) {
            o = layer.confirm(t, {
                title: "提示",
                btn: [ "确定", "取消" ],
                shade: 0,
                zIndex: JHS_Z_INDEX.layer
            }, (function() {
                n && n(), layer.close(o);
            }), (function() {
                a && a();
            }));
        } else {
            let i, s;
            e ? (i = e.clientX - 130, s = e.clientY - 120) : (i = window.innerWidth / 2 - 120,
            s = window.innerHeight / 2 - 120);
            o = layer.confirm(t, {
                offset: [ s, i ],
                title: "提示",
                btn: [ "确定", "取消" ],
                shade: 0,
                zIndex: JHS_Z_INDEX.layer
            }, (function() {
                n && n(), layer.close(o);
            }), (function() {
                a && a();
            }));
        }
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
    getResponsiveArea(e) {
        const t = window.innerWidth;
        return this.isMobileMode() ? [ "100%", "90%" ] : t >= 1200 ? e || this.getDefaultArea() : [ "70%", "90%" ];
    }
    /** 按用途返回具有固定上限和安全边距的弹窗尺寸。 */
    getDialogArea(e = "md") {
        const t = {
            sm: [ 480, 640 ],
            md: [ 720, 700 ],
            lg: [ 1040, 760 ],
            xl: [ 1320, 860 ],
            workspace: [ 1440, 960 ]
        }, n = t[e] || t.md, a = window.innerWidth <= 768 ? 16 : "workspace" === e ? 32 : 64,
        i = Math.max(320, Math.min(n[0], window.innerWidth - a)), s = Math.max(320, Math.min(n[1], window.innerHeight - a));
        return [ `${i}px`, `${s}px` ];
    }
    getDefaultArea() {
        return [ "85%", "90%" ];
    }
    isMobile() {
        const e = navigator.userAgent.toLowerCase();
        return [ "iphone", "ipod", "ipad", "android", "blackberry", "windows phone", "nokia", "webos", "opera mini", "mobile", "mobi", "tablet" ].some((t => e.includes(t)));
    }
    isMobileMode() {
        const e = storageManager.getSettingSync("mobileMode", "auto");
        return "on" === e || ("off" !== e && (this.isMobile() || window.innerWidth < 768));
    }
    async copyToClipboard(e, t) {
        const text = String(t ?? "");
        let copied = !1;
        try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text), copied = !0; else throw new Error("Clipboard API unavailable");
        } catch (clipboardError) {
            const textarea = document.createElement("textarea"), activeElement = document.activeElement;
            textarea.value = text, textarea.setAttribute("readonly", ""), textarea.style.position = "fixed", textarea.style.opacity = "0",
            document.body.appendChild(textarea), textarea.select();
            try {
                copied = !0 === document.execCommand("copy");
                if (!copied) throw clipboardError;
            } catch (fallbackError) {
                clog.error("复制失败:", fallbackError), show.error("复制失败，请手动复制");
            } finally {
                textarea.remove(), activeElement?.focus?.();
            }
        }
        return copied && show.info(`${e}已复制到剪贴板, ${text}`), copied;
    }
    htmlTo$dom(e) {
        const t = new DOMParser;
        return $(t.parseFromString(e, "text/html"));
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
        const i = e => {
            if (e instanceof Date) return e;
            if ("string" == typeof e) {
                const t = new Date(e);
                if (!isNaN(t.getTime())) return t;
            }
            return e;
        };
        const getVal = (e, t) => null != t ? "function" == typeof t ? t(e) : e && "object" == typeof e ? e[t] : void 0 : e;
        /* Separate nulls and non-nulls, sort non-nulls, then reassemble */
        const nulls = [], nonNulls = [];
        for (const item of e) {
            let hasNull = !1;
            for (const s of t) {
                const val = getVal(item, s.key);
                if (null == val || void 0 === val) { hasNull = !0; break; }
            }
            hasNull ? nulls.push(item) : nonNulls.push(item);
        }
        return nonNulls.sort(((e, a) => {
            for (const s of t) {
                const {key: t, order: o = "asc"} = s;
                let r = getVal(e, t), l = getVal(a, t);
                const c = i(r), d = i(l);
                let h = c instanceof Date && d instanceof Date ? c.getTime() - d.getTime() : "number" == typeof r && "number" == typeof l ? r - l : "string" == typeof r && "string" == typeof l ? r.localeCompare(l) : String(r).localeCompare(String(l));
                "desc" === o && (h *= -1);
                if (0 !== h) return h;
            }
            return 0;
        })), n ? [ ...nonNulls, ...nulls ] : [ ...nulls, ...nonNulls ];
    }
    async retry(e, t = 3) {
        let n = 0;
        for (;n < t; ) try {
            const t = await e();
            return n > 0 && clog.debug(`[重试] 请求成功，共发起 ${n + 1} 次。`), t;
        } catch (a) {
            const e = a instanceof Error ? a.message : "object" == typeof a ? JSON.stringify(a) : String(a);
            if (a?._cfBlocked || a?._circuitBroken || e.includes("Just a moment") || e.includes("重定向") || e.toLowerCase().includes("404 not found")) throw a;
            if (n++, n === t) throw clog.debug(`[重试] 达到最大重试次数 (${t})，最终失败：`, a), a;
            await this.sleep(500 * n), clog.debug(`[重试] 请求失败，准备第 ${n + 1} 次重试, 错误信息: ${e}`);
        }
    }
}
