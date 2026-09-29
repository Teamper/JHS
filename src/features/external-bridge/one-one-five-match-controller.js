// @ts-check

import { escapeHtml, normalizeCarNum } from "../../core/constants.js";
import { mapLimit, parseBooleanSetting } from "../../core/feature-helpers.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { format115Size, normalize115Keyword, preview115Rename } from "./one-one-five-utils.js";

/** Own optional 115 file matching on supported list and detail surfaces. */
export class OneOneFiveMatchController {
    /** @param {{document: Document, window: Window & typeof globalThis, route: string, host: any, offline: any, settings: any, events: any, dialog: any, ui: any, notifications: any, scope: LifecycleScope, diagnostics: any}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.route = options.route;
        this.host = options.host;
        this.offline = options.offline;
        this.settings = options.settings;
        this.events = options.events;
        this.dialog = options.dialog;
        this.ui = options.ui;
        this.notifications = options.notifications;
        this.scope = options.scope;
        this.diagnostics = options.diagnostics;
        this.matchGeneration = 0;
        this.concurrency = 4;
        this.cacheMinutes = 60;
        this.lifecycleScope = null;
        this.releaseMatchScope = null;
        this.observer = null;
        this.unsubscribeItems = null;
        this.flushTimer = null;
        this.flushTimerCleanup = null;
        this.pendingCards = new Set();
        this.disposed = false;
        this.managedByFeature = true;
        this.runtimeStatus = "managed-feature";
    }

    getName() { return "OneOneFiveMatchPlugin"; }

    /** Compatibility accessor for old diagnostics and integrations during migration. @param {string} name */
    getRuntimeService(name) {
        const services = /** @type {Record<string, any>} */ ({
            host: this.host, offline: this.offline, settings: this.settings, events: this.events,
            dialog: this.dialog, scope: () => Promise.resolve(this.lifecycleScope ?? this.scope),
        });
        return services[name];
    }

