// @ts-check

import { cleanActressName, readCleanActorElementText } from "../../core/actress-measurements.js";
import { _, escapeHtml, l, o, r, u } from "../../core/constants.js";
import { mapLimit, safePlay } from "../../core/feature-helpers.js";
import { requestHostPage } from "../../core/host-page-request.js";
import { readListItem } from "../../core/list-item-reader.js";
import { assertMovieStateEligible } from "../../core/movie-identity.js";
import { upgradeListCoverImage } from "./list-cover-image-controller.js";

/** @typedef {import("./list-page-service.js").ListPageService} ListPageService */

/** @typedef {Record<string, any>} ListRecord */
/** @typedef {any} JQueryHandle */
/** Normalize public list-card translation inputs (DOM Element or jQuery handle). */
/** @param {any} item @returns {any} */
function normalizeCard(item) {
    return item?.jquery ? item : $(item);
}

/** @param {(Element|JQueryHandle)[]} e
 * @param {ListPageService} owner
 */
export async function translateListItems(owner, e) {
    if (owner.readTranslation()?.translateListItems) return owner.readTranslation().translateListItems(e.map((item) => item?.jquery ? item[0] : item));
    if ((owner.getRuntimeService("settings").snapshot().translateTitle ?? _) !== _) return;
    let failed = 0;
    /** @type {unknown} */
    let firstError = null;
    await mapLimit(e, 3, (async (item, index) => {
        try {
            if (index > 0 && index % 8 === 0) await owner.yieldListFrame();
            await owner.translate(normalizeCard(item));
        } catch (error) {
            failed++;
            firstError ??= error;
        }
    }));
    if (failed) {
        owner.logger.error(`列表标题翻译失败 ${failed} 项`, firstError);
    }
}

/** @param {ListPageService} owner */
export async function bindClick(owner) {
    const e = owner.getSelector();
    if (!owner.listView) {
        owner.bindMovieDetailNavigation(e.boxSelector);
        $(e.boxSelector).off("click.jhsListVideo").on("click.jhsListVideo", ".item video", (async (/** @type {any} */ event) => {
            event.preventDefault();
            event.stopPropagation();
            const video = event.currentTarget;
            video.paused ? await safePlay(video, { context: "列表视频", notify: true, notifyUser: (message) => owner.runtimeServices.notifications?.error(message), warn: (message, error) => owner.logger.warn?.(message, error) }) : video.pause();
        }));
    }
    if (owner.controllers.contextMenu) $(e.boxSelector).off("contextmenu.jhsListMenu");
    else $(e.boxSelector).off("contextmenu.jhsListMenu").on("contextmenu.jhsListMenu", ".item img, .item video", (async (/** @type {any} */ e) => {
        try {
            e.preventDefault();
            const t = $(e.target).closest(".item"), movie = owner.findCarNumAndHref(t), {carNum: n, url: a, publishTime: i, fc2Source} = movie;
            assertMovieStateEligible(movie);
            let o = owner.getRuntimeService("host")?.readActorProfile?.()?.name || "";
            if (!o) {
                const actorEl = document.querySelector(r ? ".actor-section-name" : ".avatar-box .photo-info .pb10");
                o = cleanActressName(readCleanActorElementText(actorEl).split(/[,，、]/u)[0] ?? "");
            }
            owner.getRuntimeService("ui").q(e, `屏蔽「${escapeHtml(n)}」？`, (async () => {
                try {
                    const current = owner.findCarNumAndHref(t);
                    assertMovieStateEligible(current);
                    if (current.carNum !== n) throw new Error("影片信息已变化，请重试");
                    o || (o = await owner.parseActressName(a)), await owner.getRuntimeService("state").patch(n, { blocked: !0 }, { record: { ...owner.findCarNumAndHref(t), carNum: n, url: a, names: o, publishTime: i, fc2Source } }), owner.runtimeServices.notifications?.ok("已屏蔽");
                } catch (s) { owner.logger.error("屏蔽操作失败:", s), owner.runtimeServices.notifications?.error("屏蔽失败，请重试"); }
            }), undefined, { confirmText: "屏蔽", tone: "danger" });
        } catch (t) { owner.logger.error("右键菜单处理失败:", t); }
    }));
}

/** 从任意列表卡片进入统一详情导航。 */
    /** @param {any} item
 * @param {ListPageService} owner
 */
