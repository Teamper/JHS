// @ts-check

import { escapeHtml, i } from "../../core/constants.js";
import { q } from "../../core/javdb-api.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { hasStoredEncryptedCredential, removeStoredEncryptedCredential, storeEncryptedCredential } from "../../core/credential-crypto.js";

const me = "jhs_appAuthorization";
/** @typedef {Record<string, any>} TopMovie */

export class Top250Plugin extends BasePlugin {
    static legacyPluginId = "TOP250Plugin";
    constructor() {
        super(), i(this, "has_cnsub", ""), i(this, "$contentBox", null), i(this, "$listRoot", null), i(this, "movies", []);
    }
    getName() {
        return "TOP250Plugin";
    }
    async handle() {
        const topTab = $('.main-tabs ul li:contains("猜你喜歡")').length ? $('.main-tabs ul li:contains("猜你喜歡")') : $('.main-tabs ul li:contains("猜你喜欢")');
        topTab.length && topTab.html('<a href="/rankings/top"><span>Top250</span></a>');
        $('a[href*="rankings/top"]').off("click.jhsTop250").on("click.jhsTop250", ((/** @type {MouseEvent} */ e) => {
            e.preventDefault(), e.stopPropagation();
            const t = $(e.target), n = (t.is("a") ? t : t.closest("a")).attr("href");
            if (!n) return;
            let a = n.includes("?") ? n.split("?")[1] : n;
            const i = new URLSearchParams(a);
            this.checkLogin(e, i);
        })), await this.handleTop();
    }
    hookPage() {
        const host = this.getRuntimeService("host"), contentBox = host.getListContainer?.() ?? host.getListLayoutContainer?.();
        if (!contentBox || !host.createOwnedListRoot) throw new Error("JavDB 列表容器不可用");
        this.$contentBox = $(contentBox), this.$listRoot = $(host.createOwnedListRoot([ "jhs-top250-list", "jhs-layout-d2c171b1" ]));
        let e = $("h2.section-title");
        e.length || (e = $("<h2></h2>").addClass("section-title").prependTo(this.$contentBox)), e.contents().first().replaceWith("Top250"),
        $(".empty-message").remove(), this.$contentBox.children(".box").remove(), $("#sort-toggle-btn").remove(),
        this.$contentBox.children(".jhs-top250-list").remove(), this.$contentBox.children(".jhs-top250-filters").remove(),
        this.$contentBox.children(".tool-box.jhs-layout-d2c171b1").remove(), this.$contentBox.children("nav.pagination").remove(),
        this.$contentBox.append('<div class="tool-box jhs-layout-d2c171b1"></div>'), this.$contentBox.append(this.$listRoot);
    }
    renderPagination() {
        const e = new URLSearchParams(window.location.search);
        let t = parseInt(e.get("page") || "", 10) || 1;
        this.$contentBox.append((e => {
            const t = e >= 5;
            let n = "";
            for (let a = 1; a <= 5; a++) {
                n += `<li><button type="button" class="jhs-btn pagination-link ${e === a ? "is-current" : ""}" data-page="${a}">${a}</button></li>`;
            }
            return `\n                <nav class="pagination">\n                    <button type="button" class="jhs-btn pagination-previous ${e <= 1 ? "do-hide" : ""}" data-page="${e - 1}">上一页</button>\n                    <button type="button" class="jhs-btn pagination-next ${t ? "do-hide" : ""}" data-page="${e + 1}">下一页</button>\n                    \n                    <ul class="pagination-list">\n                        ${n}\n                    </ul>\n                </nav>\n            `;
        })(t)), this.$contentBox.on("click", ".pagination-link, .pagination-previous, .pagination-next", ((/** @type {MouseEvent} */ t) => {
            t.preventDefault();
            const n = parseInt(String($(t.currentTarget).data("page")), 10);
            !isNaN(n) && n > 0 && (t => {
                e.set("page", String(t)), window.history.pushState({}, "", "?" + e.toString()), window.location.reload();
            })(n);
        }));
    }
    async handleTop() {
        if (!window.location.href.includes("handleTop=1")) return;
        const hitShow = this.getOptionalDependency("HitShowPlugin");
        if (!hitShow) return void show.info("热播列表功能已禁用");
        const e = new URLSearchParams(window.location.search);
        let t = e.get("handleType") || "all", n = e.get("type_value") || "";
        this.has_cnsub = e.get("has_cnsub") || "";
        let a = Number(e.get("page")) || 1;
        this.hookPage(), this.toolBar(t, n), this.renderPagination();
        // 操作按钮行（开始鉴定/批量操作）挂进 Top250 自有筛选容器，与热播页同一挂载通道
        await this.getOptionalDependency("ListPageButtonPlugin")?.mountOwnedRankingControls?.($(".jhs-top250-filters"))?.catch?.((/** @type {unknown} */ error) => clog.error("Top250 操作按钮挂载失败", error));
        let i = this.$listRoot;
        i.html("");
        let s = loading();
        let o = !1;
        for (let attempt = 1; attempt <= 3 && !o; attempt++) try {
            const e = await q(t, n, a, 50);
            let r = e.success, c = e.action;
            if (1 === r) {
                const movies = e.data.movies;
                if (0 === movies.length) return show.error("无数据"), void s.close();
                this.movies = movies;
                const filtered = movies.filter(((/** @type {TopMovie} */ movie) => "1" === this.has_cnsub ? movie.has_cnsub : "0" !== this.has_cnsub || !movie.has_cnsub)), rendered = hitShow.markDataListHtml(filtered, { thumbnailFirst: !0 });
                i.html(rendered), await hitShow.initializeRenderedList(), await hitShow.loadScore(filtered), o = !0;
            } else clog.error(e), i.html(`<h3>${escapeHtml(e.message)}</h3>`), show.error(e.message), "JWTVerificationError" === c && (removeStoredEncryptedCredential(me),
            await this.checkLogin(null, new URLSearchParams(window.location.search))), o = !0;
        } catch (r) {
            attempt < 3 ? (clog.error(`获取Top数据失败 (第 ${attempt} 次重试):`, r), await new Promise((e => setTimeout(e, 1e3)))) : (clog.error("所有重试尝试均失败，无法获取Top数据。", r),
            i.html("<h3>无法加载数据，请稍后再试。</h3>"));
        } finally {
            (o || 3 === attempt) && s.close();
        }
    }
    toolBar(/** @type {string} */ e, /** @type {string} */ t) {
        let years = "";
        for (let year = (new Date).getFullYear(); year >= 2008; year--) years += `<a class="jhs-segmented__item jhs-layout-186f17ef ${t === String(year) ? "active" : ""}" aria-current="${t === String(year) ? "page" : "false"}" href="/advanced_search?handleTop=1&handleType=year&type_value=${year}&has_cnsub=${this.has_cnsub}">${year}</a>`;
        const typeLink = (/** @type {string} */ value, /** @type {string} */ label, /** @type {string} */ type = "video_type") => `<a class="jhs-segmented__item jhs-layout-186f17ef ${value === ("all" === value ? e : t) ? "active" : ""}" aria-current="${value === ("all" === value ? e : t) ? "page" : "false"}" href="/advanced_search?handleTop=1&handleType=${type}&type_value=${"all" === value ? "" : value}&has_cnsub=${this.has_cnsub}">${label}</a>`;
        const html = `<div class="jhs-top250-filters"><nav class="jhs-segmented jhs-layout-701bf0f9" aria-label="类型条件">${typeLink("all", "全部", "all")}${typeLink("0", "有码")}${typeLink("1", "无码")}${typeLink("2", "欧美")}${typeLink("3", "Fc2")}<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm jhs-layout-2335597e ${"1" === this.has_cnsub ? "active" : ""}" aria-pressed="${"1" === this.has_cnsub}" data-cnsub-value="1">含中字磁力</button><button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm jhs-layout-186f17ef ${"0" === this.has_cnsub ? "active" : ""}" aria-pressed="${"0" === this.has_cnsub}" data-cnsub-value="0">无字幕</button><button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm jhs-layout-186f17ef" aria-pressed="false" data-cnsub-value="">重置</button></nav><nav class="jhs-segmented" aria-label="年份条件">${years}</nav></div>`;
        const title = this.$contentBox.children("h2.section-title").first();
        title.length ? title.after(html) : this.$contentBox.prepend(html), $("button[data-cnsub-value]").on("click", ((/** @type {MouseEvent} */ event) => {
            const value = String($(event.currentTarget).data("cnsub-value")), params = new URLSearchParams(window.location.search);
            params.set("handleTop", "1"), params.set("handleType", e), params.set("type_value", t), params.set("has_cnsub", value), params.delete("page"),
            window.location.href = `/advanced_search?${params.toString()}`;
        }));
    }
    async checkLogin(/** @type {MouseEvent | null} */ e, /** @type {URLSearchParams} */ t) {
        const credential = this.getRuntimeService("credential") || /** @type {any} */ (globalThis).credentialService;
        if (!(credential?.get ? await credential.get(me) : hasStoredEncryptedCredential(me))) return show.error("该类别依赖移动端接口，请先完成登录"), void this.openLoginDialog();
        let n = "all", a = "", i = t.get("t") || "";
        /^y\d+$/.test(i) ? (n = "year", a = i.substring(1)) : "" !== i && (n = "video_type",
        a = i);
        let s = `/advanced_search?handleTop=1&handleType=${n}&type_value=${a}`;
        e && (e.ctrlKey || e.metaKey) ? GM_openInTab(window.location.origin + s, {
            insert: 0
        }) : window.location.href = s;
    }
    /** @param {{onSuccess?: (() => unknown | Promise<unknown>) | null}} [options] */
    openLoginDialog({ onSuccess = null } = {}) {
        const dialog = this.getRuntimeService("dialog"), account = this.getRuntimeService("account"), getScope = this.getRuntimeService("scope");
        dialog.open({
            type: 1,
            title: "JavDB",
            closeBtn: 1,
            area: utils.getResponsiveArea([ "360px", "auto" ]),
            shadeClose: !1,
            content: '\n                <style>#loginBtn:hover{background:var(--jhs-accent-hover)}</style>\n                <div class="jhs-layout-e32cff7f">\n                    <div class="jhs-layout-598afa5a">\n                        <input type="text" id="username" name="username" \n                           \n                            placeholder="用户名 | 邮箱"\n                            onfocus="this.style.borderColor=\'var(--jhs-accent)\'; this.style.background=\'var(--jhs-surface)\'"\n                            onblur="this.style.borderColor=\'var(--jhs-border-strong)\'; this.style.background=\'var(--jhs-surface-2)\'" class="jhs-field">\n                    </div>\n                    \n                    <div class="jhs-layout-da303dcf">\n                        <input type="password" id="password" name="password" \n                           \n                            placeholder="密码"\n                            onfocus="this.style.borderColor=\'var(--jhs-accent)\'; this.style.background=\'var(--jhs-surface)\'"\n                            onblur="this.style.borderColor=\'var(--jhs-border-strong)\'; this.style.background=\'var(--jhs-surface-2)\'" class="jhs-field">\n                    </div>\n                    \n                    <button id="loginBtn" \n                           \n                             class="jhs-btn jhs-layout-c4eb15bf">\n                        登录\n                    </button>\n                </div>\n            ',
            success: (/** @type {Element} */ e, /** @type {number} */ t) => {
                $("#loginBtn").click((async () => {
                    const e = $("#username").val(), n = $("#password").val();
                    if (!e || !n) return void show.error("请输入用户名和密码");
                    let a = loading();
                    account.login("javdb", { username: e, password: n }, { scope: await getScope() }).then((async (/** @type {any} */ result) => {
                        if (!result.success) show.error(result.message); else {
                            const credential = this.getRuntimeService("credential") || /** @type {any} */ (globalThis).credentialService;
                            credential?.set ? await credential.set(me, result.token) : await storeEncryptedCredential(me, result.token), show.ok("登录成功"), dialog.close(t), "function" === typeof onSuccess ? await onSuccess() : window.location.href = "/advanced_search?handleTop=1&period=daily";
                        }
                    })).catch(((/** @type {unknown} */ error) => {
                        clog.error("登录异常:", error), show.error(error instanceof Error ? error.message : String(error));
                    })).finally((() => {
                        a.close();
                    }));
                }));
            }
        });
    }
}
