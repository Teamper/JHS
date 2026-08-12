class TranslatePlugin extends BasePlugin {
    getName() {
        return "TranslatePlugin";
    }
    async initCss() {
        return "\n            <style>\n                .translated-title { margin-top:var(--jhs-space-2); color:var(--jhs-text); font-size:clamp(16px,1.5vw,18px); font-weight:500; line-height:1.5; }\n                .translated-title.is-error { color:var(--jhs-danger); }\n            </style>";
    }
    handle() {
        isDetailPage && this.translate();
    }
    async translate(e, t = !0) {
        if (await storageManager.getSetting("translateTitle", _) !== _) return;
        l && (t = !1);
        let n = $(".origin-title");
        if (n.length || (n = $(".current-title")), n.length || (n = $("h3")), !n.length) return;
        const a = n.text().trim();
        if (!a) return void show.error("获取标题失败, 无法进行翻译");
        let i = n.nextAll(".translated-title").first();
        i.length || (i = $('<div class="translated-title"></div>').insertAfter(n)), i.removeClass("is-error").text("翻译中...");
        e || (e = this.getPageInfo().carNum);
        const s = "string" == typeof e ? e.trim() : "", o = s && "undefined" !== s ? s : a;
        let r = {};
        try {
            const e = localStorage.getItem("jhs_translate");
            e && (r = JSON.parse(e) || {});
        } catch (l) {
            clog.warn("翻译缓存无法解析，已忽略旧缓存", l);
        }
        if (r[o]) return void i.text(r[o]);
        try {
            const e = await _e(a, "ja", "zh-CN");
            i.text(e), r[o] = e, localStorage.setItem("jhs_translate", JSON.stringify(r));
        } catch (l) {
            console.error("翻译失败:", l), i.addClass("is-error").text(`翻译失败: ${l.message || String(l)}`);
        }
    }
}
