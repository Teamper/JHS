// @ts-check

import { _ } from "../../core/constants.js";
import { renderTranslatedTitle } from "../../ui/translation/title-translation.js";

/** Own detail/list title translation lifecycle behind the TranslationService. */
export class ExternalBridgeTranslationController {
    /** @param {{document?: Document, window?: any, route?: string, settings: any, translation: any, features: any, styles?: any, ui?: any, scope: any}} options */
    constructor(options) {
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window;
        this.route = options.route ?? "unknown";
        this.settings = options.settings;
        this.translation = options.translation;
        this.features = options.features;
        this.styles = options.styles;
        this.ui = options.ui;
        this.scope = options.scope;
        this.listFeatureApi = null;
        this.translationGeneration = 0;
        this.started = false;
    }

    getJQuery() { return this.ui?.getJQuery?.() ?? this.window?.jQuery; }
    getClog() { return this.ui?.getClog?.() ?? {}; }

    /** Start translation and own settings-driven reconfiguration. */
    async start() {
        this.scope.assertActive();
        if (this.started) return;
        this.started = true;
        const removeStyle = this.styles?.register?.("external-bridge-translation", this.initCss());
        if (typeof removeStyle === "function") this.scope.addCleanup?.(removeStyle);
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (!names?.includes("translateTitle")) return;
            void this.reconfigure().catch((error) => this.getClog().error?.("标题翻译切换失败", error));
        };
        if (this.scope.listen) this.scope.listen(this.settings, "settings.changed", onSettingsChanged);
        else {
            this.settings.addEventListener("settings.changed", onSettingsChanged);
            this.scope.addCleanup?.(() => this.settings.removeEventListener("settings.changed", onSettingsChanged));
        }
        this.scope.addCleanup?.(() => this.dispose());
        try { await this.reconfigure(); }
        catch (error) { this.dispose(); throw error; }
    }

    initCss() {
        return `
            .translated-title { margin-top:var(--jhs-space-2); color:var(--jhs-text); font-size:clamp(16px,1.5vw,18px); font-weight:500; line-height:1.5; }
            .translated-title.is-error { color:var(--jhs-danger); }
        `;
    }

    isEnabled() { return (this.settings.snapshot().translateTitle ?? _) === _; }

    async reconfigure() {
        this.scope.assertActive();
        if (this.isEnabled()) await this.applyTranslation();
        else await this.revertTranslation();
    }

    async applyTranslation() {
        if (this.route === "detail") return this.translate();
        if (this.route !== "list") return;
        const listFeature = await this.getListFeatureApi(), selectors = listFeature?.getListSelectors?.();
        if (!listFeature?.translateListItems || !selectors?.itemSelector) return;
        const items = this.document ? [ ...this.document.querySelectorAll(selectors.itemSelector) ] : [];
        await listFeature.translateListItems(items);
    }

    async revertTranslation() {
        this.translationGeneration += 1;
        this.getJQuery()?.(this.document).find?.(".translated-title").remove();
        const listFeature = await this.getListFeatureApi();
        listFeature?.invalidateTranslations?.();
        await listFeature?.revertTranslation?.();
    }

    async getListFeatureApi() {
        if (this.listFeatureApi) return this.listFeatureApi;
        try { this.listFeatureApi = await this.features?.getFeatureApi("list"); }
        catch (error) {
            this.getClog().warn?.("列表 Feature API 不可用，跳过标题翻译", error);
            this.listFeatureApi = null;
        }
        return this.listFeatureApi;
    }

    readCarNum() {
        return this.document?.querySelector(".panel-block.first-block .value, [data-car-number], .info p span")?.textContent?.trim() || null;
    }

    /** @param {string | null} [carNum] @param {{root?: ParentNode}} [options] */
    async translate(carNum = null, options = {}) {
        if (!this.isEnabled()) return;
        const generation = this.translationGeneration;
        const resolvedCarNum = carNum ?? this.readCarNum() ?? undefined;
        await renderTranslatedTitle({
            root: options.root,
            carNum: resolvedCarNum,
            translation: this.translation,
            scope: this.scope,
            isActive: () => this.isEnabled() && generation === this.translationGeneration && !this.scope.disposed,
        });
    }

    dispose() {
        this.translationGeneration += 1;
        this.getJQuery()?.(this.document).find?.(".translated-title").remove();
        this.started = false;
    }
}
