// @ts-check

import { escapeHtml } from "../../core/constants.js";
import { assertMovieStateEligible, getMovieStateEligibility } from "../../core/movie-identity.js";

/** Keep the list-card block action inside the List Feature lifecycle. */
export class ListContextMenuController {
    /** @param {{hostAdapter: any, list: any, state: any, ui: any, notifications: any, scope: any, diagnostics?: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.list = options.list;
        this.state = options.state;
        this.ui = options.ui;
        this.notifications = options.notifications;
        this.scope = options.scope;
        this.diagnostics = options.diagnostics ?? null;
        this.started = false;
        this.disposed = false;
        this.releaseListener = null;
    }

    start() {
        if (this.started || !this.state?.patch || !this.ui?.confirm || !this.list?.findCarNumAndHref) return false;
        this.scope.assertActive();
        const root = this.hostAdapter.locateListRoot?.()
            ?? this.hostAdapter.document?.querySelector?.(this.hostAdapter.getListSelectors?.()?.boxSelector ?? "")
            ?? (typeof document === "undefined" ? null : document.querySelector(this.hostAdapter.getListSelectors?.()?.boxSelector ?? ""));
        if (!root) return false;
        this.started = true;
        this.releaseListener = this.scope.listen(root, "contextmenu", (/** @type {Event} */ event) => this.onContextMenu(event));
        return true;
    }

    /** @param {Event} event */
    onContextMenu(event) {
        const element = /** @type {Element | null} */ (event.target && typeof /** @type {any} */ (event.target).closest === "function" ? event.target : null);
        if (!element || !element.closest(".item img, .item video")) return;
        const card = element.closest(".item");
        if (!card) return;
        event.preventDefault();
        try {
            const record = this.readEligibleCard(card);
            const actorName = this.getActorName();
            this.ui.confirm(
                { clientX: /** @type {MouseEvent} */ (event).clientX, clientY: /** @type {MouseEvent} */ (event).clientY },
                `屏蔽「${escapeHtml(record.carNum)}」？`,
                () => this.blockMovie({ ...record, actorName }, card),
                { confirmText: "屏蔽" },
            );
        } catch (error) {
            this.recordError("右键屏蔽菜单处理失败", error);
            if (!this.scope.disposed) this.notifyFailure(error);
        }
    }

    getActorName() {
        const selector = this.hostAdapter.site === "javdb" ? ".actor-section-name" : ".avatar-box .photo-info .pb10";
        return this.hostAdapter.document?.querySelector?.(selector)?.textContent?.trim()?.split(",")[0]?.replace("(無碼)", "") ?? "";
    }

    /** @param {Element} card @param {string} [expectedCarNum] */
    readEligibleCard(card, expectedCarNum) {
        let record;
        try { record = this.list.findCarNumAndHref(this.ui.jquery(card)); } catch (error) { assertMovieStateEligible(null); throw error; }
        const stateEligibility = expectedCarNum && record.carNum !== expectedCarNum
            ? { eligible: false, reason: "conflicting" } : getMovieStateEligibility(record);
        assertMovieStateEligible({ ...record, stateEligibility });
        return { ...record, stateEligibility };
    }

    /** @param {{carNum: string, url: string, publishTime?: string, fc2Source?: string, actorName: string, stateEligibility?: any}} record @param {Element} [card] */
    async blockMovie(record, card) {
        if (this.disposed || this.scope.disposed) return;
        try {
            let source = card ? this.readEligibleCard(card, record.carNum) : record;
            assertMovieStateEligible(source);
            const names = record.actorName || await this.list.parseActressName?.(source.url, this.scope);
            if (this.disposed || this.scope.disposed) return;
            source = card ? this.readEligibleCard(card, record.carNum) : record;
            const stateEligibility = assertMovieStateEligible(source);
            await this.state.patch(source.carNum, { blocked: true }, {
                record: { carNum: source.carNum, url: source.url, names, publishTime: source.publishTime, fc2Source: source.fc2Source, stateEligibility },
            });
            if (this.disposed || this.scope.disposed) return;
            this.notifications.ok("已屏蔽");
        } catch (error) {
            if (this.disposed || this.scope.disposed) return;
            this.recordError("列表屏蔽操作失败", error);
            this.notifyFailure(error);
        }
    }

    /** @param {unknown} error */
    notifyFailure(error) {
        this.notifications.error(/** @type {any} */ (error)?.code === "UNRELIABLE_MOVIE_IDENTITY" ? `已跳过 1 项：${/** @type {Error} */ (error).message}` : "屏蔽失败，请重试");
    }

    /** @param {string} message @param {unknown} error */
    recordError(message, error) {
        this.diagnostics?.recordError?.({
            source: "list-context-menu", featureId: "list", contributionId: "list.core",
            message: `${message}: ${error instanceof Error ? error.message : String(error)}`,
        });
    }

    dispose() {
        this.releaseListener?.();
        this.releaseListener = null;
        this.disposed = true;
        this.started = false;
    }
}
