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
        $(".section .container .box").remove(), $("#sort-toggle-btn").remove(), this.$contentBox.append('<div class="tool-box jhs-layout-d2c171b1"></div>'),
        this.$contentBox.append('<div class="movie-list h cols-4 vcols-8 jhs-layout-d2c171b1"></div>'),
        this.renderPagination();
    }
    renderPagination() {
        const e = new URLSearchParams(window.location.search);
        let t = parseInt(e.get("page")) || 1;
        this.$contentBox.append((e => {
            const t = e >= 5;
            let n = "";
            for (let a = 1; a <= 5; a++) {
                n += `<li><button type="button" class="jhs-btn pagination-link ${e === a ? "is-current" : ""}" data-page="${a}">${a}</button></li>`;
            }
            return `\n                <nav class="pagination">\n                    <button type="button" class="jhs-btn pagination-previous ${e <= 1 ? "do-hide" : ""}" data-page="${e - 1}">上一頁</button>\n                    <button type="button" class="jhs-btn pagination-next ${t ? "do-hide" : ""}" data-page="${e + 1}">下一頁</button>\n                    \n                    <ul class="pagination-list">\n                        ${n}\n                    </ul>\n                </nav>\n            `;
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
        $(".pagination-list li .pagination-link").each((function() {
            parseInt($(this).text()) > 5 && $(this).closest("li").remove();
        }));
        let a = "";
        for (let s = (new Date).getFullYear(); s >= 2008; s--) a += `\n                <a \n                   class="button is-small jhs-layout-186f17ef ${t === s.toString() ? "is-info" : ""}" \n                   href="/advanced_search?handleTop=1&handleType=year&type_value=${s}&has_cnsub=${this.has_cnsub}">\n                  ${s}\n                </a>\n            `;
        let i = `\n            <div class="button-group">\n                <div class="buttons has-addons jhs-layout-701bf0f9" id="conditionBox">\n                    <a class="button is-small jhs-layout-186f17ef ${"all" === e ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=all&type_value=&has_cnsub=${this.has_cnsub}">全部</a>\n                    <a class="button is-small jhs-layout-186f17ef ${"0" === t ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=0&has_cnsub=${this.has_cnsub}">有码</a>\n                    <a class="button is-small jhs-layout-186f17ef ${"1" === t ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=1&has_cnsub=${this.has_cnsub}">无码</a>\n                    <a class="button is-small jhs-layout-186f17ef ${"2" === t ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=2&has_cnsub=${this.has_cnsub}">欧美</a>\n                    <a class="button is-small jhs-layout-186f17ef ${"3" === t ? "is-info" : ""}" href="/advanced_search?handleTop=1&handleType=video_type&type_value=3&has_cnsub=${this.has_cnsub}">Fc2</a>\n                    \n                    <button type="button" class="jhs-btn jhs-btn--secondary jhs-layout-2335597e ${"1" === this.has_cnsub ? "is-info" : ""}" data-cnsub-value="1">含中字磁鏈</button>\n                    <button type="button" class="jhs-btn jhs-btn--secondary jhs-layout-186f17ef ${"0" === this.has_cnsub ? "is-info" : ""}" data-cnsub-value="0">无字幕</button>\n                    <button type="button" class="jhs-btn jhs-btn--secondary jhs-layout-186f17ef" data-cnsub-value="">重置</button>\n                </div>\n                \n                <div class="buttons has-addons" id="conditionBox">\n                    ${a}\n                </div>\n            </div>\n        `;
        this.$contentBox.append(i), $("button[data-cnsub-value]").on("click", (e => {
            const t = $(e.currentTarget).data("cnsub-value");
            this.has_cnsub = t.toString(), $("button[data-cnsub-value]").removeClass("is-info"),
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
            content: '\n                <style>#loginBtn:hover{background:var(--jhs-accent-hover)}</style>\n                <div class="jhs-layout-e32cff7f">\n                    <div class="jhs-layout-598afa5a">\n                        <input type="text" id="username" name="username" \n                           \n                            placeholder="用户名 | 邮箱"\n                            onfocus="this.style.borderColor=\'var(--jhs-accent)\'; this.style.background=\'var(--jhs-surface)\'"\n                            onblur="this.style.borderColor=\'var(--jhs-border-strong)\'; this.style.background=\'var(--jhs-surface-2)\'" class="jhs-field">\n                    </div>\n                    \n                    <div class="jhs-layout-da303dcf">\n                        <input type="password" id="password" name="password" \n                           \n                            placeholder="密码"\n                            onfocus="this.style.borderColor=\'var(--jhs-accent)\'; this.style.background=\'var(--jhs-surface)\'"\n                            onblur="this.style.borderColor=\'var(--jhs-border-strong)\'; this.style.background=\'var(--jhs-surface-2)\'" class="jhs-field">\n                    </div>\n                    \n                    <button id="loginBtn" \n                           \n                             class="jhs-btn jhs-layout-c4eb15bf">\n                        登录\n                    </button>\n                </div>\n            ',
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
