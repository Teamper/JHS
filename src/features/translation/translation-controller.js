// @ts-check

import { _ } from "../../core/constants.js";
import { mapLimit } from "../../core/feature-helpers.js";

const TRANSLATION_STYLES = `
    .translated-title { margin-top:var(--jhs-space-2); color:var(--jhs-text); font-size:clamp(16px,1.5vw,18px); font-weight:500; line-height:1.5; }
    .translated-title.is-error { color:var(--jhs-danger); }
`;

/** Feature-owned detail and list title translation with a narrow legacy attachment point. */
export class ExternalBridgeTranslationController {
    /** @param {{document: Document, window: Window, route: string, hostAdapter: any, listPage: any, settings: any, translation: any, styles: any, diagnostics: any, scope: any}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.route = options.route;
        this.hostAdapter = options.hostAdapter;
        this.listPage = options.listPage ?? null;
        this.settings = options.settings;
        this.translation = options.translation;
        this.styles = options.styles;
        this.diagnostics = options.diagnostics;
        this.scope = options.scope;
        this.generation = 0;
        this.listGeneration = 0;
        this.started = false;
        this.disposed = false;
    }

    /** Start the single detail/list translation owner. */
    start() {
        this.scope.assertActive();
        if (this.started || !["detail", "list"].includes(this.route)) return false;
        this.started = true;
        const releaseStyle = this.styles?.register?.("external-bridge-translation", TRANSLATION_STYLES);
        if (releaseStyle) this.scope.addCleanup(releaseStyle);
        if (this.route === "list") this.listPage?.attachFeatureListTranslationAdapter?.(this);
        this.scope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (names?.includes("translateTitle")) void this.reconfigure().catch((error) => this.report(error));
        });
        this.scope.addCleanup(() => this.dispose());
        void this.reconfigure().catch((error) => this.report(error));
        return true;
    }

    isEnabled() {
        return (this.settings.snapshot().translateTitle ?? _) === _;
    }

    async reconfigure() {
        if (this.disposed || this.scope.disposed) return;
        this.generation += 1;
        this.listGeneration += 1;
        if (!this.isEnabled()) {
            this.revertTranslation();
            return;
        }
        if (this.route === "detail") await this.translateDetail(this.generation);
        else await this.translateList();
    }

    async translateList() {
        if (!this.window.isListPage) return;
        const selectors = this.hostAdapter?.getListSelectors?.();
        if (!selectors?.itemSelector) return;
        const items = [...this.document.querySelectorAll(selectors.itemSelector)];
        await this.translateListItems(items);
    }

    /** Translate a visible or newly inserted subset while preserving the 6.5.1 worker and yield limits. @param {Element[]} items */
    async translateListItems(items) {
        if (!this.isEnabled() || this.disposed || this.scope.disposed) return;
        const generation = this.listGeneration;
        let failed = 0;
        /** @type {unknown} */
        let firstError = null;
        await mapLimit(items, 3, async (item, index) => {
            try {
                if (index > 0 && index % 8 === 0) await this.yieldListFrame();
                if (!this.isCurrentListTranslation(generation)) return;
                await this.translateListItem(item, generation);
            } catch (error) {
                failed++;
                firstError ??= error;
            }
        });
        if (failed) this.report(new Error(`列表标题翻译失败 ${failed} 项：${firstError instanceof Error ? firstError.message : String(firstError)}`));
    }

    /** @param {Element} item @param {number} generation */
    async translateListItem(item, generation) {
        if (!this.isCurrentListTranslation(generation)) return;
        const titleNode = item.querySelector(".video-title");
        if (!titleNode) return;
        const isJavDb = this.hostAdapter?.site === "javdb";
        const sourceText = item.getAttribute("data-jhs-original-title") || (isJavDb
            ? [...titleNode.childNodes].filter((node) => node.nodeType === 3 && (node.textContent ?? "").trim()).map((node) => node.textContent ?? "").join("").trim()
            : item.querySelector("img")?.getAttribute("data-title")?.trim() ?? "");
        const carNum = isJavDb
            ? titleNode.querySelector("strong")?.textContent?.trim() ?? ""
            : item.querySelector("a[href]")?.getAttribute("href")?.split("/").filter(Boolean).pop()?.trim() ?? "";
        if (!sourceText || !carNum) return;
        const translated = await this.translation.translate(sourceText, { cacheAlias: carNum, scope: this.scope });
        if (!this.isCurrentListTranslation(generation) || !item.isConnected || !titleNode.isConnected) return;
        if (!item.hasAttribute("data-jhs-original-title")) item.setAttribute("data-jhs-original-title", sourceText);
        if (isJavDb) {
            for (const node of titleNode.childNodes) {
                if (node.nodeType !== 3 || !(node.textContent ?? "").trim() || (node.textContent ?? "").includes(carNum)) continue;
                node.textContent = ` ${String(translated ?? "")} `;
            }
            titleNode.setAttribute("title", String(translated ?? ""));
        } else titleNode.textContent = String(translated ?? "");
        item.setAttribute("data-jhs-translation-key", carNum);
    }

    yieldListFrame() {
        return new Promise((resolve) => {
            this.window.requestAnimationFrame ? this.window.requestAnimationFrame(() => setTimeout(resolve)) : setTimeout(resolve);
        });
    }

    invalidateListTranslations() {
        this.listGeneration += 1;
    }

    /** @param {number} generation */
    isCurrentListTranslation(generation) {
        return generation === this.listGeneration && this.isEnabled() && !this.disposed && !this.scope.disposed;
    }

    revertListTranslations() {
        const selector = this.hostAdapter?.getListSelectors?.()?.itemSelector;
        if (!selector) return;
        for (const item of this.document.querySelectorAll(selector)) {
            if (!item.hasAttribute("data-jhs-original-title") && !item.hasAttribute("data-jhs-translation-key")) continue;
            const titleNode = item.querySelector(".video-title");
            if (!titleNode) continue;
            const source = item.getAttribute("data-jhs-original-title")
                || item.querySelector(".box")?.getAttribute("title")
                || titleNode.getAttribute("title")
                || item.querySelector("img")?.getAttribute("data-title");
            const carNum = this.hostAdapter?.site === "javdb" ? titleNode.querySelector("strong")?.textContent?.trim() : null;
            if (source) {
                for (const node of titleNode.childNodes) {
                    if (node.nodeType !== 3 || !(node.textContent ?? "").trim() || (carNum && (node.textContent ?? "").includes(carNum))) continue;
                    node.textContent = ` ${source} `;
                }
            }
            titleNode.removeAttribute("title");
            item.removeAttribute("data-jhs-original-title");
            item.removeAttribute("data-jhs-translation-key");
        }
    }

    /** @param {number} generation */
    async translateDetail(generation) {
        const title = this.document.querySelector(".origin-title")
            ?? this.document.querySelector(".current-title")
            ?? this.document.querySelector("h1")
            ?? this.document.querySelector("h3");
        if (!title) return;
        const sourceText = title.textContent?.trim() ?? "";
        if (!sourceText) {
            this.report(new TypeError("获取标题失败, 无法进行翻译"));
            return;
        }
        let translatedNode = title.nextElementSibling;
        while (translatedNode && !translatedNode.matches(".translated-title")) translatedNode = translatedNode.nextElementSibling;
        if (!translatedNode) {
            translatedNode = this.document.createElement("div");
            translatedNode.className = "translated-title";
            title.insertAdjacentElement("afterend", translatedNode);
        }
        translatedNode.classList.remove("is-error");
        translatedNode.textContent = "翻译中…";
        const carNum = this.hostAdapter?.readMovieRef?.()?.carNum ?? undefined;
        try {
            const translated = await this.translation.translate(sourceText, { cacheAlias: carNum, scope: this.scope });
            if (!this.isCurrent(generation) || !title.isConnected || !translatedNode.isConnected) return;
            translatedNode.textContent = String(translated ?? "");
        } catch (error) {
            if (!this.isCurrent(generation) || !title.isConnected || !translatedNode.isConnected) return;
            translatedNode.classList.add("is-error");
            translatedNode.textContent = `翻译失败: ${error instanceof Error ? error.message : String(error)}`;
            this.report(error);
        }
    }

    /** @param {number} generation */
    isCurrent(generation) {
        return !this.disposed && !this.scope.disposed && generation === this.generation && this.isEnabled();
    }

    revertTranslation() {
        this.document.querySelectorAll(".translated-title").forEach((node) => node.remove());
        this.revertListTranslations();
    }

    /** @param {unknown} error */
    report(error) {
        this.diagnostics?.recordError?.({
            source: "external-bridge-translation", featureId: "external-bridge", contributionId: "external-bridge.translation",
            message: error instanceof Error ? error.message : String(error),
        });
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.generation += 1;
        this.listGeneration += 1;
        this.revertTranslation();
        this.listPage?.detachFeatureListTranslationAdapter?.(this);
    }
}
