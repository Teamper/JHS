// @ts-check

import { LifecycleScope } from "../../core/lifecycle-scope.js";

export const INFO_TAG_CSS = ".info-tag{background-color:var(--jhs-status-fav-tint);display:inline-block;height:32px;padding:0 10px;line-height:30px;font-size:12px;color:var(--jhs-status-fav);border:1px solid var(--jhs-status-fav-tint);border-radius:4px;box-sizing:border-box;white-space:nowrap}";

/** Manage optional actress information and cancel lookups when the setting or feature turns off. */
export class ActressInfoController {
    /** @param {{document: Document, location: {href: string, pathname: string}, service: any, settings: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, diagnostics: any}} options */
    constructor(options) {
        this.document = options.document;
        this.location = options.location;
        this.service = options.service;
        this.settings = options.settings;
        this.scope = options.scope;
        this.diagnostics = options.diagnostics;
        this.generation = 0;
        /** @type {import("../../core/lifecycle-scope.js").LifecycleScope | null} */
        this.mountScope = null;
        /** @type {Set<Element>} */
        this.ownedNodes = new Set();
        this.disposed = false;
    }

    start() {
        this.scope.assertActive();
        this.scope.listen(this.settings, "settings.changed", this.handleSettingsChanged);
        void this.mount().catch((error) => this.reportError(error));
        this.scope.addCleanup(() => this.dispose());
    }

    async mount() {
        if (this.disposed || this.scope.disposed || this.settings.snapshot().enableLoadActressInfo === "no") return;
        this.unmount();
        const generation = ++this.generation, requestScope = new LifecycleScope(`actress-info:${generation}`);
        this.mountScope = requestScope;
        const path = this.location.pathname;
        try {
            if (path.startsWith("/v/") || path.startsWith("/movies/")) await this.mountDetailPage(generation, requestScope);
            else if (path.startsWith("/actors/")) await this.mountActorPage(generation, requestScope);
        } catch (error) {
            if (this.isStillActive(generation, requestScope)) throw error;
        }
    }

    /** @param {number} generation @param {import("../../core/lifecycle-scope.js").LifecycleScope} requestScope */
    isStillActive(generation, requestScope) {
        return !this.disposed && !this.scope.disposed && !requestScope.disposed && generation === this.generation && this.mountScope === requestScope && this.settings.snapshot().enableLoadActressInfo !== "no";
    }

    unmount() {
        this.generation += 1;
        this.mountScope?.dispose();
        this.mountScope = null;
        for (const node of this.ownedNodes) node.remove();
        this.ownedNodes.clear();
    }

    /** @param {number} generation @param {import("../../core/lifecycle-scope.js").LifecycleScope} requestScope */
    async mountDetailPage(generation, requestScope) {
        const actressLinks = [...this.document.querySelectorAll(".female")];
        const names = actressLinks.map((link) => link.previousElementSibling?.textContent?.trim() || "").filter(Boolean);
        if (!names.length) return;
        /** @type {HTMLElement[]} */
        const blocks = [];
        for (const name of names) {
            let info = null;
            try { info = await this.service.lookup(name, { scope: requestScope }); }
            catch (error) { this.logLookupError(name, error); }
            if (!this.isStillActive(generation, requestScope)) return;
            blocks.push(this.createDetailBlock(name, info));
        }
        if (!this.isStillActive(generation, requestScope)) return;
        const heading = [...this.document.querySelectorAll("strong")].find((element) => /^(?:演員|演员)\s*:?$/u.test((element.textContent || "").trim()));
        const anchor = heading?.parentElement || actressLinks[0]?.closest(".panel-block");
        if (!anchor) return;
        anchor.after(...blocks);
        blocks.forEach((block) => this.ownedNodes.add(block));
    }

    /** @param {string} name @param {any} info */
    createDetailBlock(name, info) {
        const block = this.document.createElement("div");
        block.className = "panel-block actress-info";
        const link = this.document.createElement("a");
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        if (info) {
            const heading = this.document.createElement("strong");
            heading.textContent = `${name}:`;
            block.append(heading);
            link.className = "jhs-layout-9813a0dd";
            link.href = this.safeExternalUrl(info.url) || "#";
            link.append(
                this.createInfoTag(`${info.birthday} ${info.age}`.trim()),
                this.createInfoTag(`${info.height} ${info.weight}`.trim()),
                this.createInfoTag(`${info.threeSizeText} ${info.braSize}`.trim()),
            );
        } else {
            link.href = this.safeExternalUrl(this.service.profileUrl(name)) || "#";
            const heading = this.document.createElement("strong");
            heading.textContent = `${name}:`;
            link.append(heading);
        }
        block.append(link);
        return block;
    }

