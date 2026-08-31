// @ts-check

/** Own the image-search dialog, input events, and integration calls. */
export class IdentityImageSearchController {
    /** @param {{dialog: any, storage: any, imageSearch: any, styles?: any, ui?: any, scope: any}} options */
    constructor(options) {
        this.document = globalThis.document;
        this.window = this.document?.defaultView ?? globalThis.window;
        this.dialog = options.dialog;
        this.storage = options.storage;
        this.imageSearch = options.imageSearch;
        this.styles = options.styles;
        this.ui = options.ui ?? null;
        this.scope = options.scope;
        this.started = false;
        this.isUploading = false;
        this.activeDialogId = null;
    }

    getJQuery() {
        const jq = this.ui?.getJQuery?.();
        if (typeof jq !== "function") throw new TypeError("以图识图需要 jQuery");
        return jq;
    }
    getUtils() { return this.ui?.getUtils?.() ?? {}; }
    getShow() { return this.ui?.show ?? {}; }
    getLoading() { return this.ui?.getLoading?.() ?? (() => ({ close() {} })); }
    getClog() { return this.ui?.getClog?.() ?? {}; }

    initCss() {
        return `
            #upload-area {
                border: 2px dashed var(--jhs-status-down);
                border-radius: 8px;
                padding: 40px;
                text-align: center;
                margin-bottom: 20px;
                transition: all 0.3s;
                background-color: var(--jhs-surface-2);
            }
            #upload-area:hover {
                border-color: var(--jhs-status-down-hover);
                background-color: var(--jhs-surface-2);
            }
            #upload-area.highlight {
                border-color: var(--jhs-status-fav);
                background-color: var(--jhs-status-fav-tint);
            }
            #select-image-btn {
                background-color: var(--jhs-status-down);
                color: var(--jhs-status-down-on);
                border: none;
                padding: 10px 20px;
                border-radius: var(--jhs-radius-sm);
                cursor: pointer;
                font-size: 16px;
                transition: background-color 0.3s;
            }
            #select-image-btn:hover { background-color: var(--jhs-status-down-hover); }
            #handle-btn, #cancel-btn {
                padding: 8px 16px;
                border-radius: var(--jhs-radius-sm);
                cursor: pointer;
                font-size: 14px;
                border: none;
                transition: opacity 0.3s;
            }
            #handle-btn { background-color: var(--jhs-status-fav); color: var(--jhs-status-fav-on); }
            #handle-btn:hover { filter: brightness(0.94); }
            #cancel-btn { background-color: var(--jhs-status-filter); color: var(--jhs-status-filter-on); }
            #cancel-btn:hover { filter: brightness(0.94); }
            .search-img-site-btns-container { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; }
            .search-img-site-btn {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                background-color: var(--jhs-surface-2);
                border-radius: var(--jhs-radius-sm);
                text-decoration: none;
                color: var(--jhs-text);
                transition: all 0.2s;
                font-size: 14px;
                border: 1px solid var(--jhs-border);
            }
            .search-img-site-btn:hover { background-color: var(--jhs-border); transform: translateY(-2px); box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .search-img-site-btn img { width: 16px; height: 16px; margin-right: 6px; }
            .search-img-site-btn span { white-space: nowrap; }
        `;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        const removeStyle = this.styles?.register?.("identity-image-search", this.initCss());
        if (typeof removeStyle === "function") this.scope.addCleanup?.(removeStyle);
        this.scope.addCleanup?.(() => this.dispose());
        return Promise.resolve();
    }

