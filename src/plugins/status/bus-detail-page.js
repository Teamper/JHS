class we extends X {
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
                n.textContent = "复制", n.style.marginLeft = "10px", n.style.padding = "0 10px", n.style.cursor = "pointer",
                n.style.border = "1px solid var(--jhs-border)", n.style.borderRadius = "5px", n.style.backgroundColor = "var(--jhs-surface-2)",
                n.style.fontSize = "12px", n.addEventListener("click", (function(t) {
                    t.preventDefault();
                    const n = e => {
                        this.textContent = "已复制", setTimeout((() => {
                            this.textContent = "复制";
                        }), 1500);
                    };
                    navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.writeText(e).then((() => n())).catch((t => {
                        console.error("无法通过标准API复制:", t), alert("复制失败，请手动复制: " + e);
                    }));
                })), t.parentNode.insertBefore(n, t.nextSibling);
            }
        }
    }
}
