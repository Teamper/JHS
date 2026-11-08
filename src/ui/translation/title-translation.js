// @ts-check
import { translationErrorLabel } from "../../core/translation-model.js";

/**
 * @param {{root?: any, carNum?: string, translation: import("../../services/translation-service.js").TranslationService, scope?: import("../../core/lifecycle-scope.js").LifecycleScope, isActive?: () => boolean}} options
 */
export async function renderTranslatedTitle(options) {
    // Double gate: never create DOM or start a network request when the feature
    // is already disabled at call time.
    if (options.isActive && options.isActive() === false) return;
    const jq = /** @type {any} */ (globalThis).$;
    const root = options.root ? jq(options.root) : jq(document);
    let title = root.find(".origin-title").first();
    if (!title.length) title = root.find(".jhs-fc2-original-title").first();
    if (!title.length) title = root.find(".current-title").first();
    if (!title.length) title = root.find("h3").first();
    if (!title.length) return;
    const sourceText = title.text().trim();
    if (!sourceText) throw new TypeError("获取标题失败, 无法进行翻译");
    let translatedNode = title.nextAll(".translated-title").first();
    if (!translatedNode.length) translatedNode = jq('<div class="translated-title"></div>').insertAfter(title);
    translatedNode.removeClass("is-error").text("翻译中…");
    try {
        const request = {cacheAlias:options.carNum,scope:options.scope,automatic:true,canDispatch:options.isActive};
        const result = typeof options.translation.translateDetailed === "function" ? await options.translation.translateDetailed(sourceText,request) : {text:await options.translation.translate(sourceText,request),source:{name:"Google"},usage:{},cacheHit:false};
        if (options.isActive && !options.isActive()) return;
        if (!title[0]?.isConnected || !translatedNode[0]?.isConnected) return;
        translatedNode.text(result.text);
        translatedNode.next("[data-jhs-fc2-translation-meta]").remove();
    } catch (error) {
        if (options.isActive && !options.isActive()) return;
        if (!title[0]?.isConnected || !translatedNode[0]?.isConnected) return;
        /** @type {any} */ (globalThis).clog?.error("翻译失败:", error);
        translatedNode.addClass("is-error").text(translationErrorLabel(error));
    }
}