    /** @param {string} value */
    createInfoTag(value) {
        const tag = this.document.createElement("span");
        tag.className = "info-tag";
        tag.textContent = value;
        return tag;
    }

    /** @param {number} generation @param {import("../../core/lifecycle-scope.js").LifecycleScope} requestScope */
    async mountActorPage(generation, requestScope) {
        const title = this.document.querySelector(".actor-section-name");
        const names = [];
        if (title) names.push(...(title.textContent || "").trim().split(",").map((name) => name.trim()));
        for (const element of this.document.querySelectorAll(".section-meta")) {
            const text = (element.textContent || "").trim();
            if (text && !text.includes("影片")) names.push(...text.split(",").map((name) => name.trim()));
        }
        const uniqueNames = names.filter(Boolean);
        if (!uniqueNames.length || !title?.parentElement) return;
        let info = null;
        for (const name of uniqueNames) {
            try { info = await this.service.lookup(name, { scope: requestScope }); }
            catch (error) { this.logLookupError(name, error); }
            if (!this.isStillActive(generation, requestScope)) return;
            if (info) break;
        }
        if (!this.isStillActive(generation, requestScope)) return;
        const body = this.document.createElement("div");
        body.className = "jhs-layout-c0d4a511";
        if (!info) body.textContent = "无此相关演员信息";
        else {
            body.append(this.createActorInfoRow([
                [`出生日期: ${info.birthday}`, "jhs-layout-dd5a75f6"],
                [`年龄: ${info.age}`, "jhs-layout-d4a09a0d"],
                [`身高: ${info.height}`, "jhs-layout-d4a09a0d"],
            ]), this.createActorInfoRow([
                [`体重: ${info.weight}`, "jhs-layout-dd5a75f6"],
                [`三围: ${info.threeSizeText}`, "jhs-layout-d4a09a0d"],
                [`罩杯: ${info.braSize}`, "jhs-layout-d4a09a0d"],
            ]));
        }
        const result = info ? this.document.createElement("a") : body;
        if (info) {
            result.className = "actress-info";
            result.setAttribute("target", "_blank");
            result.setAttribute("rel", "noopener noreferrer");
            result.setAttribute("href", this.safeExternalUrl(info.url) || "#");
            result.append(body);
        } else result.classList.add("actress-info");
        title.parentElement.append(result);
        this.ownedNodes.add(result);
    }

    /** @param {Array<[string, string]>} values */
    createActorInfoRow(values) {
        const row = this.document.createElement("div");
        row.className = "jhs-layout-1b3790ef";
        for (const [text, className] of values) {
            const item = this.document.createElement("span");
            item.className = className;
            item.textContent = text;
            row.append(item);
        }
        return row;
    }

    /** @param {unknown} value */
    safeExternalUrl(value) {
        try {
            const url = new URL(String(value || ""), this.location.href);
            return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
        } catch {
            return null;
        }
    }

    /** @param {any} event */
    handleSettingsChanged = (event) => {
        if (!event.detail?.names?.includes("enableLoadActressInfo")) return;
        if (this.settings.snapshot().enableLoadActressInfo === "no") this.unmount();
        else {
            this.unmount();
            void this.mount().catch((error) => this.reportError(error));
        }
    };

    /** @param {string} name @param {unknown} error */
    logLookupError(name, error) {
        try { /** @type {any} */ (globalThis).clog?.error?.("演员资料查询失败", name, error); }
        catch { /* A logging issue cannot block actress info rendering. */ }
    }

    /** @param {unknown} error */
    reportError(error) {
        this.diagnostics?.recordError?.({ source: "actress-info-feature", featureId: "actress-info", contributionId: "identity.actress-info", message: error instanceof Error ? error.message : String(error) });
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.unmount();
    }
}
