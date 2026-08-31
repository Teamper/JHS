// @ts-check

/** Own list-card context-menu blocking and its lifecycle listener. */
export class ListContextMenuController {
    /** @param {{scope: any, document?: Document, selectors: Record<string, string>, site?: string, readItem: (item: Element) => {carNum?: string, url?: string, publishTime?: string, fc2Source?: string} | null, stateService?: any, parseActressName?: (url: string) => Promise<string | null> | string | null, confirm?: (event: MouseEvent, message: string, callback: () => Promise<void>) => void}} options */
    constructor(options) {
        this.scope = options.scope;
        this.document = options.document ?? globalThis.document ?? null;
        this.selectors = Object.freeze({ ...options.selectors });
        this.site = options.site ?? "";
        this.readItem = options.readItem;
        this.stateService = options.stateService ?? null;
        this.parseActressName = options.parseActressName ?? (async () => null);
        this.confirm = options.confirm ?? ((event, message, callback) => /** @type {any} */ (globalThis).utils?.q?.(event, message, callback));
        /** @type {Element | null} */ this.root = null;
        this.started = false;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    start() {
        this.scope.assertActive();
        if (this.started || this.disposed || !this.document) return;
        this.started = true;
        this.root = this.document.querySelector(this.selectors.boxSelector);
        if (!this.root) return;
        this.scope.listen(this.root, "contextmenu", (/** @type {MouseEvent} */ event) => {
            void this.handle(event).catch((error) => /** @type {any} */ (globalThis).clog?.error?.("右键菜单处理失败", error));
        });
    }

    /** @param {MouseEvent} event */
    async handle(event) {
        if (this.disposed) return;
        const target = /** @type {Element | null} */ (event.target);
        if (!target) return;
        const item = target?.closest?.(".item");
        const mediaTarget = target.closest(".item img, .item video");
        if (!item || !this.root?.contains(item) || !mediaTarget || mediaTarget.closest(".item") !== item) return;
        event.preventDefault();
        const record = this.readItem(item);
        if (!record?.carNum || !this.stateService?.patch) return;
        const actorName = this.readActorName();
        this.confirm(event, `是否屏蔽番号 ${record.carNum}?`, async () => {
            try {
                const names = actorName || await this.parseActressName(record.url || "");
                await this.stateService.patch(record.carNum, { blocked: true }, { record: { carNum: record.carNum, url: record.url, names: names || "", publishTime: record.publishTime, fc2Source: record.fc2Source } });
                /** @type {any} */ (globalThis).show?.ok?.("操作成功");
            } catch (error) {
                /** @type {any} */ (globalThis).clog?.error?.("屏蔽操作失败:", error);
                /** @type {any} */ (globalThis).show?.error?.("操作失败");
            }
        });
    }

    readActorName() {
        const selector = this.site === "javdb" ? ".actor-section-name" : ".avatar-box .photo-info .pb10";
        const text = this.document?.querySelector(selector)?.textContent?.trim() ?? "";
        return text.split(",")[0]?.replace("(無碼)", "") ?? "";
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.root = null;
    }
}
