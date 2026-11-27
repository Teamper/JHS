// @ts-check
import { normalizeCarNum, getMovieStateEligibility } from "../../core/movie-identity.js";
import { hasAnyState, normalizeStateFlags } from "../../core/state-model.js";
import { parseBooleanSetting, parseCarNumberText } from "../../core/feature-helpers.js";
import { computeLibraryStats } from "../../features/system/stats-model.js";
import { isMissingActorSource } from "../../features/discovery/actor-source-health.js";
import { formatUiDateTime } from "../../core/ui-date-time.js";
import { ExternalUrlPolicy } from "../../services/external-url-policy.js";

/** @param {string} tag @param {string} [text] @param {string} [className] @returns {any} */
export function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

/** @param {string} text @param {() => any} action @param {string} [variant] @returns {HTMLButtonElement} */
export function actionButton(text, action, variant = "ghost") {
    const node = el("button", text, `jhs-btn jhs-btn--${variant} jhs-extension-button`);
    node.type = "button";
    node.addEventListener("click", () => { void action(); });
    return node;
}

/** @param {string} carNum */
function getCarPrefix(carNum) {
    const idx = String(carNum || "").indexOf("-");
    return idx > 0 ? carNum.slice(0, idx + 1) : String(carNum || "").slice(0, 4);
}

/** @param {string} carNum @param {string} [coverUrl] @param {string} [title] */
function createPosterNode(carNum, coverUrl, title = "") {
    if (coverUrl) {
        const img = el("img", undefined, "jhs-ext-poster-img");
        img.src = coverUrl;
        img.alt = title || carNum;
        img.loading = "lazy";
        return img;
    }
    const placeholder = el("div", undefined, "jhs-ext-poster-fallback");
    placeholder.append(
        el("span", getCarPrefix(carNum).replace(/-$/, ""), "jhs-ext-poster-fallback__prefix"),
        el("strong", carNum, "jhs-ext-poster-fallback__code"),
    );
    return placeholder;
}

/** @param {any} app @param {string} message @param {string} [title] @returns {Promise<boolean>} */
function confirmAction(app, message, title = "确认操作") {
    return new Promise(resolve => {
        const dialog = app.context?.services?.dialog;
        if (!dialog?.confirm) {
            resolve(globalThis.confirm?.(message) ?? false);
            return;
        }
        let settled = false;
        const finish = (/** @type {boolean} */ value) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        dialog.confirm(message, {
            title,
            confirmText: "确定",
            cancelText: "取消",
            tone: "danger",
            ui: { size: "sm", body: "scroll" },
            end: () => finish(false),
        }, (/** @type {number} */ id) => {
            finish(true);
            dialog.close(id);
        }, () => finish(false));
    });
}

/**
 * Render the Library Workbench view in Manager App.
 * @param {HTMLElement} host
 * @param {any} app
 */
