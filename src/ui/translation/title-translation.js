// @ts-check

/**
 * @param {{root?: any, carNum?: string, translation: import("../../services/translation-service.js").TranslationService, scope?: import("../../core/lifecycle-scope.js").LifecycleScope}} options
 */
export async function renderTranslatedTitle(options) {
    const jq = /** @type {any} */ (globalThis).$;
    const root = options.root ? jq(options.root) : jq(document);
    let title = root.find(".origin-title").first();
    if (!title.length) title = root.find(".current-title").first();
    if (!title.length) title = root.find("h3").first();
    if (!title.length) return;
    const sourceText = title.text().trim();
    if (!sourceText) throw new TypeError("获取标题失败, 无法进行翻译");
    let translatedNode = title.nextAll(".translated-title").first();
    if (!translatedNode.length) translatedNode = jq('<div class="translated-title"></div>').insertAfter(title);
    translatedNode.removeClass("is-error").text("翻译中...");
    try {
        const translated = await options.translation.translate(sourceText, { scope: options.scope });
        if (!title[0]?.isConnected || !translatedNode[0]?.isConnected) return;
        translatedNode.text(translated);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        /** @type {any} */ (globalThis).clog?.error("翻译失败:", error);
        translatedNode.addClass("is-error").text(`翻译失败: ${message}`);
    }
}
