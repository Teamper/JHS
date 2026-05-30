const me = "jhs_appAuthorization";

class ue extends X {
    constructor() {
        super(), i(this, "has_cnsub", ""), i(this, "$contentBox", $(".section .container")),
        i(this, "movies", []);
    }
    getName() {
        return "TOP250Plugin";
    }
    handle() {
        $('.main-tabs ul li:contains("猜你喜歡")').html('<a href="/rankings/top"><span>Top250</span></a>'),
        $('a[href*="rankings/top"]').on("click", (e => {
            e.preventDefault(), e.stopPropagation();
            const t = $(e.target), n = (t.is("a") ? t : t.closest("a")).attr("href");
            let a = n.includes("?") ? n.split("?")[1] : n;
            const i = new URLSearchParams(a);
            this.checkLogin(e, i);
        })), this.handleTop().then();
    }
    hookPage() {
        $("h2.section-title").contents().first().replaceWith("Top250"), $(".empty-message").remove(),
        $(".section .container .box").remove(), $("#sort-toggle-btn").remove(), this.$contentBox.append('<div class="tool-box" style="margin-top: 10px"></div>'),
        this.$contentBox.append('<div class="movie-list h cols-4 vcols-8" style="margin-top: 10px"></div>'),
        this.renderPagination();
    }
    renderPagination() {
        const e = new URLSearchParams(window.location.search);
        let t = parseInt(e.get("page")) || 1;
        this.$contentBox.append((e => {
            const t = e >= 5;
            let n = "";
            for (let a = 1; a <= 5; a++) {
                n += `<li><a class="pagination-link ${e === a ? "is-current" : ""}" data-page="${a}">${a}</a></li>`;
            }
            return `\n                <nav class="pagination">\n                    <a class="pagination-previous ${e <= 1 ? "do-hide" : ""}" data-page="${e - 1}">上一頁</a>\n                    <a class="pagination-next ${t ? "do-hide" : ""}" data-page="${e + 1}">下一頁</a>\n                    \n                    <ul class="pagination-list">\n                        ${n}\n                    </ul>\n                </nav>\n            `;
        })(t)), this.$contentBox.on("click", ".pagination-link, .pagination-previous, .pagination-next", (t => {
            t.preventDefault();
            const n = parseInt($(t.currentTarget).data("page"));
            !isNaN(n) && n > 0 && (t => {
                e.set("page", t), window.history.pushState({}, "", "?" + e.toString()), window.location.reload();
            })(n);
        }));
    }
    async handleTop() {
        if (!window.location.href.includes("handleTop=1")) return;
        const e = new URLSearchParams(window.location.search);
        let t = e.get("handleType") || "all", n = e.get("type_value") || "";
        this.has_cnsub = e.get("has_cnsub") || "";
        let a = e.get("page") || 1;
        this.toolBar(t, n, a), this.hookPage();
        let i = $(".movie-list");
        i.html("");
        let s = loading();
        let o = !1;
        for (let l = 1; l <= 3 && !o; l++) try {
            const e = await q(t, n, a, 50);
            let r = e.success, l = e.message, c = e.action;
            if (1 === r) {
                let t = e.data.movies;
                if (0 === t.length) return show.error("无数据"), void s.close();
                this.movies = t;
                const n = t.filter((e => "1" === this.has_cnsub ? e.has_cnsub : "0" !== this.has_cnsub || !e.has_cnsub)), a = this.getBean("HitShowPlugin");
                let r = a.markDataListHtml(n);
                i.html(r), a.loadScore(n), o = !0;
            } else console.error(e), i.html(`<h3>${escapeHtml(l)}</h3>`), show.error(l), "JWTVerificationError" === c && (await localStorage.removeItem(me),
            await this.checkLogin(null, new URLSearchParams(window.location.search))), o = !0;
        } catch (r) {
            l < 3 ? (clog.error(`获取Top数据失败 (第 ${l} 次重试):`, r), await new Promise((e => setTimeout(e, 1e3)))) : (clog.error("所有重试尝试均失败，无法获取Top数据。", r),
            i.html("<h3>无法加载数据，请稍后再试。</h3>"));
        } finally {
            (o || 3 === l) && s.close();
        }
    }
    toolBar(e, t, n) {
        "5" === n.toString() && $(".pagination-next").remove(), $(".pagination-ellipsis").closest("li").remove(),
        $(".pagination-list li a").each((function() {
            parseInt($(this).text()) > 5 && $(this).closest("li").remove();
        }));
        let a = "";
        for (let s = (new Date).getFullYear(); s >= 2008; s--) a += `\n                <a style="padding:18px 18px !important;" \n                   class="button is-small ${t === s.toString() ? "is-info" : ""}" \n                   href="/advanced_search?handleTop=1&handleType=year&type_value=${s}&has_cnsub=${this.has_cnsub}">\n                  ${s}\n                </a>\n            `;
        let i = `\n            <div class="button-group">\n                <div class="buttons has-addons" id="conditionBox" style="margin-bottom: 0!important;">\n                    <a style="padding:18px 18px !important;" class="button is-small ${"all" === e ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=all&type_value=&has_cnsub=${this.has_cnsub}">全部</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"0" === t ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=0&has_cnsub=${this.has_cnsub}">有码</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"1" === t ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=1&has_cnsub=${this.has_cnsub}">无码</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"2" === t ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=2&has_cnsub=${this.has_cnsub}">欧美</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"3" === t ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=3&has_cnsub=${this.has_cnsub}">Fc2</a>\n                    \n                    <a style="padding:18px 18px !important;margin-left: 50px" class="button is-small ${"1" === this.has_cnsub ? "is-info" : ""}" data-cnsub-value="1">含中字磁鏈</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${"0" === this.has_cnsub ? "is-info" : ""}" data-cnsub-value="0">无字幕</a>\n                    <a style="padding:18px 18px !important;" class="button is-small" data-cnsub-value="">重置</a>\n                </div>\n                \n                <div class="buttons has-addons" id="conditionBox">\n                    ${a}\n                </div>\n            </div>\n        `;
        this.$contentBox.append(i), $("a[data-cnsub-value]").on("click", (e => {
            const t = $(e.currentTarget).data("cnsub-value");
            this.has_cnsub = t.toString(), $("a[data-cnsub-value]").removeClass("is-info"),
            $(e.currentTarget).addClass("is-info"), $(".toolbar a.button").not("[data-cnsub-value]").each(((e, n) => {
                const a = $(n), i = new URL(a.attr("href"), window.location.origin);
                i.searchParams.set("has_cnsub", t), a.attr("href", i.toString());
            }));
            const n = this.movies.filter((e => "1" === this.has_cnsub ? e.has_cnsub : "0" !== this.has_cnsub || !e.has_cnsub)), a = this.getBean("HitShowPlugin");
            let i = a.markDataListHtml(n);
            $(".movie-list").html(i), a.loadScore(n);
        }));
    }
    async checkLogin(e, t) {
        if (!localStorage.getItem(me)) return show.error("该类别依赖移动端接口，请先完成登录"), void this.openLoginDialog();
        let n = "all", a = "", i = t.get("t") || "";
        /^y\d+$/.test(i) ? (n = "year", a = i.substring(1)) : "" !== i && (n = "video_type",
        a = i);
        let s = `/advanced_search?handleTop=1&handleType=${n}&type_value=${a}`;
        e && (e.ctrlKey || e.metaKey) ? GM_openInTab(window.location.origin + s, {
            insert: 0
        }) : window.location.href = s;
    }
    openLoginDialog() {
        layer.open({
            type: 1,
            title: "JavDB",
            closeBtn: 1,
            area: utils.getResponsiveArea([ "360px", "auto" ]),
            shadeClose: !1,
            content: '\n                <div style="padding: 30px; font-family: \'Helvetica Neue\', Arial, sans-serif;">\n                    <div style="margin-bottom: 25px;">\n                        <input type="text" id="username" name="username" \n                            style="width: 100%; padding: 12px 15px; border: 1px solid #e0e0e0; border-radius: 4px; \n                                   box-sizing: border-box; transition: all 0.3s; font-size: 14px;\n                                   background: #f9f9f9; color: #333;"\n                            placeholder="用户名 | 邮箱"\n                            onfocus="this.style.borderColor=\'#4a8bfc\'; this.style.background=\'#fff\'"\n                            onblur="this.style.borderColor=\'#e0e0e0\'; this.style.background=\'#f9f9f9\'">\n                    </div>\n                    \n                    <div style="margin-bottom: 15px;">\n                        <input type="password" id="password" name="password" \n                            style="width: 100%; padding: 12px 15px; border: 1px solid #e0e0e0; border-radius: 4px; \n                                   box-sizing: border-box; transition: all 0.3s; font-size: 14px;\n                                   background: #f9f9f9; color: #333;"\n                            placeholder="密码"\n                            onfocus="this.style.borderColor=\'#4a8bfc\'; this.style.background=\'#fff\'"\n                            onblur="this.style.borderColor=\'#e0e0e0\'; this.style.background=\'#f9f9f9\'">\n                    </div>\n                    \n                    <button id="loginBtn" \n                            style="width: 100%; padding: 12px; background: #4a8bfc; color: white; \n                                   border: none; border-radius: 4px; font-size: 15px; cursor: pointer;\n                                   transition: background 0.3s;"\n                            onmouseover="this.style.background=\'#3a7be0\'"\n                            onmouseout="this.style.background=\'#4a8bfc\'">\n                        登录\n                    </button>\n                </div>\n            ',
            success: (e, t) => {
                $("#loginBtn").click((function() {
                    const e = $("#username").val(), n = $("#password").val();
                    if (!e || !n) return void show.error("请输入用户名和密码");
                    let a = loading();
                    (async (e, t) => {
                        let n = `${U}/v1/sessions?username=${encodeURIComponent(e)}&password=${encodeURIComponent(t)}&device_uuid=04b9534d-5118-53de-9f87-2ddded77111e&device_name=iPhone&device_model=iPhone&platform=ios&system_version=17.4&app_version=official&app_version_number=1.9.29&app_channel=official`, a = {
                            "user-agent": "Dart/3.5 (dart:io)",
                            "accept-language": "zh-TW",
                            "content-type": "multipart/form-data; boundary=--dio-boundary-2210433284",
                            jdsignature: await O()
                        };
                        return await gmHttp.post(n, null, a);
                    })(e, n).then((async e => {
                        let n = e.success;
                        if (0 === n) show.error(e.message); else {
                            if (1 !== n) throw clog.error("登录失败", e), new Error(e.message);
                            {
                                let n = e.data.token;
                                await localStorage.setItem(me, await encryptData(n)), show.ok("登录成功"), layer.close(t), window.location.href = "/advanced_search?handleTop=1&period=daily";
                            }
                        }
                    })).catch((e => {
                        clog.error("登录异常:", e), show.error(e.message);
                    })).finally((() => {
                        a.close();
                    }));
                }));
            }
        });
    }
}
