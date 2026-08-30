// @ts-check

import { _ } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";

export class FavoriteActressesPlugin extends BasePlugin {
    getName() {
        return "FavoriteActressesPlugin";
    }
    /** @param {{scope?: any}} [options] */
    async handle(options = {}) {
        const scope = options.scope ?? await this.getRuntimeService("scope")();
        this.bindEvent(scope), await this.highlightActress(), void this.replaceActressAvatar().catch((error) => clog.warn("演员头像替换失败", error));
    }
    async highlightActress() {
        if (!isDetailPage) return;
        if (await storageManager.getSetting("enableFavoriteActresses", _) !== _) return;
        const e = await storageManager.getFavoriteActressList();
        if (!e || 0 === e.length) return;
        const t = new Set;
        e.forEach(((/** @type {any} */ e) => {
            e.starId && t.add(String(e.starId).trim());
        })), 0 !== t.size && $(".female").prev().each(((/** @type {number} */ e, /** @type {Element} */ n) => {
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
    async removeActorFromStorage(/** @type {unknown} */ e) {
        await storageManager.removeFavoriteActress(e) && (clog.log("移除演员成功"), document.dispatchEvent(new CustomEvent("actress-state-changed", { detail: { starId: String(e) } })));
    }
    /** @param {any} scope */
    bindEvent(scope) {
        const e = /\/actors\/(\w+)\/(collect|uncollect)/;
        const onConfirm = async (/** @type {any} */ t) => {
            const [n] = t.detail;
            if (!n) return;
            const a = $(t.currentTarget).attr("href").match(e), i = a ? a[1] : null;
            i && await this.removeActorFromStorage(i);
        };
        const onCollect = async (/** @type {MouseEvent} */ t) => {
            const n = $("#button-collect-actor").attr("href").match(e), a = n ? n[1] : null;
            /** @type {string[]} */ let i = [];
            let s = $(".actor-section-name");
            s.length && s.text().trim().split(",").forEach(((/** @type {string} */ e) => {
                i.push(e.trim());
            }));
            let o = $(".section-meta:not(:contains('影片'))");
            if (o.length && o.text().trim().split(",").forEach(((/** @type {string} */ e) => {
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
            1 === await storageManager.addFavoriteActressList([ c ]) ? (clog.log(`收藏演员成功: ${r} (ID: ${a})`), document.dispatchEvent(new CustomEvent("actress-state-changed", { detail: { starId: String(a) } }))) : clog.log(`收藏演员失败: ${r} (ID: ${a})`);
        };
        const onUncollect = async (/** @type {MouseEvent} */ t) => {
            const n = $("#button-uncollect-actor").attr("href").match(e), a = n ? n[1] : null;
            a ? await this.removeActorFromStorage(a) : clog.error("无法获取演员ID进行取消收藏操作。");
        };
        $(document).on("confirm:complete.jhsFavoriteActress", 'a[href*="/actors/"][href*="/uncollect"]', onConfirm);
        $("#button-collect-actor").on("click.jhsFavoriteActress", onCollect);
        $("#button-uncollect-actor").on("click.jhsFavoriteActress", onUncollect);
        scope.addCleanup(() => {
            $(document).off(".jhsFavoriteActress");
            $("#button-collect-actor,#button-uncollect-actor").off(".jhsFavoriteActress");
        });
    }
    async replaceActressAvatar() {
        const e = this.getActressId();
        if (!e) return;
        const t = (await storageManager.getFavoriteActressList()).find(((/** @type {any} */ t) => t.starId === e));
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