    start() {
        this.scope.assertActive();
        this.scope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => {
            const names = event.detail?.names;
            if (names?.some((/** @type {string} */ name) => ["enable115Match", "oneOneFiveConcurrency", "oneOneFiveCacheMinutes"].includes(name))) {
                void this.configureMatching().catch((error) => this.report("115 匹配设置更新失败", error));
            }
        });
        this.scope.addCleanup(() => this.dispose());
        void this.configureMatching().catch((error) => this.report("115 匹配启动失败", error));
        return true;
    }

    async configureMatching() {
        const generation = ++this.matchGeneration;
        this.stopMatching();
        const enabled = parseBooleanSetting(this.settings.snapshot().enable115Match, false);
        if (!enabled || this.disposed || this.scope.disposed || generation !== this.matchGeneration) return;
        const scope = this.lifecycleScope = new LifecycleScope(`115-match:${generation}`);
        this.releaseMatchScope = this.scope.addCleanup(() => {
            if (this.lifecycleScope === scope) this.lifecycleScope = null;
            scope.dispose();
        });
        await this.mountMatching(scope);
    }

    stopMatching() {
        this.releaseMatchScope?.();
        this.releaseMatchScope = null;
        this.lifecycleScope?.dispose();
        this.lifecycleScope = null;
        this.unsubscribeItems?.();
        this.unsubscribeItems = null;
        this.flushTimerCleanup?.();
        this.flushTimerCleanup = null;
        this.flushTimer = null;
        this.pendingCards.clear();
        this.observer?.disconnect();
        this.observer = null;
        for (const node of this.document.querySelectorAll(".jhs-115-match,.jhs-115-list-match")) node.remove();
        for (const card of this.document.querySelectorAll("[data-jhs115-observed],[data-jhs115-state]")) {
            card.removeAttribute("data-jhs115-observed");
            card.removeAttribute("data-jhs115-state");
        }
    }

    /** @param {LifecycleScope} scope */
    async mountMatching(scope) {
        if (scope.disposed || this.lifecycleScope !== scope) return;
        if (this.route === "detail") return this.mountDetailMatching(scope);
        if (this.route !== "list") return;
        await this.mountListMatching(scope);
    }

    /** @param {LifecycleScope} scope */
    async mountDetailMatching(scope) {
        const movie = this.host.readMovieRef?.(), carNum = movie?.carNum, keyword = normalize115Keyword(carNum);
        if (!keyword) return;
        const summary = this.host.locateDetailSlots?.()?.summary;
        if (!summary) return;
        const block = this.document.createElement("div");
        block.className = "panel-block jhs-115-match";
        const label = this.document.createElement("strong");
        label.textContent = "115匹配：";
        block.append(label, this.document.createTextNode("匹配中"));
        summary.append(block);
        try {
            const cacheMinutes = this.readCacheMinutes();
            const matches = await this.offline.searchFiles("one115", keyword, { scope, ttlMs: cacheMinutes * 60_000 });
            if (!this.isCurrent(scope)) return;
            block.replaceChildren(label);
            if (!matches.length) {
                block.append(this.document.createTextNode("未匹配 "), this.createRetryButton());
                return;
            }
            for (const match of matches) {
                const row = this.document.createElement("span");
                row.className = "jhs-115-match-row";
                const url = this.safePlayUrl(match);
                if (url) {
                    const link = this.document.createElement("a");
                    link.className = "jhs-btn jhs-btn--secondary";
                    link.href = url;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = `${match.name} (${format115Size(match.size)})`;
                    row.append(link);
                } else {
                    const unavailable = this.document.createElement("span");
                    unavailable.textContent = `${match.name} (${format115Size(match.size)}) · 不可播放`;
                    row.append(unavailable);
                }
                if (match.fileId) row.append(this.createRenameButton(match, carNum));
                block.append(row);
            }
        } catch (error) {
            if (!this.isCurrent(scope)) return;
            block.replaceChildren(label, this.document.createTextNode("未登录或请求失败 "));
            const login = this.document.createElement("a");
            login.className = "jhs-btn jhs-btn--ghost";
            login.href = this.offline.getIntegrationHomeUrl("one115");
            login.target = "_blank";
            login.rel = "noopener noreferrer";
            login.textContent = "去登录";
            block.append(login, this.createRetryButton());
            this.report("115 匹配失败", error);
        }
    }

    /** @param {LifecycleScope} scope */
    async mountListMatching(scope) {
        const root = this.host.locateListRoot?.();
        if (!root) return;
        const Observer = this.window.IntersectionObserver;
        if (typeof Observer !== "function") throw new Error("当前浏览器不支持 115 卡片懒匹配");
        this.concurrency = this.readConcurrency();
        this.cacheMinutes = this.readCacheMinutes();
        this.observer = new Observer((/** @type {IntersectionObserverEntry[]} */ entries) => {
            if (!this.isCurrent(scope)) return;
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                this.observer?.unobserve(entry.target);
                this.pendingCards.add(entry.target);
            }
            if (this.pendingCards.size) this.scheduleFlush(scope);
        }, { rootMargin: "200px" });
        this.registerCards([...root.querySelectorAll(".item")]);
        this.unsubscribeItems = this.events.on("list-items-added", (/** @type {any} */ payload) => this.registerCards(payload.items || []));
        scope.ownObserver(this.observer);
        scope.addCleanup(() => {
            this.unsubscribeItems?.();
            this.unsubscribeItems = null;
            this.flushTimerCleanup?.();
            this.flushTimerCleanup = null;
            this.flushTimer = null;
            this.pendingCards.clear();
        });
    }

    /** @param {Element[]} cards */
    registerCards(cards) {
        for (const card of cards) {
            if (!(card instanceof this.window.HTMLElement)) continue;
            const listCard = /** @type {HTMLElement} */ (card);
            if (listCard.dataset.jhs115Observed === "true" || listCard.dataset.jhs115State === "matched") continue;
            listCard.dataset.jhs115Observed = "true";
            this.observer?.observe(card);
        }
    }

    /** @param {LifecycleScope} scope */
    scheduleFlush(scope) {
        if (this.flushTimer || !this.isCurrent(scope)) return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flushTimerCleanup?.();
            this.flushTimerCleanup = null;
            const cards = [...this.pendingCards];
            this.pendingCards.clear();
            void mapLimit(cards, this.concurrency, (card) => this.isCurrent(scope) ? this.matchCard(card, scope) : undefined);
        }, 50);
        this.flushTimerCleanup = scope.ownTimeout(this.flushTimer);
    }

    /** @param {Element} element @param {LifecycleScope} scope @param {boolean} [force] */
    async matchCard(element, scope, force = false) {
        if (!this.isCurrent(scope)) return;
        const carNum = normalizeCarNum(element.querySelector(".video-title strong")?.textContent);
        if (!carNum || element.getAttribute("data-jhs115-state") === "pending") return;
        try {
            element.setAttribute("data-jhs115-state", "pending");
            const matches = await this.offline.searchFiles("one115", normalize115Keyword(carNum), { scope, ttlMs: this.cacheMinutes * 60_000, force });
            if (!this.isCurrent(scope) || !element.isConnected) return;
            element.querySelector(".jhs-115-list-match")?.remove();
            const badge = this.document.createElement("button");
            badge.type = "button";
            badge.className = "jhs-btn jhs-btn--ghost jhs-115-list-match";
            badge.textContent = matches.length ? `匹配${matches.length}个` : "未匹配";
            badge.addEventListener("click", (/** @type {MouseEvent} */ event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!this.isCurrent(scope)) return;
                if (!matches.length) return void this.matchCard(element, scope, true);
                if (matches.length === 1) {
                    const url = this.safePlayUrl(matches[0]);
                    if (url) this.window.open(url, "_blank", "noopener,noreferrer");
                    return;
                }
                this.openMatchesDialog(carNum, matches);
            });
            element.querySelector(".video-title")?.prepend(badge);
            element.setAttribute("data-jhs115-state", "matched");
        } catch (error) {
            if (!this.isCurrent(scope) || !element.isConnected) return;
            element.setAttribute("data-jhs115-state", "failed");
            element.querySelector(".jhs-115-list-match")?.remove();
            const retry = this.document.createElement("button");
            retry.type = "button";
            retry.className = "jhs-btn jhs-btn--ghost jhs-115-list-match";
            retry.textContent = "失败·重试";
            retry.addEventListener("click", (/** @type {MouseEvent} */ event) => {
                event.preventDefault();
                event.stopPropagation();
                if (this.isCurrent(scope)) void this.matchCard(element, scope, true);
            });
            element.querySelector(".video-title")?.prepend(retry);
            this.report("115 单卡匹配失败", error);
        }
    }

    /** @param {string} carNum @param {any[]} matches */
    openMatchesDialog(carNum, matches) {
        const links = matches.map((/** @type {any} */ match) => {
            const url = this.safePlayUrl(match);
            return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match.name)}</a>` : `<span>${escapeHtml(match.name)} · 不可播放</span>`;
        }).join("<br>");
        this.dialog.open({ type: 1, title: `${carNum} 115匹配`, content: `<div class="jhs-dialog-content">${links}</div>`, area: ["560px", "auto"] });
    }

    /** @param {any} match @param {string} carNum */
    createRenameButton(match, carNum) {
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--ghost jhs-115-rename";
        button.textContent = "重命名";
        button.addEventListener("click", (/** @type {MouseEvent} */ event) => this.renameWithPreview(event, match, carNum));
        return button;
    }

    /** @param {MouseEvent} event @param {any} match @param {string} carNum */
    renameWithPreview(event, match, carNum) {
        const nextName = preview115Rename(match.name, carNum, { uppercase: true, keepSuffix: true });
        this.ui.confirm({ clientX: event.clientX, clientY: event.clientY + 80 }, `确认重命名？<br>${escapeHtml(match.name)}<br>→ ${escapeHtml(nextName)}`, async () => {
            const scope = this.lifecycleScope;
            if (!this.isCurrent(scope)) return;
            try {
                await this.offline.renameFile("one115", match.fileId, nextName, { scope });
                if (this.isCurrent(scope)) this.notifications.ok("重命名完成");
            } catch (error) {
                if (!this.isCurrent(scope)) return;
                this.report("115 重命名失败", error);
                this.notifications.error(`重命名失败：${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }

    createRetryButton() {
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--ghost";
        button.textContent = "重试";
        button.addEventListener("click", () => this.window.location.reload());
        return button;
    }

    /** @param {any} match */
    safePlayUrl(match) {
        try {
            const url = new URL(this.offline.getPlayUrl("one115", match));
            return ["http:", "https:"].includes(url.protocol) ? url.href : null;
        } catch { return null; }
    }

    readConcurrency() {
        return Math.max(1, Math.min(10, Number(this.settings.snapshot().oneOneFiveConcurrency ?? 4) || 4));
    }

    readCacheMinutes() {
        return Math.max(1, Number(this.settings.snapshot().oneOneFiveCacheMinutes ?? 60) || 60);
    }

    /** @param {LifecycleScope | null} scope */
    isCurrent(scope) { return !this.disposed && !this.scope.disposed && !scope?.disposed && this.lifecycleScope === scope; }

    /** @param {string} message @param {unknown} error */
    report(message, error) {
        const text = error instanceof Error ? error.message : String(error);
        this.diagnostics?.recordError?.({ source: "one-one-five-match", featureId: "one-one-five", contributionId: "external-bridge.115-match", message: `${message}: ${text}` });
        this.notifications.debug(message, error);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.matchGeneration += 1;
        this.stopMatching();
    }
}
