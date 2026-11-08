// @ts-check
import { subtitleUploadEnabled } from "../../core/enhancement-controls.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { subtitleFilename } from "../../core/subtitle-asset.js";
import { createSubtitleUploadView } from "../../ui/detail/subtitle-upload.js";

export class SubtitleUploadController {
    /** @param {{document: Document, dialog: any, ui: any, settings: any, matching: any, uploads: any}} options */
    constructor(options) { this.options = options; }

    /** Recovery remains reachable even if the original subtitle source has disappeared. @param {{movie: {carNum: string}, scope: LifecycleScope, trigger: HTMLElement}} input */
    async openRecords(input) {
        const { document, dialog, ui, uploads } = this.options;
        const scope = new LifecycleScope("subtitle-upload-records");
        const release = input.scope.addCleanup(() => scope.dispose());
        scope.addCleanup(release);
        const view = createSubtitleUploadView({ document, scope });
        if (view.filename.parentElement) view.filename.parentElement.hidden = true;
        let index = /** @type {number | null} */ (null);
        const refresh = async () => {
            button.disabled = true;
            try {
                const { accountId } = await uploads.currentAccount({ scope });
                const records = await uploads.records({ accountId, carNum: input.movie.carNum });
                scope.assertActive();
                view.results.replaceChildren();
                for (const record of records) {
                    let current = record;
                    if (["pending", "dispatching"].includes(record.state)) {
                        try { current = await uploads.reconcile(record, { scope }); }
                        catch (error) { current = { ...record, message: error instanceof Error ? error.message : String(error) }; }
                    }
                    scope.assertActive();
                    view.result(`目录 ${current.folderId} · ${current.filename} · ${current.message}`);
                }
                view.message(records.length ? "当前账号上传记录已读取，待确认项已核对远端" : "当前账号暂无该影片的上传记录");
            } catch (error) { if (!scope.disposed) view.message(error instanceof Error ? error.message : String(error)); }
            finally { if (!scope.disposed) button.disabled = false; }
        };
        const button = view.button("重新核对", () => void refresh());
        scope.addCleanup(() => { if (index !== null) { const id = index; index = null; dialog.close(id); } view.root.remove(); if (input.trigger.isConnected) input.trigger.focus({ preventScroll: true }); });
        view.root.style.display = "none";
        document.body.append(view.root);
        try {
            index = dialog.open({ type: 1, title: `字幕上传记录 ${input.movie.carNum}`, content: ui.jquery(view.root), area: ui.getResponsiveArea(["70%", "76%"]), scrollbar: false, anim: -1, ui: { body: "table" },
                success: (/** @type {any} */ _root, /** @type {number} */ id) => { index = id; ui.setupEscClose(id); void refresh(); }, end: () => { index = null; scope.dispose(); },
            });
        } catch (error) { scope.dispose(); throw error; }
    }