export async function openMovieDetail(owner, item, /** @type {{event?: MouseEvent | null, autoplay?: boolean, newTab?: boolean}} */ { event = null, autoplay = !1, newTab = !1 } = {}) {
    if (owner.controllers.navigation) return owner.controllers.navigation.openMovieDetail(item, { event, autoplay, newTab });
    const card = item?.jquery ? item : $(item), {carNum, aHref} = owner.findCarNumAndHref(card);
    if (!aHref) return;
    const shouldOpenTab = newTab || !!event && (event.ctrlKey || event.metaKey || 1 === event.button);
    if (carNum.includes("FC2-")) return;
    const destination = new URL(aHref, window.location.origin);
    autoplay && destination.searchParams.set("autoPlay", "1"), owner.getRuntimeService("ui").openPage(destination.href, carNum, !0, { event, newTab: shouldOpenTab }), owner.$currentImage = null;
}

/** 为宿主与合成列表统一绑定左键、修饰键和中键导航。 */
    /** @param {any} container
 * @param {ListPageService} owner
 */
export function bindMovieDetailNavigation(owner, container) {
    if (owner.listView) return owner.listView.bindMovieDetailNavigation(container);
    const root = $(container), selector = ".item img, .item .video-title";
    root.off("click.jhsMovieDetail auxclick.jhsMovieDetail", selector).on("click.jhsMovieDetail auxclick.jhsMovieDetail", selector, ((/** @type {any} */ event) => {
        if ("auxclick" === event.type && 1 !== event.button || "click" === event.type && event.button && 0 !== event.button) return;
        if (event.shiftKey || event.altKey || $(event.target).closest("div.meta-buttons,[class^='jhs-match-']").length) return;
        event.preventDefault(), event.stopPropagation();
        void owner.openMovieDetail($(event.currentTarget).closest(".item"), { event }).catch((error => owner.logger.error("打开影片详情失败", error)));
    }));
}

/** @param {string} e @param {import("../../core/lifecycle-scope.js").LifecycleScope} [scope]
 * @param {ListPageService} owner
 */
export async function parseActressName(owner, e, scope) {
    let t = null;
    const { enableSaveActressCarInfo } = await owner.getRuntimeService("settings").readStoredSnapshot();
    if (enableSaveActressCarInfo === _) {
        owner.logger.debug("鉴定补录演员信息-已启用, 开始解析详情页"), owner.logger.debug("开始解析演员详情页", e);
        scope ??= await owner.getRuntimeService("scope")();
        scope?.assertActive();
        const n = await requestHostPage(owner.getRuntimeService("http"), e, scope);
        if (r) {
            const detail = new DOMParser().parseFromString(n, "text/html");
            t = owner.getRuntimeService("host").readMovieActors(detail, new URL(e, window.location.href).href).actors
                .filter((/** @type {{role: string}} */ actor) => actor.role === "actress")
                .map((/** @type {{name: string}} */ actor) => actor.name).join(" ");
        } else if (l) {
            t = $(new DOMParser().parseFromString(n, "text/html")).find('span[onmouseover*="star_"] a').map(((/** @type {number} */ e, /** @type {Element} */ t) => $(t).text())).get().join(" ");
        }
        owner.logger.debug("解析到名称:", t);
    }
    return t;
}

/** @param {JQueryHandle} e
 * @param {ListPageService} owner
 */
export function findCarNumAndHref(owner, e) {
    try { return readListItem(e); } catch (error) { owner.runtimeServices.notifications?.error("提取番号信息失败"); throw error; }
}

/** @param {string} e
 * @param {ListPageService} owner
 */
export function showCarNumBox(owner, e) {
    const t = owner.getRuntimeService("host").locateListItems().find((/** @type {Element} */ t) => $(t).find(".video-title strong").text() === e);
    if (t) {
        const n = $(t);
        n.attr("data-hide") === "yes" && (n.show(), n.removeAttr("data-hide"));
    }
}

/** @param {HTMLImageElement} e
 * @param {ListPageService} owner
 */
export function _replaceSingleHdImg(owner, e) {
    return upgradeListCoverImage(e, r ? "javdb" : l ? "javbus" : undefined);
}

/** 先完成当前缩略图请求，再升级为高清图，避免取消首屏可见内容。 @param {HTMLImageElement} image
 * @param {ListPageService} owner
 */
export function _scheduleHdUpgrade(owner, image) {
    if ("true" === image.dataset.hdReplaced || "true" === image.dataset.jhsHdPending) return;
    if (image.complete) return void owner._replaceSingleHdImg(image);
    image.dataset.jhsHdPending = "true";
    const finish = () => {
        image.removeEventListener("load", finish), image.removeEventListener("error", finish), delete image.dataset.jhsHdPending, owner.hdPendingCleanups.delete(image), owner._replaceSingleHdImg(image);
    }, cleanup = () => {
        image.removeEventListener("load", finish), image.removeEventListener("error", finish), delete image.dataset.jhsHdPending;
    };
    owner.hdPendingCleanups.set(image, cleanup), image.addEventListener("load", finish, { once: !0 }), image.addEventListener("error", finish, { once: !0 });
}

/** @param {any} [e]
 * @param {ListPageService} owner
 */
