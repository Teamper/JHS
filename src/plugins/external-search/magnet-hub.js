import { CACHE_TTL, ProviderError } from "../../core/cache-policy.js";
import { escapeHtml, i, l, r } from "../../core/constants.js";
import { mapLimit } from "../../core/feature-helpers.js";
import { calcMagnetScore } from "../../core/magnet-quality.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { BUILT_IN_MAGNET_SOURCES, ResourceSettingsService } from "../backup/resource-settings.js";
import { MagnetSourceRegistry, applyMagnetRules, deduplicateMagnetResults, normalizeMagnetResult, parseCustomMagnetResponse, parseNativeMagnets, validateCustomMagnetSource } from "./magnet-source-registry.js";

export class MagnetHubPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "sourceRegistry", new MagnetSourceRegistry()), i(this, "searchEngines", []);
    }
    async initializeSources() {
        const settings = new ResourceSettingsService(), overrides = await settings.getBuiltInSources(), custom = await settings.getMagnetSources();
        const configured = id => ({ ...(BUILT_IN_MAGNET_SOURCES.find((source => source.id === id)) || {}), ...(overrides.find((source => source.id === id)) || {}) });
        const baseUrl = (id, fallback) => String(configured(id).baseUrl || fallback).replace(/\/$/, "");
        this.sourceRegistry = new MagnetSourceRegistry([ {
            name: "JavDB 本站", id: "native-javdb", applicable: r, enabled: r, priority: 1, search: async (keyword, root = document) => parseNativeMagnets(root?.jquery ? root[0] : root, "javdb"), targetUrl: () => window.location.href
        }, { name: "JavBus 本站", id: "native-javbus", applicable: l, enabled: l, priority: 2, search: async (keyword, root = document) => parseNativeMagnets(root?.jquery ? root[0] : root, "javbus"), targetUrl: () => window.location.href
        }, {
            name: "U9A9",
            id: "u9a9",
            url: "https://u9a9.com/?type=2&search={keyword}",
            targetPage: "https://u9a9.com/?type=2&search={keyword}",
            priority: 10, search: keyword => this.searchTorrentSource("u9a9", `${baseUrl("u9a9", "https://u9a9.com")}/?type=2&search={keyword}`, keyword), targetUrl: keyword => `${baseUrl("u9a9", "https://u9a9.com")}/?type=2&search=${encodeURIComponent(keyword)}`
        }, {
            name: "U3C3",
            id: "u3c3",
            url: "https://u3c3.com/?search2=a8lr16lo&search={keyword}",
            targetPage: "https://u3c3.com/?search2=a8lr16lo&search={keyword}",
            priority: 20, search: keyword => this.searchTorrentSource("u3c3", `${baseUrl("u3c3", "https://u3c3.com")}/?search2=a8lr16lo&search={keyword}`, keyword), targetUrl: keyword => `${baseUrl("u3c3", "https://u3c3.com")}/?search2=a8lr16lo&search=${encodeURIComponent(keyword)}`
        }, {
            name: "Sukebei",
            id: "sukebei",
            url: "https://sukebei.nyaa.si/?f=0&c=0_0&q={keyword}",
            targetPage: "https://sukebei.nyaa.si/?f=0&c=0_0&q={keyword}",
            priority: 30, search: keyword => this.searchTorrentSource("sukebei", `${baseUrl("sukebei", "https://sukebei.nyaa.si")}/?f=0&c=0_0&q={keyword}`, keyword), targetUrl: keyword => `${baseUrl("sukebei", "https://sukebei.nyaa.si")}/?f=0&c=0_0&q=${encodeURIComponent(keyword)}`
        }, { name: "BTSOW", id: "btsow", priority: 40, search: keyword => this.searchBtsow(keyword, baseUrl("btsow", "https://btsow.lol")), targetUrl: keyword => `${baseUrl("btsow", "https://btsow.lol")}/search/${encodeURIComponent(keyword)}` }
        ].map((source => { const config = configured(source.id), applicable = source.applicable ?? true; return { ...source, ...config, enabled: applicable && (config.enabled ?? source.enabled ?? true), search: source.search, targetUrl: source.targetUrl }; })));
        custom.filter((source => source.enabled)).forEach((config => this.sourceRegistry.register({ ...config, id: `custom:${config.id}`, search: keyword => this.searchCustomSource(config, keyword), targetUrl: keyword => config.targetUrlTemplate.replaceAll("{keyword}", encodeURIComponent(keyword)) })));
        const enabled = this.sourceRegistry.getEnabledSources().map((source => ({ ...source, targetPage: source.targetUrl("{keyword}").replace("%7Bkeyword%7D", "{keyword}") })));
        this.searchEngines = enabled.length ? [{ id: "all", name: "全部", priority: 0, targetPage: "#", search: keyword => this.searchAllSources(enabled, keyword) }, ...enabled] : [];
    }
    getName() {
        return "MagnetHubPlugin";
    }
    async initCss() {
        return `<style>
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
        </style>`;
    }
    async createMagnetHub(e, options = {}) {
        await this.initializeSources();
        e = e.replace("FC2-", "");
        const root = options.root ? $(options.root) : $(document), engines = [ ...this.searchEngines ];
        const storage = this.getRuntimeService("storage"), t = $('<div class="magnet-container jhs-ui"></div>'), n = $('<div class="magnet-tabs"></div>'), a = "jhs_magnetHub_selectedEngine", i = storage.getLocal(a);
        const o = $('<div class="magnet-tabs__options" role="tablist" aria-label="磁力来源"></div>');
        let currentEngine = engines.find((engine => engine.id === i)) || engines[0] || null;
        if (!currentEngine) return t.append($('<div class="magnet-error"></div>').text("暂无可用磁力来源，请前往设置启用来源"));
        engines.forEach((engine => o.append($('<button type="button" class="jhs-btn magnet-tab" role="tab" aria-selected="false" tabindex="-1"></button>').attr("data-engine", engine.id).text(engine.name).toggleClass("active", engine.id === currentEngine.id))));
        const target = $('<a class="jhs-btn jhs-btn--ghost" data-jhs-role="magnet-target" target="_blank" rel="noopener noreferrer">原网页</a>').attr("href", currentEngine.targetPage.replace("{keyword}", encodeURIComponent(e))).toggle("all" !== currentEngine.id);
        n.append(o), n.append(target),
        o.find(".magnet-tab.active").attr({ "aria-selected": "true", tabindex: "0" }),
        t.append(n);
        const r = $('<div class="magnet-results"></div>');
        return t.append(r), t.on("click", ".magnet-tab", (n => {
            const i = $(n.target).data("engine");
            currentEngine = engines.find((e => e.id === i)), t.find('[data-jhs-role="magnet-target"]').attr("href", currentEngine.targetPage.replace("{keyword}", encodeURIComponent(e))).toggle("all" !== currentEngine.id),
            storage.setLocal(a, i), t.find(".magnet-tab").removeClass("active").attr({ "aria-selected": "false", tabindex: "-1" }), $(n.target).addClass("active").attr({ "aria-selected": "true", tabindex: "0" }),
            this.searchEngine(r, currentEngine, e, root);
        })), t.on("keydown", ".magnet-tab", (e => {
            if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(e.key)) return;
            e.preventDefault();
            const n = t.find(".magnet-tab"), a = n.index(e.currentTarget);
            let i = "Home" === e.key ? 0 : "End" === e.key ? n.length - 1 : "ArrowRight" === e.key ? (a + 1) % n.length : (a - 1 + n.length) % n.length;
            n.eq(i).trigger("click").trigger("focus");
        })), this.searchEngine(r, currentEngine, e, root), t;
    }
    async searchEngine(e, t, n, root = $(document)) {
        e.html(`<div class="magnet-loading">正在从 ${escapeHtml(t.name)} 搜索 "${escapeHtml(n)}"...</div>`);
        const a = `${t.name}_${n}`;
        if (t.search) try {
            return void this.displayResults(e, await this.applyRuntimeRules(deduplicateMagnetResults(await t.search(n, root))), t.name);
        } catch (error) {
            clog.error(`磁力源 ${t.name} 请求失败`, error);
            return void e.html(`<div class="magnet-error">${escapeHtml(t.name)} 请求失败</div>`);
        }
        if (t.parseHtml) try {
            const i = t.url.replace("{keyword}", encodeURIComponent(n)), payload = await this.requestSource(t.id, i, { ttlMs: 216e5 }), s = t.parseHtml.call(this, payload, n);
            return void this.displayResults(e, s, t.name);
        } catch (s) {
            return void e.html(`<div class="magnet-error">解析 ${escapeHtml(t.name)} 结果失败: ${escapeHtml(s.message)}</div>`);
        }
        t.parseJson && await t.parseJson.call(this, e, t, n, a);
    }
    async searchTorrentSource(source, template, keyword) {
        const url = template.replace("{keyword}", encodeURIComponent(keyword));
        const config = BUILT_IN_MAGNET_SOURCES.find((item => item.id === source)), targetHost = new URL(url).hostname;
        const html = await this.requestSource(source, url, { ttlMs: CACHE_TTL.magnet, hosts: config?.domain ? [config.domain] : undefined, custom: Boolean(config?.domain && targetHost !== config.domain) });
        return this.parseTorrentList(html, keyword).map((item => ({ ...item, source, files: [] })));
    }
    async searchCustomSources(keyword) {
        const configs = JSON.parse(await storageManager.getSetting("customMagnetSources", "[]"));
        const enabled = configs.filter((config => config.enabled)).map(validateCustomMagnetSource);
        const groups = await mapLimit(enabled, 4, (async config => {
            const url = config.searchUrlTemplate.replaceAll("{keyword}", encodeURIComponent(keyword));
            try {
                const payload = await this.requestSource(config.id, url, { ttlMs: CACHE_TTL.magnet, custom: true, responseType: config.parserType === "json" ? "json" : "text" });
                const parsed = "json" === config.parserType && "string" === typeof payload ? JSON.parse(payload) : payload;
                return parseCustomMagnetResponse(config, parsed, config.id);
            } catch (cause) { clog.error(`自定义磁力源 ${config.name} 失败`, new ProviderError(config.id, cause.code || "HTTP_ERROR", cause.message, { cause, url, status: cause.status, retryable: cause.retryable })); return []; }
        }));
        return deduplicateMagnetResults(groups.flat());
    }
    async searchCustomSource(config, keyword) {
        const url = config.searchUrlTemplate.replaceAll("{keyword}", encodeURIComponent(keyword));
        const payload = await this.requestSource(config.id, url, { ttlMs: CACHE_TTL.magnet, custom: true, responseType: config.parserType === "json" ? "json" : "text" });
        return parseCustomMagnetResponse(config, "json" === config.parserType && "string" === typeof payload ? JSON.parse(payload) : payload, config.id);
    }
    async searchAllSources(sources, keyword) { const groups = await mapLimit(sources, 3, (async source => { try { return await source.search(keyword); } catch (error) { clog.warn(`磁力源 ${source.name} 聚合失败`, error); return []; } })); return deduplicateMagnetResults(groups.flat()); }
    async searchBtsow(keyword, baseUrl = "https://btsow.lol") {
        const defaultHost = BUILT_IN_MAGNET_SOURCES.find((item => item.id === "btsow"))?.domain, targetHost = new URL(baseUrl).hostname;
        const payload = await this.requestSource("btsow", `${baseUrl}/search`, {
            method: "POST", body: JSON.stringify([{ search: keyword }, 50, 1]), responseType: "json", headers: { "Content-Type": "application/json" },
            custom: targetHost !== defaultHost, hosts: defaultHost ? [defaultHost] : undefined,
        });
        const value = "string" === typeof payload ? JSON.parse(payload) : payload;
        return (value?.data || []).map((item => normalizeMagnetResult({ title: item.name, magnet: `magnet:?xt=urn:btih:${item.hash}`, size: `${(Number(item.size) / 1073741824).toFixed(2)} GB`, date: utils.formatDate(new Date(1e3 * item.lastUpdateTime)) }, "btsow"))).filter(Boolean);
    }
    /** 通过统一 HTTP/URL Policy 边界请求磁力来源。 */
    async requestSource(sourceId, url, options = {}) {
        const scope = await this.getRuntimeService("scope")(), response = await this.getRuntimeService("http").request({
            providerId: `magnet:${sourceId}`, method: options.method || "GET", url, body: options.body,
            headers: options.headers, responseType: options.responseType || "text",
            cacheScope: options.method && options.method !== "GET" ? "none" : "public", ttlMs: options.ttlMs ?? CACHE_TTL.magnet,
            urlPolicy: options.custom ? { trustClass: "custom-public" } : { trustClass: "builtin-public", hosts: options.hosts || [new URL(url).hostname] },
        }, scope);
        return response.data;
    }
    async applyRuntimeRules(results) {
        const service = new ResourceSettingsService(), [tags, filters] = await Promise.all([service.getMagnetTagRules(), service.getMagnetFilterRules()]);
        return results.map((result => applyMagnetRules(result, tags, filters.filter((rule => (rule.target || "title") === "title")), filters.filter((rule => rule.target === "file"))))).filter((result => !result.hidden));
    }
    async displayResults(e, t, n) {
        function a(e) {
            const t = e.text();
            e.addClass("copied").text("已复制"), setTimeout((() => {
                e.removeClass("copied").text(t);
            }), 2e3);
        }
        e.empty(), 0 !== t.length ? (t.forEach((e => { const base = this.calcMagnetScore(e); e._score = { ...base, total: Math.max(0, Math.min(100, base.total + (e.customTagWeight || 0) + (e.filterPenalty || 0))) }; })),
        t.sort(((e, t) => t._score.total - e._score.total)),
        t.forEach((t => {
            const n = t._score ? t._score.total : 0, a = n >= 80 ? "高" : n >= 60 ? "中" : "低", i = t._score ? `做种:${t._score.seeders}/35 分辨率:${t._score.resolution}/25 字幕:${t._score.subtitle}/20 新鲜度:${t._score.freshness}/15 完整性:${t._score.completeness}/5` : "";
            const safeTitle = escapeHtml(t.title), safeMagnet = escapeHtml(t.magnet), safeSize = escapeHtml(String(t.size || "未知")), safeDate = escapeHtml(String(t.date || "未知"));
            const item = $(`\n                <div class="magnet-result">\n                    <div class="magnet-title">\n                        <span class="magnet-score" title="${i}">${a} ${n}</span>\n                        <a href="${safeMagnet}">${safeTitle}</a>\n                    </div>\n                    <div class="magnet-info">\n                        <span>大小: ${safeSize}</span>\n                        <span>做种: ${t.seeders || "—"}</span>\n                        <span>日期: ${safeDate}</span>\n                    </div>\n                    <div class="magnet-copy">\n                        <button type="button" class="jhs-btn magnet-hub-btn copy-btn" data-magnet="${safeMagnet}">复制链接</button>\n                    </div>\n                </div>\n            `);
            t.tags?.length && item.find(".magnet-info").after($("<div></div>").addClass("magnet-tags").append(t.tags.map((tag => $("<span></span>").addClass("jhs-badge").text(tag)))));
            const copyBox = item.find(".magnet-copy");
            item.find(".copy-btn").removeClass("magnet-hub-btn").addClass("jhs-btn--secondary");
            copyBox.append(`<button type="button" class="jhs-btn jhs-btn--secondary jhs-offline-btn" data-resource="${safeMagnet}">离线</button>`);
            item.appendTo(e);
        })), e.on("click", ".copy-btn", (async function() {
            const e = $(this), t = e.data("magnet");
            await utils.copyToClipboard("磁力链接", t) && a(e);
        }))) : e.append('<div class="magnet-error">没有找到相关结果</div>');
    }
    parseTorrentList(e, t) {
        const n = utils.htmlTo$dom(e), a = [];
        return n.find(".torrent-list tbody tr").each(((e, n) => {
            const i = $(n);
            if (i.text().includes("置顶")) return;
            const s = i.find("td:nth-child(2) a").attr("title") || i.find("td:nth-child(2) a").text().trim();
            if (!s.toLowerCase().includes(t.toLowerCase())) return;
            const o = i.find("td:nth-child(3) a[href^='magnet:']").attr("href"), r = i.find("td:nth-child(4)").text().trim(), l = i.find("td:nth-child(5)").text().trim(), c = parseInt(i.find("td:nth-child(6)").text().trim()) || 0, d = parseInt(i.find("td:nth-child(7)").text().trim()) || 0;
            o && a.push({
                title: s,
                magnet: o,
                size: r,
                date: l,
                seeders: c,
                leechers: d
            });
        })), a;
    }
    calcMagnetScore(e) {
        return calcMagnetScore(e);
    }
}
