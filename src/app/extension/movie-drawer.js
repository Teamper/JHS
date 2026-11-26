// @ts-check
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { normalizeCarNum, getMovieStateEligibility } from "../../core/movie-identity.js";
import { normalizeStateFlags } from "../../core/state-model.js";
import { assessMagnetQuality } from "../../core/magnet-quality.js";

/** @param {string} tag @param {string} [text] @param {string} [className] @returns {any} */
function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

/** @param {number | undefined | null} sizeMb */
function formatSizeMb(sizeMb) {
    const n = Number(sizeMb);
    if (!Number.isFinite(n) || n <= 0) return "";
    return n >= 1024 ? `${(n / 1024).toFixed(2)} GB` : `${n.toFixed(0)} MB`;
}

/** @param {string} resource */
async function buildReceiptKey(resource) {
    if (!globalThis.crypto?.subtle || !globalThis.TextEncoder) return null;
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(resource));
    const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    return `jhs_offline_receipt_v1:${hex}`;
}

/**
 * In-extension movie workbench drawer / inline detail panel.
 * Aggregates local library record, ratings, remote metadata, screenshots,
 * preview video, multi-source magnets, 115/123 offline submission, subtitles, and reviews.
 */
export class ExtensionMovieDrawer {
    /** @param {{container: HTMLElement, client: any, context: any, mode?: "drawer" | "inline", onMutated?: () => any, onFilterActor?: (name: string) => any, onStatus?: (message: string) => void}} options */
    constructor(options) {
        this.container = options.container;
        this.client = options.client;
        this.context = options.context;
        this.mode = options.mode ?? "drawer";
        this.onMutated = options.onMutated;
        this.onFilterActor = options.onFilterActor;
        this.onStatus = options.onStatus;
        /** @type {LifecycleScope | null} */ this.openScope = null;
        this.openGeneration = 0;
        this.currentCarNum = "";
    }

    isOpen() {
        return Boolean(this.openScope && !this.openScope.disposed && this.container.childElementCount > 0);
    }

    close() {
        this.openGeneration++;
        this.openScope?.dispose();
        this.openScope = null;
        this.currentCarNum = "";
        this.container.replaceChildren();
        this.container.hidden = true;
    }

