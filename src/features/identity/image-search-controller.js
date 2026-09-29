// @ts-check

import { LifecycleScope } from "../../core/lifecycle-scope.js";

const SELECTED_SITES_KEY = "jhs_selectedSites";

export const IMAGE_SEARCH_CSS = `
.jhs-image-search__upload { border:2px dashed var(--jhs-status-down); border-radius:8px; padding:32px 20px; text-align:center; margin-bottom:16px; background:var(--jhs-surface-2); }
.jhs-image-search__upload.highlight { border-color:var(--jhs-status-fav); background:var(--jhs-status-fav-tint); }
.jhs-image-search__preview { display:flex; flex-direction:column; align-items:center; gap:12px; }
.jhs-image-search__preview-image { display:block; max-width:100%; max-height:360px; object-fit:contain; }
.jhs-image-search__actions { display:flex; flex-wrap:wrap; gap:8px; }
.jhs-image-search__results { margin-top:16px; }
.jhs-image-search__results-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.jhs-image-search__targets { display:flex; flex-wrap:wrap; gap:10px; margin-top:12px; }
.jhs-image-search__target { display:flex; align-items:center; gap:8px; padding:8px 12px; background:var(--jhs-surface-2); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); color:var(--jhs-text); }
.jhs-image-search__target a { display:flex; align-items:center; gap:6px; color:inherit; text-decoration:none; }
.jhs-image-search__target a:hover { text-decoration:underline; }
.jhs-image-search__target img { width:16px; height:16px; }
.jhs-image-search__file { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); }
.jhs-image-search [hidden] { display:none !important; }
`;

const DIALOG_CONTENT = `
<div class="jhs-image-search jhs-ui">
  <div class="jhs-image-search__upload" data-role="upload-area">
    <p>拖拽图片到此处或点击按钮选择图片</p>
    <p>也可以直接 Ctrl+V 粘贴图片或图片 URL</p>
    <button type="button" class="jhs-btn" data-action="select-image">选择图片</button>
    <input type="file" accept="image/*" class="jhs-image-search__file" data-role="image-file">
  </div>
  <div data-role="url-input-container">
    <input type="url" placeholder="粘贴图片 URL 地址..." class="jhs-field" data-role="image-url">
  </div>
  <section class="jhs-image-search__preview" data-role="preview" hidden>
    <img class="jhs-image-search__preview-image" alt="" data-role="preview-image">
    <div class="jhs-image-search__actions" data-role="actions">
      <button type="button" class="jhs-btn jhs-btn--primary" data-action="search">搜索图片</button>
      <button type="button" class="jhs-btn jhs-btn--secondary" data-action="cancel">取消</button>
    </div>
    <div class="jhs-image-search__results" data-role="results" hidden>
      <div class="jhs-image-search__results-heading"><span>请选择识图网站：</span><button type="button" class="jhs-btn jhs-btn--ghost" data-action="open-all">全部打开</button></div>
      <div class="jhs-image-search__targets" data-role="targets"></div>
    </div>
  </section>
</div>`;