export function replaceHdImg(owner, e) {
    if (owner.controllers.coverImages) return owner.controllers.coverImages.replace(e);
    if (e && "string" == typeof e.jquery && (e = e.toArray()), e || (e = document.querySelectorAll(owner.getSelector().coverImgSelector)),
    !e.length) return;
    const t = Array.from(/** @type {Iterable<HTMLImageElement>} */ (e)).filter((/** @type {HTMLImageElement} */ e) => "true" !== e.dataset.hdReplaced && "true" !== e.dataset.jhsHdObserved);
    if ("IntersectionObserver" in window && !owner.hdImageObserver) owner.hdImageObserver = new IntersectionObserver((entries => {
        entries.forEach((entry => {
            const image = /** @type {HTMLImageElement} */ (entry.target);
            entry.isIntersecting && (owner.hdImageObserver?.unobserve(image), delete image.dataset.jhsHdObserved,
            owner._scheduleHdUpgrade(image));
        }));
    }), { rootMargin: "200px" });
    for (const image of t) image.decoding = "async", owner.hdImageObserver ? (image.dataset.jhsHdObserved = "true",
    owner.hdImageObserver.observe(image)) : owner._scheduleHdUpgrade(image);
}

/** hoverBigImg 唯一生命周期入口：ON→绑定，OFF→销毁。 */
    /** @param {string} enabled
 * @param {ListPageService} owner
 */
export function configureHoverPreview(owner, enabled) {
    if (owner.controllers.hoverPreview) return owner.controllers.hoverPreview.configure(enabled);
    if (enabled === "yes" && !owner.fallbackHoverPreview) {
        owner.fallbackHoverPreview = owner.runtimeServices.ui?.createImageHoverPreview({ selector: owner.getSelector().coverImgSelector });
    } else if (enabled !== "yes" && owner.fallbackHoverPreview) {
        owner.fallbackHoverPreview.destroy();
        owner.fallbackHoverPreview = null;
    }
}

/** @param {JQueryHandle} e @param {string} t @param {string} n
 * @param {ListPageService} owner
 */
export function applyTranslatedTitle(owner, e, t, n) {
    const a = e.find(".video-title");
    r ? (a.contents().each(((/** @type {number} */ index, /** @type {Node} */ node) => {
        3 !== node.nodeType || "" === (node.textContent || "").trim() || (node.textContent || "").includes(n) || (node.textContent = " " + t + " ");
    })), a.attr("title", t)) : a.text(t), e.attr("data-jhs-translation-key", n);
}

/** 使在途列表翻译作废（Translate OFF 时调用）。 */
/** @param {ListPageService} owner */
export function invalidateTranslations(owner) {
    if (owner.readTranslation()?.invalidateListTranslations) return owner.readTranslation().invalidateListTranslations();
    owner.translationGeneration++;
}

/** @param {Element|JQueryHandle} input
 * @param {ListPageService} owner
 */
export async function translate(owner, input) {
    const e = input?.jquery ? input : $(input);
    if (!e.length) return;
    let t, n, a = e.find(".video-title");
    if (r ? (t = a.contents().filter(((/** @type {number} */ e, /** @type {Node} */ t) => 3 === t.nodeType && "" !== (t.textContent || "").trim())).text().trim(),
    n = e.find(".video-title strong").text().trim()) : (t = (e.find("img").attr("data-title") || "").trim(),
    n = (e.find("a").attr("href") || "").split("/").filter(Boolean).pop()?.trim()), !t || !n) return;
    const generation = owner.translationGeneration, settings = owner.getRuntimeService("settings");
    const scope = await owner.getRuntimeService("scope")();
    const translated = await owner.getRuntimeService("translation").translate(t, { cacheAlias: n, scope });
    if (generation !== owner.translationGeneration || (settings?.snapshot?.().translateTitle ?? _) !== _) return;
    owner.applyTranslatedTitle(e, translated, n);
}

/** @param {ListPageService} owner */
export async function revertTranslation(owner) {
    if (owner.readTranslation()?.revertListTranslations) return owner.readTranslation().revertListTranslations();
    $(owner.getSelector().itemSelector).toArray().forEach((/** @type {Element} */ e) => {
        let t = $(e);
        const n = t.find(".box").attr("title") || t.find(".video-title").attr("title") || t.find("img").attr("data-title");
        /** @type {string | undefined} */
        let a;
        r && (a = t.find(".video-title strong").text().trim());
        const i = t.find(".video-title");
        i.contents().each(((/** @type {number} */ index, /** @type {Node} */ node) => {
            3 !== node.nodeType || !n || "" === (node.textContent || "").trim() || a && (node.textContent || "").includes(a) || (node.textContent = " " + n + " ");
        })), i.removeAttr("title");
    });
}
