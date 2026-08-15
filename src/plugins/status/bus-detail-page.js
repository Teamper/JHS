class BusDetailPagePlugin extends BasePlugin {
    getName() {
        return "BusDetailPagePlugin";
    }
    async initCss() {
        if (!window.isDetailPage) return "";
        $("h4:contains('推薦')").hide();
    }
    async handle() {
        if (window.location.href.includes("/star/")) {
            const e = $(".avatar-box");
            if (e.length > 0) {
                let t = e.parent();
                t.css("position", "initial"), t.insertBefore(t.parent());
            }
        }
        $(".genre a").each((function() {
            const e = $(this).attr("href");
            e && (e.startsWith("http://") || e.startsWith("https://") || e.startsWith("/")) && $(this).attr("target", "_blank");
        })), this.addCopyCarNumBtn();
    }
    addCopyCarNumBtn() {
        let e = null;
        const t = document.querySelectorAll("span.header");
        for (const n of t) if ("識別碼:" === n.textContent.trim()) {
            e = n;
            break;
        }
        if (e) {
            const t = e.nextElementSibling;
            if (t && "SPAN" === t.tagName) {
                const e = t.textContent.trim(), n = document.createElement("button");
                n.type = "button", n.className = "jhs-btn jhs-btn--secondary jhs-copy-car-number", n.textContent = "复制", n.addEventListener("click", (async function(t) {
                    t.preventDefault();
                    await utils.copyToClipboard("番号", e) && (() => {
                        this.textContent = "已复制", setTimeout((() => {
                            this.textContent = "复制";
                        }), 1500);
                    })();
                })), t.parentNode.insertBefore(n, t.nextSibling);
            }
        }
    }
}
