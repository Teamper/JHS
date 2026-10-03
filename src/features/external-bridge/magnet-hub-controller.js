// @ts-check

import { CACHE_TTL, ProviderError } from "../../core/cache-policy.js";
import { escapeHtml } from "../../core/constants.js";
import { mapLimit } from "../../core/feature-helpers.js";
import { calcMagnetScore } from "../../core/magnet-quality.js";
import { createMovieContext } from "../../core/movie-context.js";
import { BUILT_IN_NATIVE_MAGNET_SOURCES } from "../../services/resource-settings-service.js";
import { MagnetSourceRegistry, applyMagnetRules, deduplicateMagnetResults, parseCustomMagnetResponse, parseNativeMagnets, validateCustomMagnetSource } from "../../services/magnet-source-registry.js";

/** @typedef {any} JQueryHandle */
/** @typedef {{ id: string, name: string, enabled?: boolean, applicable?: boolean, priority?: number, baseUrl?: string, search: (keyword: string, root?: JQueryHandle | Document) => Promise<MagnetResult[]>, targetUrl: (keyword: string) => string, targetPage?: string, parseHtml?: Function, parseJson?: Function, url?: string }} MagnetSource */
/** @typedef {{ title: string, magnet: string, size?: string | number, date?: string, seeders?: number, tags?: string[], customTagWeight?: number, filterPenalty?: number, hidden?: boolean, _score?: any, [key: string]: any }} MagnetResult */
/** @typedef {{ id: string, name: string, enabled?: boolean, searchUrlTemplate: string, targetUrlTemplate: string, parserType?: string, [key: string]: any }} CustomSource */
/** @typedef {{ root?: JQueryHandle | Element, method?: string, body?: unknown, headers?: Record<string, string>, responseType?: string, ttlMs?: number, custom?: boolean, hosts?: string[] }} MagnetRequestOptions */
/** @typedef {{ movieContext?: import("../../core/movie-context.js").MovieContext, root?: JQueryHandle | Element, initialEngineId?: string, requireExternal?: boolean, isActive?: () => boolean }} MagnetHubOptions */
/** @typedef {{ source: MagnetSource, status: "success" | "empty" | "error", results: MagnetResult[] }} MagnetSourceOutcome */
/** @typedef {{ generation: number, engines: MagnetSource[], outcomes: MagnetSourceOutcome[], engineId: string, pending: boolean, isActive: () => boolean }} MagnetPanelState */

export const MAGNET_HUB_STYLES = `
    .magnet-container { width:100%; margin:var(--jhs-space-4) auto; }
    .magnet-tabs { display:flex; justify-content:space-between; margin-bottom:var(--jhs-space-3); border-bottom:1px solid var(--jhs-border); }
    .magnet-results { min-height:200px; }
    .magnet-result { position:relative; padding:var(--jhs-space-3); border-bottom:1px solid var(--jhs-border); }
    .magnet-result:hover { background:var(--jhs-surface-hover); }
    .magnet-title { overflow:hidden; margin-bottom:var(--jhs-space-1); padding-right:80px; font-weight:700; text-overflow:ellipsis; white-space:nowrap; }
    .magnet-info { display:flex; justify-content:space-between; margin-bottom:var(--jhs-space-1); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
    .magnet-loading { padding:var(--jhs-space-4); text-align:center; }
    .magnet-error { padding:var(--jhs-space-2); color:var(--jhs-danger); }
    .magnet-copy { position:absolute; top:var(--jhs-space-2); right:var(--jhs-space-3); }
`;

