// @ts-check

import { _, l } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { renderTranslatedTitle } from "../../ui/translation/title-translation.js";

export class TranslatePlugin extends BasePlugin {
    getName() {
        return "TranslatePlugin";
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
                this.reconfigure();
            };
            settings.addEventListener("settings.changed", onSettingsChanged);
            scope.addCleanup((() => {
                settings.removeEventListener("settings.changed", onSettingsChanged);
                this._settingsListenerBound = false;
            }));
        }
        this.reconfigure();
    }
    reconfigure() {
        const enabled = (this.getRuntimeService("settings").snapshot().translateTitle ?? _) === _;
        if (enabled) void this.applyTranslation();
        else this.revertTranslation();
    }
    /** ON：详情页插入/刷新翻译标题；列表页翻译当前所有卡片。 */
    async applyTranslation() {
        if (isDetailPage) return this.translate();
        if (!window.isListPage) return;
        const listPage = this.getOptionalDependency("ListPagePlugin");
        if (!listPage?.translateListItems || typeof listPage.getSelector !== "function") return;
        const items = $(listPage.getSelector().itemSelector).toArray();
        await listPage.translateListItems(items);
    }
    /** OFF：详情页移除 JHS 翻译节点；列表页回退为原始标题。 */
    revertTranslation() {
        $(".translated-title").remove();
        const listPage = this.getOptionalDependency("ListPagePlugin");
        listPage?.revertTranslation?.();
    }
    /** @param {string | null} [e] @param {boolean} [t] @param {{root?: ParentNode}} [options] */
    async translate(e, t = !0, options = {}) {
        if ((this.getRuntimeService("settings").snapshot().translateTitle ?? _) !== _) return;
        l && (t = !1);
        const scope = await this.getRuntimeService("scope")();
        await renderTranslatedTitle({ root: options.root, carNum: e ?? undefined, translation: this.getRuntimeService("translation"), scope });
    }
}
