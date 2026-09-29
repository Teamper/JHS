// @ts-check

/** Restore and persist the JavDB actor-tag expansion preference under the legacy key. */
export class ListTagExpansionController {
    /** @param {{hostAdapter: any, storage: any, scope: any, diagnostics?: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.storage = options.storage;
        this.scope = options.scope;
        this.diagnostics = options.diagnostics ?? null;
        this.started = false;
        this.releaseListener = null;
        this.expandButton = null;
        /** @type {Element[]} */ this.contents = [];
    }

    start() {
        if (this.started) return true;
        if (!this.storage?.getLocal || !this.storage?.setLocal) return false;
        this.scope.assertActive();
        if (!(this.hostAdapter.location?.href ?? "").includes("actors")) return false;
        const document = this.hostAdapter.document;
        this.expandButton = document?.querySelector?.(".tag-expand") ?? null;
        if (!this.expandButton) return false;
        this.contents = [...document.querySelectorAll(".actor-tags .content")];
        this.started = true;

        try {
            if (this.storage.getLocal("jhs_tag_expand") === "true" && this.contents.some((element) => element.classList.contains("collapse"))) {
                this.expandButton.click();
            }
        } catch (error) {
            this.recordError("恢复演员标签展开状态失败", error);
        }
        this.releaseListener = this.scope.listen(this.expandButton, "click", () => this.rememberState());
        return true;
    }

    rememberState() {
        if (!this.started || this.scope.disposed) return;
        try {
            const expanded = !this.contents.some((element) => element.classList.contains("collapse"));
            this.storage.setLocal("jhs_tag_expand", String(expanded));
        } catch (error) {
            this.recordError("保存演员标签展开状态失败", error);
        }
    }

    /** @param {string} message @param {unknown} error */
    recordError(message, error) {
        this.diagnostics?.recordError?.({
            source: "list-tag-expansion", featureId: "list", contributionId: "list.core",
            message: `${message}: ${error instanceof Error ? error.message : String(error)}`,
        });
    }

    dispose() {
        this.releaseListener?.();
        this.releaseListener = null;
        this.contents = [];
        this.expandButton = null;
        this.started = false;
    }
}