/** Own the image-search dialog and its temporary DOM, requests, and event listeners. */
export class ImageSearchController {
    /** @param {{document: Document, window: Window, dialog: {open: (options: Record<string, unknown>) => number, close: (id: number) => void}, storage: {getLocal: (key: string) => string | null, setLocal: (key: string, value: string) => void}, imageSearch: {resolve: (source: string, options?: {scope?: LifecycleScope}) => Promise<{imageUrl: string, targets: Array<{id: string, name: string, url: string, iconUrl: string}>}>}, notifications: {info?: (message: string) => void, error?: (message: string) => void}, settings: {snapshot: () => Record<string, unknown>}, onError?: (error: unknown) => void}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.dialog = options.dialog;
        this.storage = options.storage;
        this.imageSearch = options.imageSearch;
        this.notifications = options.notifications;
        this.settings = options.settings;
        this.onError = options.onError ?? null;
        /** @type {LifecycleScope | null} */
        this.featureScope = null;
        /** @type {any} */
        this.session = null;
        this.disposed = false;
    }

    /** @param {LifecycleScope} scope */
    start(scope) {
        scope.assertActive();
        if (this.disposed) return false;
        this.featureScope = scope;
        scope.addCleanup(() => this.dispose());
        return true;
    }

    /** @param {{file?: File | null}} [options] */
    open(options = {}) {
        if (this.disposed || !this.featureScope || this.featureScope.disposed) return false;
        this.close();
        const session = {
            scope: new LifecycleScope("identity.image-search.dialog"),
            root: /** @type {HTMLElement | null} */ (null),
            dialogId: /** @type {number | null} */ (null),
            source: "",
            generation: 0,
            searching: false,
            reader: /** @type {FileReader | null} */ (null),
            requestScope: /** @type {LifecycleScope | null} */ (null),
            releaseFeatureCleanup: /** @type {(() => void) | null} */ (null),
        };
        this.session = session;
        session.scope.addCleanup(() => session.requestScope?.dispose());
        session.scope.addCleanup(() => {
            if (session.reader?.readyState === 1) session.reader.abort();
            session.reader = null;
        });
        session.releaseFeatureCleanup = this.featureScope.addCleanup(() => {
            if (this.session === session) this.close();
        });
        try {
            const dialogId = this.dialog.open({
                type: 1,
                title: "以图识图",
                content: DIALOG_CONTENT,
                area: this.getResponsiveArea(),
                success: (/** @type {any} */ layerRoot) => this.mount(session, layerRoot),
                end: () => this.finishSession(session),
            });
            session.dialogId = dialogId;
            if (options.file) this.handleImageFile(options.file, session);
            return true;
        } catch (error) {
            this.finishSession(session);
            this.onError?.(error);
            this.notifications.error?.(`以图识图弹窗打开失败: ${messageOf(error)}`);
            return false;
        }
    }

    getResponsiveArea() {
        const width = this.window.innerWidth;
        const mode = this.settings.snapshot().mobileMode;
        const mobileDevice = /iphone|ipod|ipad|android|blackberry|windows phone|nokia|webos|opera mini|mobile|mobi|tablet/i.test(this.window.navigator.userAgent);
        const mobile = mode === "on" || (mode !== "off" && (mobileDevice || width < 768));
        return mobile ? ["100%", "90%"] : width >= 1200 ? ["40%", "80%"] : ["70%", "90%"];
    }

    /** @param {any} session @param {any} layerRoot */
    mount(session, layerRoot) {
        if (!this.isCurrent(session)) return;
        const element = layerRoot?.[0] ?? layerRoot;
        session.root = element?.querySelector?.(".jhs-image-search") ?? this.document.querySelector(".jhs-image-search");
        if (!session.root) return;
        const root = session.root;
        const on = (/** @type {EventTarget | null} */ target, /** @type {string} */ type, /** @type {(event: any) => void} */ listener) => {
            if (target) session.scope.listen(target, type, listener);
        };
        const role = (/** @type {string} */ name) => root.querySelector(`[data-role="${name}"]`);
        const action = (/** @type {string} */ name) => root.querySelector(`[data-action="${name}"]`);
        const fileInput = /** @type {HTMLInputElement | null} */ (role("image-file"));
        const urlInput = /** @type {HTMLInputElement | null} */ (role("image-url"));
        const upload = /** @type {HTMLElement} */ (role("upload-area"));

        on(action("select-image"), "click", () => fileInput?.click());
        on(fileInput, "change", (/** @type {Event} */ event) => {
            const input = /** @type {HTMLInputElement} */ (event.currentTarget);
            if (input.files?.[0]) this.handleImageFile(input.files[0], session);
            input.value = "";
        });
        on(upload, "dragover", (/** @type {DragEvent} */ event) => { event.preventDefault(); upload.classList.add("highlight"); });
        on(upload, "dragleave", () => upload.classList.remove("highlight"));
        on(upload, "drop", (/** @type {DragEvent} */ event) => {
            event.preventDefault();
            upload.classList.remove("highlight");
            const file = event.dataTransfer?.files?.[0];
            if (file) this.handleImageFile(file, session);
        });
        on(this.document, "paste", (/** @type {ClipboardEvent} */ event) => this.handlePaste(event, session));
        on(urlInput, "change", () => {
            const value = urlInput?.value.trim() ?? "";
            if (!value) return;
            if (!isHttpUrl(value)) return this.notifications.info?.("请输入有效的 HTTP/HTTPS 图片 URL");
            this.setPreview(value, session, false);
        });
        on(action("search"), "click", () => { void this.runSearch(session); });
        on(action("cancel"), "click", () => this.resetSearchUI(session));
        on(action("open-all"), "click", () => this.openSelectedTargets(session));
        on(role("targets"), "change", (/** @type {Event} */ event) => {
            const target = event.target;
            const checkbox = target instanceof Element && target.matches('input[type="checkbox"]') ? /** @type {HTMLInputElement} */ (target) : null;
            if (!checkbox) return;
            this.persistSelection(checkbox.dataset.siteName ?? "", checkbox.checked);
        });
    }

    /** @param {ClipboardEvent} event @param {any} session */
    handlePaste(event, session) {
        const items = event.clipboardData?.items ?? [];
        for (const item of items) {
            if (!item.type.includes("image")) continue;
            const file = item.getAsFile();
            if (file) this.handleImageFile(file, session);
            return;
        }
        const text = event.clipboardData?.getData("text")?.trim() ?? "";
        if (isHttpUrl(text)) {
            const input = /** @type {HTMLInputElement | null} */ (session.root?.querySelector('[data-role="image-url"]'));
            if (input) input.value = text;
            this.setPreview(text, session, false);
        }
    }

    /** @param {File} file @param {any} session */
    handleImageFile(file, session = this.session) {
        if (!session || !this.isCurrent(session)) return;
        if (!/^image\//i.test(file.type)) return void this.notifications.info?.("请选择图片文件");
        session.reader?.abort();
        const reader = new FileReader();
        session.reader = reader;
        reader.onload = () => {
            if (!this.isCurrent(session) || session.reader !== reader) return;
            const source = String(reader.result ?? "");
            if (!source.startsWith("data:image/")) return void this.notifications.info?.("无法读取图片文件");
            this.setPreview(source, session, true);
        };
        reader.onerror = () => {
            if (this.isCurrent(session)) this.notifications.error?.("读取图片失败");
        };
        reader.readAsDataURL(file);
    }

    /** @param {string} source @param {any} session @param {boolean} search */
    setPreview(source, session, search) {
        if (!this.isCurrent(session)) return;
        session.requestScope?.dispose();
        session.requestScope = null;
        session.generation += 1;
        session.source = source;
        const root = session.root;
        const preview = root?.querySelector('[data-role="preview"]');
        const image = /** @type {HTMLImageElement | null} */ (root?.querySelector('[data-role="preview-image"]'));
        const urlContainer = root?.querySelector('[data-role="url-input-container"]');
        if (!image || !preview) return;
        image.src = source;
        preview.hidden = false;
        if (urlContainer) urlContainer.hidden = source.startsWith("data:");
        if (search) void this.runSearch(session);
        else this.resetSearchUI(session, false);
    }

    /** @param {any} session @param {boolean} clearSource */
    resetSearchUI(session = this.session, clearSource = true) {
        if (!session || !this.isCurrent(session)) return;
        session.generation += 1;
        session.requestScope?.dispose();
        session.requestScope = null;
        session.searching = false;
        if (clearSource) session.source = "";
        const root = session.root;
        const image = /** @type {HTMLImageElement | null} */ (root?.querySelector('[data-role="preview-image"]'));
        if (clearSource && image) image.removeAttribute("src");
        const preview = root?.querySelector('[data-role="preview"]');
        const actions = root?.querySelector('[data-role="actions"]');
        const results = root?.querySelector('[data-role="results"]');
        const targets = root?.querySelector('[data-role="targets"]');
        const urlContainer = root?.querySelector('[data-role="url-input-container"]');
        const urlInput = /** @type {HTMLInputElement | null} */ (root?.querySelector('[data-role="image-url"]'));
        const searchButton = /** @type {HTMLButtonElement | null} */ (root?.querySelector('[data-action="search"]'));
        if (clearSource) {
            if (preview) preview.hidden = true;
            if (urlContainer) urlContainer.hidden = false;
            if (urlInput) urlInput.value = "";
        }
        if (actions) actions.hidden = false;
        if (results) results.hidden = true;
        if (targets) targets.replaceChildren();
        if (searchButton) { searchButton.disabled = false; searchButton.removeAttribute("aria-busy"); searchButton.textContent = "搜索图片"; }
    }

    /** @param {any} session */
    async runSearch(session = this.session) {
        if (!session || !this.isCurrent(session) || !session.source || session.searching) return;
        const generation = session.generation;
        const source = session.source;
        const requestScope = new LifecycleScope("identity.image-search.request");
        session.requestScope = requestScope;
        session.searching = true;
        const searchButton = /** @type {HTMLButtonElement | null} */ (session.root?.querySelector('[data-action="search"]'));
        if (searchButton) { searchButton.disabled = true; searchButton.setAttribute("aria-busy", "true"); searchButton.textContent = "搜索中..."; }
        try {
            if (source.startsWith("data:")) this.notifications.info?.("开始上传图片...");
            const result = await this.imageSearch.resolve(source, { scope: requestScope });
            if (!this.isCurrent(session) || generation !== session.generation || requestScope.disposed) return;
            const targets = /** @type {HTMLElement | null} */ (session.root?.querySelector('[data-role="targets"]'));
            const actions = /** @type {HTMLElement | null} */ (session.root?.querySelector('[data-role="actions"]'));
            const results = /** @type {HTMLElement | null} */ (session.root?.querySelector('[data-role="results"]'));
            if (!targets || !results) return;
            targets.replaceChildren();
            const selections = this.readSelections();
            for (const target of result.targets) targets.append(this.createTarget(target, selections));
            if (actions) actions.hidden = true;
            results.hidden = false;
        } catch (error) {
            if (this.isCurrent(session) && generation === session.generation && !isAbort(error)) {
                this.notifications.error?.(`搜索失败: ${messageOf(error)}`);
                this.onError?.(error);
            }
        } finally {
            if (session.requestScope === requestScope) {
                session.requestScope = null;
                requestScope.dispose();
            }
            if (this.isCurrent(session) && generation === session.generation) {
                session.searching = false;
                if (searchButton) { searchButton.disabled = false; searchButton.removeAttribute("aria-busy"); searchButton.textContent = "搜索图片"; }
            }
        }
    }

    /** @param {{id: string, name: string, url: string, iconUrl: string}} target @param {Record<string, boolean>} selections */
    createTarget(target, selections) {
        const item = this.document.createElement("div");
        item.className = "jhs-image-search__target";
        const checkbox = this.document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selections[target.name] !== false;
        checkbox.dataset.siteName = target.name;
        checkbox.setAttribute("aria-label", `选择 ${target.name}`);
        const link = this.document.createElement("a");
        link.href = safeExternalUrl(target.url);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.title = target.name;
        const icon = this.document.createElement("img");
        icon.src = safeExternalUrl(target.iconUrl);
        icon.alt = "";
        icon.loading = "lazy";
        const label = this.document.createElement("span");
        label.textContent = target.name;
        link.append(icon, label);
        item.append(checkbox, link);
        return item;
    }

    /** @param {any} session */
    openSelectedTargets(session) {
        for (const checkbox of session.root?.querySelectorAll('[data-role="targets"] input[type="checkbox"]') ?? []) {
            if (!checkbox.checked) continue;
            const url = checkbox.closest(".jhs-image-search__target")?.querySelector("a")?.href;
            if (url) this.window.open(url, "_blank", "noopener");
        }
    }

    readSelections() {
        try {
            const parsed = JSON.parse(this.storage.getLocal(SELECTED_SITES_KEY) || "{}");
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch (error) {
            this.onError?.(error);
            return {};
        }
    }

    /** @param {string} name @param {boolean} selected */
    persistSelection(name, selected) {
        if (!name) return;
        try {
            const selections = this.readSelections();
            selections[name] = selected;
            this.storage.setLocal(SELECTED_SITES_KEY, JSON.stringify(selections));
        } catch (error) {
            this.onError?.(error);
            this.notifications.error?.("无法保存识图网站选择");
        }
    }

    /** @param {any} session */
    isCurrent(session) { return !this.disposed && this.session === session && !session.scope.disposed; }

    /** @param {any} session */
    finishSession(session) {
        session.releaseFeatureCleanup?.();
        session.releaseFeatureCleanup = null;
        if (!session.scope.disposed) session.scope.dispose();
        if (this.session === session) this.session = null;
    }

    close() {
        const session = this.session;
        if (!session) return;
        const dialogId = session.dialogId;
        this.finishSession(session);
        if (dialogId !== null) this.dialog.close(dialogId);
    }

    dispose() {
        if (this.disposed) return;
        this.close();
        this.disposed = true;
        this.featureScope = null;
    }
}

/** @param {string} value */
function isHttpUrl(value) {
    try { return ["http:", "https:"].includes(new URL(value).protocol); }
    catch { return false; }
}

/** @param {unknown} value */
function safeExternalUrl(value) {
    const url = new URL(String(value));
    if (!["http:", "https:"].includes(url.protocol)) throw new TypeError("以图识图目标必须使用 HTTP/HTTPS URL");
    return url.href;
}

/** @param {unknown} error */
function messageOf(error) { return error instanceof Error ? error.message : String(error); }

/** @param {unknown} error */
function isAbort(error) { return error instanceof DOMException && error.name === "AbortError" || /** @type {any} */ (error)?.code === "ABORTED"; }