    /** @param {{movie: {carNum: string}, asset: any, filename: string, scope: LifecycleScope, trigger: HTMLElement}} input */
    async open(input) {
        const { document, dialog, ui, settings, matching, uploads } = this.options;
        if (![true, "yes", "true"].includes(settings.snapshot().enable115Match)) throw new TypeError("请先在设置中启用 115 匹配并登录账号");
        if (!subtitleUploadEnabled(settings.snapshot())) throw new TypeError("115 字幕直传已关闭");
        const unavailable = uploads.availability();
        if (unavailable) throw new TypeError(unavailable);
        const scope = new LifecycleScope("subtitle-upload");
        scope.listen(settings, "settings.changed", () => {
            if (!subtitleUploadEnabled(settings.snapshot())) scope.dispose();
        });
        const releaseParent = input.scope.addCleanup(() => scope.dispose());
        scope.addCleanup(releaseParent);
        const view = createSubtitleUploadView({ document, scope });
        view.filename.value = input.filename;
        let index = /** @type {number | null} */ (null), continuation = /** @type {any} */ (null), running = false, previewed = "";
        /** @type {any[]} */ let allMatches = [];
        const load = async () => {
            loadMore.disabled = true;
            try {
                const result = await matching.matchMovie({ carNum: input.movie.carNum }, { scope, continuation, force: !continuation });
                scope.assertActive();
                allMatches = result.matches;
                continuation = result.continuation;
                view.add(result.matches);
                view.message(`${result.complete ? "匹配完成" : "结果未完整，可继续加载"} · ${new Set(result.matches.map((/** @type {any} */ match) => match.folderId)).size} 个目录。同名文件默认跳过。`);
                loadMore.hidden = result.complete;
                preview.disabled = !result.matches.length;
            } catch (error) { if (!scope.disposed) view.message(error instanceof Error ? error.message : String(error)); }
            finally { if (!scope.disposed) loadMore.disabled = false; }
        };
        const loadMore = view.button("继续加载匹配目录", () => void load());
        const preview = view.button("预览上传范围", () => {
            const selected = view.selected();
            const filename = view.filename.value.trim();
            if (!selected.length) return view.message("请勾选目标目录");
            if (subtitleFilename(filename, input.asset.extension) !== filename) return view.message("文件名含无效字符或扩展名不一致");
            previewed = JSON.stringify([filename, selected.map(item => [item.accountId, item.folderId])]);
            view.results.replaceChildren();
            for (const match of selected) view.result(`目录 ${match.folderId} · ${match.name} → ${filename}`);
            view.message(`确认后向 ${selected.length} 个目录逐项上传，文件 ${(input.asset.size / 1024).toFixed(1)} KiB`);
            confirm.hidden = false;
        });
        const confirm = view.button("确认上传至所选目录", async () => {
            if (running) return;
            const selected = view.selected(), filename = view.filename.value.trim();
            if (previewed !== JSON.stringify([filename, selected.map(item => [item.accountId, item.folderId])])) { confirm.hidden = true; return view.message("范围或文件名已变更，请重新预览"); }
            running = true;
            view.lock();
            confirm.disabled = preview.disabled = loadMore.disabled = true;
            for (const match of selected) {
                if (scope.disposed || !subtitleUploadEnabled(settings.snapshot())) break;
                try {
                    const result = await uploads.submit({ carNum: input.movie.carNum, accountId: match.accountId, folderId: match.folderId, filename, bytes: input.asset.bytes }, { scope });
                    if (!scope.disposed) view.result(`目录 ${match.folderId} · ${result.message}`);
                } catch (error) { if (!scope.disposed) view.result(`目录 ${match.folderId} · ${error instanceof Error ? error.message : String(error)}`); }
            }
            if (!scope.disposed) { view.message("本次提交已结算。待确认项可核对远端，原请求不会重复发送。"); recover.disabled = false; }
        });
        const recover = view.button("核对待确认记录", async () => {
            recover.disabled = true;
            try {
                const accountId = allMatches[0]?.accountId;
                if (!accountId) throw new TypeError("请先确认当前账号与目录");
                const records = await uploads.records({ carNum: input.movie.carNum, accountId });
                for (const record of records.filter((/** @type {any} */ item) => ["pending", "dispatching"].includes(item.state))) {
                    const result = await uploads.reconcile(record, { scope });
                    if (!scope.disposed) view.result(`目录 ${result.folderId} · ${result.filename} · ${result.message}`);
                }
                if (!scope.disposed) view.message("待确认记录核对完成");
            } catch (error) { if (!scope.disposed) view.message(error instanceof Error ? error.message : String(error)); }
            finally { if (!scope.disposed) recover.disabled = false; }
        });
        preview.disabled = true;
        confirm.hidden = true;
        scope.addCleanup(() => { if (index !== null) { const id = index; index = null; dialog.close(id); } view.root.remove(); if (input.trigger.isConnected) input.trigger.focus({ preventScroll: true }); });
        view.root.style.display = "none";
        document.body.append(view.root);
        try {
            index = dialog.open({ type: 1, title: `字幕上传 ${input.movie.carNum}`, content: ui.jquery(view.root), area: ui.getResponsiveArea(["70%", "76%"]), scrollbar: false, anim: -1, ui: { body: "table" },
                success: (/** @type {any} */ _root, /** @type {number} */ id) => { index = id; ui.setupEscClose(id); void load(); },
                end: () => { index = null; scope.dispose(); },
            });
        } catch (error) { scope.dispose(); throw error; }
    }
}
