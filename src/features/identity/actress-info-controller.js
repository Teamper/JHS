// @ts-check

import { cleanActressName, collectActressLookupNames, readCleanActorElementText, readVerifiedActressProfile } from "../../core/actress-measurements.js";
import { isAbortError, isNotFoundError } from "../../core/jhs-error.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";

export const ACTRESS_INFO_CSS = `
    .info-tag{background-color:var(--jhs-accent-tint);display:inline-flex;align-items:center;min-height:var(--jhs-control-height-sm);padding:0 var(--jhs-space-2);line-height:var(--jhs-line-height-tight);font-size:var(--jhs-font-size-xs);color:var(--jhs-accent-text);border:1px solid var(--jhs-border);border-radius:var(--jhs-radius-xs);box-sizing:border-box;white-space:nowrap}
    .jhs-actor-profile-info {
        display: flex;
        flex-wrap: wrap;
        gap: var(--jhs-space-1) var(--jhs-space-4);
        margin-block-start: var(--jhs-space-1);
        min-inline-size: 0;
        max-inline-size: 100%;
        font-size: var(--jhs-font-size-md);
        font-weight: 400;
        line-height: var(--jhs-line-height-ui);
        white-space: normal;
        word-break: normal;
        overflow-wrap: anywhere;
    }
`;