    /** @param {(() => void) | undefined} [onReady] */
    open(onReady) {
        this.scope.assertActive();
        const utils = this.getUtils();
        this.activeDialogId = this.dialog.open({
            type: 1,
            title: "以图识图",
            content: `
                <div class="jhs-layout-769fed37">
                    <div id="upload-area">
                        <div class="jhs-layout-9e3c853e"><p>拖拽图片到此处 或 点击按钮选择图片</p><p>也可以直接 Ctrl+V 粘贴图片或 图片URL</p></div>
                        <button class="jhs-btn" id="select-image-btn">选择图片</button>
                        <input type="file" id="image-file" accept="image/*" class="jhs-layout-6b99de8b">
                    </div>
                    <div id="url-input-container" class="jhs-layout-d50e4f09"><input type="text" id="image-url" placeholder="粘贴图片URL地址..." class="jhs-field"></div>
                    <div id="preview-area" class="jhs-layout-d10a577d">
                        <img id="preview-image" alt="" src="" class="jhs-image-preview">
                        <div id="action-btns" class="jhs-layout-06cf30c0"><button class="jhs-btn" id="handle-btn">搜索图片</button><button class="jhs-btn" id="cancel-btn">取消</button></div>
                        <div id="search-results" class="jhs-layout-c8be1ccb"><p class="jhs-layout-9ea2322d">请选择识图网站：<button type="button" id="openAll" class="jhs-btn jhs-btn--ghost">全部打开</button></p><div class="search-img-site-btns-container" id="search-img-site-btns-container"></div></div>
                    </div>
                </div>
            `,
            area: utils?.isMobileMode?.() ? utils.getResponsiveArea() : ["40%", "80%"],
            success: (/** @type {Element} */ _element) => {
                if (!this.scope.disposed) this.initEventListeners(), onReady?.();
            },
            end: () => {
                this.detachPasteListener();
                this.activeDialogId = null;
            },
        });
        return this.activeDialogId;
    }

    initEventListeners() {
        const $ = this.getJQuery(), uploadArea = $("#upload-area"), fileInput = $("#image-file"), selectButton = $("#select-image-btn"), previewArea = $("#preview-area"), previewImage = $("#preview-image"), actionButtons = $("#action-btns"), handleButton = $("#handle-btn"), cancelButton = $("#cancel-btn"), urlContainer = $("#url-input-container"), urlInput = $("#image-url"), results = $("#search-results"), targets = $("#search-img-site-btns-container");
        uploadArea.on("dragover.identityImage", (/** @type {any} */ event) => { event.preventDefault(); uploadArea.addClass("highlight"); });
        uploadArea.on("dragleave.identityImage", () => uploadArea.removeClass("highlight"));
        uploadArea.on("drop.identityImage", (/** @type {any} */ event) => {
            event.preventDefault();
            uploadArea.removeClass("highlight");
            const file = event.originalEvent?.dataTransfer?.files?.[0];
            if (file) this.handleImageFile(file), this.resetSearchUI();
        });
        selectButton.on("click.identityImage", () => fileInput.trigger("click"));
        fileInput.on("change.identityImage", (/** @type {Event} */ event) => {
            const file = /** @type {HTMLInputElement} */ (event.target).files?.[0];
            if (file) this.handleImageFile(file), this.resetSearchUI();
        });
        this.attachPasteListener(urlContainer, urlInput, previewArea, previewImage);
        handleButton.on("click.identityImage", async () => {
            const source = previewImage.attr("src");
            if (!source) return void this.getShow().info?.("请粘贴或上传图片");
            if (this.isUploading) return;
            this.isUploading = true;
            try {
                const result = await this.searchByImage(source);
                if (!result || this.scope.disposed) return;
                actionButtons.hide();
                results.show();
                targets.empty();
                /** @type {Record<string, boolean>} */ let selected = {};
                try { selected = JSON.parse(this.storage.getLocal("jhs_selectedSites") || "{}"); } catch { selected = {}; }
                result.targets.forEach((/** @type {{name: string, url: string, iconUrl: string}} */ target) => {
                    const anchor = $('<a class="search-img-site-btn" target="_blank" rel="noopener noreferrer"></a>').attr({ href: target.url, title: target.name });
                    const checkbox = $('<input type="checkbox" class="site-checkbox jhs-layout-8896c95d">').attr("data-site-name", target.name).prop("checked", selected[target.name] !== false);
                    anchor.append(checkbox, $("<img>").attr({ src: target.iconUrl, alt: target.name }), $("<span></span>").text(target.name));
                    targets.append(anchor);
                });
                targets.on("change.identityImage", ".site-checkbox", (/** @type {Event} */ event) => {
                    const checkbox = $(event.currentTarget), name = checkbox.data("site-name");
                    selected[name] = checkbox.is(":checked");
                    this.storage.setLocal("jhs_selectedSites", JSON.stringify(selected));
                }).show();
            } finally {
                this.isUploading = false;
            }
        });
        cancelButton.on("click.identityImage", () => { previewArea.hide(); urlContainer.hide(); fileInput.val(""); urlInput.val(""); });
        urlInput.on("change.identityImage", () => {
            if (!this.getUtils()?.isUrl?.(urlInput.val())) return;
            previewImage.attr("src", urlInput.val());
            urlContainer.show();
            previewArea.show();
        });
        $("#openAll").on("click.identityImage", () => $(".search-img-site-btn").each((/** @type {number} */ _index, /** @type {Element} */ element) => {
            const item = $(element);
            if (item.find(".site-checkbox").is(":checked")) this.window.open(item.attr("href"));
        }));
    }

