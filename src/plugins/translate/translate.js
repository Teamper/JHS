class Ze extends X {
    getName() {
        return "TranslatePlugin";
    }
    async initCss() {
        return "\n            <style> \n                .translated-title {\n                    margin-top: 8px; \n                    padding: 12px; \n                    border-radius: 5px; \n                    border-left: 4px solid rgb(76, 175, 80);\n                    background: linear-gradient(135deg, rgb(255, 255, 255) 0%, rgb(245, 245, 245) 100%); \n                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);\n                    font-size: 20px;\n                }\n            </style>\n        ";
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
        n.after('<div class="translated-title">翻译中...</div>');
        const i = n.next(".translated-title");
        e || (e = this.getPageInfo().carNum);
        const s = localStorage.getItem("jhs_translate") ? JSON.parse(localStorage.getItem("jhs_translate")) : {};
        s[e] ? i.html(t ? e + "&nbsp;&nbsp;&nbsp;" + s[e] : s[e]) : _e(a, "ja", "zh-CN").then((n => {
            i.html(t ? e + "&nbsp;&nbsp;&nbsp;" + n : n);
        })).catch((e => {
            console.error("翻译失败:", e), i.replaceWith(`<div class="translated-title" style="color: red;">翻译失败: ${escapeHtml(e.message)}</div>`);
        }));
    }
}
