// @ts-check

import { escapeHtml } from "../../core/constants.js";

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
            const { carNum, url, publishTime, fc2Source } = this.list.findCarNumAndHref(this.ui.jquery(card));
            let actorName = this.getActorName();
            this.ui.confirm(
                { clientX: /** @type {MouseEvent} */ (event).clientX, clientY: /** @type {MouseEvent} */ (event).clientY },
                `是否屏蔽番号 ${escapeHtml(carNum)}?`,
                () => this.blockMovie({ carNum, url, publishTime, fc2Source, actorName }),
            );
        } catch (error) {
            this.recordError("右键屏蔽菜单处理失败", error);
            if (!this.scope.disposed) this.notifications.error("操作失败");
        }
    }

    getActorName() {
        const selector = this.hostAdapter.site === "javdb" ? ".actor-section-name" : ".avatar-box .photo-info .pb10";
        return this.hostAdapter.document?.querySelector?.(selector)?.textContent?.trim()?.split(",")[0]?.replace("(無碼)", "") ?? "";
    }

    /** @param {{carNum: string, url: string, publishTime?: string, fc2Source?: string, actorName: string}} record */
    async blockMovie(record) {
        if (this.disposed || this.scope.disposed) return;
        try {
            const names = record.actorName || await this.list.parseActressName?.(record.url);
            if (this.disposed || this.scope.disposed) return;
            await this.state.patch(record.carNum, { blocked: true }, {
                record: { carNum: record.carNum, url: record.url, names, publishTime: record.publishTime, fc2Source: record.fc2Source },
            });
            if (this.disposed || this.scope.disposed) return;
            this.notifications.ok("操作成功");
        } catch (error) {
            if (this.disposed || this.scope.disposed) return;
            this.recordError("列表屏蔽操作失败", error);
            this.notifications.error("操作失败");
        }
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
