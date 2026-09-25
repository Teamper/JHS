// @ts-check

import { BasePlugin } from "../../core/plugin-manager.js";
import { classifyJavDbPage } from "../../core/site-context.js";

/** Test only the native magnet tag; a playable subtitle badge has different meaning. */
/** @param {Element} item */
export function hasChineseSubtitleMagnet(item) {
    return [...item.querySelectorAll(".tags .tag")].some((tag) => /中字磁[链鏈]/u.test(tag.textContent || ""));
}

export class Top250Plugin extends BasePlugin {
    static legacyPluginId = "TOP250Plugin";
    getName() { return "TOP250Plugin"; }

    async initCss() {
        return `<style>.jhs-top250-subtitle{display:flex;gap:var(--jhs-space-2);max-width:100%;overflow-x:auto;margin:var(--jhs-space-3) 0}.jhs-top250-subtitle .jhs-btn{flex-shrink:0;white-space:nowrap}.jhs-top250-subtitle-hidden{display:none!important}</style>`;
    }

    async handle() {
        if (classifyJavDbPage(window.location).kind !== "top250-ranking") return;
        const host = this.getRuntimeService("host"), listRoot = host.locateListRoot?.(), container = host.getTop250FilterContainer?.();
        if (!listRoot || !container || container.querySelector(".jhs-top250-subtitle")) return;
        const controls = document.createElement("div");
        controls.className = "jhs-top250-subtitle";
        controls.setAttribute("role", "group");
        controls.setAttribute("aria-label", "TOP250 已加载条目筛选");
        for (const [value, label] of [["all", "已加载条目：全部"], ["with", "已加载条目：含中字磁链"], ["without", "已加载条目：无中字磁链"]]) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "jhs-btn jhs-btn--secondary";
            button.dataset.jhsSubtitle = value;
            button.textContent = label;
            controls.append(button);
        }
        host.mountTop250SubtitleControls(controls);
        const fromUrl = new URLSearchParams(window.location.search).get("jhs_subtitle");
        this.applySubtitleFilter(["with", "without"].includes(fromUrl || "") ? /** @type {string} */ (fromUrl) : "all", controls);
        controls.addEventListener("click", (event) => {
            const target = /** @type {Element | null} */ (event.target);
            const value = target?.closest("button[data-jhs-subtitle]")?.getAttribute("data-jhs-subtitle");
            if (!["all", "with", "without"].includes(value || "")) return;
            const url = new URL(window.location.href);
            value === "all" ? url.searchParams.delete("jhs_subtitle") : url.searchParams.set("jhs_subtitle", /** @type {string} */ (value));
            window.history.replaceState(window.history.state, "", url.href);
            this.applySubtitleFilter(/** @type {string} */ (value), controls);
        });
    }

    /** @param {string} value @param {Element} controls */
    applySubtitleFilter(value, controls) {
        const host = this.getRuntimeService("host");
        for (const item of host.locateTop250SubtitleCards()) {
            const hasSubtitleMagnet = hasChineseSubtitleMagnet(item);
            item.classList.toggle("jhs-top250-subtitle-hidden", value === "with" ? !hasSubtitleMagnet : value === "without" && hasSubtitleMagnet);
        }
        controls.querySelectorAll("button[data-jhs-subtitle]").forEach((button) => {
            const selected = button.getAttribute("data-jhs-subtitle") === value;
            button.setAttribute("aria-pressed", String(selected));
            button.classList.toggle("active", selected);
        });
        host.syncTop250SubtitleLinks?.(value);
    }
}
