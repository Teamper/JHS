// @ts-check

import { OneOneFiveMatchService } from "../../services/one-one-five-match-service.js";
import { create115RenamePreview } from "../../ui/detail/one115-rename-preview.js";

import { PRODUCT_NAMES } from "../../core/product-names.js";

import { escapeHtml, normalizeCarNum } from "../../core/constants.js";
import { mapLimit, parseBooleanSetting } from "../../core/feature-helpers.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { format115Size, normalize115Keyword, preview115Rename } from "./one-one-five-utils.js";

/** Own optional 115 file matching on supported list and detail surfaces. */
export class OneOneFiveMatchController {
    /** @param {{document: Document, window: Window & typeof globalThis, route: string, host: any, offline: any, match?: any, settings: any, events: any, dialog: any, ui: any, notifications: any, scope: LifecycleScope, diagnostics: any}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.route = options.route;
        this.host = options.host;
        this.offline = options.offline;
        this.match = options.match ?? new OneOneFiveMatchService(options.offline);
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
        if (this.events?.on) this.scope.addCleanup(this.events.on("subtitle.uploaded", () => {
            this.match.clear();
            return this.configureMatching().catch(error => this.report("115 字幕状态刷新失败", error));
        }));
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

    /** @param {LifecycleScope} scope @param {any} [continuation] */
    async mountDetailMatching(scope, continuation = null) {
        const movie = this.host.readMovieRef?.(), carNum = movie?.carNum, keyword = normalize115Keyword(carNum);
        if (!keyword) return;
        const summary = this.host.locateDetailSlots?.()?.summary;
        if (!summary) return;
        const block = this.document.createElement("div");
        block.className = "panel-block jhs-115-match";
        const label = this.document.createElement("strong");
        label.textContent = `${PRODUCT_NAMES.one115} 匹配：`;
        block.append(label, this.document.createTextNode("匹配中"));
        const previous = summary.querySelector(".jhs-115-match");
        const restoreFocus = previous?.contains(this.document.activeElement);
        previous?.remove();
        summary.append(block);
        try {
            const cacheMinutes = this.readCacheMinutes();
            const result = await this.match.matchMovie(movie, { scope, ttlMs: cacheMinutes * 60_000, continuation });
            if (!this.isCurrent(scope)) return;
            const matches = result.matches;
            block.replaceChildren(label);
            if (!result.complete) {
                const more = this.document.createElement("button");
                more.type = "button";
                more.className = "jhs-btn jhs-btn--secondary";
                more.textContent = "结果未完整 · 继续加载";
                more.addEventListener("click", () => {
                    if (this.isCurrent(scope)) void this.mountDetailMatching(scope, result.continuation);
                });
                block.append(more);
            }
            if (!matches.length) {
                block.append(this.document.createTextNode(result.complete ? "未匹配 " : "尚未匹配 "), this.createRetryButton());
                return;
            }
            const renameSelected = this.document.createElement("button");
            renameSelected.type = "button";
            renameSelected.className = "jhs-btn jhs-btn--secondary";
            renameSelected.textContent = "预览与批量重命名";
            scope.listen(renameSelected, "click", () => this.openRenamePreview(matches, carNum, renameSelected));
            block.append(renameSelected);
            for (const match of matches) {
                const row = this.document.createElement("span");
                row.className = "jhs-115-match-row";
                row.dataset.jhs115FileId = match.fileId || "";
                const url = this.safePlayUrl(match);
                if (url) {
                    const link = this.document.createElement("a");
                    link.className = "jhs-btn jhs-btn--secondary";
                    link.href = url;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = `${match.name}（${format115Size(match.size)}）`;
                    row.append(link);
                } else {
                    const unavailable = this.document.createElement("span");
                    unavailable.textContent = `${match.name}（${format115Size(match.size)}） · 不可播放`;
                    row.append(unavailable);
                }
                if (match.fileId) row.append(this.createRenameButton(match, carNum));
                block.append(row);
            }
        } catch (error) {
            if (!this.isCurrent(scope)) return;
            block.replaceChildren(label, this.document.createTextNode("匹配失败，请登录后重试 "));
            const login = this.document.createElement("a");
            login.className = "jhs-btn jhs-btn--ghost";
            login.href = this.offline.getIntegrationHomeUrl("one115");
            login.target = "_blank";
            login.rel = "noopener noreferrer";
            login.textContent = "去登录";
            block.append(login, this.createRetryButton());
            this.report("115 匹配失败", error);
        } finally {
            if (restoreFocus && this.isCurrent(scope) && this.document.activeElement === this.document.body) {
                /** @type {HTMLElement | null} */ (block.querySelector("button,a[href]") || null)?.focus({ preventScroll: true });
            }
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

    /** @param {Element} element @param {LifecycleScope} scope @param {boolean} [force] @param {any} [continuation] */
    async matchCard(element, scope, force = false, continuation = null) {
        if (!this.isCurrent(scope)) return;
        const carNum = normalizeCarNum(element.querySelector(".video-title strong")?.textContent);
        if (!carNum || element.getAttribute("data-jhs115-state") === "pending") return;
        try {
            element.setAttribute("data-jhs115-state", "pending");
            const result = await this.match.matchMovie({ carNum }, { scope, ttlMs: this.cacheMinutes * 60_000, force, continuation });
            if (!this.isCurrent(scope) || !element.isConnected) return;
            const matches = result.matches;
            element.querySelector(".jhs-115-list-match")?.remove();
            const badge = this.document.createElement("button");
            badge.type = "button";
            badge.className = "jhs-btn jhs-btn--ghost jhs-115-list-match";
            badge.textContent = result.complete ? matches.length ? `匹配${matches.length}个` : "未匹配" : `结果未完整 · 已匹配${matches.length}个 · 继续加载`;
            badge.addEventListener("click", (/** @type {MouseEvent} */ event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!this.isCurrent(scope)) return;
                if (!result.complete) return void this.matchCard(element, scope, false, result.continuation);
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
        this.dialog.open({ type: 1, title: `${carNum} ${PRODUCT_NAMES.one115} 匹配`, content: `<div class="jhs-dialog-content">${links}</div>`, area: ["560px", "auto"] });
    }

    /** @param {any[]} matches @param {string} carNum @param {HTMLElement} trigger */
    openRenamePreview(matches, carNum, trigger) {
        const parent = this.lifecycleScope;
        if (!parent || !this.isCurrent(parent)) return;
        const scope = new LifecycleScope("115-rename-preview");
        const release = parent.addCleanup(() => scope.dispose());
        scope.addCleanup(release);
        const view = create115RenamePreview({ document: this.document, records: matches.map(match => ({ ...match, nextName: preview115Rename(match.name, carNum, { uppercase: true, keepSuffix: true }) })) });
        let index = /** @type {number | null} */ (null), running = false;
        scope.listen(view.submit, "click", async () => {
            if (running) return;
            const selected = view.entries.filter(entry => entry.checkbox.checked && !entry.checkbox.disabled);
            if (!selected.length) { view.progress.textContent = "请勾选需要重命名的文件"; return; }
            running = true;
            view.submit.disabled = true;
            for (const entry of view.entries) entry.checkbox.disabled = true;
            let succeeded = 0, failed = 0;
            for (const entry of selected) {
                if (scope.disposed) break;
                entry.status.textContent = "处理中";
                try {
                    await this.offline.renameFile("one115", entry.record.fileId, entry.record.nextName, { scope, expectedAccountId: entry.record.accountId });
                    this.match.clear();
                    if (scope.disposed) break;
                    entry.status.textContent = "成功";
                    succeeded++;
                    const original = matches.find(match => match.fileId === entry.record.fileId);
                    if (original) original.name = entry.record.nextName;
                    for (const row of this.document.querySelectorAll("[data-jhs115-file-id]")) {
                        if (/** @type {HTMLElement} */ (row).dataset.jhs115FileId !== entry.record.fileId) continue;
                        const link = row.querySelector("a");
                        if (link) link.textContent = `${entry.record.nextName}（${format115Size(entry.record.size)}）`;
                    }
                } catch (error) {
                    if (scope.disposed) break;
                    failed++;
                    entry.status.textContent = `失败 ${error instanceof Error ? error.message : String(error)}`;
                }
                view.progress.textContent = `成功 ${succeeded} · 失败 ${failed} · 未开始 ${selected.length - succeeded - failed}`;
            }
        });
        scope.addCleanup(() => { if (index !== null) { const id = index; index = null; this.dialog.close(id); } view.root.remove(); if (trigger.isConnected) trigger.focus({ preventScroll: true }); });
        view.root.style.display = "none";
        this.document.body.append(view.root);
        try {
            index = this.dialog.open({ type: 1, title: `${carNum} 115 重命名预览`, content: this.ui.jquery(view.root), area: this.ui.getResponsiveArea(["70%", "76%"]), scrollbar: false, ui: { body: "scroll" },
                success: (/** @type {any} */ _root, /** @type {number} */ id) => { index = id; this.ui.setupEscClose(id); }, end: () => { index = null; scope.dispose(); },
            });
        } catch (error) { scope.dispose(); this.report("115 重命名预览失败", error); }
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
        const trigger = /** @type {Element | null} */ (event.currentTarget);
        const nextName = preview115Rename(match.name, carNum, { uppercase: true, keepSuffix: true });
        this.ui.confirm({ clientX: event.clientX, clientY: event.clientY + 80 }, `重命名此文件？<br>${escapeHtml(match.name)}<br>→ ${escapeHtml(nextName)}`, async () => {
            const scope = this.lifecycleScope;
            if (!this.isCurrent(scope)) return;
            try {
                await this.offline.renameFile("one115", match.fileId, nextName, { scope, expectedAccountId: match.accountId });
                this.match.clear();
                if (this.isCurrent(scope)) {
                    match.name = nextName;
                    const link = trigger?.parentElement?.querySelector("a");
                    if (link) link.textContent = `${nextName}（${format115Size(match.size)}）`;
                    this.notifications.ok("已重命名");
                }
            } catch (error) {
                if (!this.isCurrent(scope)) return;
                this.report("115 重命名失败", error);
                this.notifications.error("重命名失败，请重试");
            }
        }, { confirmText: "重命名" });
    }

    createRetryButton() {
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--ghost";
        button.textContent = "重试";
        button.addEventListener("click", () => { this.match.clear(); void this.configureMatching().catch(error => this.report("115 匹配重试失败", error)); });
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
