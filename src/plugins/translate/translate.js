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
    handle() {
        isDetailPage && this.translate();
    }
    async translate(e, t = !0, options = {}) {
        if ((this.getRuntimeService("settings").snapshot().translateTitle ?? _) !== _) return;
        l && (t = !1);
        const scope = await this.getRuntimeService("scope")();
        await renderTranslatedTitle({ root: options.root, carNum: e, translation: this.getRuntimeService("translation"), scope });
    }
}