export class MagnetHubController {
    /** @param {{storage: any, http: any, magnet: any, resourceSettings: any, scope: any, site: string, jquery: (value: any) => JQueryHandle, clipboard: any, diagnostics?: any, document?: Document, window?: Window}} options */
    constructor(options) {
        this.storage = options.storage;
        this.http = options.http;
        this.magnet = options.magnet;
        this.scope = options.scope;
        this.site = options.site;
        this.jquery = options.jquery;
        this.clipboard = options.clipboard;
        this.diagnostics = options.diagnostics;
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? globalThis.window;
        this.resourceSettings = options.resourceSettings;
        this.managedByFeature = true;
        this.runtimeStatus = "managed-feature";
        /** @type {MagnetSourceRegistry} */ this.sourceRegistry = new MagnetSourceRegistry();
        /** @type {MagnetSource[]} */ this.searchEngines = [];
    }
    async initializeSources() {
        const settings = this.resourceSettings, magnet = this.magnet, overrides = await settings.getBuiltInSources();
        const custom = /** @type {CustomSource[]} */ (/** @type {unknown} */ (await settings.getMagnetSources()));
        const integrationSources = magnet.getBuiltInSources(), catalog = [...BUILT_IN_NATIVE_MAGNET_SOURCES, ...integrationSources];
        const configured = (/** @type {string} */ id) => ({ ...(catalog.find((/** @type {MagnetSource} */ source) => source.id === id) || {}), ...(overrides.find((/** @type {MagnetSource} */ source) => source.id === id) || {}) });
        const externalSources = integrationSources.map(((/** @type {MagnetSource} */ source) => {
            const config = configured(source.id), baseUrl = String(config.baseUrl || source.baseUrl).replace(/\/$/, "");
            return {
                ...source, ...config,
                search: async (/** @type {string} */ keyword) => magnet.searchSource(source.id, keyword, { baseUrl, scope: this.scope }),
                targetUrl: (/** @type {string} */ keyword) => magnet.getSourceTargetUrl(source.id, keyword, { baseUrl }),
            };
        }));
        this.sourceRegistry = new MagnetSourceRegistry([{
            name: "JavDB 本站", id: "native-javdb", applicable: this.site === "javdb", enabled: this.site === "javdb", priority: 1, search: async (/** @type {string} */ keyword, root = this.document) => parseNativeMagnets((/** @type {any} */ (root))?.jquery ? (/** @type {any} */ (root))[0] : root, "javdb"), targetUrl: () => this.window.location.href
        }, { name: "JavBus 本站", id: "native-javbus", applicable: this.site === "javbus", enabled: this.site === "javbus", priority: 2, search: async (/** @type {string} */ keyword, root = this.document) => parseNativeMagnets((/** @type {any} */ (root))?.jquery ? (/** @type {any} */ (root))[0] : root, "javbus"), targetUrl: () => this.window.location.href
        }, ...externalSources
        ].map((source => { const config = configured(source.id), applicable = source.applicable ?? true; return { ...source, ...config, enabled: applicable && (config.enabled ?? source.enabled ?? true), search: source.search, targetUrl: source.targetUrl }; })));
        custom.filter((/** @type {CustomSource} */ source) => source.enabled).forEach((/** @type {CustomSource} */ config) => this.sourceRegistry.register({ ...config, id: `custom:${config.id}`, search: (/** @type {string} */ keyword) => this.searchCustomSource(config, keyword), targetUrl: (/** @type {string} */ keyword) => config.targetUrlTemplate.replaceAll("{keyword}", encodeURIComponent(keyword)) }));
        const enabled = this.sourceRegistry.getEnabledSources().map((source => ({ ...source, targetPage: source.targetUrl("{keyword}").replace("%7Bkeyword%7D", "{keyword}") })));
        this.searchEngines = enabled.length ? [{ id: "all", name: "全部", priority: 0, targetPage: "#", targetUrl: () => "#", search: (/** @type {string} */ keyword, /** @type {JQueryHandle | Document} */ root) => this.searchAllSources(enabled, keyword, root) }, ...enabled] : [];
    }
    getName() {
        return "MagnetHubPlugin";
    }
    async initCss() {
        return MAGNET_HUB_STYLES;
    }
    /** Create a magnet surface carrying the owning movie context to offline actions. */
    /** @param {string | MagnetHubOptions} movie @param {MagnetHubOptions} [options] */
    async createMagnetHub(movie, options = {}) {
        await this.initializeSources();
        const input = typeof movie === "string" ? null : movie;
        const movieContext = typeof movie === "string" ? createMovieContext({ carNum: movie }) : input?.movieContext;
        if (!movieContext?.carNum) {
            const empty = this.jquery('<div class="magnet-container jhs-ui"></div>');
            return empty.append(this.jquery('<div class="magnet-error"></div>').text("无法确定影片身份，未加载磁力"));
        }
        const keyword = movieContext.carNum.replace("FC2-", "");
        const root = (options.root ?? input?.root) ? this.jquery(options.root ?? input?.root) : this.jquery(this.document), engines = [ ...this.searchEngines ];
        const storage = this.storage, t = this.jquery('<div class="magnet-container jhs-ui"></div>'), n = this.jquery('<div class="magnet-tabs"></div>'), a = "jhs_magnetHub_selectedEngine", i = storage.getLocal(a);
        t.data("jhsMovieContext", movieContext);
        const o = this.jquery('<div class="magnet-tabs__options" role="tablist" aria-label="磁力来源"></div>');
        const initialEngine = engines.find((engine => engine.id === (options.initialEngineId ?? input?.initialEngineId ?? i))) || engines[0];
        if (!initialEngine) return t.append(this.jquery('<div class="magnet-error"></div>').text("暂无可用磁力来源，请前往设置启用来源"));
        /** @type {MagnetSource} */
        let currentEngine = initialEngine;
        engines.forEach((engine => o.append(this.jquery('<button type="button" class="jhs-btn magnet-tab" role="tab" aria-selected="false" tabindex="-1"></button>').attr("data-engine", engine.id).text(engine.name).toggleClass("active", engine.id === currentEngine.id))));
        const target = this.jquery('<a class="jhs-btn jhs-btn--ghost" data-jhs-role="magnet-target" target="_blank" rel="noopener noreferrer">原网页</a>').attr("href", (currentEngine.targetPage || "#").replace("{keyword}", encodeURIComponent(keyword))).toggle("all" !== currentEngine.id);
        n.append(o), n.append(target),
        o.find(".magnet-tab.active").attr({ "aria-selected": "true", tabindex: "0" }),
        t.append(n);
        const r = this.jquery('<div class="magnet-results" aria-live="polite"></div>');
        /** @type {MagnetPanelState} */
        const state = { generation: 0, engines, outcomes: [], engineId: "", pending: false, isActive: options.isActive ?? input?.isActive ?? (() => root[0]?.isConnected !== false) };
        r.data("jhsMagnetPanel", state);
        /** @param {string} id @param {boolean} [remember] @param {boolean} [requireExternal] */
        const selectEngine = (id, remember = false, requireExternal = false) => {
            const engine = engines.find((candidate => candidate.id === id));
            if (!engine || !state.isActive() || this.scope?.disposed) return;
            currentEngine = engine;
            t.find('[data-jhs-role="magnet-target"]').attr("href", engine.targetUrl(keyword)).toggle("all" !== id);
            if (remember) storage.setLocal(a, id);
            o.find(".magnet-tab").removeClass("active").attr({ "aria-selected": "false", tabindex: "-1" });
            o.find(".magnet-tab").filter((/** @type {number} */ _, /** @type {HTMLElement} */ tab) => tab.dataset.engine === id).addClass("active").attr({ "aria-selected": "true", tabindex: "0" });
            const hasExternal = engines.some((source => source.id !== "all" && !source.id.startsWith("native-")));
            if (state.engineId === id && !remember && (!requireExternal || hasExternal)) return;
            void this.searchEngine(r, engine, keyword, root, { requireExternal });
        };
        t.data("jhsOpenExternalMagnets", () => selectEngine("all", false, true));
        t.append(r);
        t.on("click", ".magnet-tab", ((/** @type {MouseEvent} */ event) => selectEngine(this.jquery(event.currentTarget).data("engine"), true)));
        r.on("click", '[data-jhs-action="retry-magnets"]', () => void this.searchEngine(r, currentEngine, keyword, root, { retryFailed: true }));
        this.bindResultActions(r);
        t.on("keydown", ".magnet-tab", ((/** @type {KeyboardEvent} */ e) => {
            if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(e.key)) return;
            e.preventDefault();
            const n = t.find(".magnet-tab"), a = n.index(e.currentTarget);
            let i = "Home" === e.key ? 0 : "End" === e.key ? n.length - 1 : "ArrowRight" === e.key ? (a + 1) % n.length : (a - 1 + n.length) % n.length;
            n.eq(i).trigger("click").trigger("focus");
        }));
        selectEngine(initialEngine.id, false, options.requireExternal ?? input?.requireExternal ?? false);
        return t;
    }
    /** Query one panel without allowing old responses to replace a newer selection. */
    /** @param {JQueryHandle} panel @param {MagnetSource} engine @param {string} keyword @param {JQueryHandle | Document} [root] @param {{retryFailed?: boolean, requireExternal?: boolean}} [options] */
    async searchEngine(panel, engine, keyword, root = this.jquery(this.document), options = {}) {
        /** @type {MagnetPanelState} */
        const state = panel.data("jhsMagnetPanel") || { generation: 0, engines: this.searchEngines, outcomes: [], engineId: "", pending: false, isActive: () => true };
        panel.data("jhsMagnetPanel", state);
        if (!state.isActive() || this.scope?.disposed || (options.retryFailed && state.pending)) return;
        const previous = state.engineId === engine.id ? state.outcomes : [];
        const sources = engine.id === "all" ? state.engines.filter((source => source.id !== "all")) : [engine];
        const generation = ++state.generation;
        state.engineId = engine.id;
        const canCommit = () => generation === state.generation && state.isActive() && !this.scope?.disposed;
        if (options.requireExternal && !sources.some((source => !source.id.startsWith("native-")))) {
            state.pending = false;
            state.outcomes = [];
            panel.empty().append(this.jquery('<div class="magnet-query-status" role="status"></div>').text("外部磁力来源未启用，请在设置 → 资源来源 → 磁力来源中启用"));
            return;
        }
        const retrySources = previous.filter((outcome => outcome.status === "error")).map((outcome => outcome.source));
        const selected = options.retryFailed && retrySources.length ? retrySources : sources;
        state.pending = true;
        panel.find('[data-jhs-action="retry-magnets"]').prop("disabled", true);
        if (!options.retryFailed) panel.empty();
        panel.find(".magnet-loading").remove();
        panel.prepend(this.jquery('<div class="magnet-loading" role="status"></div>').text(`正在从 ${engine.name} 搜索 "${keyword}"…`));
        try {
            const queried = await this.querySources(selected, keyword, root);
            if (!canCommit()) return;
            const outcomes = options.retryFailed && retrySources.length
                ? previous.map((outcome => queried.find((item => item.source.id === outcome.source.id)) || outcome)) : queried;
            const raw = /** @type {MagnetResult[]} */ (deduplicateMagnetResults(outcomes.flatMap((outcome => outcome.results))));
            const results = await this.applyRuntimeRules(raw);
            if (!canCommit()) return;
            state.outcomes = outcomes;
            state.pending = false;
            const failures = outcomes.filter((outcome => outcome.status === "error"));
            const allFailed = outcomes.length > 0 && failures.length === outcomes.length;
            if (results.length) await this.displayResults(panel, results, engine.name);
            else panel.empty().append(this.jquery('<div class="magnet-query-status" role="status"></div>').text(
                allFailed ? "磁力查询失败" : raw.length ? "相关资源已被当前过滤规则隐藏" : failures.length ? "已完成查询的来源未找到资源，部分来源查询失败" : "未找到相关资源"
            ));
            if (!canCommit()) return;
            if (failures.length) {
                const warning = this.jquery('<div class="magnet-error" role="status"></div>').text(`查询失败：${failures.map((outcome => outcome.source.name)).join("、")} `);
                warning.append(this.jquery('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm" data-jhs-action="retry-magnets"></button>').text(engine.id === "all" ? "重试失败来源" : "重试"));
                panel.prepend(warning);
            }
        } catch (error) {
            if (!canCommit()) return;
            state.pending = false;
            this.diagnostics?.recordError?.({ source: "magnet-hub", message: "磁力查询结果处理失败", error });
            panel.empty().append(this.jquery('<div class="magnet-error" role="status"></div>').text("磁力查询结果处理失败，请检查资源规则后重试 ").append(this.jquery('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm" data-jhs-action="retry-magnets">重试</button>')));
        }
    }
    /** Keep source failures separate from successful empty searches. */
    /** @param {MagnetSource[]} sources @param {string} keyword @param {JQueryHandle | Document} root @returns {Promise<MagnetSourceOutcome[]>} */
    async querySources(sources, keyword, root) {
        return mapLimit(sources, 3, async source => {
            try {
                const results = await source.search(keyword, root);
                return /** @type {MagnetSourceOutcome} */ ({ source, status: results.length ? "success" : "empty", results });
            } catch (error) {
                this.diagnostics?.recordError?.({ source: "magnet-hub", message: `磁力源 ${source.name} 请求失败`, error });
                return /** @type {MagnetSourceOutcome} */ ({ source, status: "error", results: [] });
            }
        });
    }
    /** Bind delegated copy actions once for this result panel. @param {JQueryHandle} panel */
    bindResultActions(panel) {
        if (panel.data("jhsMagnetCopyBound")) return;
        panel.data("jhsMagnetCopyBound", true).on("click", ".copy-btn", async (/** @type {MouseEvent} */ event) => {
            const button = this.jquery(event.currentTarget), label = button.text();
            if (!await this.clipboard.copyText("磁力链接", button.data("magnet"))) return;
            button.addClass("copied").text("已复制");
            setTimeout(() => button.removeClass("copied").text(label), 2000);
        });
    }
    /** @param {string} keyword */
    async searchCustomSources(keyword) {
        const configs = /** @type {any[]} */ (await this.resourceSettings.getMagnetSources());
        const enabled = configs.filter((/** @type {CustomSource} */ config) => config.enabled)
            .map((/** @type {CustomSource} */ config) => /** @type {CustomSource} */ (validateCustomMagnetSource(config)));
        const groups = await mapLimit(enabled, 4, (async (/** @type {CustomSource} */ config) => {
            const url = config.searchUrlTemplate.replaceAll("{keyword}", encodeURIComponent(keyword));
            try {
                const payload = await this.requestSource(config.id, url, { ttlMs: CACHE_TTL.magnet, custom: true, responseType: config.parserType === "json" ? "json" : "text" });
                const parsed = "json" === config.parserType && "string" === typeof payload ? JSON.parse(payload) : payload;
                return parseCustomMagnetResponse(config, parsed, config.id);
            } catch (cause) { const error = /** @type {{ code?: string, message?: string, status?: number, retryable?: boolean }} */ (cause); this.diagnostics?.recordError?.({ source: "magnet-hub", message: `自定义磁力源 ${config.name} 失败`, error: new ProviderError(config.id, error.code || "HTTP_ERROR", error.message || String(cause), { cause, url, status: error.status, retryable: error.retryable }) }); return []; }
        }));
        return deduplicateMagnetResults(groups.flat());
    }
    /** @param {CustomSource} config @param {string} keyword */
    async searchCustomSource(config, keyword) {
        const url = config.searchUrlTemplate.replaceAll("{keyword}", encodeURIComponent(keyword));
        const payload = await this.requestSource(config.id, url, { ttlMs: CACHE_TTL.magnet, custom: true, responseType: config.parserType === "json" ? "json" : "text" });
        return parseCustomMagnetResponse(config, "json" === config.parserType && "string" === typeof payload ? JSON.parse(payload) : payload, config.id);
    }
    /** @param {MagnetSource[]} sources @param {string} keyword @param {JQueryHandle | Document} [root] */
    async searchAllSources(sources, keyword, root = this.jquery(this.document)) { const groups = await mapLimit(sources, 3, (async source => { try { return await source.search(keyword, root); } catch (error) { this.diagnostics?.recordError?.({ source: "magnet-hub", message: `磁力源 ${source.name} 聚合失败`, error }); return []; } })); return deduplicateMagnetResults(groups.flat()); }
    /** 通过统一 HTTP/URL Policy 边界请求磁力来源。 */
    /** @param {string} sourceId @param {string} url @param {MagnetRequestOptions} [options] */
    async requestSource(sourceId, url, options = {}) {
        const response = await this.http.request({
            providerId: `magnet:${sourceId}`, method: options.method || "GET", url, body: options.body,
            headers: options.headers, responseType: options.responseType || "text",
            cacheScope: options.method && options.method !== "GET" ? "none" : "public", ttlMs: options.ttlMs ?? CACHE_TTL.magnet,
            urlPolicy: options.custom ? { trustClass: "custom-public" } : { trustClass: "builtin-public", hosts: options.hosts || [new URL(url).hostname] },
        }, this.scope);
        return response.data;
    }
    /** @param {MagnetResult[]} results */
    async applyRuntimeRules(results) {
        const service = this.resourceSettings, [tags, filters] = await Promise.all([service.getMagnetTagRules(), service.getMagnetFilterRules()]);
        return /** @type {MagnetResult[]} */ (/** @type {unknown} */ (results.map((result => applyMagnetRules(result, tags, filters.filter((/** @type {any} */ rule) => (rule.target || "title") === "title"), filters.filter((/** @type {any} */ rule) => rule.target === "file")))).filter((result => !result.hidden))));
    }
    /** @param {JQueryHandle} e @param {MagnetResult[]} t @param {string} n */
    async displayResults(e, t, n) {
        this.bindResultActions(e);
        e.empty(), 0 !== t.length ? (t.forEach((e => { const base = this.calcMagnetScore(e); e._score = { ...base, total: Math.max(0, Math.min(100, base.total + (e.customTagWeight || 0) + (e.filterPenalty || 0))) }; })),
        t.sort(((e, t) => t._score.total - e._score.total)),
        t.forEach((t => {
            const n = t._score ? t._score.total : 0, a = n >= 80 ? "高" : n >= 60 ? "中" : "低", i = t._score ? `做种:${t._score.seeders}/35 分辨率:${t._score.resolution}/25 字幕:${t._score.subtitle}/20 新鲜度:${t._score.freshness}/15 完整性:${t._score.completeness}/5` : "";
            const safeTitle = escapeHtml(t.title), safeMagnet = escapeHtml(t.magnet), safeSize = escapeHtml(String(t.size || "未知")), safeDate = escapeHtml(String(t.date || "未知"));
            const item = this.jquery(`\n                <div class="magnet-result">\n                    <div class="magnet-title">\n                        <span class="magnet-score" title="${i}">${a} ${n}</span>\n                        <a href="${safeMagnet}">${safeTitle}</a>\n                    </div>\n                    <div class="magnet-info">\n                        <span>大小: ${safeSize}</span>\n                        <span>做种: ${t.seeders || "—"}</span>\n                        <span>日期: ${safeDate}</span>\n                    </div>\n                    <div class="magnet-copy">\n                        <button type="button" class="jhs-btn magnet-hub-btn copy-btn" data-magnet="${safeMagnet}">复制链接</button>\n                    </div>\n                </div>\n            `);
            t.tags?.length && item.find(".magnet-info").after(this.jquery("<div></div>").addClass("magnet-tags").append(t.tags.map((tag => this.jquery("<span></span>").addClass("jhs-badge").text(tag)))));
            const copyBox = item.find(".magnet-copy");
            item.find(".copy-btn").removeClass("magnet-hub-btn").addClass("jhs-btn--secondary");
            copyBox.append(this.jquery(`<button type="button" class="jhs-btn jhs-btn--secondary jhs-offline-btn" data-resource="${safeMagnet}">离线</button>`));
            item.appendTo(e);
        }))) : e.append('<div class="magnet-query-status">未找到相关资源</div>');
    }
    /** @param {MagnetResult} e */
    calcMagnetScore(e) {
        return calcMagnetScore(e);
    }
}