/** Manage optional actress information and cancel lookups when the setting or feature turns off. */
export class ActressInfoController {
    /** @param {{document: Document, location: {href: string, pathname: string}, hostAdapter: any, service: any, settings: any, state?: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, diagnostics: any}} options */
    constructor(options) {
        this.document = options.document;
        this.location = options.location;
        this.hostAdapter = options.hostAdapter;
        this.service = options.service;
        this.settings = options.settings;
        this.state = options.state ?? null;
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

    async readActorAliasMaps() {
        const favoriteById = new Map();
        const blacklistById = new Map();
        if (!this.state) return { favoriteById, blacklistById };
        const [favorites, blacklist] = await Promise.all([
            typeof this.state.getFavoriteActressList === "function" ? this.state.getFavoriteActressList() : [],
            typeof this.state.getBlacklist === "function" ? this.state.getBlacklist() : [],
        ]);
        if (Array.isArray(favorites)) {
            for (const item of favorites) {
                const id = String(item?.starId || "").trim();
                if (id && !favoriteById.has(id)) favoriteById.set(id, item);
            }
        }
        if (Array.isArray(blacklist)) {
            for (const item of blacklist) {
                const id = String(item?.starId || "").trim();
                if (id && !blacklistById.has(id)) blacklistById.set(id, item);
            }
        }
        return { favoriteById, blacklistById };
    }

    /** @param {{starId?: string, domNames?: string[], aliasMaps?: {favoriteById?: Map<string, any>, blacklistById?: Map<string, any>} | null, requestScope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    async resolveActorInfo({ starId = "", domNames = [], aliasMaps = null, requestScope }) {
        const normalizedStarId = String(starId || "").trim();
        const favorite = normalizedStarId ? aliasMaps?.favoriteById?.get(normalizedStarId) : null;
        const stored = readVerifiedActressProfile(favorite);
        if (stored) return stored;
        const blacklist = normalizedStarId ? aliasMaps?.blacklistById?.get(normalizedStarId) : null;
        const candidates = collectActressLookupNames(
            favorite?.name,
            favorite?.allName,
            domNames,
            blacklist?.name,
            blacklist?.allName,
        );
        if (!candidates.length) return null;
        if (typeof this.service.lookupAny === "function") {
            try {
                const result = await this.service.lookupAny(candidates, { scope: requestScope });
                return result?.info ?? null;
            } catch (error) {
                this.logLookupError(candidates[0], error);
                return null;
            }
        }
        for (const candidate of candidates) {
            try {
                const info = await this.service.lookup(candidate, { scope: requestScope });
                if (info) return info;
            } catch (error) {
                this.logLookupError(candidate, error);
            }
            if (requestScope?.disposed) return null;
        }
        return null;
    }

    readFallbackActorProfile() {
        const title = this.document.querySelector(".actor-section-name");
        const anchorParent = title?.parentElement ?? null;
        const starId = this.location.pathname.match(/\/actors\/([^/?#]+)/u)?.[1] || null;
        const rawNames = [];
        if (title) rawNames.push(readCleanActorElementText(title));
        for (const element of this.document.querySelectorAll(".section-meta")) {
            const text = readCleanActorElementText(element);
            if (text && !text.includes("影片")) rawNames.push(text);
        }
        const names = collectActressLookupNames(rawNames).map((item) => cleanActressName(item)).filter(Boolean);
        if (!names.length) return null;
        return { starId, name: names[0], names, anchorParent };
    }

    /** @param {number} generation @param {import("../../core/lifecycle-scope.js").LifecycleScope} requestScope */
    async mountDetailPage(generation, requestScope) {
        const { actors, panel } = this.hostAdapter.readMovieActors();
        const actresses = actors.filter((/** @type {{role: string}} */ actor) => actor.role === "actress");
        if (!actresses.length) return;
        const aliasMaps = await this.readActorAliasMaps();
        if (!this.isStillActive(generation, requestScope)) return;
        /** @type {HTMLElement[]} */
        const blocks = [];
        for (const actor of actresses) {
            const info = await this.resolveActorInfo({
                starId: actor.starId || "",
                domNames: [actor.name],
                aliasMaps,
                requestScope,
            });
            if (!this.isStillActive(generation, requestScope)) return;
            blocks.push(this.createDetailBlock(actor.name, info));
        }
        if (!this.isStillActive(generation, requestScope)) return;
        const anchor = panel;
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
            heading.textContent = `${name}：`;
            block.append(heading);
            link.className = "jhs-layout-9813a0dd";
            link.href = this.safeExternalUrl(info.url) || "#";
            link.append(
                this.createInfoTag(`${info.birthday || ""} ${info.age || ""}`.trim()),
                this.createInfoTag(`${info.height || ""} ${info.weight || ""}`.trim()),
                this.createInfoTag(`${info.threeSizeText || ""} ${info.braSize || ""}`.trim()),
            );
        } else {
            link.href = this.safeExternalUrl(this.service.profileUrl(name)) || "#";
            const heading = this.document.createElement("strong");
            heading.textContent = `${name}：`;
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
        const profile = typeof this.hostAdapter?.readActorProfile === "function"
            ? this.hostAdapter.readActorProfile(this.document, this.location.href)
            : this.readFallbackActorProfile();
        if (!profile?.names?.length || !profile.anchorParent) return;
        const aliasMaps = await this.readActorAliasMaps();
        if (!this.isStillActive(generation, requestScope)) return;
        const info = await this.resolveActorInfo({
            starId: profile.starId || "",
            domNames: [...profile.names],
            aliasMaps,
            requestScope,
        });
        if (!this.isStillActive(generation, requestScope)) return;
        const fields = info ? [
            ["出生日期", info.birthday],
            ["年龄", info.age],
            ["身高", info.height],
            ["体重", info.weight],
            ["三围", info.threeSizeText],
            ["罩杯", info.braSize],
        ] : [];
        const items = [];
        for (const [label, value] of fields) {
            const text = value?.trim();
            if (!text) continue;
            const item = this.document.createElement("span");
            item.textContent = `${label}: ${text}`;
            items.push(item);
        }

        const result = this.document.createElement(items.length ? "a" : "div");
        result.className = "actress-info jhs-actor-profile-info";
        if (items.length) {
            result.setAttribute("target", "_blank");
            result.setAttribute("rel", "noopener noreferrer");
            result.setAttribute("href", this.safeExternalUrl(info.url) || "#");
            result.append(...items);
        } else {
            result.textContent = "无此相关演员信息";
        }
        profile.anchorParent.append(result);
        this.ownedNodes.add(result);
    }

    /** @param {unknown} value */
    safeExternalUrl(value) {
        try {
            const raw = String(value || "").trim();
            if (!raw) return null;
            const url = new URL(raw, this.location.href);
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
        if (isAbortError(error) || isNotFoundError(error)) return;
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
