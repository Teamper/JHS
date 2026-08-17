class ListPageButtonPlugin extends BasePlugin {
    getName() {
        return "ListPageButtonPlugin";
    }
    async handle() {
        if (!window.isListPage) return;
        await this.createMenuBtn(), this.bindEvent();
        const e = await storageManager.getSetting("autoPage"), t = this.isHitShowPage();
        $("#sort-toggle-btn").prop("disabled", e === _ && !t).attr("title", e === _ && !t ? "瀑布流模式仅支持默认排序" : "选择列表排序方式"),
        (e !== _ || t) && await this.sortItems();
    }
    async createMenuBtn() {
        if (r) {
            const e = o.includes("/actors/");
            let t = $(".main-tabs, .tabs"), n = "加入黑名单", a = "jhs-btn--filter", s = null;
            if (e) {
                t = $(".toolbar, .section-addition").filter(":last");
                const e = await storageManager.getBlacklist(), i = this.getActressPageInfo();
                e.find((e => e.starId === i.starId)) && (n = "已加入黑名单", a = "jhs-btn--muted");
            } else o.includes("/tags") && utils.loopDetector((() => $("#jhs-check-tag").text().trim()), (async () => {
                const e = $("#addBlacklistBtn");
                e.attr("data-tip", "将当前分类标签加入到黑名单, 后续有作品更新也会纳入屏蔽中");
                const t = $("#jhs-check-tag").text().trim();
                if (!t) return;
                const n = "no-" + t, a = await storageManager.getBlacklist();
                s = a.find((e => e.starId === n)), s && (e.addClass("jhs-btn--muted").removeClass("jhs-btn--filter"), $("#addBlacklistBtn span").text("已加入黑名单"));
            }));
            const r = o.includes("advanced_search");
            r && (t = $("h2.section-title"));
            const l = localStorage.getItem("jhs_sortMethod"), d = "当前排序方式: " + ("rateCount" === l ? "评价人数" : "date" === l ? "时间" : "默认");
            t.append(`\n                <div class="jhs-list-btn-row">\n                    <button type="button" id="waitCheckBtn" class="jhs-btn jhs-btn--secondary"><span>打开待鉴定</span></button>\n                    ${e ? `\n                     <button type="button" id="addBlacklistBtn" class="jhs-btn ${a}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n}</span></button>\n                     <button type="button" id="filterAllVideo" class="jhs-btn jhs-btn--watch" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>一键屏蔽所有作品</span></button>\n                     <button type="button" id="favoriteAllVideo" class="jhs-btn jhs-btn--fav" data-tip="一键收藏当前页面所有作品"><span>一键收藏所有作品</span></button>\n                     <button type="button" id="hasDownAllVideo" class="jhs-btn jhs-btn--down" data-tip="一键标记当前页面所有作品为已下载"><span>一键已下载所有作品</span></button>\n                    ` : ""}\n                    ${o.includes("/tags") ? `\n                      <button type="button" id="addBlacklistBtn" class="jhs-btn ${a}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n}</span></button>\n                    ` : ""}\n                </div>\n                <div class="jhs-list-btn-row">\n                    <button type="button" id="newVideoBtn" class="jhs-btn jhs-btn--secondary"><span>新作品检测 (<span id="newVideoCount">0</span>)</span></button>\n                    <button type="button" id="blacklistBtn" class="jhs-btn jhs-btn--secondary"><span>演员黑名单</span></button>\n                    ${c ? "" : this.sortMenuHtml(l || "default", d)}\n                </div>\n            `);
        }
        if (l) {
            const e = o.includes("/star/");
            let t = "加入黑名单", n = "jhs-btn--filter";
            if (e) {
                const e = await storageManager.getBlacklist(), a = this.getActressPageInfo();
                e.find((e => e.starId === a.starId)) && (t = "已加入黑名单", n = "jhs-btn--muted");
            }
            const a = localStorage.getItem("jhs_sortMethod") || "default";
            $(".masonry").parent().prepend(`\n                <div class="jhs-list-btn-row">\n                    <button type="button" id="waitCheckBtn" class="jhs-btn jhs-btn--secondary"><span>打开待鉴定</span></button>\n                    ${e ? `    \n                        <button type="button" id="addBlacklistBtn" class="jhs-btn ${n}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${t}</span></button>\n                        <button type="button" id="filterAllVideo" class="jhs-btn jhs-btn--watch" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>一键屏蔽所有作品</span></button>\n                        <button type="button" id="favoriteAllVideo" class="jhs-btn jhs-btn--fav" data-tip="一键收藏当前页面所有作品"><span>一键收藏所有作品</span></button>\n                        <button type="button" id="hasDownAllVideo" class="jhs-btn jhs-btn--down" data-tip="一键标记当前页面所有作品为已下载"><span>一键已下载所有作品</span></button>\n                    ` : '<button type="button" id="blacklistBtn" class="jhs-btn jhs-btn--secondary"><span>演员黑名单</span></button>'}\n                    ${this.sortMenuHtml(a)}\n                </div>\n            `);
        }
    }
    /** 构建与原排序值兼容的 JHS 菜单。 */
    sortMenuHtml(method, title = "选择列表排序方式") {
        const labels = { default: "默认", rateCount: "评价人数", date: "时间" }, current = labels[method] || labels.default;
        return `<div class="jhs-sort-control"><button type="button" id="sort-toggle-btn" class="jhs-btn jhs-btn--secondary" aria-haspopup="menu" aria-expanded="false" title="${title}"><span id="jhs-sort-current">${current}</span></button><div class="jhs-popover jhs-sort-menu" role="menu" aria-label="排序方式">${Object.entries(labels).map((([value, label]) => `<button type="button" class="jhs-btn jhs-btn--ghost jhs-sort-option" role="menuitemradio" aria-checked="${value === method ? "true" : "false"}" data-sort-method="${value}" tabindex="-1">${label}</button>`)).join("")}</div></div>`;
    }
    bindEvent() {
        $("#waitCheckBtn").on("click", (e => {
            void this.openWaitCheck(e).catch((error => clog.error("待鉴定列表打开失败", error)));
        })), $("#newVideoBtn").on("click", (e => {
            this.getBean("NewVideoPlugin").openDialog();
        })), $("#blacklistBtn").on("click", (e => {
            this.getBean("BlacklistPlugin").openBlacklistDialog();
        })), this.bindSortMenu();
        const e = this.getBean("BlacklistPlugin");
        $("#addBlacklistBtn").on("click", (async t => {
            await e.addBlacklist(t);
        })), $("#filterAllVideo").on("click", (async t => {
            let n = {
                clientX: t.clientX,
                clientY: t.clientY + 80
            }, a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            let i = a.text().trim().split(",")[0];
            utils.q(n, "一键屏蔽视频列表?", (async () => {
                this.loadObj = loading();
                try {
                    await e.filterAllVideo(i), window.refresh();
                } catch (t) {
                    clog.error(t);
                } finally { this.loadObj.close(); }
            }));
        })), $("#favoriteAllVideo").on("click", (async t => {
            let n = {clientX: t.clientX, clientY: t.clientY + 80}, a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            let i = a.text().trim().split(",")[0];
            utils.q(n, "一键收藏所有可见作品?", (async () => {
                this.loadObj = loading();
                try { await e.batchSaveAllVideos(i, h), window.refresh(); } catch (t) { clog.error(t); } finally { this.loadObj.close(); }
            }));
        })), $("#hasDownAllVideo").on("click", (async t => {
            let n = {clientX: t.clientX, clientY: t.clientY + 80}, a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            let i = a.text().trim().split(",")[0];
            utils.q(n, "一键已下载所有可见作品?", (async () => {
                this.loadObj = loading();
                try { await e.batchSaveAllVideos(i, g), window.refresh(); } catch (t) { clog.error(t); } finally { this.loadObj.close(); }
            }));
        }));
    }
    /** 绑定排序 popover 的选择与键盘交互。 */
    bindSortMenu() {
        const control = $(".jhs-sort-control"), toggle = control.find("#sort-toggle-btn"), menu = control.find(".jhs-sort-menu"), close = (focus = !1) => {
            menu.removeClass("is-open"), toggle.attr("aria-expanded", "false"), focus && toggle.trigger("focus");
        };
        toggle.on("click", (event => {
            event.preventDefault(), event.stopPropagation();
            const open = !menu.hasClass("is-open");
            menu.toggleClass("is-open", open), toggle.attr("aria-expanded", String(open)), open && menu.find('[aria-checked="true"]').trigger("focus");
        }));
        menu.on("click", ".jhs-sort-option", (event => {
            const item = $(event.currentTarget), method = item.data("sort-method");
            localStorage.setItem("jhs_sortMethod", method), menu.find(".jhs-sort-option").attr("aria-checked", "false"), item.attr("aria-checked", "true"),
            $("#jhs-sort-current").text(item.text()), close(!0), void this.sortItems().catch((error => clog.error("列表排序失败", error)));
        })).on("keydown", ".jhs-sort-option", (event => {
            const items = menu.find(".jhs-sort-option"), index = items.index(event.currentTarget);
            if ("Escape" === event.key) return event.preventDefault(), close(!0);
            if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
            event.preventDefault();
            const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items.eq(next).trigger("focus");
        }));
        $(document).off("click.jhsSortMenu").on("click.jhsSortMenu", (event => {
            $(event.target).closest(control).length || close();
        }));
    }
    async sortItems() {
        const e = this.isHitShowPage();
        if (!e && (o.includes("handle") || o.includes("advanced_search"))) return;
        const s = await storageManager.getSetting("autoPage");
        if (c || s === _ && !e) return;
        const t = localStorage.getItem("jhs_sortMethod");
        if (!t) return;
        const i = this.getSelector(), d = $(i.boxSelector), h = $(i.itemSelector);
        h.each((function(e) {
            $(this).attr("data-original-index") || $(this).attr("data-original-index", e);
        }));
        const items = h.get().map(((element, index) => {
            const card = $(element), originalIndex = Number(card.attr("data-original-index")) || 0;
            if ("default" === t) return { element, key: originalIndex, originalIndex, index };
            if ("rateCount" === t) {
                const explicit = Number(card.attr("data-jhs-rate-count")), match = card.find(".score .value").text().match(/由(\d+)人/);
                return { element, key: Number.isFinite(explicit) ? explicit : match ? Number(match[1]) : 0, originalIndex, index };
            }
            const value = card.attr("data-jhs-publish-time") || card.find(".meta").text().trim() || card.find("date").filter((function() { return /^\d{4}-\d{1,2}-\d{1,2}$/.test($(this).text().trim()); })).first().text().trim(), timestamp = Date.parse(value);
            return { element, key: Number.isFinite(timestamp) ? timestamp : 0, originalIndex, index };
        }));
        items.sort(((e, n) => "default" === t ? e.key - n.key : n.key - e.key || e.originalIndex - n.originalIndex || e.index - n.index));
        const sortedElements = items.map((item => item.element));
        "default" === t ? $(sortedElements).appendTo(d) : d.empty().append(sortedElements);
    }
    isHitShowPage() {
        return isHitShowPage(window.location);
    }
    async openWaitCheck() {
        let e = this.getSelector();
        const t = await storageManager.getSetting("waitCheckCount", 5), n = [ u, b, y, k ];
        let a = 0;
        $(`${e.itemSelector}:visible`).each(((e, i) => {
            if (a >= t) return !1;
            const s = $(i);
            if (n.some((e => s.find(`span.tag:contains('${e}')`).length > 0))) return;
            const {carNum: o, aHref: r} = this.getBean("ListPagePlugin").findCarNumAndHref(s);
            if (o.includes("FC2-")) {
                const e = this.parseMovieId(r);
                this.getBean("Fc2Plugin").openFc2Page(e, o, r);
            } else {
                let e = r + (r.includes("?") ? "&autoPlay=1" : "?autoPlay=1");
                window.open(e);
            }
            a++;
        })), 0 === a && show.info("没有需鉴定的视频");
    }
}