export async function renderLibraryView(host, app) {
    const version = app.nextVersion();
    const [records, ratings, actresses] = await Promise.all([
        app.client.call("state.getCarList"),
        app.client.call("state.getPersonalRatings").catch(() => ({})),
        app.client.call("state.getFavoriteActressList").catch(() => []),
    ]);
    if (!app.isCurrentVersion(version)) return;

    const knownCoverMap = new Map(app.coverCache);
    for (const actress of actresses || []) {
        for (const item of actress.newVideoList || []) {
            const code = normalizeCarNum(typeof item === "string" ? item : item?.carNum);
            if (code && item?.coverUrl && !knownCoverMap.has(code)) {
                knownCoverMap.set(code, { coverUrl: item.coverUrl, title: item.title || "", publishTime: item.publishTime || "" });
            }
        }
    }

    const enriched = (records || []).map((/** @type {any} */ record) => {
        const code = normalizeCarNum(record.carNum) || String(record.carNum || "");
        const cached = knownCoverMap.get(code);
        const flags = normalizeStateFlags(record.stateFlags);
        const personalRating = ratings?.[code]?.rating ?? null;
        return {
            ...record,
            carNum: code,
            stateFlags: flags,
            titleText: record.title || cached?.title || "",
            coverUrl: record.coverUrl || cached?.coverUrl || "",
            publishTime: record.publishTime || cached?.publishTime || "",
            personalRating,
        };
    });

    const stats = computeLibraryStats(enriched);
    const ratedCount = enriched.filter((/** @type {any} */ r) => r.personalRating != null).length;

    host.replaceChildren();
    const scope = app.resetViewScope("library");

    // Page header
    const heading = el("div", undefined, "jhs-extension-section-heading");
    const titleGroup = el("div", undefined, "jhs-ext-title-group");
    titleGroup.append(el("h1", "作品库"), el("span", `共 ${stats.total} 部作品`, "jhs-ext-subtitle"));
    const headerTools = el("div", undefined, "jhs-ext-toolbar-actions");

    const viewToggle = el("div", undefined, "jhs-segmented");
    const gridBtn = el("button", "海报墙", "jhs-btn jhs-segmented__item");
    gridBtn.type = "button";
    const listBtn = el("button", "紧凑列表", "jhs-btn jhs-segmented__item");
    listBtn.type = "button";
    viewToggle.append(gridBtn, listBtn);

    const importCodesBtn = actionButton("番号批量导入", () => openBatchImportDialog(app), "secondary");
    const openHistoryBtn = actionButton("打开鉴定记录", () => app.openInlineCommand("library.history.open"), "secondary");
    headerTools.append(viewToggle, importCodesBtn, openHistoryBtn);
    heading.append(titleGroup, headerTools);

    // KPI Filter strip
    const kpiStrip = el("div", undefined, "jhs-ext-kpi-grid");
    /** @type {Array<[string, string, number, string]>} */
    const kpis = [
        ["all", "全部作品", stats.total, "neutral"],
        ["favorite", "已收藏", stats.favoriteRaw, "fav"],
        ["downloaded", "已下载", stats.downloadedRaw, "down"],
        ["watched", "已观看", stats.watchedRaw, "watch"],
        ["pending", "待鉴定", stats.pending, "neutral"],
        ["rated", "已评分", ratedCount, "accent"],
        ["blocked", "已屏蔽", stats.blocked, "filter"],
    ];

    // Toolbar: search + status + sort + prefix chips
    const filterBar = el("div", "", "jhs-ext-filter-bar");
    const searchInput = el("input", "", "jhs-field jhs-ext-search-input");
    searchInput.type = "search";
    searchInput.placeholder = "搜索番号、标题、演员或备注";
    searchInput.setAttribute("aria-label", "搜索作品");
    searchInput.value = app.libraryState.query;

    const statusSelect = el("select", undefined, "jhs-field jhs-ext-select");
    statusSelect.setAttribute("aria-label", "筛选作品状态");
    for (const [val, label] of [["all", "全部状态"], ["favorite", "已收藏"], ["downloaded", "已下载"], ["watched", "已观看"], ["pending", "待鉴定"], ["rated", "已评分"], ["unrated", "未评分"], ["blocked", "已屏蔽"]]) {
        const opt = el("option", label);
        opt.value = val;
        statusSelect.append(opt);
    }
    statusSelect.value = app.libraryState.status;

    const sortSelect = el("select", undefined, "jhs-field jhs-ext-select");
    sortSelect.setAttribute("aria-label", "排序方式");
    for (const [val, label] of [["updateDate:desc", "最近更新"], ["createDate:desc", "最近入库"], ["publishTime:desc", "发行日期 新→旧"], ["rating:desc", "个人评分 高→低"], ["carNum:asc", "番号 A→Z"], ["carNum:desc", "番号 Z→A"]]) {
        const opt = el("option", label);
        opt.value = val;
        sortSelect.append(opt);
    }
    sortSelect.value = app.libraryState.sort;

    filterBar.append(searchInput, statusSelect, sortSelect);

    // Quick prefix chips
    const prefixCounts = new Map();
    for (const rec of enriched) {
        const prefix = getCarPrefix(rec.carNum);
        if (prefix) prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
    }
    const topPrefixes = [...prefixCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const chipRow = el("div", undefined, "jhs-ext-chip-row");

    // Batch toolbar
    const batchBar = el("div", undefined, "jhs-ext-batch-bar");
    const listHost = el("div");
    const pagination = el("div", undefined, "jhs-extension-pagination");

    const selectedCodes = new Set();
    let pageItems = /** @type {any[]} */ ([]);

    const syncViewToggle = () => {
        const mode = app.libraryState.viewMode;
        gridBtn.classList.toggle("active", mode === "grid");
        gridBtn.setAttribute("aria-pressed", String(mode === "grid"));
        listBtn.classList.toggle("active", mode === "list");
        listBtn.setAttribute("aria-pressed", String(mode === "list"));
    };

    const renderBatchBar = () => {
        batchBar.replaceChildren();
        const count = selectedCodes.size;
        const summary = el("span", count ? `已选 ${count} 部作品` : "批量操作", "jhs-ext-batch-bar__label");
        const selectPageBtn = actionButton("全选本页", () => {
            for (const item of pageItems) selectedCodes.add(item.carNum);
            renderResults();
        }, "ghost");
        const clearBtn = actionButton("清空选择", () => {
            selectedCodes.clear();
            renderResults();
        }, "ghost");
        clearBtn.disabled = count === 0;
        batchBar.append(summary, selectPageBtn, clearBtn);

        if (count > 0) {
            for (const [flag, label, variant] of [["favorite", "批量收藏", "secondary"], ["downloaded", "批量已下载", "secondary"], ["watched", "批量已看", "secondary"], ["blocked", "批量屏蔽", "secondary"]]) {
                batchBar.append(actionButton(label, () => app.run(async () => {
                    await app.client.call("state.patch", [[...selectedCodes], { [flag]: true }, { type: "history-batch-state" }]);
                    selectedCodes.clear();
                    await renderLibraryView(host, app);
                }), variant));
            }
            batchBar.append(actionButton("批量移除", async () => {
                if (!await confirmAction(app, `确认移除选中的 ${count} 条作品记录？`, "批量移除作品")) return;
                await app.run(async () => {
                    await app.client.call("state.remove", [[...selectedCodes]]);
                    selectedCodes.clear();
                    await renderLibraryView(host, app);
                });
            }, "danger"));
        }
    };

    const renderKpis = () => {
        kpiStrip.replaceChildren();
        for (const [key, label, count, tone] of kpis) {
            const card = el("button", undefined, `jhs-ext-kpi-card jhs-ext-kpi-card--${tone}`);
            card.type = "button";
            card.setAttribute("aria-pressed", String(app.libraryState.status === key));
            card.append(el("span", label, "jhs-ext-kpi-card__label"), el("strong", String(count), "jhs-ext-kpi-card__value"));
            scope.listen(card, "click", () => {
                app.libraryState.status = key;
                app.libraryState.offset = 0;
                statusSelect.value = key === "unrated" ? "unrated" : key;
                renderKpis();
                renderResults();
            });
            kpiStrip.append(card);
        }
    };

    const renderPrefixes = () => {
        chipRow.replaceChildren();
        if (app.libraryState.prefix) {
            const reset = el("button", `清除筛选: ${app.libraryState.prefix} ×`, "jhs-chip");
            reset.type = "button";
            reset.setAttribute("aria-pressed", "true");
            scope.listen(reset, "click", () => {
                app.libraryState.prefix = "";
                app.libraryState.offset = 0;
                renderPrefixes();
                renderResults();
            });
            chipRow.append(reset);
        }
        for (const [prefix, count] of topPrefixes) {
            const chip = el("button", `${prefix} (${count})`, "jhs-chip");
            chip.type = "button";
            chip.setAttribute("aria-pressed", String(app.libraryState.prefix === prefix));
            scope.listen(chip, "click", () => {
                app.libraryState.prefix = app.libraryState.prefix === prefix ? "" : prefix;
                app.libraryState.offset = 0;
                renderPrefixes();
                renderResults();
            });
            chipRow.append(chip);
        }
    };

    /** Progressive lazy hydration for visible posters without covers. @param {any[]} visible */
    const hydrateVisibleCovers = (visible) => {
        const queue = visible.filter(item => !item.coverUrl && !app.coverFailed.has(item.carNum)).slice(0, 12);
        if (!queue.length) return;
        let index = 0;
        const worker = async () => {
            while (index < queue.length && !scope.disposed && app.isCurrentVersion(version)) {
                const item = queue[index++];
                try {
                    const resolved = await app.context.services.movie.resolve({ carNum: item.carNum }, { scope });
                    if (scope.disposed || !app.isCurrentVersion(version) || !resolved?.movieId) {
                        app.coverFailed.add(item.carNum);
                        continue;
                    }
                    const detail = await app.context.services.movie.detail(resolved, { scope });
                    if (scope.disposed || !app.isCurrentVersion(version)) return;
                    if (detail?.coverUrl) {
                        app.coverCache.set(item.carNum, { coverUrl: detail.coverUrl, title: detail.title || "", publishTime: detail.releaseDate || "" });
                        item.coverUrl = detail.coverUrl;
                        item.titleText = item.titleText || detail.title || "";
                        item.publishTime = item.publishTime || detail.releaseDate || "";
                        const slot = listHost.querySelector(`[data-jhs-card-car="${CSS.escape(item.carNum)}"] .jhs-ext-poster-slot`);
                        if (slot) slot.replaceChildren(createPosterNode(item.carNum, item.coverUrl, item.titleText));
                    } else {
                        app.coverFailed.add(item.carNum);
                    }
                } catch {
                    app.coverFailed.add(item.carNum);
                }
            }
        };
        void Promise.all([worker(), worker()]);
    };

    const renderResults = () => {
        const query = app.libraryState.query.trim().toLowerCase();
        const status = app.libraryState.status;
        const prefix = app.libraryState.prefix;
        const [sortField, sortDir] = String(app.libraryState.sort || "updateDate:desc").split(":");

        const matched = enriched.filter((/** @type {any} */ record) => {
            if (status === "favorite" && !record.stateFlags.favorite) return false;
            if (status === "downloaded" && !record.stateFlags.downloaded) return false;
            if (status === "watched" && !record.stateFlags.watched) return false;
            if (status === "blocked" && !record.stateFlags.blocked) return false;
            if (status === "pending" && hasAnyState(record.stateFlags)) return false;
            if (status === "rated" && record.personalRating == null) return false;
            if (status === "unrated" && record.personalRating != null) return false;
            if (prefix && !record.carNum.startsWith(prefix)) return false;
            if (!query) return true;
            return `${record.carNum} ${record.titleText} ${record.names || ""} ${record.remark || ""}`.toLowerCase().includes(query);
        });

        matched.sort((/** @type {any} */ a, /** @type {any} */ b) => {
            let cmp = 0;
            if (sortField === "rating") cmp = (a.personalRating || 0) - (b.personalRating || 0);
            else if (sortField === "carNum") cmp = String(a.carNum).localeCompare(String(b.carNum), "en");
            else cmp = String(a[sortField] || "").localeCompare(String(b[sortField] || ""), "en");
            return sortDir === "asc" ? cmp : -cmp;
        });

        const pageSize = app.libraryState.viewMode === "grid" ? 24 : 60;
        if (app.libraryState.offset >= matched.length) app.libraryState.offset = 0;
        pageItems = matched.slice(app.libraryState.offset, app.libraryState.offset + pageSize);

        renderBatchBar();
        syncViewToggle();
        listHost.className = app.libraryState.viewMode === "grid" ? "jhs-ext-poster-grid" : "jhs-extension-movie-list";
        listHost.replaceChildren();

        if (!matched.length) {
            listHost.append(el("p", "暂无作品，可从备份导入或在站点页面标记作品。", "jhs-extension-empty"));
        } else {
            for (const record of pageItems) {
                if (app.libraryState.viewMode === "grid") {
                    const card = el("article", undefined, "jhs-ext-movie-card");
                    card.dataset.jhsCardCar = record.carNum;
                    const mediaWrap = el("div", undefined, "jhs-ext-movie-card__media");
                    const check = el("input", undefined, "jhs-ext-card-check");
                    check.type = "checkbox";
                    check.checked = selectedCodes.has(record.carNum);
                    check.setAttribute("aria-label", `选择 ${record.carNum}`);
                    scope.listen(check, "change", () => {
                        if (check.checked) selectedCodes.add(record.carNum);
                        else selectedCodes.delete(record.carNum);
                        renderBatchBar();
                    });

                    const posterTrigger = el("button", undefined, "jhs-ext-poster-slot");
                    posterTrigger.type = "button";
                    posterTrigger.setAttribute("aria-label", `查看 ${record.carNum} 详情`);
                    posterTrigger.append(createPosterNode(record.carNum, record.coverUrl, record.titleText));
                    scope.listen(posterTrigger, "click", () => { void app.openMovieDrawer(record); });

                    const overlayBadges = el("div", undefined, "jhs-ext-movie-card__badges");
                    if (record.personalRating != null) overlayBadges.append(el("span", `★ ${record.personalRating}`, "jhs-badge jhs-badge--watch"));
                    if (record.stateFlags.blocked) overlayBadges.append(el("span", "已屏蔽", "jhs-badge jhs-badge--filter"));
                    mediaWrap.append(posterTrigger, check, overlayBadges);

                    const body = el("div", undefined, "jhs-ext-movie-card__body");
                    const topRow = el("div", undefined, "jhs-ext-movie-card__top");
                    const codeBtn = el("button", record.carNum, "jhs-ext-code-btn");
                    codeBtn.type = "button";
                    scope.listen(codeBtn, "click", () => { void app.openMovieDrawer(record); });
                    const dateSpan = el("span", String(record.publishTime || record.updateDate || "").slice(0, 10), "jhs-ext-muted");
                    topRow.append(codeBtn, dateSpan);

                    const titleEl = el("div", record.titleText || record.names || "点击查看详情与磁力", "jhs-ext-movie-card__title");
                    const actorsWrap = el("div", undefined, "jhs-ext-movie-card__actors");
                    for (const name of String(record.names || "").split(/\s+/).filter(Boolean).slice(0, 3)) {
                        const aChip = el("button", name, "jhs-chip jhs-ext-chip-sm");
                        aChip.type = "button";
                        scope.listen(aChip, "click", () => {
                            app.libraryState.query = name;
                            searchInput.value = name;
                            app.libraryState.offset = 0;
                            renderResults();
                        });
                        actorsWrap.append(aChip);
                    }
                    if (record.remark) body.append(topRow, titleEl, actorsWrap, el("p", record.remark, "jhs-ext-movie-card__remark"));
                    else body.append(topRow, titleEl, actorsWrap);

                    const footer = el("div", undefined, "jhs-ext-movie-card__actions");
                    for (const [flag, label] of [["favorite", "收藏"], ["downloaded", "下载"], ["watched", "已看"], ["blocked", "屏蔽"]]) {
                        const control = actionButton(label, async () => {
                            await app.client.call("state.toggle", [record.carNum, flag]);
                            await renderLibraryView(host, app);
                        });
                        control.classList.add("jhs-btn--sm");
                        control.setAttribute("aria-pressed", String(Boolean(record.stateFlags?.[flag])));
                        footer.append(control);
                    }
                    const detailBtn = actionButton("详情", () => app.openMovieDrawer(record), "secondary");
                    detailBtn.classList.add("jhs-btn--sm");
                    footer.append(detailBtn);
                    card.append(mediaWrap, body, footer);
                    listHost.append(card);
                } else {
                    const row = el("article", undefined, "jhs-extension-movie-row");
                    const check = el("input", undefined, "jhs-ext-row-check");
                    check.type = "checkbox";
                    check.checked = selectedCodes.has(record.carNum);
                    check.setAttribute("aria-label", `选择 ${record.carNum}`);
                    scope.listen(check, "change", () => {
                        if (check.checked) selectedCodes.add(record.carNum);
                        else selectedCodes.delete(record.carNum);
                        renderBatchBar();
                    });
                    const codeBtn = el("button", record.carNum, "jhs-ext-code-btn");
                    codeBtn.type = "button";
                    scope.listen(codeBtn, "click", () => { void app.openMovieDrawer(record); });
                    const metaInfo = el("div", undefined, "jhs-extension-movie-title");
                    metaInfo.append(el("span", record.titleText || record.names || ""));
                    if (record.names && record.titleText) metaInfo.append(el("small", ` · ${record.names}`, "jhs-ext-muted"));
                    if (record.personalRating != null) metaInfo.append(el("span", ` ★${record.personalRating}`, "jhs-badge jhs-badge--watch"));
                    row.append(check, codeBtn, metaInfo);
                    for (const [flag, label] of [["favorite", "收藏"], ["downloaded", "下载"], ["watched", "已看"], ["blocked", "屏蔽"]]) {
                        const control = actionButton(label, async () => {
                            await app.client.call("state.toggle", [record.carNum, flag]);
                            await renderLibraryView(host, app);
                        });
                        control.setAttribute("aria-pressed", String(Boolean(record.stateFlags?.[flag])));
                        row.append(control);
                    }
                    const ext = el("a", "原站", "jhs-btn jhs-btn--ghost jhs-btn--sm");
                    ext.href = record.url || `https://javdb.com/search?q=${encodeURIComponent(record.carNum)}&f=all`;
                    ext.target = "_blank";
                    ext.rel = "noopener noreferrer";
                    row.append(actionButton("详情", () => app.openMovieDrawer(record), "secondary"), ext);
                    listHost.append(row);
                }
            }
            if (app.libraryState.viewMode === "grid") hydrateVisibleCovers(pageItems);
        }

        pagination.replaceChildren(
            actionButton("上一页", () => { app.libraryState.offset = Math.max(0, app.libraryState.offset - pageSize); renderResults(); }),
            el("span", `${Math.min(app.libraryState.offset + pageSize, matched.length)} / ${matched.length}`),
            actionButton("下一页", () => { if (app.libraryState.offset + pageSize < matched.length) app.libraryState.offset += pageSize; renderResults(); }),
        );
    };

    scope.listen(gridBtn, "click", () => { app.libraryState.viewMode = "grid"; app.libraryState.offset = 0; renderResults(); });
    scope.listen(listBtn, "click", () => { app.libraryState.viewMode = "list"; app.libraryState.offset = 0; renderResults(); });
    scope.listen(searchInput, "input", () => { app.libraryState.query = searchInput.value; app.libraryState.offset = 0; renderResults(); });
    scope.listen(statusSelect, "change", () => { app.libraryState.status = statusSelect.value; app.libraryState.offset = 0; renderKpis(); renderResults(); });
    scope.listen(sortSelect, "change", () => { app.libraryState.sort = sortSelect.value; app.libraryState.offset = 0; renderResults(); });

    host.append(heading, kpiStrip, filterBar, chipRow, batchBar, listHost, pagination);
    renderKpis();
    renderPrefixes();
    renderResults();
}

/** Open an inline modal to batch import car numbers into the library. @param {any} app */
function openBatchImportDialog(app) {
    const dialog = app.context?.services?.dialog;
    if (!dialog?.open) return;
    const wrapper = el("div", undefined, "jhs-form-dialog jhs-ui jhs-ext-import-dialog");
    const desc = el("p", "粘贴包含番号的文本（自动提取规范番号并忽略无效字符）：");
    const textarea = el("textarea", undefined, "jhs-field jhs-textarea");
    textarea.rows = 6;
    textarea.placeholder = "例如：SSIS-001, STARS-804\nABC-123";
    const flagSelect = el("select", undefined, "jhs-field");
    for (const [val, label] of [["favorite", "标记为：收藏"], ["downloaded", "标记为：已下载"], ["watched", "标记为：已观看"], ["blocked", "标记为：屏蔽"]]) {
        const opt = el("option", label);
        opt.value = val;
        flagSelect.append(opt);
    }
    const preview = el("p", "等待输入番号…", "jhs-ext-muted");
    const submitBtn = el("button", "开始导入", "jhs-btn jhs-btn--primary");
    submitBtn.type = "button";
    wrapper.append(desc, textarea, flagSelect, preview, submitBtn);

    const id = dialog.open({
        type: 1,
        title: "番号批量导入",
        content: wrapper,
        ui: { size: "sm", body: "scroll" },
        success: (/** @type {HTMLElement} */ layerRoot) => {
            const area = /** @type {HTMLTextAreaElement | null} */ (layerRoot.querySelector("textarea"));
            const select = /** @type {HTMLSelectElement | null} */ (layerRoot.querySelector("select"));
            const note = layerRoot.querySelector(".jhs-ext-muted");
            const btn = /** @type {HTMLButtonElement | null} */ (layerRoot.querySelector("button"));
            const parseCodes = () => [...new Set(parseCarNumberText(area?.value || "").values.map(normalizeCarNum).filter((/** @type {string | null} */ code) => Boolean(code)))];
            area?.addEventListener("input", () => {
                const codes = parseCodes();
                if (note) note.textContent = codes.length ? `已识别 ${codes.length} 个有效番号：${codes.slice(0, 6).join("、")}${codes.length > 6 ? "…" : ""}` : "暂未识别到有效番号";
            });
            btn?.addEventListener("click", () => {
                const codes = parseCodes();
                if (!codes.length) {
                    if (note) note.textContent = "请先输入至少一个有效番号";
                    return;
                }
                const flag = select?.value || "favorite";
                void app.run(async () => {
                    await app.client.call("state.patch", [codes, { [flag]: true }, { type: "history-batch-state" }]);
                    dialog.close(id);
                    await app.refreshCurrentView();
                });
            });
        },
    });
}

/**
 * Render the Actors Gallery & Blacklist Hub.
 * @param {HTMLElement} host
 * @param {any} app
 */
export async function renderActorsView(host, app) {
    const version = app.nextVersion();
    const records = await app.client.call("state.getFavoriteActressList");
    if (!app.isCurrentVersion(version)) return;

    host.replaceChildren();
    const scope = app.resetViewScope("actors");

    const heading = el("div", undefined, "jhs-extension-section-heading");
    const titleGroup = el("div", undefined, "jhs-ext-title-group");
    const missingCount = (records || []).filter((/** @type {any} */ a) => isMissingActorSource(a)).length;
    titleGroup.append(
        el("h1", "演员与黑名单"),
        el("span", `${records.length} 位收藏演员${missingCount ? ` · ${missingCount} 位来源异常` : ""}`, "jhs-ext-subtitle"),
    );
    const headerTools = el("div", undefined, "jhs-ext-toolbar-actions");
    headerTools.append(
        actionButton("检测全部新作", () => app.run(() => app.client.call("scan.checkNewVideo")), "secondary"),
        actionButton("打开黑名单", () => app.openInlineCommand("library.blacklist.open"), "secondary"),
    );
    heading.append(titleGroup, headerTools);

    const filterBar = el("div", "", "jhs-ext-filter-bar");
    const actorSearchInput = el("input", "", "jhs-field jhs-ext-search-input");
    actorSearchInput.type = "search";
    actorSearchInput.placeholder = "搜索演员名称、别名或 ID";
    actorSearchInput.setAttribute("aria-label", "搜索收藏演员");
    actorSearchInput.value = app.actorState.query;

    const categorySelect = el("select", undefined, "jhs-field jhs-ext-select");
    categorySelect.setAttribute("aria-label", "筛选演员分类");
    for (const [val, label] of [["all", "全部演员"], ["hasNew", "有待看新作"], ["censored", "有码"], ["uncensored", "无码"], ["missing", "来源异常 (404)"]]) {
        const opt = el("option", label);
        opt.value = val;
        categorySelect.append(opt);
    }
    categorySelect.value = app.actorState.filter;

    const sortSelect = el("select", undefined, "jhs-field jhs-ext-select");
    sortSelect.setAttribute("aria-label", "排序演员");
    for (const [val, label] of [["newCount:desc", "新作数 多→少"], ["lastPublishTime:desc", "最近发行"], ["lastCheckTime:desc", "最近检测"], ["name:asc", "名称 A→Z"]]) {
        const opt = el("option", label);
        opt.value = val;
        sortSelect.append(opt);
    }
    sortSelect.value = app.actorState.sort;
    filterBar.append(actorSearchInput, categorySelect, sortSelect);

    const grid = el("div", undefined, "jhs-ext-actor-grid");

    const renderList = () => {
        const query = app.actorState.query.trim().toLowerCase();
        const filter = app.actorState.filter;
        const [sortField, sortDir] = app.actorState.sort.split(":");

        const matched = (records || []).filter((/** @type {any} */ actor) => {
            const missing = isMissingActorSource(actor);
            const newCount = actor.newVideoList?.length || 0;
            if (filter === "hasNew" && !newCount) return false;
            if (filter === "censored" && actor.actressType !== "censored") return false;
            if (filter === "uncensored" && actor.actressType !== "uncensored") return false;
            if (filter === "missing" && !missing) return false;
            if (!query) return true;
            const aliases = Array.isArray(actor.allName) ? actor.allName.join(" ") : String(actor.allName || "");
            return `${actor.name || ""} ${aliases} ${actor.starId || ""}`.toLowerCase().includes(query);
        });

        matched.sort((/** @type {any} */ a, /** @type {any} */ b) => {
            let cmp = 0;
            if (sortField === "newCount") cmp = (a.newVideoList?.length || 0) - (b.newVideoList?.length || 0);
            else if (sortField === "name") cmp = String(a.name || a.starId || "").localeCompare(String(b.name || b.starId || ""), "zh-CN");
            else cmp = String(a[sortField] || "").localeCompare(String(b[sortField] || ""), "en");
            return sortDir === "asc" ? cmp : -cmp;
        });

        grid.replaceChildren();
        if (!matched.length) {
            grid.append(el("p", "暂无符合条件的收藏演员", "jhs-extension-empty"));
            return;
        }

        for (const actor of matched) {
            const card = el("article", undefined, "jhs-ext-actor-card");
            const profile = el("div", undefined, "jhs-ext-actor-card__profile");

            if (actor.avatar) {
                const avatar = el("img", undefined, "jhs-ext-actor-avatar");
                avatar.src = actor.avatar;
                avatar.alt = actor.name || actor.starId;
                avatar.loading = "lazy";
                profile.append(avatar);
            } else {
                const avatarFallback = el("div", String(actor.name || actor.starId || "?").slice(0, 1), "jhs-ext-actor-avatar jhs-ext-actor-avatar--fallback");
                profile.append(avatarFallback);
            }

            const info = el("div", undefined, "jhs-ext-actor-card__info");
            const nameRow = el("div", undefined, "jhs-ext-actor-card__name-row");
            const link = el("a", actor.name || actor.starId, "jhs-ext-actor-card__name");
            link.href = `https://javdb.com/actors/${encodeURIComponent(actor.starId)}`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            nameRow.append(link);

            const typeLabel = actor.actressType === "uncensored" ? "无码" : actor.actressType === "censored" ? "有码" : "未知";
            nameRow.append(el("span", typeLabel, `jhs-badge ${actor.actressType === "uncensored" ? "jhs-badge--success" : "jhs-badge--accent"}`));
            if (isMissingActorSource(actor)) nameRow.append(el("span", "来源异常", "jhs-badge jhs-badge--watch"));

            const aliases = Array.isArray(actor.allName) ? actor.allName.filter((/** @type {string} */ n) => n !== actor.name).join(" / ") : "";
            info.append(nameRow);
            if (aliases) info.append(el("p", aliases, "jhs-ext-actor-card__aliases"));
            const metaLine = `新作 ${actor.newVideoList?.length || 0} 部${actor.lastPublishTime ? ` · 最近发行 ${String(actor.lastPublishTime).slice(0, 10)}` : ""}${actor.lastCheckTime ? ` · 上次检测 ${String(actor.lastCheckTime).slice(0, 10)}` : ""}`;
            info.append(el("p", metaLine, "jhs-ext-muted"));
            profile.append(info);
            card.append(profile);

            // Preview recent new videos for this actor
            if (Array.isArray(actor.newVideoList) && actor.newVideoList.length) {
                const previewStrip = el("div", undefined, "jhs-ext-actor-new-strip");
                for (const raw of actor.newVideoList.slice(0, 4)) {
                    const code = normalizeCarNum(typeof raw === "string" ? raw : raw?.carNum);
                    if (!code) continue;
                    const itemBtn = el("button", code, "jhs-chip jhs-ext-chip-sm");
                    itemBtn.type = "button";
                    scope.listen(itemBtn, "click", () => {
                        void app.openMovieDrawer({
                            carNum: code,
                            title: raw?.title || "",
                            coverUrl: raw?.coverUrl || "",
                            publishTime: raw?.publishTime || "",
                            actress: actor.name || "",
                            url: raw?.url || "",
                        });
                    });
                    previewStrip.append(itemBtn);
                }
                if (actor.newVideoList.length > 4) previewStrip.append(el("span", `+${actor.newVideoList.length - 4}`, "jhs-ext-muted"));
                card.append(previewStrip);
            }

            const actions = el("div", undefined, "jhs-ext-actor-card__actions");
            actions.append(
                actionButton("单人检测", async () => {
                    await app.run(async () => {
                        await app.client.call("scan.checkOneNewVideo", [actor]);
                        await renderActorsView(host, app);
                    });
                }, "secondary"),
                actionButton("取消收藏", async () => {
                    if (!await confirmAction(app, `取消收藏演员“${actor.name || actor.starId}”？`, "取消收藏演员")) return;
                    await app.run(async () => {
                        await app.client.call("state.removeFavoriteActress", [actor.starId]);
                        await renderActorsView(host, app);
                    });
                }, "ghost"),
            );
            card.append(actions);
            grid.append(card);
        }
    };

    scope.listen(actorSearchInput, "input", () => { app.actorState.query = actorSearchInput.value; renderList(); });
    scope.listen(categorySelect, "change", () => { app.actorState.filter = categorySelect.value; renderList(); });
    scope.listen(sortSelect, "change", () => { app.actorState.sort = sortSelect.value; renderList(); });

    host.append(heading, filterBar, grid);
    renderList();
}

/**
 * Render the Background Tasks, Cloud Offline Tasks & Local Receipts view.
 * @param {HTMLElement} host
 * @param {any} app
 * @param {{compact?: boolean}} [options]
 */
export async function renderTasksCloudView(host, app, options = {}) {
    const version = app.nextVersion();
    const [taskState, sync, cloud, scanSnapshot, offlineHistory] = await Promise.all([
        app.client.call("tasks.status"),
        app.client.call("sync.getStatus"),
        app.client.call("tasks.offlineStatus"),
        app.client.call("scan.snapshot").catch(() => ({ config: {}, states: {} })),
        app.client.call("state.getOfflineHistory").catch(() => []),
    ]);
    if (!app.isCurrentVersion(version)) return;

    const settings = app.context.services.settings.snapshot();
    const compact = Boolean(options.compact);

    host.replaceChildren();
    app.resetViewScope("tasks");

    const heading = el("div", undefined, "jhs-extension-section-heading");
    const statusText = taskState.state === "error" ? taskState.error : taskState.state === "running" ? "正在执行后台检查" : "等待下次检查";
    heading.append(
        el("h1", "后台任务"),
        el("div", undefined, "jhs-ext-toolbar-actions"),
    );
    const toolbar = heading.lastElementChild;
    toolbar?.append(
        actionButton("立即检查", async () => {
            await app.run(async () => {
                await app.client.call("tasks.run");
                await renderTasksCloudView(host, app, options);
            });
        }, "primary"),
        actionButton("同步设置", () => app.openInlineCommand("settings.open", "backup-panel"), "secondary"),
    );

    const summaryBar = el("div", undefined, "jhs-ext-task-summary");
    summaryBar.append(
        el("span", statusText, `jhs-badge ${taskState.state === "error" ? "jhs-badge--danger" : taskState.state === "running" ? "jhs-badge--accent" : "jhs-badge--neutral"}`),
    );
    if (taskState.completedAt) summaryBar.append(el("span", `上次完成 ${new Date(taskState.completedAt).toLocaleString()}`, "jhs-ext-muted"));
    if (taskState.retryAt) summaryBar.append(el("span", `下次重试 ${new Date(taskState.retryAt).toLocaleString()}`, "jhs-ext-muted"));
    summaryBar.append(el("span", `WebDAV: ${sync.message || sync.state || "待配置"}`, "jhs-ext-muted"));

    // 4 Scheduler cards
    const taskGrid = el("div", undefined, compact ? "jhs-ext-task-stack" : "jhs-ext-task-grid");
    /** @type {Array<{id: string, title: string, enabled: boolean, state: any, actionText: string, onRun: () => Promise<any>}>} */
    const schedulers = [
        {
            id: "newVideo",
            title: "新作品检测",
            enabled: parseBooleanSetting(settings.enableCheckNewVideo, true),
            state: scanSnapshot?.states?.newVideo || {},
            actionText: "检测新作品",
            onRun: () => app.client.call("scan.checkNewVideo"),
        },
        {
            id: "favoriteActress",
            title: "收藏演员同步",
            enabled: parseBooleanSetting(settings.enableCheckFavoriteActress, true),
            state: scanSnapshot?.states?.favoriteActress || {},
            actionText: "同步演员",
            onRun: () => app.client.call("scan.checkFavoriteActress"),
        },
        {
            id: "blacklist",
            title: "黑名单检测",
            enabled: parseBooleanSetting(settings.enableCheckBlacklist, true),
            state: scanSnapshot?.states?.blacklist || {},
            actionText: "检测黑名单",
            onRun: () => app.client.call("scan.checkBlacklist"),
        },
        {
            id: "webdav",
            title: "WebDAV 同步",
            enabled: Boolean(sync?.configured ?? (sync?.state && sync.state !== "unconfigured")),
            state: { status: sync.state, message: sync.message, lastSuccessAt: sync.lastSuccessAt },
            actionText: "立即同步",
            onRun: () => app.client.call("sync.check"),
        },
    ];

    for (const item of schedulers) {
        const card = el("article", undefined, "jhs-ext-task-card");
        const top = el("div", undefined, "jhs-ext-task-card__top");
        top.append(
            el("strong", item.title),
            el("span", item.enabled ? "已启用" : "已关闭", `jhs-badge ${item.enabled ? "jhs-badge--success" : "jhs-badge--neutral"}`),
        );
        const detailLine = item.id === "webdav"
            ? (sync.lastSuccessAt ? `上次同步 ${formatUiDateTime(sync.lastSuccessAt)}` : (sync.message || "等待配置 WebDAV"))
            : (item.state.completedAt ? `上次完成 ${new Date(item.state.completedAt).toLocaleString()}` : item.state.status === "running" ? "正在执行…" : "等待调度");
        const btn = actionButton(item.actionText, async () => {
            await app.run(async () => {
                await item.onRun();
                await renderTasksCloudView(host, app, options);
            });
        }, "secondary");
        btn.classList.add("jhs-btn--sm");
        card.append(top, el("p", detailLine, "jhs-ext-muted"), btn);
        taskGrid.append(card);
    }

    // Cloud tasks section
    const cloudHeader = el("div", undefined, "jhs-extension-section-heading jhs-ext-subsection-heading");
    cloudHeader.append(
        el("h2", "云盘任务"),
        actionButton("刷新云盘任务", async () => {
            await app.run(async () => {
                await app.client.call("tasks.offline", [true]);
                await renderTasksCloudView(host, app, options);
            });
        }, "secondary"),
    );

    const cloudGrid = el("div", undefined, compact ? "jhs-ext-cloud-stack" : "jhs-ext-cloud-grid");
    for (const [id, name, home] of [["pan123", "123 云盘", "https://yun.123pan.com"], ["one115", "115", "https://115.com"]]) {
        const cState = cloud[id];
        const section = el("section", undefined, "jhs-extension-cloud-tasks jhs-ext-cloud-card");
        const head = el("div", undefined, "jhs-ext-cloud-card__head");
        const link = el("a", name);
        link.href = home;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        const badgeText = !cState ? "待查询" : cState.enabled === false ? "已关闭" : cState.reason ? "需要注意" : `${cState.items?.length || 0} 项任务`;
        head.append(link, el("span", badgeText, `jhs-badge ${cState?.reason ? "jhs-badge--watch" : cState?.enabled === false ? "jhs-badge--neutral" : "jhs-badge--accent"}`));
        section.append(head);

        if (!cState) {
            section.append(el("p", "等待首次查询", "jhs-ext-muted"));
        } else {
            if (cState.reason) section.append(el("p", cState.reason, "jhs-ext-muted"));
            for (const task of cState.items || []) {
                const row = el("div", undefined, "jhs-ext-cloud-item");
                const rowTop = el("div", undefined, "jhs-ext-cloud-item__top");
                rowTop.append(el("span", task.name, "jhs-ext-cloud-item__name"), el("span", `${task.status} · ${task.progress}%`, "jhs-ext-muted"));
                const track = el("div", undefined, "jhs-ext-progress");
                const bar = el("div", undefined, "jhs-ext-progress__bar");
                const pct = Math.max(0, Math.min(100, Number(task.progress) || 0));
                bar.style.width = `${pct}%`;
                track.append(bar);
                row.append(rowTop, track);
                section.append(row);
            }
            if (cState.total > (cState.items?.length || 0)) {
                section.append(el("p", `显示前 ${cState.items.length} 项，共 ${cState.total} 项`, "jhs-ext-muted"));
            }
            if (!cState.reason && !(cState.items?.length)) {
                section.append(el("p", "暂无云端任务", "jhs-ext-muted"));
            }
        }
        cloudGrid.append(section);
    }

    host.append(heading, summaryBar, taskGrid, cloudHeader, cloudGrid);

    // Local offline submission history & receipts
    if (!compact) {
        const receiptHead = el("div", undefined, "jhs-extension-section-heading jhs-ext-subsection-heading");
        receiptHead.append(el("h2", `近期离线提交记录 (${offlineHistory.length})`));
        const receiptList = el("div", undefined, "jhs-ext-receipt-list");
        const recent = (offlineHistory || []).slice().reverse().slice(0, 20);
        if (!recent.length) {
            receiptList.append(el("p", "暂无本地离线提交记录", "jhs-extension-empty"));
        } else {
            for (const item of recent) {
                const row = el("article", undefined, "jhs-ext-receipt-row");
                const info = el("div", undefined, "jhs-ext-receipt-row__info");
                const titleLine = el("div", undefined, "jhs-ext-receipt-row__title");
                if (item.carNum) {
                    const codeBtn = el("button", item.carNum, "jhs-ext-code-btn");
                    codeBtn.type = "button";
                    codeBtn.addEventListener("click", () => { void app.openMovieDrawer({ carNum: item.carNum }); });
                    titleLine.append(codeBtn);
                } else {
                    titleLine.append(el("strong", "未关联番号"));
                }
                const statusBadge = item.status === "submitted" || item.status === "success" ? "已提交" : item.status === "failed" ? "失败" : "待确认";
                titleLine.append(
                    el("span", item.providerName || item.providerId || "云盘", "jhs-badge jhs-badge--neutral"),
                    el("span", statusBadge, `jhs-badge ${item.status === "failed" ? "jhs-badge--danger" : "jhs-badge--success"}`),
                    el("span", formatUiDateTime(item.createdAt), "jhs-ext-muted"),
                );
                info.append(titleLine, el("p", item.errorMessage || item.resource || "", "jhs-ext-receipt-row__resource"));
                const acts = el("div", undefined, "jhs-ext-receipt-row__actions");
                acts.append(
                    actionButton("复制磁力", async () => { await app.context.services.clipboard.copyText("磁力链接", item.resource || ""); app.setStatus("已复制离线链接"); }, "ghost"),
                    actionButton("移除", async () => { await app.client.call("state.removeOfflineHistory", [item.id]); await renderTasksCloudView(host, app, options); }, "ghost"),
                );
                row.append(info, acts);
                receiptList.append(row);
            }
        }
        host.append(receiptHead, receiptList);
    }
}

/**
 * Render the Library Analytics / Statistics Dashboard view.
 * @param {HTMLElement} host
 * @param {any} app
 */
export async function renderStatsView(host, app) {
    const version = app.nextVersion();
    const [snapshot, ratings] = await Promise.all([
        app.client.call("stats.snapshot"),
        app.client.call("state.getPersonalRatings").catch(() => ({})),
    ]);
    if (!app.isCurrentVersion(version)) return;

    const cars = snapshot?.cars || [];
    const actresses = snapshot?.actresses || [];
    const blacklist = snapshot?.blacklist || [];
    const activity = snapshot?.activity?.entries || [];
    const stats = computeLibraryStats(cars);
    const ratedCount = Object.keys(ratings || {}).length;

    host.replaceChildren();
    app.resetViewScope("stats");

    const heading = el("div", undefined, "jhs-extension-section-heading");
    heading.append(el("h1", "数据统计"), el("span", "全库资产与操作分布概览", "jhs-ext-subtitle"));

    const kpiGrid = el("div", undefined, "jhs-ext-kpi-grid");
    for (const [label, value, tone] of [
        ["总作品数", stats.total, "neutral"],
        ["有效未屏蔽", stats.unblocked, "accent"],
        ["待鉴定", stats.pending, "neutral"],
        ["已收藏", stats.favoriteEffective, "fav"],
        ["已下载", stats.downloadedEffective, "down"],
        ["已观看", stats.watchedEffective, "watch"],
        ["个人已评分", ratedCount, "accent"],
        ["收藏演员", actresses.length, "fav"],
        ["待处理新作", snapshot?.pendingNewVideos ?? 0, "watch"],
        ["黑名单演员", blacklist.length, "filter"],
    ]) {
        const card = el("div", undefined, `jhs-ext-kpi-card jhs-ext-kpi-card--${tone}`);
        card.append(el("span", String(label), "jhs-ext-kpi-card__label"), el("strong", String(value), "jhs-ext-kpi-card__value"));
        kpiGrid.append(card);
    }

    const chartGrid = el("div", undefined, "jhs-ext-stats-grid");

    // Prefix top 10
    const prefixCounts = new Map();
    const actressCounts = new Map();
    for (const car of cars) {
        const prefix = getCarPrefix(car.carNum);
        if (prefix) prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
        for (const name of String(car.names || "").split(/\s+/).filter(Boolean)) {
            actressCounts.set(name, (actressCounts.get(name) || 0) + 1);
        }
    }

    /** @param {string} title @param {Array<[string, number]>} rows @param {(label: string) => void} onSelect */
    const buildBarSection = (title, rows, onSelect) => {
        const section = el("section", undefined, "jhs-ext-stats-card");
        section.append(el("h2", title));
        if (!rows.length) {
            section.append(el("p", "暂无足够数据", "jhs-ext-muted"));
            return section;
        }
        const max = Math.max(...rows.map(r => r[1]), 1);
        for (const [label, value] of rows) {
            const row = el("button", undefined, "jhs-ext-bar-row");
            row.type = "button";
            row.addEventListener("click", () => onSelect(label));
            const track = el("span", undefined, "jhs-ext-progress");
            const fill = el("span", undefined, "jhs-ext-progress__bar");
            fill.style.width = `${Math.max(4, Math.round((value / max) * 100))}%`;
            track.append(fill);
            row.append(el("span", label, "jhs-ext-bar-row__label"), track, el("span", String(value), "jhs-ext-bar-row__value"));
            section.append(row);
        }
        return section;
    };

    const topPrefixes = [...prefixCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topActresses = [...actressCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

    chartGrid.append(
        buildBarSection("系列前缀 Top 10", topPrefixes, (prefix) => {
            app.libraryState.prefix = prefix;
            app.libraryState.offset = 0;
            void app.navigate("library");
        }),
        buildBarSection("入库演员 Top 10", topActresses, (name) => {
            app.libraryState.query = name;
            app.libraryState.offset = 0;
            void app.navigate("library");
        }),
    );

    const recentSection = el("section", undefined, "jhs-ext-stats-card");
    recentSection.append(el("h2", "最近操作流水"));
    const recentEntries = activity.slice().reverse().slice(0, 12);
    if (!recentEntries.length) {
        recentSection.append(el("p", "暂无近期操作记录", "jhs-ext-muted"));
    } else {
        for (const entry of recentEntries) {
            const line = el("div", undefined, "jhs-ext-activity-line");
            const codes = (entry.changes || []).slice(0, 5).map((/** @type {any} */ c) => c.carNum).join("、");
            line.append(
                el("span", formatUiDateTime(entry.createdAt), "jhs-ext-muted"),
                el("span", `${entry.type || "state"} · ${entry.changes?.length || 0} 项`),
                el("span", codes, "jhs-ext-muted"),
            );
            recentSection.append(line);
        }
    }

    host.append(heading, kpiGrid, chartGrid, recentSection);
}

/**
 * Render Backup & Migration view.
 * @param {HTMLElement} host
 * @param {any} app
 */
export async function renderBackupView(host, app) {
    const version = app.nextVersion();
    const sync = await app.client.call("sync.getStatus").catch(() => ({}));
    if (!app.isCurrentVersion(version)) return;

    host.replaceChildren();
    app.resetViewScope("backup");

    const heading = el("div", undefined, "jhs-extension-section-heading");
    heading.append(el("h1", "备份与迁移"), actionButton("打开完整备份设置", () => app.openInlineCommand("settings.open", "backup-panel"), "secondary"));

    const grid = el("div", undefined, "jhs-ext-two-col-grid");

    const exportCard = el("section", undefined, "jhs-ext-panel-card");
    exportCard.append(
        el("h2", "便携数据导出"),
        el("p", "导出全部作品状态、收藏演员、黑名单、个人评分及普通设置（不包含加密凭证）。", "jhs-ext-muted"),
        actionButton("导出数据", async () => {
            await app.run(async () => {
                const data = await app.client.call("backup.exportData");
                const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
                const anchor = el("a");
                anchor.href = url;
                anchor.download = `JHS-${new Date().toISOString().slice(0, 10)}.json`;
                anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            });
        }, "primary"),
    );

    const importCard = el("section", undefined, "jhs-ext-panel-card");
    importCard.append(
        el("h2", "从备份导入或迁移"),
        el("p", "支持导入油猴版或扩展版导出的 JSON 备份。导入前会自动建立本地恢复点并校验数据版本。", "jhs-ext-muted"),
    );
    const label = el("label", "导入 JHS 备份", "jhs-ext-file-label");
    const input = el("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
        void app.run(async () => {
            const file = input.files?.[0];
            if (!file) return;
            const data = JSON.parse(await file.text());
            if (!await confirmAction(app, "导入会应用备份中的数据，并在写入前自动建立本地恢复点。是否继续？", "确认导入备份")) return;
            await app.client.call("backup.createSnapshot", ["扩展导入前", "import"]);
            await app.client.call("backup.importData", [data]);
            await app.navigate("library");
        });
    });
    label.append(input);
    importCard.append(label);

    const davCard = el("section", undefined, "jhs-ext-panel-card");
    davCard.append(
        el("h2", "WebDAV 多端同步"),
        el("p", `当前状态：${sync.message || sync.state || "待配置"}`, "jhs-ext-muted"),
        sync.lastSuccessAt ? el("p", `上次成功同步：${formatUiDateTime(sync.lastSuccessAt)}`, "jhs-ext-muted") : el("p", "配置 WebDAV 后，扩展会以独立设备身份与油猴版及其他浏览器合并数据。", "jhs-ext-muted"),
    );
    const davActions = el("div", undefined, "jhs-ext-toolbar-actions");
    davActions.append(
        actionButton("立即同步", () => app.run(async () => { await app.client.call("sync.check"); await renderBackupView(host, app); }), "secondary"),
        actionButton("配置与恢复点", () => app.openInlineCommand("settings.open", "backup-panel"), "ghost"),
    );
    davCard.append(davActions);

    grid.append(exportCard, importCard, davCard);
    host.append(heading, grid);
}

/**
 * Render Site Permissions view.
 * @param {HTMLElement} host
 * @param {any} app
 */
export async function renderPermissionsView(host, app) {
    const version = app.nextVersion();
    const grantedPermissions = await chrome.permissions.getAll().catch(() => ({ origins: [] }));
    if (!app.isCurrentVersion(version)) return;

    host.replaceChildren();
    app.resetViewScope("permissions");

    host.append(el("h1", "站点授权"));
    const card = el("section", undefined, "jhs-ext-panel-card");
    card.append(el("h2", "授权自定义来源"), el("p", "为自定义 HTTPS 镜像站、WebDAV 服务或本地媒体库授权精确来源访问权限。", "jhs-ext-muted"));
    const formRow = el("div", undefined, "jhs-ext-inline-form");
    const label = el("label", "自定义来源地址");
    const input = el("input", undefined, "jhs-field");
    input.type = "url";
    input.placeholder = "https://…";
    label.append(input);
    const grant = el("button", "授权来源", "jhs-btn jhs-btn--primary");
    grant.type = "button";
    grant.addEventListener("click", () => {
        let url;
        try {
            url = new URL(input.value);
            const origins = app.context.services.settings.snapshot().trustedLocalOrigins || [];
            new ExternalUrlPolicy({ localOrigins: origins }).assertAllowed(url, { trustClass: origins.includes(url.origin) || url.protocol === "http:" ? "user-local" : "custom-public", expectedOrigin: url.origin });
        } catch (error) {
            app.setStatus(error instanceof Error ? error.message : String(error));
            return;
        }
        chrome.permissions.request({ origins: [`${url.origin}/*`] }).then(async granted => {
            app.setStatus(granted ? "来源已授权" : "来源授权已取消");
            if (granted && url.protocol === "https:") await app.client.call("sites.register", [url.origin]);
            await renderPermissionsView(host, app);
        }).catch(error => { app.setStatus(error.message); });
    });
    formRow.append(label, grant);
    card.append(formRow);

    const listCard = el("section", undefined, "jhs-ext-panel-card");
    const trustedLocal = app.context.services.settings.snapshot().trustedLocalOrigins || [];
    const origins = grantedPermissions?.origins || [];
    listCard.append(el("h2", `已授权来源 (${origins.length})`));
    const originList = el("div", undefined, "jhs-ext-origin-list");
    for (const origin of origins) {
        const badge = el("span", origin, "jhs-badge jhs-badge--neutral");
        originList.append(badge);
    }
    if (!origins.length) originList.append(el("p", "暂无额外已授权来源", "jhs-ext-muted"));
    listCard.append(originList);
    if (trustedLocal.length) {
        listCard.append(el("h3", "受信任的本地服务来源"), el("p", trustedLocal.join(" · "), "jhs-ext-muted"));
    }

    host.append(card, listCard);
}

/**
 * Render the Side Panel Current Page / Cross-Site Companion view.
 * @param {HTMLElement} host
 * @param {any} app
 */
export async function renderSidePanelCurrentView(host, app) {
    const version = app.nextVersion();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = tab?.id ? await chrome.tabs.sendMessage(tab.id, { channel: "jhs-current-movie" }, { frameId: 0 }).catch(error => { if (!/receiving end does not exist|could not establish connection/i.test(error.message)) throw error; return null; }) : null;
    if (!app.isCurrentVersion(version)) return;

    host.replaceChildren();
    const scope = app.resetViewScope("current");

    // Always provide a quick cross-site lookup input at the top of Side Panel
    const lookupBox = el("div", undefined, "jhs-ext-side-lookup");
    const lookupInput = el("input", undefined, "jhs-field");
    lookupInput.type = "search";
    lookupInput.placeholder = "输入任意番号直达详情与磁力…";
    lookupInput.setAttribute("aria-label", "跨站番号直达");
    const lookupBtn = el("button", "检索", "jhs-btn jhs-btn--secondary jhs-btn--sm");
    lookupBtn.type = "button";
    const runLookup = () => {
        const code = normalizeCarNum(lookupInput.value);
        if (!code) { app.setStatus("请输入有效番号，如 ABC-123"); return; }
        void app.openMovieDrawer({ carNum: code });
    };
    scope.listen(lookupBtn, "click", runLookup);
    scope.listen(lookupInput, "keydown", (/** @type {KeyboardEvent} */ e) => { if (e.key === "Enter") runLookup(); });
    lookupBox.append(lookupInput, lookupBtn);

    if (response?.mode === "list" && Array.isArray(response.items)) {
        const allRecords = await app.client.call("state.getCarList").catch(() => []);
        if (!app.isCurrentVersion(version)) return;
        const recordMap = new Map((allRecords || []).map((/** @type {any} */ r) => [normalizeCarNum(r.carNum), r]));
        const items = response.items.map((/** @type {any} */ item) => {
            const code = normalizeCarNum(item.carNum);
            const rec = recordMap.get(code);
            return { ...item, carNum: code, stateFlags: normalizeStateFlags(rec?.stateFlags) };
        });
        const counts = computeLibraryStats(items);
        const header = el("div", undefined, "jhs-ext-side-header");
        header.append(el("h1", "本页影片汇总"), el("p", response.title || response.url || "", "jhs-ext-muted"));
        const statsStrip = el("div", undefined, "jhs-ext-side-stats");
        statsStrip.append(
            el("span", `共 ${items.length}`, "jhs-badge jhs-badge--neutral"),
            el("span", `未标记 ${counts.pending}`, "jhs-badge jhs-badge--accent"),
            el("span", `已看 ${counts.watchedRaw}`, "jhs-badge jhs-badge--watch"),
            el("span", `下载 ${counts.downloadedRaw}`, "jhs-badge jhs-badge--down"),
            el("span", `收藏 ${counts.favoriteRaw}`, "jhs-badge jhs-badge--fav"),
        );

        let listFilter = "all";
        const filterRow = el("div", undefined, "jhs-ext-chip-row");
        const listEl = el("div", undefined, "jhs-ext-side-list");

        const pendingCodes = items.filter((/** @type {any} */ i) => i.eligible && !hasAnyState(i.stateFlags)).map((/** @type {any} */ i) => i.carNum);
        const batchWatchBtn = actionButton(`本页未标记设为已看 (${pendingCodes.length})`, async () => {
            if (!pendingCodes.length) return;
            await app.client.call("state.patch", [pendingCodes, { watched: true }, { type: "list-batch-state" }]);
            await renderSidePanelCurrentView(host, app);
        }, "secondary");
        batchWatchBtn.disabled = !pendingCodes.length;

        const drawList = () => {
            filterRow.replaceChildren();
            for (const [key, label] of [["all", "全部"], ["pending", "未标记"], ["favorite", "收藏"], ["downloaded", "下载"]]) {
                const chip = el("button", label, "jhs-chip jhs-ext-chip-sm");
                chip.type = "button";
                chip.setAttribute("aria-pressed", String(listFilter === key));
                scope.listen(chip, "click", () => { listFilter = key; drawList(); });
                filterRow.append(chip);
            }
            listEl.replaceChildren();
            const filtered = items.filter((/** @type {any} */ item) => {
                if (listFilter === "pending") return !hasAnyState(item.stateFlags);
                if (listFilter === "favorite") return item.stateFlags.favorite;
                if (listFilter === "downloaded") return item.stateFlags.downloaded;
                return true;
            });
            for (const item of filtered) {
                const card = el("article", undefined, "jhs-ext-side-item");
                const top = el("div", undefined, "jhs-ext-side-item__top");
                const codeBtn = el("button", item.carNum, "jhs-ext-code-btn");
                codeBtn.type = "button";
                scope.listen(codeBtn, "click", () => {
                    if (tab?.id) void chrome.tabs.sendMessage(tab.id, { channel: "jhs-current-movie", action: "focus-car", carNum: item.carNum }, { frameId: 0 }).catch(error => { if (!/receiving end does not exist|could not establish connection/i.test(error.message)) app.setStatus(error.message); });
                    void app.openMovieDrawer(item);
                });
                const flagsWrap = el("div", undefined, "jhs-ext-side-item__flags");
                for (const [flag, shortLabel] of [["favorite", "藏"], ["downloaded", "下"], ["watched", "看"], ["blocked", "蔽"]]) {
                    const btn = actionButton(shortLabel, async () => {
                        await app.client.call("state.toggle", [item.carNum, flag, { metadata: { url: item.url, names: item.names || "", publishTime: item.publishTime || "" } }]);
                        await renderSidePanelCurrentView(host, app);
                    });
                    btn.classList.add("jhs-btn--sm");
                    btn.setAttribute("aria-pressed", String(Boolean(item.stateFlags[flag])));
                    flagsWrap.append(btn);
                }
                top.append(codeBtn, flagsWrap);
                card.append(top);
                if (item.title) card.append(el("p", item.title, "jhs-ext-side-item__title"));
                listEl.append(card);
            }
        };

        host.append(lookupBox, header, statsStrip, batchWatchBtn, filterRow, listEl);
        drawList();
        return;
    }

    if (!response?.carNum) {
        host.append(
            lookupBox,
            el("h1", "当前作品"),
            el("p", "在支持站点的详情页或列表页打开作品，或使用上方番号直达框在任意网页检索详情与磁力。", "jhs-ext-muted"),
        );
        return;
    }

    // Detail mode in Side Panel
    const [state, ratings] = await Promise.all([
        app.client.call("state.getState", [response.carNum]),
        app.client.call("state.getPersonalRatings").catch(() => ({})),
    ]);
    if (!app.isCurrentVersion(version)) return;

    const currentRating = ratings?.[response.carNum]?.rating ?? null;
    const detailHeader = el("div", undefined, "jhs-ext-side-detail-head");
    if (response.coverUrl) {
        const thumb = el("img", undefined, "jhs-ext-side-cover");
        thumb.src = response.coverUrl;
        thumb.alt = response.carNum;
        detailHeader.append(thumb);
    }
    const detailText = el("div", undefined, "jhs-ext-side-detail-meta");
    detailText.append(el("h1", response.carNum), el("p", response.title || "", "jhs-ext-side-detail-title"));
    if (response.actress || response.publishTime) {
        detailText.append(el("p", `${response.actress || ""}${response.actress && response.publishTime ? " · " : ""}${response.publishTime || ""}`, "jhs-ext-muted"));
    }
    detailHeader.append(detailText);

    const stateGrid = el("div", undefined, "jhs-ext-side-states");
    for (const [flag, label] of [["favorite", "收藏"], ["downloaded", "已下载"], ["watched", "已看"], ["blocked", "屏蔽"]]) {
        const control = actionButton(label, async () => {
            await app.client.call("state.toggle", [response.carNum, flag, { metadata: { url: response.url, names: response.actress || response.title } }]);
            await renderSidePanelCurrentView(host, app);
        });
        control.disabled = response.eligible === false;
        control.setAttribute("aria-pressed", String(Boolean(state?.stateFlags?.[flag])));
        stateGrid.append(control);
    }

    // Quick star rating in side panel
    const ratingRow = el("div", undefined, "jhs-ext-rating-bar");
    ratingRow.append(el("span", "评分", "jhs-ext-rating-label"));
    for (let star = 1; star <= 5; star++) {
        const active = currentRating != null && star <= currentRating;
        const starBtn = actionButton(active ? "★" : "☆", async () => {
            const next = currentRating === star ? null : star;
            await app.client.call("state.setPersonalRating", [[response.carNum], next]);
            await renderSidePanelCurrentView(host, app);
        });
        starBtn.classList.add("jhs-btn--sm", "jhs-ext-star-btn");
        starBtn.setAttribute("aria-pressed", String(active));
        ratingRow.append(starBtn);
    }

    const fullDrawerBtn = actionButton("展开完整详情、预览与跨源磁力", () => app.openMovieDrawer(response), "primary");
    fullDrawerBtn.classList.add("jhs-ext-full-width");

    host.append(lookupBox, detailHeader, stateGrid, ratingRow, fullDrawerBtn);

    if (Array.isArray(response.magnets) && response.magnets.length) {
        const magSection = el("section", undefined, "jhs-ext-side-magnets");
        magSection.append(el("h2", `本页磁力 (${response.magnets.length})`));
        for (const item of response.magnets.slice(0, 12)) {
            const row = el("article", undefined, "jhs-ext-side-magnet-row");
            const titleLine = el("div", item.title || response.carNum, "jhs-ext-side-magnet-row__title");
            const metaLine = el("div", undefined, "jhs-ext-side-magnet-row__meta");
            if (item.hasSubtitleTag) metaLine.append(el("span", "中字", "jhs-badge jhs-badge--watch"));
            if (item.hasHdTag) metaLine.append(el("span", "高清", "jhs-badge jhs-badge--accent"));
            if (item.sizeText) metaLine.append(el("span", item.sizeText, "jhs-ext-muted"));
            const acts = el("div", undefined, "jhs-ext-side-magnet-row__actions");
            acts.append(
                actionButton("复制", async () => { await app.context.services.clipboard.copyText("磁力链接", item.resource); app.setStatus("已复制磁力链接"); }),
                actionButton("115", () => app.quickSubmitOffline("one115", item.resource, response), "secondary"),
                actionButton("123", () => app.quickSubmitOffline("pan123", item.resource, response), "primary"),
            );
            row.append(titleLine, metaLine, acts);
            magSection.append(row);
        }
        host.append(magSection);
    }
}

/**
 * Render the Cross-Site Quick Search & Code Lookup view in Side Panel.
 * @param {HTMLElement} host
 * @param {any} app
 */
export async function renderSidePanelSearchView(host, app) {
    const version = app.nextVersion();
    const [records, actresses] = await Promise.all([
        app.client.call("state.getCarList").catch(() => []),
        app.client.call("state.getFavoriteActressList").catch(() => []),
    ]);
    if (!app.isCurrentVersion(version)) return;

    host.replaceChildren();
    const scope = app.resetViewScope("search");

    const heading = el("h1", "跨站速查");
    const lookupBar = el("div", undefined, "jhs-ext-side-lookup");
    const input = el("input", undefined, "jhs-field");
    input.type = "search";
    input.placeholder = "搜索本地库/演员，或输入任意番号直达";
    input.setAttribute("aria-label", "速查搜索");
    const directBtn = el("button", "直达", "jhs-btn jhs-btn--primary jhs-btn--sm");
    directBtn.type = "button";
    const openDirect = () => {
        const code = normalizeCarNum(input.value);
        if (!code) { app.setStatus("请输入有效番号，如 ABC-123"); return; }
        void app.openMovieDrawer({ carNum: code });
    };
    scope.listen(directBtn, "click", openDirect);
    scope.listen(input, "keydown", (/** @type {KeyboardEvent} */ e) => { if (e.key === "Enter" && normalizeCarNum(input.value)) openDirect(); });
    lookupBar.append(input, directBtn);

    const resultsHost = el("div", undefined, "jhs-ext-side-list");
    const draw = () => {
        const query = input.value.trim().toLowerCase();
        resultsHost.replaceChildren();
        const matchedActors = (actresses || []).filter((/** @type {any} */ a) => {
            if (!query) return false;
            return `${a.name || ""} ${(a.allName || []).join(" ")} ${a.starId || ""}`.toLowerCase().includes(query);
        }).slice(0, 6);
        if (matchedActors.length) {
            resultsHost.append(el("h2", "收藏演员", "jhs-ext-side-subheading"));
            for (const actor of matchedActors) {
                const row = el("article", undefined, "jhs-ext-side-item");
                const link = el("a", `${actor.name || actor.starId} (${actor.newVideoList?.length || 0} 部新作)`);
                link.href = `https://javdb.com/actors/${encodeURIComponent(actor.starId)}`;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                row.append(link);
                resultsHost.append(row);
            }
        }
        const matchedMovies = (records || []).filter((/** @type {any} */ r) => {
            if (!query) return true;
            return `${r.carNum} ${r.title || ""} ${r.names || ""} ${r.remark || ""}`.toLowerCase().includes(query);
        }).slice(0, 24);
        resultsHost.append(el("h2", query ? `匹配作品 (${matchedMovies.length})` : `最近作品 (${records.length})`, "jhs-ext-side-subheading"));
        if (!matchedMovies.length) {
            resultsHost.append(el("p", "本地库无匹配记录，点击右上“直达”可直接在线检索番号。", "jhs-ext-muted"));
        }
        for (const rec of matchedMovies) {
            const flags = normalizeStateFlags(rec.stateFlags);
            const card = el("article", undefined, "jhs-ext-side-item");
            const top = el("div", undefined, "jhs-ext-side-item__top");
            const codeBtn = el("button", rec.carNum, "jhs-ext-code-btn");
            codeBtn.type = "button";
            scope.listen(codeBtn, "click", () => { void app.openMovieDrawer(rec); });
            const badges = el("div", undefined, "jhs-ext-side-item__flags");
            if (flags.favorite) badges.append(el("span", "藏", "jhs-badge jhs-badge--fav"));
            if (flags.downloaded) badges.append(el("span", "下", "jhs-badge jhs-badge--down"));
            if (flags.watched) badges.append(el("span", "看", "jhs-badge jhs-badge--watch"));
            if (flags.blocked) badges.append(el("span", "蔽", "jhs-badge jhs-badge--filter"));
            top.append(codeBtn, badges);
            card.append(top);
            if (rec.title || rec.names) card.append(el("p", rec.title || rec.names, "jhs-ext-side-item__title"));
            resultsHost.append(card);
        }
    };
    scope.listen(input, "input", draw);
    host.append(heading, lookupBar, resultsHost);
    draw();
}