    /** @param {string | Record<string, any>} input */
    async open(input) {
        /** @type {Record<string, any>} */
        const seed = typeof input === "string" ? { carNum: input } : { ...(input || {}) };
        const carNum = normalizeCarNum(seed.carNum);
        if (!carNum) {
            this.onStatus?.("请输入有效的番号");
            return;
        }
        this.close();
        const generation = ++this.openGeneration;
        const scope = new LifecycleScope(`ext-movie-drawer:${carNum}`);
        this.openScope = scope;
        this.currentCarNum = carNum;
        this.container.hidden = false;

        const isActive = () => generation === this.openGeneration && !scope.disposed;
        const services = this.context.services;
        const settings = services.settings.snapshot();
        const [localRecord, ratings] = await Promise.all([
            this.client.call("state.getState", [carNum]).catch(() => null),
            this.client.call("state.getPersonalRatings").catch(() => ({})),
        ]);
        if (!isActive()) return;

        /** @type {Record<string, any>} */
        const model = {
            carNum,
            title: seed.title || localRecord?.title || localRecord?.names || "",
            originalTitle: seed.originalTitle || "",
            coverUrl: seed.coverUrl || localRecord?.coverUrl || "",
            publishTime: seed.publishTime || localRecord?.publishTime || "",
            remark: localRecord?.remark || "",
            names: localRecord?.names || seed.actress || "",
            url: seed.url || localRecord?.url || "",
            duration: seed.duration || null,
            score: seed.score || 0,
            movieId: seed.movieId || "",
            actors: Array.isArray(seed.actors) ? seed.actors : [],
            imageUrls: Array.isArray(seed.imageUrls) ? seed.imageUrls : [],
            stateFlags: normalizeStateFlags(localRecord?.stateFlags),
            personalRating: ratings?.[carNum]?.rating ?? null,
            pageMagnets: Array.isArray(seed.magnets) ? seed.magnets : [],
            remoteMagnets: /** @type {any[]} */ ([]),
            mediaHits: /** @type {any} */ (null),
            translatedTitle: "",
        };

        const backdrop = this.mode === "drawer" ? el("div", undefined, "jhs-ext-drawer-backdrop") : null;
        const panel = el("aside", undefined, this.mode === "drawer" ? "jhs-ext-drawer jhs-ui" : "jhs-ext-inline-detail jhs-ui");
        panel.setAttribute("role", this.mode === "drawer" ? "dialog" : "region");
        panel.setAttribute("aria-label", `${carNum} 作品详情`);

        if (backdrop) {
            scope.listen(backdrop, "click", () => this.close());
            this.container.append(backdrop);
        }
        this.container.append(panel);

        if (this.mode === "drawer") {
            scope.listen(document, "keydown", (/** @type {Event} */ event) => {
                if (/** @type {KeyboardEvent} */ (event).key === "Escape") this.close();
            });
        }

        // Header
        const header = el("header", undefined, "jhs-ext-drawer__header");
        const titleWrap = el("div", undefined, "jhs-ext-drawer__heading");
        const codeEl = el("h2", carNum, "jhs-ext-drawer__code");
        const subStatus = el("span", "同步元数据中…", "jhs-ext-drawer__status");
        titleWrap.append(codeEl, subStatus);
        const headerActions = el("div", undefined, "jhs-ext-drawer__header-actions");
        const javdbOrigin = services.movie.externalSiteOrigin("javDbBtn", settings) || "https://javdb.com";
        const extLink = el("a", "JavDB", "jhs-btn jhs-btn--ghost jhs-btn--sm");
        extLink.href = model.url && /^https?:\/\//i.test(model.url) ? model.url : `${javdbOrigin}/search?q=${encodeURIComponent(carNum)}&f=all`;
        extLink.target = "_blank";
        extLink.rel = "noopener noreferrer";
        const closeBtn = el("button", "关闭", "jhs-btn jhs-btn--ghost jhs-btn--sm");
        closeBtn.type = "button";
        scope.listen(closeBtn, "click", () => this.close());
        headerActions.append(extLink, closeBtn);
        header.append(titleWrap, headerActions);

        const body = el("div", undefined, "jhs-ext-drawer__body jhs-scrollbar");
        panel.append(header, body);

        // Hero section (cover + title + translation + metadata + state actions + rating + remark)
        const hero = el("section", undefined, "jhs-ext-drawer__hero");
        const coverBox = el("div", undefined, "jhs-ext-drawer__cover-box");
        const renderCover = () => {
            coverBox.replaceChildren();
            if (model.coverUrl) {
                const img = el("img", undefined, "jhs-ext-drawer__cover");
                img.src = model.coverUrl;
                img.alt = carNum;
                img.loading = "lazy";
                scope.listen(img, "click", () => {
                    try { this.context.feedback?.showImageViewer?.(model.coverUrl, carNum); } catch { /* The optional viewer can fail while the cover remains visible. */ }
                });
                coverBox.append(img);
            } else {
                const placeholder = el("div", undefined, "jhs-ext-cover-placeholder");
                placeholder.append(el("span", carNum));
                coverBox.append(placeholder);
            }
        };
        renderCover();

        const metaCol = el("div", undefined, "jhs-ext-drawer__meta");
        const titleEl = el("h3", model.title || carNum, "jhs-ext-drawer__title");
        const translatedEl = el("p", "", "jhs-ext-drawer__translated");
        translatedEl.hidden = true;
        const metaFacts = el("div", undefined, "jhs-ext-drawer__facts");
        const actorsRow = el("div", undefined, "jhs-ext-drawer__actors");
        const mediaBadgeRow = el("div", undefined, "jhs-ext-drawer__media-row");

        const renderMeta = () => {
            titleEl.textContent = model.title || model.originalTitle || carNum;
            if (model.translatedTitle) {
                translatedEl.textContent = model.translatedTitle;
                translatedEl.hidden = false;
            }
            const facts = [];
            if (model.publishTime) facts.push(`发行 ${model.publishTime}`);
            if (model.duration) facts.push(`${model.duration} 分钟`);
            if (model.score) facts.push(`评分 ${model.score}`);
            metaFacts.replaceChildren(...facts.map(item => el("span", item, "jhs-badge jhs-badge--neutral")));

            actorsRow.replaceChildren();
            const actorNames = model.actors.length
                ? model.actors.map((/** @type {any} */ a) => a.name).filter(Boolean)
                : String(model.names || "").split(/\s+/).filter(Boolean);
            for (const name of actorNames.slice(0, 12)) {
                const chip = el("button", name, "jhs-chip jhs-ext-actor-chip");
                chip.type = "button";
                scope.listen(chip, "click", () => {
                    if (this.onFilterActor) {
                        this.onFilterActor(name);
                        if (this.mode === "drawer") this.close();
                    }
                });
                actorsRow.append(chip);
            }

            mediaBadgeRow.replaceChildren();
            if (model.mediaHits?.status === "present" && Array.isArray(model.mediaHits.hits)) {
                for (const hit of model.mediaHits.hits.slice(0, 3)) {
                    const link = el("a", `已入库 · ${hit.serverName || "媒体库"}`, "jhs-badge jhs-badge--success");
                    if (hit.url) {
                        link.href = hit.url;
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";
                    }
                    mediaBadgeRow.append(link);
                }
            }
        };
        renderMeta();

        // Action bar: 4 state flags + translate
        const eligible = getMovieStateEligibility({ carNum }).eligible;
        const stateBar = el("div", undefined, "jhs-ext-drawer__states");
        /** @type {Array<["favorite" | "downloaded" | "watched" | "blocked", string, string]>} */
        const flagDefs = [
            ["favorite", "收藏", "fav"],
            ["downloaded", "已下载", "down"],
            ["watched", "已看", "watch"],
            ["blocked", "屏蔽", "filter"],
        ];
        const flagButtons = new Map();
        const syncFlagButtons = () => {
            for (const [flag, _label, _tone] of flagDefs) {
                const btn = flagButtons.get(flag);
                if (btn) btn.setAttribute("aria-pressed", String(Boolean(model.stateFlags[flag])));
            }
        };
        for (const [flag, label, tone] of flagDefs) {
            const btn = el("button", label, `jhs-btn jhs-btn--sm jhs-ext-flag-btn jhs-ext-flag-btn--${tone}`);
            btn.type = "button";
            btn.disabled = !eligible;
            btn.setAttribute("aria-pressed", String(Boolean(model.stateFlags[flag])));
            scope.listen(btn, "click", async () => {
                btn.disabled = true;
                try {
                    const actorStr = model.actors.length
                        ? model.actors.map((/** @type {any} */ a) => a.name).filter(Boolean).join(" ")
                        : model.names;
                    await this.client.call("state.toggle", [carNum, flag, {
                        metadata: {
                            url: model.url || extLink.href,
                            names: actorStr,
                            publishTime: model.publishTime || "",
                        },
                    }]);
                    if (!isActive()) return;
                    const updated = await this.client.call("state.getState", [carNum]);
                    if (!isActive()) return;
                    model.stateFlags = normalizeStateFlags(updated?.stateFlags);
                    syncFlagButtons();
                    this.onMutated?.();
                } catch (error) {
                    this.onStatus?.(error instanceof Error ? error.message : String(error));
                } finally {
                    if (isActive()) btn.disabled = !eligible;
                }
            });
            flagButtons.set(flag, btn);
            stateBar.append(btn);
        }

        const translateBtn = el("button", "翻译标题", "jhs-btn jhs-btn--ghost jhs-btn--sm");
        translateBtn.type = "button";
        scope.listen(translateBtn, "click", async () => {
            const sourceTitle = model.title || model.originalTitle;
            if (!sourceTitle) return;
            translateBtn.disabled = true;
            translateBtn.textContent = "翻译中…";
            try {
                const result = await services.translation.translateDetailed(sourceTitle, { scope, cacheAlias: carNum });
                if (!isActive()) return;
                model.translatedTitle = result?.text || "";
                renderMeta();
                translateBtn.textContent = "已翻译";
            } catch (error) {
                if (isActive()) {
                    translateBtn.textContent = "翻译失败";
                    this.onStatus?.(error instanceof Error ? error.message : String(error));
                }
            } finally {
                if (isActive()) translateBtn.disabled = false;
            }
        });
        stateBar.append(translateBtn);

        // Personal rating + remark row
        const noteSection = el("div", undefined, "jhs-ext-drawer__notes");
        const ratingBar = el("div", undefined, "jhs-ext-rating-bar");
        ratingBar.append(el("span", "个人评分", "jhs-ext-rating-label"));
        /** @type {HTMLButtonElement[]} */ const starButtons = [];
        const syncStars = () => {
            starButtons.forEach((btn, idx) => {
                const active = model.personalRating != null && idx + 1 <= model.personalRating;
                btn.setAttribute("aria-pressed", String(active));
                btn.textContent = active ? "★" : "☆";
            });
        };
        for (let star = 1; star <= 5; star++) {
            const btn = el("button", "☆", "jhs-btn jhs-btn--ghost jhs-btn--sm jhs-ext-star-btn");
            btn.type = "button";
            btn.setAttribute("aria-label", `评分 ${star} 星`);
            scope.listen(btn, "click", async () => {
                const nextRating = model.personalRating === star ? null : star;
                try {
                    await this.client.call("state.setPersonalRating", [[carNum], nextRating]);
                    if (!isActive()) return;
                    model.personalRating = nextRating;
                    syncStars();
                    this.onMutated?.();
                } catch (error) {
                    this.onStatus?.(error instanceof Error ? error.message : String(error));
                }
            });
            starButtons.push(btn);
            ratingBar.append(btn);
        }
        syncStars();

        const remarkWrap = el("div", undefined, "jhs-ext-remark-wrap");
        const remarkInput = el("input", undefined, "jhs-field jhs-ext-remark-input");
        remarkInput.type = "text";
        remarkInput.placeholder = "添加个人备注或标签…";
        remarkInput.value = model.remark;
        const saveRemarkBtn = el("button", "保存备注", "jhs-btn jhs-btn--secondary jhs-btn--sm");
        saveRemarkBtn.type = "button";
        scope.listen(saveRemarkBtn, "click", async () => {
            saveRemarkBtn.disabled = true;
            try {
                const actorStr = model.actors.length
                    ? model.actors.map((/** @type {any} */ a) => a.name).filter(Boolean).join(" ")
                    : model.names;
                await this.client.call("state.patch", [carNum, {}, {
                    record: {
                        url: model.url || extLink.href,
                        names: actorStr,
                        publishTime: model.publishTime || "",
                        remark: remarkInput.value.trim(),
                    },
                    replaceMetadata: true,
                    type: "history-edit",
                }]);
                if (!isActive()) return;
                model.remark = remarkInput.value.trim();
                saveRemarkBtn.textContent = "已保存";
                setTimeout(() => { if (isActive()) saveRemarkBtn.textContent = "保存备注"; }, 1200);
                this.onMutated?.();
            } catch (error) {
                this.onStatus?.(error instanceof Error ? error.message : String(error));
            } finally {
                if (isActive()) saveRemarkBtn.disabled = false;
            }
        });
        remarkWrap.append(remarkInput, saveRemarkBtn);
        noteSection.append(ratingBar, remarkWrap);

        metaCol.append(titleEl, translatedEl, metaFacts, actorsRow, mediaBadgeRow, stateBar, noteSection);
        hero.append(coverBox, metaCol);

        // Tabs inside drawer: 磁力与离线 / 预览与片花 / 字幕与短评
        const tabBar = el("div", undefined, "jhs-segmented jhs-ext-drawer__tabs");
        const tabBody = el("div", undefined, "jhs-ext-drawer__tab-body");
        let activeTab = "magnets";

        const magnetPane = el("div", undefined, "jhs-ext-drawer__pane");
        const galleryPane = el("div", undefined, "jhs-ext-drawer__pane");
        const extraPane = el("div", undefined, "jhs-ext-drawer__pane");

        /** @param {string} tabId */
        const switchTab = (tabId) => {
            activeTab = tabId;
            for (const btn of tabBar.querySelectorAll("button")) {
                const selected = btn.dataset.tab === tabId;
                btn.classList.toggle("active", selected);
                btn.setAttribute("aria-pressed", String(selected));
            }
            magnetPane.hidden = tabId !== "magnets";
            galleryPane.hidden = tabId !== "gallery";
            extraPane.hidden = tabId !== "extra";
        };
        for (const [id, label] of [["magnets", "磁力与离线"], ["gallery", "预览图与片花"], ["extra", "字幕与短评"]]) {
            const btn = el("button", label, "jhs-btn jhs-segmented__item");
            btn.type = "button";
            btn.dataset.tab = id;
            scope.listen(btn, "click", () => switchTab(id));
            tabBar.append(btn);
        }
        tabBody.append(magnetPane, galleryPane, extraPane);
        switchTab("magnets");
        body.append(hero, tabBar, tabBody);

        // 1) Magnets pane
        let magnetFilter = "all";
        const magnetControls = el("div", undefined, "jhs-ext-magnet-controls");
        const magnetFilterGroup = el("div", undefined, "jhs-ext-chip-group");
        const magnetListEl = el("div", undefined, "jhs-ext-magnet-list");
        const fetchExtraMagnetsBtn = el("button", "搜索第三方磁力", "jhs-btn jhs-btn--secondary jhs-btn--sm");
        fetchExtraMagnetsBtn.type = "button";
        magnetControls.append(magnetFilterGroup, fetchExtraMagnetsBtn);
        magnetPane.append(magnetControls, magnetListEl);

        /** @param {"pan123" | "one115"} integrationId @param {string} resource @param {HTMLButtonElement} btn */
        const submitOffline = async (integrationId, resource, btn) => {
            const providerId = integrationId === "pan123" ? "123" : "115";
            const providerName = integrationId === "pan123" ? "123 云盘" : "115 网盘";
            const originalLabel = btn.textContent || "";
            btn.disabled = true;
            btn.textContent = "提交中…";
            let receiptKey = null;
            let previousReceipt = null;
            try {
                const token = integrationId === "pan123" ? await services.pan123Credential.getStoredToken() : "";
                if (integrationId === "pan123" && !token) throw new Error("请先在 123 云盘网页同步登录授权");
                receiptKey = await buildReceiptKey(resource);
                if (receiptKey) {
                    previousReceipt = await this.client.call("receipts.getRaw", [receiptKey]).catch(() => null);
                    await this.client.call("receipts.write", [receiptKey, "pending", { attemptId: crypto.randomUUID(), providerId }, previousReceipt]);
                }
                await services.offline.submitWithIntegration(integrationId, resource, { ...(token ? { token } : {}), scope });
                if (receiptKey) {
                    await this.client.call("receipts.write", [receiptKey, "submitted", { attemptId: crypto.randomUUID(), providerId }, undefined]).catch(() => {});
                }
                await this.client.call("state.appendOfflineHistory", [{
                    carNum, providerId, providerName, resource, status: "submitted", submissionOutcome: "submitted",
                }]);
                await this.client.call("state.patch", [carNum, { downloaded: true }, {
                    type: "offline-mark-downloaded",
                    record: { url: model.url || extLink.href, names: model.names || "", publishTime: model.publishTime || "" },
                }]);
                if (!isActive()) return;
                model.stateFlags.downloaded = true;
                syncFlagButtons();
                btn.textContent = "已提交";
                this.onStatus?.(`已推送至 ${providerName} 并标记已下载`);
                this.onMutated?.();
            } catch (error) {
                if (receiptKey) {
                    await this.client.call("receipts.write", [receiptKey, "failed", { attemptId: crypto.randomUUID(), providerId }, undefined]).catch(() => {});
                }
                await this.client.call("state.appendOfflineHistory", [{
                    carNum, providerId, providerName, resource, status: "failed",
                    errorMessage: error instanceof Error ? error.message : String(error),
                }]).catch(() => {});
                if (isActive()) {
                    btn.textContent = "重试";
                    this.onStatus?.(error instanceof Error ? error.message : String(error));
                }
            } finally {
                if (isActive()) btn.disabled = false;
                setTimeout(() => { if (isActive() && btn.textContent === "已提交") btn.textContent = originalLabel; }, 2200);
            }
        };

        const renderMagnets = (loadingNote = "") => {
            magnetFilterGroup.replaceChildren();
            for (const [key, label] of [["all", "全部"], ["sub", "中字"], ["hd", "高清"]]) {
                const chip = el("button", label, "jhs-chip");
                chip.type = "button";
                chip.setAttribute("aria-pressed", String(magnetFilter === key));
                scope.listen(chip, "click", () => { magnetFilter = key; renderMagnets(); });
                magnetFilterGroup.append(chip);
            }

            const seen = new Set();
            /** @type {any[]} */
            const merged = [];
            for (const raw of [...model.pageMagnets, ...model.remoteMagnets]) {
                const resource = raw.resource || raw.magnet || (raw.hash ? `magnet:?xt=urn:btih:${raw.hash}&dn=${encodeURIComponent(raw.title || carNum)}` : "");
                if (!resource) continue;
                const dedupeKey = resource.toLowerCase().slice(0, 64);
                if (seen.has(dedupeKey)) continue;
                seen.add(dedupeKey);
                const quality = assessMagnetQuality({
                    title: raw.title,
                    hasHdTag: raw.hasHdTag,
                    hasSubtitleTag: raw.hasSubtitleTag,
                    date: raw.createdAt || raw.date,
                    seeders: raw.seeders,
                });
                merged.push({
                    resource,
                    title: raw.title || carNum,
                    sizeText: raw.sizeText || raw.size || formatSizeMb(raw.sizeMb),
                    date: String(raw.createdAt || raw.date || "").slice(0, 10),
                    source: raw.source || raw.providerId || "page",
                    quality,
                });
            }

            const filtered = merged.filter(item => {
                if (magnetFilter === "sub") return item.quality.subtitle;
                if (magnetFilter === "hd") return item.quality.highQuality;
                return true;
            }).sort((a, b) => b.quality.score.total - a.quality.score.total);

            magnetListEl.replaceChildren();
            if (loadingNote) magnetListEl.append(el("p", loadingNote, "jhs-ext-muted"));
            if (!filtered.length) {
                magnetListEl.append(el("p", loadingNote ? "正在加载磁力资源…" : "暂无匹配磁力，可尝试点击“搜索第三方磁力”。", "jhs-ext-empty"));
                return;
            }
            for (const item of filtered) {
                const row = el("article", undefined, "jhs-ext-magnet-row");
                const info = el("div", undefined, "jhs-ext-magnet-row__info");
                const titleLine = el("div", item.title, "jhs-ext-magnet-row__title");
                const badges = el("div", undefined, "jhs-ext-magnet-row__badges");
                if (item.quality.subtitle) badges.append(el("span", "中字", "jhs-badge jhs-badge--watch"));
                if (item.quality.highQuality) badges.append(el("span", item.quality.resolution ? item.quality.resolution.toUpperCase() : "高清", "jhs-badge jhs-badge--accent"));
                if (item.sizeText) badges.append(el("span", item.sizeText, "jhs-badge jhs-badge--neutral"));
                if (item.date) badges.append(el("span", item.date, "jhs-badge jhs-badge--neutral"));
                badges.append(el("span", `评分 ${item.quality.score.total}`, "jhs-badge jhs-badge--neutral"));
                info.append(titleLine, badges);

                const actions = el("div", undefined, "jhs-ext-magnet-row__actions");
                const copyBtn = el("button", "复制", "jhs-btn jhs-btn--ghost jhs-btn--sm");
                copyBtn.type = "button";
                scope.listen(copyBtn, "click", async () => {
                    await this.context.services.clipboard.copyText("磁力链接", item.resource);
                    copyBtn.textContent = "已复制";
                    setTimeout(() => { if (isActive()) copyBtn.textContent = "复制"; }, 1200);
                });
                const push115 = el("button", "115 离线", "jhs-btn jhs-btn--secondary jhs-btn--sm");
                push115.type = "button";
                scope.listen(push115, "click", () => void submitOffline("one115", item.resource, push115));

                const push123 = el("button", "123 离线", "jhs-btn jhs-btn--primary jhs-btn--sm");
                push123.type = "button";
                scope.listen(push123, "click", () => void submitOffline("pan123", item.resource, push123));

                actions.append(copyBtn, push115, push123);
                row.append(info, actions);
                magnetListEl.append(row);
            }
        };
        renderMagnets("正在查询磁力列表…");

        scope.listen(fetchExtraMagnetsBtn, "click", async () => {
            fetchExtraMagnetsBtn.disabled = true;
            fetchExtraMagnetsBtn.textContent = "检索中…";
            try {
                const sources = (services.magnet.getBuiltInSources?.() || []).filter((/** @type {any} */ s) => s.enabled !== false);
                const settled = await Promise.allSettled(sources.map((/** @type {any} */ source) => services.magnet.searchSource(source.id, carNum, { scope })));
                if (!isActive()) return;
                for (const item of settled) {
                    if (item.status === "fulfilled" && Array.isArray(item.value)) model.remoteMagnets.push(...item.value);
                }
                renderMagnets();
                fetchExtraMagnetsBtn.textContent = "已更新第三方磁力";
            } catch (error) {
                if (isActive()) this.onStatus?.(error instanceof Error ? error.message : String(error));
            } finally {
                if (isActive()) fetchExtraMagnetsBtn.disabled = false;
            }
        });

        // 2) Gallery & Preview pane
        const previewHost = el("div", undefined, "jhs-ext-preview-host");
        const loadPreviewBtn = el("button", "加载 DMM 预览片花", "jhs-btn jhs-btn--secondary jhs-btn--sm");
        loadPreviewBtn.type = "button";
        const galleryGrid = el("div", undefined, "jhs-ext-gallery-grid");
        galleryPane.append(previewHost, galleryGrid);
        previewHost.append(loadPreviewBtn);

        const renderGallery = () => {
            galleryGrid.replaceChildren();
            if (!model.imageUrls.length) {
                galleryGrid.append(el("p", "暂无预览截图。", "jhs-ext-empty"));
                return;
            }
            for (const url of model.imageUrls) {
                const thumbBtn = el("button", undefined, "jhs-ext-gallery-item");
                thumbBtn.type = "button";
                const img = el("img");
                img.src = url;
                img.alt = `${carNum} 预览图`;
                img.loading = "lazy";
                thumbBtn.append(img);
                scope.listen(thumbBtn, "click", () => {
                    try { this.context.feedback?.showImageViewer?.(model.imageUrls, carNum); } catch { /* The optional viewer can fail while the gallery remains usable. */ }
                });
                galleryGrid.append(thumbBtn);
            }
        };
        renderGallery();

        scope.listen(loadPreviewBtn, "click", async () => {
            loadPreviewBtn.disabled = true;
            loadPreviewBtn.textContent = "正在解析片花…";
            try {
                const preview = await services.movie.preview("dmm", { carNum }, { scope });
                if (!isActive()) return;
                const urls = Object.entries(preview?.sources || {});
                if (!urls.length) {
                    loadPreviewBtn.textContent = "未找到可用预览片花";
                    return;
                }
                const best = urls.find(([key]) => /dmb|hd|l/i.test(key)) || urls[0];
                const video = el("video", undefined, "jhs-ext-preview-video");
                video.controls = true;
                video.preload = "metadata";
                video.src = best[1];
                previewHost.replaceChildren(video);
            } catch (error) {
                if (isActive()) {
                    loadPreviewBtn.disabled = false;
                    loadPreviewBtn.textContent = "重试加载片花";
                    this.onStatus?.(error instanceof Error ? error.message : String(error));
                }
            }
        });

        // 3) Extra pane (Subtitles & Reviews)
        const extraActions = el("div", undefined, "jhs-ext-extra-actions");
        const loadSubBtn = el("button", "检索字幕", "jhs-btn jhs-btn--secondary jhs-btn--sm");
        loadSubBtn.type = "button";
        const loadReviewBtn = el("button", "加载热门短评", "jhs-btn jhs-btn--secondary jhs-btn--sm");
        loadReviewBtn.type = "button";
        const extraResults = el("div", undefined, "jhs-ext-extra-results");
        extraActions.append(loadSubBtn, loadReviewBtn);
        extraPane.append(extraActions, extraResults);

        scope.listen(loadSubBtn, "click", async () => {
            loadSubBtn.disabled = true;
            loadSubBtn.textContent = "检索字幕中…";
            try {
                const sources = await services.subtitle.searchAll({ carNum }, { scope });
                if (!isActive()) return;
                extraResults.replaceChildren();
                const items = sources.flatMap((/** @type {any} */ s) => s.records || []);
                if (!items.length) extraResults.append(el("p", "未找到可用字幕", "jhs-ext-empty"));
                for (const sub of items.slice(0, 20)) {
                    const row = el("div", undefined, "jhs-ext-sub-row");
                    row.append(el("span", sub.title || sub.name || carNum), el("span", (sub.extension || sub.language || "").toUpperCase(), "jhs-badge jhs-badge--neutral"));
                    if (sub.url) {
                        const a = el("a", "下载", "jhs-btn jhs-btn--ghost jhs-btn--sm");
                        a.href = sub.url;
                        a.target = "_blank";
                        a.rel = "noopener noreferrer";
                        row.append(a);
                    }
                    extraResults.append(row);
                }
                loadSubBtn.textContent = "刷新字幕";
            } catch (error) {
                if (isActive()) this.onStatus?.(error instanceof Error ? error.message : String(error));
            } finally {
                if (isActive()) loadSubBtn.disabled = false;
            }
        });

        scope.listen(loadReviewBtn, "click", async () => {
            if (!model.movieId) {
                this.onStatus?.("正在等待 JavDB 影片标识解析完成");
                return;
            }
            loadReviewBtn.disabled = true;
            loadReviewBtn.textContent = "加载中…";
            try {
                const reviews = await services.review.list({ movieId: model.movieId, carNum }, { scope });
                if (!isActive()) return;
                extraResults.replaceChildren();
                if (!reviews.length) extraResults.append(el("p", "暂无热门短评", "jhs-ext-empty"));
                for (const rev of reviews.slice(0, 15)) {
                    const card = el("article", undefined, "jhs-ext-review-card");
                    card.append(el("strong", `${rev.author} · ${rev.score || "-"}★ · 👍${rev.likes || 0}`), el("p", rev.content));
                    extraResults.append(card);
                }
                loadReviewBtn.textContent = "刷新短评";
            } catch (error) {
                if (isActive()) this.onStatus?.(error instanceof Error ? error.message : String(error));
            } finally {
                if (isActive()) loadReviewBtn.disabled = false;
            }
        });

        // Async hydration: MediaLibrary + JavDB resolve/detail + native magnets + screenshot fallback
        void (async () => {
            if (services.mediaLibrary?.enabled?.()) {
                try {
                    const mediaHits = await services.mediaLibrary.queryMovie({ carNum }, { scope });
                    if (isActive()) {
                        model.mediaHits = mediaHits;
                        renderMeta();
                    }
                } catch { /* Continue loading movie details when the optional library lookup fails. */ }
            }
            try {
                const resolved = await services.movie.resolve({ carNum, ...(model.movieId ? { movieId: model.movieId, providerId: "javdb" } : {}) }, { scope });
                if (!isActive()) return;
                if (resolved?.movieId) {
                    model.movieId = resolved.movieId;
                    extLink.href = `${javdbOrigin}/v/${encodeURIComponent(resolved.movieId)}`;
                    const [detail, nativeMagnets] = await Promise.all([
                        services.movie.detail(resolved, { scope }).catch(() => null),
                        services.magnet.listNative(resolved, { scope }).catch(() => []),
                    ]);
                    if (!isActive()) return;
                    if (detail) {
                        model.title = detail.title || model.title;
                        model.originalTitle = detail.originalTitle || model.originalTitle;
                        if (detail.coverUrl && !model.coverUrl) { model.coverUrl = detail.coverUrl; renderCover(); }
                        if (detail.releaseDate && !model.publishTime) model.publishTime = detail.releaseDate;
                        if (detail.duration) model.duration = detail.duration;
                        if (detail.score) model.score = detail.score;
                        if (Array.isArray(detail.actors) && detail.actors.length) model.actors = detail.actors;
                        if (Array.isArray(detail.imageUrls) && detail.imageUrls.length) {
                            model.imageUrls = detail.imageUrls;
                            renderGallery();
                        }
                        renderMeta();
                    }
                    if (Array.isArray(nativeMagnets) && nativeMagnets.length) {
                        model.remoteMagnets.push(...nativeMagnets);
                    }
                }
                if (!model.imageUrls.length) {
                    const shots = await services.screenshot.resolve({ carNum, movieId: model.movieId || undefined }, { scope, settings, allowWhenDisabled: true }).catch(() => null);
                    if (isActive() && Array.isArray(shots) && shots.length) {
                        model.imageUrls = shots;
                        renderGallery();
                    }
                }
                if (isActive()) {
                    subStatus.textContent = model.movieId ? "已关联详情数据" : "仅显示本地记录";
                    renderMagnets();
                }
            } catch (error) {
                if (isActive()) {
                    subStatus.textContent = "详情补全受限（保留本地视图）";
                    renderMagnets();
                }
            }
        })();
    }
}
