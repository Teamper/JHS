// @ts-check
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { subtitleFilename } from "../../core/subtitle-asset.js";
import { createSubtitleWorkspace } from "../../ui/detail/subtitle-workspace.js";

export class SubtitleWorkspaceController {
    /** @param {{document: Document, scope: LifecycleScope, subtitle: any, dialog: any, ui: any, upload?: any, uploadRecords?: any, uploadEnabled?:()=>boolean}} options */
    constructor(options) { this.options = options; }

    /** @param {{carNum: string, scope?: LifecycleScope, trigger?: HTMLElement, owner?: Element}} movie */
    open(movie) {
        const { document, subtitle, dialog, ui, upload } = this.options;
        const scope = new LifecycleScope("subtitle-workspace");
        const releaseParent = this.options.scope.addCleanup(() => scope.dispose());
        scope.addCleanup(releaseParent);
        if (movie.scope) { const release = movie.scope.addCleanup(() => scope.dispose()); scope.addCleanup(release); }
        if (movie.owner) scope.observe(document.body, () => { if (!movie.owner?.isConnected) scope.dispose(); }, { childList: true, subtree: true });
        const focus = movie.trigger || /** @type {HTMLElement} */ (document.activeElement);
        let index = /** @type {number | null} */ (null), generation = 0;
        /** @type {LifecycleScope | null} */ let searchScope = null;
        const search = async (refreshCache = false) => {
            searchScope?.dispose();
            const current = ++generation;
            const requestScope = new LifecycleScope("subtitle-search");
            searchScope = requestScope;
            const release = scope.addCleanup(() => requestScope.dispose());
            requestScope.addCleanup(release);
            view.reset();
            try { await subtitle.searchAll({ carNum: movie.carNum }, { scope: requestScope, refreshCache, onSource: (/** @type {any} */ result) => { if (!scope.disposed && generation === current) view.update(result); } }); }
            catch (error) { if (!scope.disposed && !requestScope.disposed) view.message(error instanceof Error ? error.message : String(error)); }
        };
        const view = createSubtitleWorkspace({ document, scope, onSearch: () => void search(true), onRecords: this.options.uploadRecords ? trigger => {
            void this.options.uploadRecords({ movie, scope, trigger }).catch((/** @type {unknown} */ error) => { if (!scope.disposed) view.message(error instanceof Error ? error.message : String(error)); });
        } : undefined, onAction: async (record, action, trigger) => {
            if (trigger.disabled) return;
            trigger.disabled = true;
            try {
                const asset = await subtitle.fetchAsset(record.providerId, record, { scope });
                scope.assertActive();
                const filename = subtitleFilename(`${movie.carNum}.${record.language || "sub"}`, asset.extension);
                if (action === "preview") view.showPreview(asset.text, trigger);
                else if (action === "upload") {
                    if (this.options.uploadEnabled?.() === false) throw new TypeError("115 字幕直传已关闭");
                    if (!upload) throw new TypeError("115 字幕上传尚不可用");
                    await upload({ movie, record, asset, filename, scope, owner: view.root, trigger });
                } else {
                    const url = URL.createObjectURL(new Blob([asset.bytes], { type: "application/octet-stream" }));
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = filename;
                    document.body.append(anchor);
                    anchor.click();
                    anchor.remove();
                    const cleanup = scope.addCleanup(() => URL.revokeObjectURL(url));
                    scope.ownTimeout(window.setTimeout(cleanup, 10_000));
                    view.message(`已下载 ${filename}`);
                }
            } catch (error) { if (!scope.disposed) view.message(error instanceof Error ? error.message : String(error)); }
            finally { if (!scope.disposed) trigger.disabled = false; }
        } });
        scope.addCleanup(() => {
            searchScope?.dispose();
            if (index !== null) { const id = index; index = null; dialog.close(id); }
            view.root.remove();
            if (focus?.isConnected) focus.focus({ preventScroll: true });
        });
        const syncUpload = () => view.root.querySelectorAll('[data-subtitle-action="upload"]').forEach(button => { /** @type {HTMLElement} */ (button).hidden = this.options.uploadEnabled?.() === false; });
        scope.observe(view.root, syncUpload, {childList:true,subtree:true});
        scope.listen(document, "jhs-feature-availability-changed", syncUpload);
        view.root.style.display = "none";
        document.body.append(view.root);
        try {
            index = dialog.open({ type: 1, title: `字幕 ${movie.carNum}`, content: ui.jquery(view.root), area: ui.getResponsiveArea(["76%", "82%"]), scrollbar: false, anim: -1, ui: { body: "table" },
                success: (/** @type {any} */ _element, /** @type {number} */ id) => { index = id; ui.setupEscClose(id); void search(); },
                end: () => { index = null; scope.dispose(); },
            });
        } catch (error) { scope.dispose(); throw error; }
        return { close: () => scope.dispose(), root: view.root };
    }
}