    /** @param {any} urlContainer @param {any} urlInput @param {any} previewArea @param {any} previewImage */
    attachPasteListener(urlContainer, urlInput, previewArea, previewImage) {
        const $ = this.getJQuery();
        $(this.document).off("paste.identityImage").on("paste.identityImage", (/** @type {any} */ event) => {
            const items = event.originalEvent?.clipboardData?.items || [];
            for (let index = 0; index < items.length; index++) if (items[index].type.includes("image")) {
                const file = items[index].getAsFile();
                this.handleImageFile(file);
                return void this.resetSearchUI();
            }
            const text = event.originalEvent?.clipboardData?.getData("text");
            if (text && this.getUtils()?.isUrl?.(text)) {
                urlContainer.show();
                urlInput.val(text);
                previewImage.attr("src", text);
                previewArea.show();
                this.resetSearchUI();
            }
        });
    }

    detachPasteListener() { this.getJQuery()?.(this.document).off("paste.identityImage"); }

    resetSearchUI() { const $ = this.getJQuery(); $("#action-btns").show(); $("#search-results").hide(); $("#search-img-site-btns-container").hide().empty(); }

    /** @param {File} file */
    handleImageFile(file) {
        const image = /** @type {HTMLImageElement | null} */ (this.document?.getElementById?.("preview-image")), preview = this.document?.getElementById?.("preview-area"), urlContainer = this.document?.getElementById?.("url-input-container");
        if (!image || !preview || !urlContainer) return;
        if (!file?.type?.match("image.*")) return void this.getShow().info?.("请选择图片文件");
        const Reader = this.window?.FileReader ?? globalThis.FileReader;
        if (!Reader) return;
        const reader = new Reader();
        reader.onload = (event) => {
            image.src = String(event.target?.result || "");
            preview.style.display = "block";
            urlContainer.style.display = "none";
            this.getJQuery()("#handle-btn").get(0)?.click();
        };
        reader.readAsDataURL(file);
    }

    /** @param {string} source */
    async searchByImage(source) {
        const progress = this.getLoading()();
        try {
            if (source.startsWith("data:")) this.getShow().info?.("开始上传图片...");
            this.scope.assertActive();
            return await this.imageSearch.resolve(source, { scope: this.scope });
        } catch (error) {
            this.getShow().error?.(`搜索失败: ${error instanceof Error ? error.message : String(error)}`);
            this.getClog().error?.("搜索失败:", error);
            return null;
        } finally {
            progress?.close?.();
        }
    }

    dispose() {
        this.detachPasteListener();
        if (this.activeDialogId !== null) this.dialog.close?.(this.activeDialogId);
        this.activeDialogId = null;
        this.isUploading = false;
        this.started = false;
    }
}
