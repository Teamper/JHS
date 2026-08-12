class SearchByImagePlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "siteList", [ {
            name: "Google旧版",
            url: "https://www.google.com/searchbyimage?image_url={占位符}&client=firefox-b-d",
            ico: "https://www.google.com/favicon.ico"
        }, {
            name: "Google",
            url: "https://lens.google.com/uploadbyurl?url={占位符}",
            ico: "https://www.google.com/favicon.ico"
        }, {
            name: "Yandex",
            url: "https://yandex.ru/images/search?rpt=imageview&url={占位符}",
            ico: "https://yandex.ru/favicon.ico"
        } ]), i(this, "isUploading", !1);
    }
    getName() {
        return "SearchByImagePlugin";
    }
    async initCss() {
        return "\n            <style>\n                #upload-area {\n                    border: 2px dashed var(--jhs-status-down);\n                    border-radius: 8px;\n                    padding: 40px;\n                    text-align: center;\n                    margin-bottom: 20px;\n                    transition: all 0.3s;\n                    background-color: var(--jhs-surface-2);\n                }\n                #upload-area:hover {\n                    border-color: var(--jhs-status-down-hover);\n                    background-color: var(--jhs-surface-2);\n                }\n                /* 拖拽进入 */\n                #upload-area.highlight {\n                    border-color: var(--jhs-status-fav);\n                    background-color: var(--jhs-status-fav-tint);\n                }\n                \n                \n                #select-image-btn {\n                    background-color: var(--jhs-status-down);\n                    color: var(--jhs-status-down-on);\n                    border: none;\n                    padding: 10px 20px;\n                    border-radius: var(--jhs-radius-sm);\n                    cursor: pointer;\n                    font-size: 16px;\n                    transition: background-color 0.3s;\n                }\n                #select-image-btn:hover {\n                    background-color: var(--jhs-status-down-hover);\n                }\n                \n                \n                #handle-btn, #cancel-btn {\n                    padding: 8px 16px;\n                    border-radius: var(--jhs-radius-sm);\n                    cursor: pointer;\n                    font-size: 14px;\n                    border: none;\n                    transition: opacity 0.3s;\n                }\n                #handle-btn {\n                    background-color: var(--jhs-status-fav);\n                    color: var(--jhs-status-fav-on);\n                }\n                #handle-btn:hover {\n                    filter: brightness(0.94);\n                }\n                #cancel-btn {\n                    background-color: var(--jhs-status-filter);\n                    color: var(--jhs-status-filter-on);\n                }\n                #cancel-btn:hover {\n                    filter: brightness(0.94);\n                }\n                \n                .search-img-site-btns-container {\n                    display: flex;\n                    flex-wrap: wrap;\n                    gap: 10px;\n                    margin-top: 15px;\n                }\n                .search-img-site-btn {\n                    display: flex;\n                    align-items: center;\n                    padding: 8px 12px;\n                    background-color: var(--jhs-surface-2);\n                    border-radius: var(--jhs-radius-sm);\n                    text-decoration: none;\n                    color: var(--jhs-text);\n                    transition: all 0.2s;\n                    font-size: 14px;\n                    border: 1px solid var(--jhs-border);\n                }\n                .search-img-site-btn:hover {\n                    background-color: var(--jhs-border);\n                    transform: translateY(-2px);\n                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);\n                }\n                .search-img-site-btn img {\n                    width: 16px;\n                    height: 16px;\n                    margin-right: 6px;\n                }\n                .search-img-site-btn span {\n                    white-space: nowrap;\n                }\n            </style>\n        ";
    }
    open(e) {
        layer.open({
            type: 1,
            title: "以图识图",
            content: '\n            <div class="jhs-layout-769fed37">\n                <div id="upload-area">\n                    <div class="jhs-layout-9e3c853e">\n                        <p>拖拽图片到此处 或 点击按钮选择图片</p>\n                        <p>也可以直接 Ctrl+V 粘贴图片或 图片URL</p>\n                    </div>\n                    <button class="jhs-btn" id="select-image-btn">选择图片</button>\n                    <input type="file" id="image-file" accept="image/*" class="jhs-layout-6b99de8b">\n                </div>\n                \n                <div id="url-input-container" class="jhs-layout-d50e4f09">\n                    <input type="text" id="image-url" placeholder="粘贴图片URL地址..." class="jhs-field">\n                </div>\n                \n                <div id="preview-area" class="jhs-layout-d10a577d">\n                    <img id="preview-image" alt="" src="" class="jhs-image-preview">\n                    <div id="action-btns" class="jhs-layout-06cf30c0">\n                        <button class="jhs-btn" id="handle-btn">搜索图片</button>\n                        <button class="jhs-btn" id="cancel-btn">取消</button>\n                    </div>\n                    \n                    <div id="search-results" class="jhs-layout-c8be1ccb">\n                        <p class="jhs-layout-9ea2322d">请选择识图网站：<button type="button" id="openAll" class="jhs-btn jhs-btn--ghost">全部打开</button></p>\n                        <div class="search-img-site-btns-container" id="search-img-site-btns-container"></div>\n                    </div>\n                </div>\n                \n            </div>\n        ',
            area: utils.isMobile() ? utils.getResponsiveArea() : [ "40%", "80%" ],
            success: async t => {
                this.initEventListeners(), e && e();
            },
            end: () => {
                $(document).off("paste.searchImg");
            }
        });
    }
    initEventListeners() {
        const e = $("#upload-area"), t = $("#image-file"), n = $("#select-image-btn"), a = $("#preview-area"), i = $("#preview-image"), s = $("#action-btns"), o = $("#handle-btn"), r = $("#cancel-btn"), l = $("#url-input-container"), c = $("#image-url"), d = $("#search-results"), h = $("#search-img-site-btns-container");
        e.on("dragover", (t => {
            t.preventDefault(), e.addClass("highlight");
        })).on("dragleave", (() => {
            e.removeClass("highlight");
        })).on("drop", (t => {
            t.preventDefault(), e.removeClass("highlight"), t.originalEvent.dataTransfer.files && t.originalEvent.dataTransfer.files[0] && (this.handleImageFile(t.originalEvent.dataTransfer.files[0]),
            this.resetSearchUI());
        })), n.on("click", (() => {
            t.trigger("click");
        })), t.on("change", (e => {
            e.target.files && e.target.files[0] && (this.handleImageFile(e.target.files[0]),
            this.resetSearchUI());
        })), $(document).on("paste.searchImg", (async e => {
            const t = e.originalEvent.clipboardData.items;
            for (let a = 0; a < t.length; a++) if (-1 !== t[a].type.indexOf("image")) {
                const e = t[a].getAsFile();
                return this.handleImageFile(e), void this.resetSearchUI();
            }
            const n = e.originalEvent.clipboardData.getData("text");
            n && utils.isUrl(n) && (l.show(), c.val(n), i.attr("src", n), a.show(), this.resetSearchUI());
        })), o.on("click", (async () => {
            const e = i.attr("src");
            if (e) {
                if (!this.isUploading) {
                    this.isUploading = !0;
                    try {
                        const t = await this.searchByImage(e);
                        s.hide(), d.show(), h.empty();
                        const n = "jhs_selectedSites", a = JSON.parse(localStorage.getItem(n) || "{}");
                        this.siteList.forEach((e => {
                            const n = e.url.replace("{占位符}", encodeURIComponent(t)), i = !1 !== a[e.name];
                            h.append(`\n                        <a href="${n}" class="search-img-site-btn" target="_blank" title="${e.name}">\n                        <input type="checkbox" \n                               class="site-checkbox jhs-layout-8896c95d" \n                               data-site-name="${e.name}" \n                              \n                               ${i ? "checked" : ""}>\n                            <img src="${e.ico}" alt="${e.name}">\n                            <span>${e.name}</span>\n                        </a>\n                    `);
                        })), h.on("change", ".site-checkbox", (function() {
                            const e = $(this).data("site-name");
                            a[e] = $(this).is(":checked"), localStorage.setItem(n, JSON.stringify(a));
                        })), h.show();
                    } finally {
                        this.isUploading = !1;
                    }
                }
            } else show.info("请粘贴或上传图片");
        })), r.on("click", (() => {
            a.hide(), l.hide(), t.val(""), c.val("");
        })), c.on("change", (() => {
            utils.isUrl(c.val()) && (i.attr("src", c.val()), a.show());
        })), $("#openAll").on("click", (() => {
            $(".search-img-site-btn").each((function() {
                $(this).find(".site-checkbox").is(":checked") && window.open($(this).attr("href"));
            }));
        }));
    }
    resetSearchUI() {
        $("#action-btns").show(), $("#search-results").hide(), $("#search-img-site-btns-container").hide().empty();
    }
    handleImageFile(e) {
        const t = document.getElementById("preview-image"), n = document.getElementById("preview-area"), a = document.getElementById("url-input-container");
        if (!e.type.match("image.*")) return void show.info("请选择图片文件");
        const i = new FileReader;
        i.onload = e => {
            t.src = e.target.result, n.style.display = "block", a.style.display = "none", $("#handle-btn")[0].click();
        }, i.readAsDataURL(e);
    }
    async searchByImage(e) {
        let t = loading();
        try {
            let t = e;
            if (e.startsWith("data:")) {
                show.info("开始上传图片...");
                const n = await async function(e) {
                    var t;
                    const n = e.match(/^data:(.+);base64,(.+)$/);
                    if (!n || n.length < 3) throw new Error("无效的Base64图片数据");
                    const a = n[1], i = n[2], s = atob(i), o = new Array(s.length);
                    for (let g = 0; g < s.length; g++) o[g] = s.charCodeAt(g);
                    const r = new Uint8Array(o), l = new Blob([ r ], {
                        type: a
                    }), c = new FormData;
                    c.append("image", l);
                    const d = await fetch("https://api.imgur.com/3/image", {
                        method: "POST",
                        headers: {
                            Authorization: "Client-ID d70305e7c3ac5c6"
                        },
                        body: c
                    }), h = await d.json();
                    if (h.success && h.data && h.data.link) return h.data.link;
                    throw new Error((null == (t = h.data) ? void 0 : t.error) || "上传到Imgur失败");
                }(e);
                if (!n) return void show.error("上传失败");
                t = n;
            }
            return t;
        } catch (n) {
            show.error(`搜索失败: ${n.message}`), console.error("搜索失败:", n);
        } finally {
            t.close();
        }
    }
}
