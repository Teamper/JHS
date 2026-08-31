// @ts-check

import { _ } from "../../core/constants.js";
import { mapLimit } from "../../core/feature-helpers.js";

/** Own list-title translation concurrency, generation invalidation, and DOM restoration. */
export class ListTranslationService {
    /** @param {{scope: any, document?: Document, window?: any, selectors: Record<string, string>, site?: string, settings: any, translation: any}} options */
    constructor(options) {
        this.scope = options.scope;
        this.document = options.document ?? globalThis.document ?? null;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window ?? null;
        this.selectors = Object.freeze({ ...options.selectors });
        this.site = options.site ?? "";
        this.settings = options.settings;
        this.translation = options.translation;
        this.translationGeneration = 0;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    /** Translate a list of cards with bounded concurrency and owned invalidation state. */
    /** @param {any[]} items */
    async translateListItems(items) {
        this.scope.assertActive();
        if (this.isDisabled()) return;
        let failed = 0;
        /** @type {unknown} */
        let firstError = null;
        await mapLimit(items, 3, async (item, index) => {
            try {
                if (index > 0 && index % 8 === 0) await this.yieldListFrame();
                await this.translate(item);
            } catch (error) {
                failed++;
                firstError ??= error;
            }
        });
        if (failed) /** @type {any} */ (globalThis).clog?.error?.(`列表标题翻译失败 ${failed} 项`, firstError);
    }

    /** @param {Element | any} input */
    async translate(input) {
        if (this.disposed || this.scope.disposed) return;
        const card = this.normalizeCard(input);
        if (!card.length) return;
        let sourceText = "", carNum = "";
        if (this.site === "javdb") {
            const title = card.find(".video-title");
            sourceText = title.contents().filter((/** @type {number} */ _index, /** @type {Node} */ node) => node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim() !== "").text().trim();
            carNum = title.find("strong").text().trim();
        } else {
            sourceText = (card.find("img").attr("data-title") || "").trim();
            carNum = (card.find("a").attr("href") || "").split("/").filter(Boolean).pop()?.trim() || "";
        }
        if (!sourceText || !carNum) return;
        const generation = this.translationGeneration;
        const translated = await this.translation.translate(sourceText, { cacheAlias: carNum, scope: this.scope });
        if (this.disposed || this.scope.disposed || generation !== this.translationGeneration || this.isDisabled()) return;
        this.applyTranslatedTitle(card, translated, carNum);
    }

    /** @param {any} card @param {string} translated @param {string} carNum */
    applyTranslatedTitle(card, translated, carNum) {
        const title = card.find(".video-title");
        if (this.site === "javdb") {
            title.contents().each((/** @type {number} */ _index, /** @type {Node} */ node) => {
                if (node.nodeType !== Node.TEXT_NODE || !(node.textContent || "").trim() || (node.textContent || "").includes(carNum)) return;
                node.textContent = ` ${translated} `;
            });
            title.attr("title", translated);
        } else title.text(translated);
        card.attr("data-jhs-translation-key", carNum);
    }

    /** Invalidate in-flight translation results after Translate OFF or lifecycle changes. */
    invalidateTranslations() {
        this.translationGeneration++;
    }

    /** Restore original title text from the host-owned title attributes. */
    async revertTranslation() {
        if (this.disposed || this.scope.disposed || !this.document) return;
        const jq = this.getJQuery();
        jq(this.document).find(this.selectors.itemSelector).toArray().forEach((/** @type {Element} */ item) => {
            const card = jq(item), sourceText = card.find(".box").attr("title") || card.find(".video-title").attr("title") || card.find("img").attr("data-title");
            if (!sourceText) return;
            const carNum = this.site === "javdb" ? card.find(".video-title strong").text().trim() : "", title = card.find(".video-title");
            title.contents().each((/** @type {number} */ _index, /** @type {Node} */ node) => {
                if (node.nodeType !== Node.TEXT_NODE || !(node.textContent || "").trim() || (node.textContent || "").includes(carNum)) return;
                node.textContent = ` ${sourceText} `;
            });
            title.removeAttr("title");
        });
    }

    isDisabled() {
        return (this.settings?.snapshot?.().translateTitle ?? _) !== _;
    }

    /** @param {any} item */
    normalizeCard(item) {
        const jq = this.getJQuery();
        return item?.jquery ? item : jq(item);
    }

    getJQuery() {
        const jq = /** @type {any} */ (globalThis).$;
        if (typeof jq !== "function") throw new TypeError("列表翻译服务需要 jQuery");
        return jq;
    }

    async yieldListFrame() {
        await new Promise((resolve) => {
            if (typeof this.window?.requestAnimationFrame === "function") this.window.requestAnimationFrame(() => setTimeout(resolve));
            else setTimeout(resolve, 0);
        });
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.translationGeneration++;
    }
}
