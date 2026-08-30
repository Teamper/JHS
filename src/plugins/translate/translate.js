// @ts-check

import { _, l } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { renderTranslatedTitle } from "../../ui/translation/title-translation.js";

export class TranslatePlugin extends BasePlugin {
    getName() {
        return "TranslatePlugin";
    }
    /** Resolve the list capability used by list-title translation. */
    async getListFeatureApi() {
        try {
            return await this.getRuntimeService("features").getFeatureApi("list");
        } catch (error) {
            clog.warn("列表 Feature API 不可用，跳过标题翻译", error);
            return null;
        }
    }
    async initCss() {
        return "\n            <style>\n                .translated-title { margin-top:var(--jhs-space-2); color:var(--jhs-text); font-size:clamp(16px,1.5vw,18px); font-weight:500; line-height:1.5; }\n                .translated-title.is-error { color:var(--jhs-danger); }\n            </style>";
    }
    /** 标题翻译 live 生命周期：listener 只注册一次，OFF→revert，ON→re-apply。 */
    async handle() {
        const settings = this.getRuntimeService("settings"), scope = await this.getRuntimeService("scope")();
        if (!this._settingsListenerBound) {
            this._settingsListenerBound = true;
            const onSettingsChanged = (/** @type {any} */ event) => {
                const names = /** @type {string[] | undefined} */ (event.detail?.names);
                if (!names?.includes("translateTitle")) return;
                void this.reconfigure().catch((error) => clog.error("标题翻译切换失败", error));
            };
            settings.addEventListener("settings.changed", onSettingsChanged);
            scope.addCleanup((() => {
                settings.removeEventListener("settings.changed", onSettingsChanged);
                this._settingsListenerBound = false;
            }));
        }
        await this.reconfigure();
    }
    async reconfigure() {
        const enabled = (this.getRuntimeService("settings").snapshot().translateTitle ?? _) === _;
        if (enabled) await this.applyTranslation();
        else await this.revertTranslation();
    }
    /** ON：详情页插入/刷新翻译标题；列表页翻译当前所有卡片。 */
    async applyTranslation() {
        if (isDetailPage) return this.translate();
        if (!window.isListPage) return;
        const listFeature = await this.getListFeatureApi(), selectors = listFeature?.getListSelectors?.();
        if (!listFeature?.translateListItems || !selectors) return;
        const items = $(selectors.itemSelector).toArray();
        await listFeature.translateListItems(items);
    }
    /** OFF：详情页移除 JHS 翻译节点；列表页回退为原始标题。 */
    async revertTranslation() {
        $(".translated-title").remove();
        const listFeature = await this.getListFeatureApi();
        listFeature?.invalidateTranslations?.();
        await listFeature?.revertTranslation?.();
    }
    /** @param {string | null} [e] @param {boolean} [t] @param {{root?: ParentNode}} [options] */
    async translate(e, t = !0, options = {}) {
        const settings = this.getRuntimeService("settings");
        if ((settings.snapshot().translateTitle ?? _) !== _) return;
        l && (t = !1);
        const scope = await this.getRuntimeService("scope")();
        const carNum = e ?? this.getPageInfo().carNum;
        await renderTranslatedTitle({ root: options.root, carNum, translation: this.getRuntimeService("translation"), scope, isActive: () => (settings.snapshot().translateTitle ?? _) === _ });
    }
}
