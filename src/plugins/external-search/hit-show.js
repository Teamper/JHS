// @ts-check

import { BasePlugin } from "../../core/plugin-manager.js";
import { classifyJavDbPage } from "../../core/site-context.js";

export class HitShowPlugin extends BasePlugin {
    getName() { return "HitShowPlugin"; }

    async handle() {
        const page = classifyJavDbPage(window.location);
        if (page.kind !== "playback-ranking") return;
        const root = this.getRuntimeService("host").locateListRoot?.();
        if (!root) return;
        root.setAttribute("data-jhs-ranking", "playback");
        root.setAttribute("data-jhs-ranking-period", page.period);
        root.setAttribute("data-jhs-ranking-filter", page.filter);
    }
}
