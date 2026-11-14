// @ts-check

import { _ } from "../../core/constants.js";
import { mapLimit } from "../../core/feature-helpers.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { translationErrorLabel } from "../../core/translation-model.js";

const TRANSLATION_STYLES = `
    .translated-title { margin-top:var(--jhs-space-2); color:var(--jhs-text); font-size:var(--jhs-font-size-lg); font-weight:var(--jhs-font-weight-normal); line-height:var(--jhs-line-height-ui); }
    .translated-title.is-error { color:var(--jhs-danger-text); }
`;

/** Feature-owned detail and list title translation with a narrow legacy attachment point. */
export class ExternalBridgeTranslationController {
    /** @param {{document: Document, window: Window, route: string, hostAdapter: any, listPage: any, settings: any, translation: any, styles: any, diagnostics: any, scope: any, privacy?:any}} options */
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
        this.privacy = options.privacy;
        this.consumerScope = new LifecycleScope("translation:auto");
        this.releaseConsumerScope = this.scope.addCleanup(() => this.consumerScope.dispose());
        /** @type {Map<Element,string>} */ this.visibilityTargets = new Map();
        this.visibilityObserver = /** @type {IntersectionObserver|null} */ (null);
        this.generation = 0;
        this.listGeneration = 0;
        this.started = false;
        this.disposed = false;
        /** @type {Map<Element,{node:Element,texts:Array<{node:ChildNode,text:string|null}>,title:string|null}>} */
        this.recommendationTitles = new Map();
        /** @type {Map<Element,number>} */
        this.recommendationPending = new Map();
    }

    /** Start the single detail/list translation owner. */
    start() {
        this.scope.assertActive();
        if (this.started || !["detail", "list"].includes(this.route)) return false;
        this.started = true;
        const IntersectionObserverType = /** @type {any} */ (this.window).IntersectionObserver;
        if (IntersectionObserverType) {
            this.visibilityObserver = new IntersectionObserverType((/** @type {IntersectionObserverEntry[]} */ entries) => {
                for (const entry of entries) if (entry.isIntersecting && this.isEnabled()) {
                    const kind = this.visibilityTargets.get(entry.target);
                    const result = kind === "detail" ? this.translateDetail(this.generation) : kind === "recommendation" ? this.translateRecommendations() : this.translateListItems([entry.target]);
                    void result.catch(error => { if (this.isEnabled()) this.report(error); });
                }
            });
            this.scope.ownObserver(this.visibilityObserver);
        }
        this.scope.listen(this.document,"visibilitychange",() => { void this.reconfigure().catch(error => this.report(error)); });
        if (this.privacy) this.scope.listen(this.privacy,"privacy.changed",() => { void this.reconfigure().catch(error => this.report(error)); });
        if (typeof this.translation.addEventListener === "function") this.scope.listen(this.translation,"translation.changed",() => { void this.reconfigure().catch(error => this.report(error)); });
        const releaseStyle = this.styles?.register?.("external-bridge-translation", TRANSLATION_STYLES);
        if (releaseStyle) this.scope.addCleanup(releaseStyle);
        if (this.route === "list") this.listPage?.attachFeatureListTranslationAdapter?.(this);
        if (this.route === "detail" && this.hostAdapter?.site === "javdb") {
            this.scope.observe(this.document.body, (/** @type {MutationRecord[]} */ records) => {
                if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 &&
                    this.hostAdapter.isDetailRecommendationMutation?.(node)))) {
                    void this.translateRecommendations().catch(error => this.report(error));
                }
            }, {childList:true,subtree:true});
        }
        this.scope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (names?.some(name => ["translateTitle","privacyTargets"].includes(name))) void this.reconfigure().catch((error) => this.report(error));
        });
        this.scope.addCleanup(() => this.dispose());
        void this.reconfigure().catch((error) => this.report(error));
        return true;
    }

    isEnabled() {
        return (this.settings.snapshot().translateTitle ?? _) === _ && this.document.visibilityState !== "hidden" && !(this.privacy?.masked && this.privacy.targets().includes("title"));
    }
    /** @param {Element} element @param {string} kind */
    observeVisible(element,kind) {
        for (const node of this.visibilityTargets.keys()) if (!node.isConnected) { this.visibilityTargets.delete(node); this.visibilityObserver?.unobserve(node); }
        if (!this.visibilityTargets.has(element)) { this.visibilityTargets.set(element,kind); this.visibilityObserver?.observe(element); }
        const bounds = element.getBoundingClientRect(), style = this.window.getComputedStyle(element);
        return element.isConnected && bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.right > 0 && bounds.top < this.window.innerHeight && bounds.left < this.window.innerWidth && style.display !== "none" && style.visibility !== "hidden";
    }
    resetConsumers() {
        this.releaseConsumerScope();
        const scope = new LifecycleScope("translation:auto");
        this.consumerScope = scope;
        this.releaseConsumerScope = this.scope.addCleanup(() => scope.dispose());
    }
    /** @param {string} text @param {any} options */
    async translateTitle(text,options) {
        const request = {...options,scope:this.consumerScope,automatic:true};
        return typeof this.translation.translateDetailed === "function" ? this.translation.translateDetailed(text,request) : {text:await this.translation.translate(text,request),source:{name:"Google"},usage:{},cacheHit:false};
    }
    /** @param {Element} target @param {any} result */
    metadata(target,result) {
        let node = target.nextElementSibling;
        if (!node?.hasAttribute("data-jhs-auto-translation-meta")) { node = this.document.createElement("small"); node.className = "jhs-translation-meta"; node.setAttribute("data-jhs-auto-translation-meta",""); target.after(node); }
        if (result.text) node.remove();
        return node;
    }

    async reconfigure() {
        if (this.disposed || this.scope.disposed) return;
        this.generation += 1;
        this.listGeneration += 1;
        this.resetConsumers();
        this.revertTranslation();
        if (!this.isEnabled()) {
            return;
        }
        if (this.route === "detail") await Promise.all([this.translateDetail(this.generation), this.translateRecommendations()]);
        else await this.translateList();
    }

    async translateRecommendations() {
        if (!this.isEnabled() || this.disposed || this.scope.disposed) return;
        const generation = this.generation;
        /** @type {Element[]} */
        const items = (this.hostAdapter?.getDetailRecommendationBoundaries?.() ?? []).flatMap((/** @type {any} */ boundary) =>
            [...boundary.root.querySelectorAll('a.tile-item,.item')]);
        await mapLimit(items, 3, async item => {
            if (!this.isCurrent(generation) || this.recommendationTitles.has(item) || this.recommendationPending.has(item) || !this.observeVisible(item,"recommendation")) return;
            const node = item.querySelector('.video-title');
            const carNum = item.querySelector('.video-number,.video-title strong')?.textContent?.trim();
            if (!node || !carNum) return;
            // Keep number/other children in place; replace only the title text.
            const textNodes = [...node.childNodes].filter(child => child.nodeType === 3 && child.textContent?.trim());
            const source = textNodes.map(child => child.textContent ?? '').join('').trim();
            if (!source) return;
            this.recommendationPending.set(item, generation);
            try {
                const result = await this.translateTitle(source, {cacheAlias:carNum,canDispatch:() => this.isCurrent(generation) && this.observeVisible(item,"recommendation")}), translated = result.text;
                if (!this.isCurrent(generation) || !item.isConnected || !node.isConnected || !translated || textNodes.map(child => child.textContent ?? '').join('').trim() !== source) return;
                this.recommendationTitles.set(item, {node,texts:textNodes.map(child=>({node:child,text:child.textContent})),title:node.getAttribute('title')});
                textNodes.forEach((child,index) => { child.textContent = index === 0 ? ` ${translated} ` : ''; });
                node.setAttribute('title', String(translated));
                this.metadata(node,result);
            } catch(error) { if (this.isCurrent(generation)) { this.metadata(node,{}).textContent = translationErrorLabel(error); this.report(error); } }
            finally { if (this.recommendationPending.get(item) === generation) this.recommendationPending.delete(item); }
        });
    }

    async translateList() {
        if (!this.window.isListPage) return;
        const selectors = (this.hostAdapter?.getCardEnhancementSelectors?.() ?? this.hostAdapter?.getLiveListSelectors?.() ?? this.hostAdapter?.getListSelectors?.());
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
                if (!this.isCurrentListTranslation(generation) || !this.observeVisible(item,"list")) return;
                await this.translateListItem(item, generation);
            } catch (error) {
                failed++;
                firstError ??= error;
                const title = item.querySelector(".video-title");
                if (title && this.isCurrentListTranslation(generation)) this.metadata(title,{}).textContent = translationErrorLabel(error);
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
        const result = await this.translateTitle(sourceText, {cacheAlias:carNum,canDispatch:() => this.isCurrentListTranslation(generation) && this.observeVisible(item,"list")}), translated = result.text;
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
        this.metadata(titleNode,result);
    }

    yieldListFrame() {
        return new Promise((resolve) => {
            this.window.requestAnimationFrame ? this.window.requestAnimationFrame(() => setTimeout(resolve)) : setTimeout(resolve);
        });
    }

    invalidateListTranslations() {
        this.listGeneration += 1;
        this.resetConsumers();
    }

    /** @param {number} generation */
    isCurrentListTranslation(generation) {
        return generation === this.listGeneration && this.isEnabled() && !this.disposed && !this.scope.disposed;
    }

    revertListTranslations() {
        const selector = (this.hostAdapter?.getCardEnhancementSelectors?.() ?? this.hostAdapter?.getLiveListSelectors?.() ?? this.hostAdapter?.getListSelectors?.())?.itemSelector;
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
        const sourceTitle = this.document.querySelector(".origin-title")
            ?? this.document.querySelector(".current-title")
            ?? this.document.querySelector("h1")
            ?? this.document.querySelector(".title.is-4")
            ?? this.document.querySelector("h3");
        if (!sourceTitle) return;
        const heading = sourceTitle.closest("h1,h2,h3");
        const alternatives = [heading?.querySelector(".current-title"),heading,sourceTitle.parentElement?.querySelector(".current-title")];
        const title = this.observeVisible(sourceTitle,"detail") ? sourceTitle : alternatives.find(node => node && this.observeVisible(node,"detail"));
        if (!title) return;
        const sourceText = sourceTitle.textContent?.trim() ?? "";
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
            const result = await this.translateTitle(sourceText, {cacheAlias:carNum,canDispatch:() => this.isCurrent(generation) && this.observeVisible(title,"detail")}), translated = result.text;
            if (!this.isCurrent(generation) || !title.isConnected || !translatedNode.isConnected) return;
            translatedNode.textContent = String(translated ?? "");
            this.metadata(translatedNode,result);
        } catch (error) {
            if (!this.isCurrent(generation) || !title.isConnected || !translatedNode.isConnected) return;
            translatedNode.classList.add("is-error");
            translatedNode.textContent = translationErrorLabel(error);
            this.report(error);
        }
    }

    /** @param {number} generation */
    isCurrent(generation) {
        return !this.disposed && !this.scope.disposed && generation === this.generation && this.isEnabled();
    }

    revertTranslation() {
        this.document.querySelectorAll(".translated-title").forEach((node) => node.remove());
        this.document.querySelectorAll("[data-jhs-auto-translation-meta]").forEach(node => node.remove());
        for (const {node,texts,title} of this.recommendationTitles.values()) {
            texts.forEach(child => { child.node.textContent = child.text; });
            if (title === null) node.removeAttribute('title'); else node.setAttribute('title',title);
        }
        this.recommendationTitles.clear(); this.recommendationPending.clear();
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
        this.releaseConsumerScope();
        this.visibilityTargets.clear();
        this.generation += 1;
        this.listGeneration += 1;
        this.revertTranslation();
        this.listPage?.detachFeatureListTranslationAdapter?.(this);
    }
}
