class FavoriteActressesPlugin extends BasePlugin {
    getName() {
        return "FavoriteActressesPlugin";
    }
    async handle() {
        this.bindEvent(), await this.highlightActress(), this.replaceActressAvatar();
    }
    async highlightActress() {
        if (!isDetailPage) return;
        if (await storageManager.getSetting("enableFavoriteActresses", _) !== _) return;
        const e = await storageManager.getFavoriteActressList();
        if (!e || 0 === e.length) return;
        const t = new Set;
        e.forEach((e => {
            e.starId && t.add(String(e.starId).trim());
        })), 0 !== t.size && $(".female").prev().each(((e, n) => {
            const a = $(n), i = a.attr("href");
            let s = null;
            if (i) {
                const e = (i.endsWith("/") ? i.slice(0, -1) : i).split("/"), t = e[e.length - 1];
                t && (s = t.trim());
            }
            let o = !1;
            s && (o = t.has(s)), o && (a.addClass("highlighted"), a.attr("title", "高亮已收藏演员, 可在设置-基础配置中关闭"));
        }));
    }
    async removeActorFromStorage(e) {
        await storageManager.removeFavoriteActress(e) && clog.log("移除演员成功");
    }
    bindEvent() {
        const e = /\/actors\/(\w+)\/(collect|uncollect)/;
        $(document).on("confirm:complete", 'a[href*="/actors/"][href*="/uncollect"]', (async t => {
            const [n] = t.detail;
            if (!n) return;
            const a = $(t.currentTarget).attr("href").match(e), i = a ? a[1] : null;
            i && await this.removeActorFromStorage(i);
        })), $("#button-collect-actor").click((async t => {
            const n = $("#button-collect-actor").attr("href").match(e), a = n ? n[1] : null;
            let i = [], s = $(".actor-section-name");
            s.length && s.text().trim().split(",").forEach((e => {
                i.push(e.trim());
            }));
            let o = $(".section-meta:not(:contains('影片'))");
            if (o.length && o.text().trim().split(",").forEach((e => {
                i.push(e.trim());
            })), !i.length) return void clog.error("获取演员名称失败");
            const r = i[0];
            if (!a) return void clog.error("无法获取演员ID进行收藏操作。");
            const l = ($(".avatar").first().css("background-image") || "").replace(/^url\(["']?|["']?\)$/g, ""), c = {
                starId: a,
                name: r,
                allName: i,
                avatar: l
            };
            1 === await storageManager.addFavoriteActressList([ c ]) ? clog.log(`收藏演员成功: ${r} (ID: ${a})`) : clog.log(`收藏演员失败: ${r} (ID: ${a})`);
        })), $("#button-uncollect-actor").click((async t => {
            const n = $("#button-uncollect-actor").attr("href").match(e), a = n ? n[1] : null;
            a ? await this.removeActorFromStorage(a) : clog.error("无法获取演员ID进行取消收藏操作。");
        }));
    }
    async replaceActressAvatar() {
        const e = this.getActressId();
        if (!e) return;
        const t = (await storageManager.getFavoriteActressList()).find((t => t.starId === e));
        if (t && t.avatar) {
            const e = `url('${t.avatar}')`;
            let n = $(".avatar").first();
            if (0 === n.length) {
                const e = '<div class="column actor-avatar"> <div class="image"> <span class="avatar"></span> </div> </div>';
                $(".section-columns").prepend(e), n = $(".avatar").first();
            }
            if (0 === n.length) return;
            n.css("background-image").trim().toLowerCase() !== e.trim().toLowerCase() && (n.css("background-image", e),
            n.css("background-size", "cover"), n.css("background-position", "top center"), n.css("background-repeat", "no-repeat"));
        }
    }
}
