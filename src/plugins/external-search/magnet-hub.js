/** 磁力评分：基于做种数/分辨率/字幕/新鲜度/完整性，返回 0-100 分 */
function calcMagnetScore(e) {
    let t = 0;
    const n = (e.seeders || 0);
    const seedersScore = n >= 50 ? 35 : n >= 10 ? 25 : n >= 1 ? 15 : 3;
    t += seedersScore;
    const a = (e.title || "").toLowerCase();
    const resolutionScore = /4k|2160p/.test(a) ? 25 : /1080p/.test(a) ? 20 : /720p/.test(a) ? 15 : 5;
    t += resolutionScore;
    const subtitleScore = /-c\b|-uc\b|chinese|中字|字幕/.test(a) ? 20 : 0;
    t += subtitleScore;
    const i = e.date ? _daysSince(e.date) : 999;
    const freshnessScore = i <= 7 ? 15 : i <= 30 ? 12 : i <= 90 ? 8 : 3;
    t += freshnessScore;
    const completenessScore = /sample|预告|trailer/.test(a) ? -15 : 0;
    t += completenessScore;
    return { total: Math.max(0, Math.min(100, t)), seeders: seedersScore, resolution: resolutionScore, subtitle: subtitleScore, freshness: freshnessScore, completeness: completenessScore };
}
function _daysSince(e) {
    try {
        const t = new Date(e);
        if (isNaN(t.getTime())) return 999;
        return Math.max(0, Math.floor((Date.now() - t.getTime()) / 864e5));
    } catch (t) { return 999; }
}

class MagnetHubPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "currentEngine", null), i(this, "sourceRegistry", new MagnetSourceRegistry()), i(this, "searchEngines", []);
    }
    async initializeSources() {
        const settings = new ResourceSettingsService(), overrides = await settings.getBuiltInSources(), custom = await settings.getMagnetSources();
        const configured = id => ({ ...(BUILT_IN_MAGNET_SOURCES.find((source => source.id === id)) || {}), ...(overrides.find((source => source.id === id)) || {}) });
        const baseUrl = (id, fallback) => String(configured(id).baseUrl || fallback).replace(/\/$/, "");
        this.sourceRegistry = new MagnetSourceRegistry([ {
            name: "JavDB 本站", id: "native-javdb", applicable: r, enabled: r, priority: 1, search: async () => parseNativeMagnets(document, "javdb"), targetUrl: () => window.location.href
        }, { name: "JavBus 本站", id: "native-javbus", applicable: l, enabled: l, priority: 2, search: async () => parseNativeMagnets(document, "javbus"), targetUrl: () => window.location.href
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
        return "\n            <style>\n                .magnet-container {\n                    margin: 20px auto;\n                    width: 100%;\n                    font-family: Arial, sans-serif;\n                }\n                .magnet-tabs {\n                    display: flex;\n                    border-bottom: 1px solid var(--jhs-border);\n                    margin-bottom: 15px;\n                    justify-content: space-between;\n                }\n                .magnet-tab {\n                    padding: 5px 12px;\n                    cursor: pointer;\n                    border: 1px solid transparent;\n                    border-bottom: none;\n                    margin-right: 5px;\n                    background: var(--jhs-surface-2);\n                    border-radius: 5px 5px 0 0;\n                }\n                .magnet-tab.active {\n                    background: var(--jhs-surface);\n                    border-color: var(--jhs-border);\n                    border-bottom: 1px solid var(--jhs-surface);\n                    margin-bottom: -1px;\n                    font-weight: bold;\n                }\n                .magnet-tab:hover:not(.active) {\n                    background: var(--jhs-border);\n                }\n                \n                .magnet-results {\n                    min-height: 200px;\n                }\n                .magnet-result {\n                    padding: 15px;\n                    border-bottom: 1px solid var(--jhs-surface-2);\n                    position: relative; \n                }\n                .magnet-result:hover {\n                    background-color: var(--jhs-surface-2);\n                }\n                .magnet-title {\n                    font-weight: bold;\n                    margin-bottom: 5px;\n                    white-space: nowrap;\n                    overflow: hidden; \n                    text-overflow: ellipsis;\n                    padding-right: 80px; \n                }\n                .magnet-info {\n                    display: flex;\n                    justify-content: space-between;\n                    font-size: 12px;\n                    color: var(--jhs-text-muted);\n                    margin-bottom: 5px;\n                }\n                .magnet-loading {\n                    text-align: center;\n                    padding: 20px;\n                }\n                .magnet-error {\n                    color: var(--jhs-status-filter-text);\n                    padding: 10px;\n                }\n                \n                .magnet-copy {\n                    position: absolute;\n                    right: 15px;\n                    top: 12px;\n                }\n                .magnet-hub-btn {\n                    background-color: var(--jhs-surface-2);\n                    color: var(--jhs-text-muted);\n                    border: 1px solid var(--jhs-border-strong);\n                    padding: 3px 8px;\n                    border-radius: 3px;\n                    cursor: pointer;\n                    font-size: 12px;\n                    transition: all 0.2s;\n                    margin-left: 10px;\n                }\n                .magnet-hub-btn:hover {\n                    background-color: var(--jhs-border);\n                    border-color: var(--jhs-border);\n                }\n                .magnet-hub-btn.copied {\n                    background-color: var(--jhs-status-down);\n                    color: var(--jhs-status-down-on);\n                    border-color: var(--jhs-status-down);\n                }\n            </style>\n        ";
    }
    async createMagnetHub(e) {
        await this.initializeSources();
        e = e.replace("FC2-", "");
        const t = $('<div class="magnet-container jhs-ui"></div>'), n = $('<div class="magnet-tabs"></div>'), a = "jhs_magnetHub_selectedEngine", i = localStorage.getItem(a);
        const o = $('<div class="magnet-tabs__options" role="tablist" aria-label="磁力来源"></div>');
        this.currentEngine = this.searchEngines.find((engine => engine.id === i)) || this.searchEngines[0] || null;
        if (!this.currentEngine) return t.append($('<div class="magnet-error"></div>').text("暂无可用磁力来源，请前往设置启用来源"));
        this.searchEngines.forEach((engine => o.append($('<button type="button" class="jhs-btn magnet-tab" role="tab" aria-selected="false" tabindex="-1"></button>').attr("data-engine", engine.id).text(engine.name).toggleClass("active", engine.id === this.currentEngine.id))));
        const target = $('<a class="jhs-btn jhs-btn--ghost" id="targetBox" target="_blank" rel="noopener noreferrer">原网页</a>').attr("href", this.currentEngine.targetPage.replace("{keyword}", encodeURIComponent(e))).toggle("all" !== this.currentEngine.id);
        n.append(o), n.append(target),
        o.find(".magnet-tab.active").attr({ "aria-selected": "true", tabindex: "0" }),
        t.append(n);
        const r = $('<div class="magnet-results"></div>');
        return t.append(r), t.on("click", ".magnet-tab", (n => {
            const i = $(n.target).data("engine");
            this.currentEngine = this.searchEngines.find((e => e.id === i)), $("#targetBox").attr("href", this.currentEngine.targetPage.replace("{keyword}", encodeURIComponent(e))).toggle("all" !== this.currentEngine.id),
            localStorage.setItem(a, i), t.find(".magnet-tab").removeClass("active").attr({ "aria-selected": "false", tabindex: "-1" }), $(n.target).addClass("active").attr({ "aria-selected": "true", tabindex: "0" }),
            this.searchEngine(r, this.currentEngine, e);
        })), t.on("keydown", ".magnet-tab", (e => {
            if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(e.key)) return;
            e.preventDefault();
            const n = t.find(".magnet-tab"), a = n.index(e.currentTarget);
            let i = "Home" === e.key ? 0 : "End" === e.key ? n.length - 1 : "ArrowRight" === e.key ? (a + 1) % n.length : (a - 1 + n.length) % n.length;
            n.eq(i).trigger("click").trigger("focus");
        })), this.searchEngine(r, this.currentEngine, e), t;
    }
    async searchEngine(e, t, n) {
        e.html(`<div class="magnet-loading">正在从 ${escapeHtml(t.name)} 搜索 "${escapeHtml(n)}"...</div>`);
        const a = `${t.name}_${n}`;
        if (t.search) try {
            return void this.displayResults(e, await this.applyRuntimeRules(deduplicateMagnetResults(await t.search(n))), t.name);
        } catch (error) {
            clog.error(`磁力源 ${t.name} 请求失败`, error);
            return void e.html(`<div class="magnet-error">${escapeHtml(t.name)} 请求失败</div>`);
        }
        if (t.parseHtml) try {
            const i = t.url.replace("{keyword}", encodeURIComponent(n)), s = await storageManager.cachedRequest(`magnet:${t.id}:${n}`, 216e5, (() => gmHttp.get(i).then((e => t.parseHtml.call(this, e, n)))));
            return void this.displayResults(e, s, t.name);
        } catch (s) {
            return void e.html(`<div class="magnet-error">解析 ${escapeHtml(t.name)} 结果失败: ${escapeHtml(s.message)}</div>`);
        }
        t.parseJson && await t.parseJson.call(this, e, t, n, a);
    }
    async searchTorrentSource(source, template, keyword) {
        const url = template.replace("{keyword}", encodeURIComponent(keyword));
        return storageManager.cachedRequest(`magnet:${source}:${keyword}`, CACHE_TTL.magnet, (async () => {
            const html = await gmHttp.get(url);
            return this.parseTorrentList(html, keyword).map((item => ({ ...item, source, files: [] })));
        }));
    }
    async searchCustomSources(keyword) {
        const configs = JSON.parse(await storageManager.getSetting("customMagnetSources", "[]"));
        const enabled = configs.filter((config => config.enabled)).map(validateCustomMagnetSource);
        const groups = await mapLimit(enabled, 4, (async config => {
            const url = config.searchUrlTemplate.replaceAll("{keyword}", encodeURIComponent(keyword));
            try {
                const payload = await storageManager.cachedRequest(`magnet:custom:${config.id}:${keyword}`, CACHE_TTL.magnet, (() => gmHttp.get(url)));
                const parsed = "json" === config.parserType && "string" === typeof payload ? JSON.parse(payload) : payload;
                return parseCustomMagnetResponse(config, parsed, config.id);
            } catch (cause) { clog.error(`自定义磁力源 ${config.name} 失败`, new ProviderError(config.id, cause._cfBlocked ? "CF_BLOCKED" : "HTTP_ERROR", cause.message, { cause, url, status: cause.status })); return []; }
        }));
        return deduplicateMagnetResults(groups.flat());
    }
    async searchCustomSource(config, keyword) {
        const url = config.searchUrlTemplate.replaceAll("{keyword}", encodeURIComponent(keyword));
        const payload = await storageManager.cachedRequest(`magnet:custom:${config.id}:${keyword}`, CACHE_TTL.magnet, (() => gmHttp.get(url)));
        return parseCustomMagnetResponse(config, "json" === config.parserType && "string" === typeof payload ? JSON.parse(payload) : payload, config.id);
    }
    async searchAllSources(sources, keyword) { const groups = await mapLimit(sources, 3, (async source => { try { return await source.search(keyword); } catch (error) { clog.warn(`磁力源 ${source.name} 聚合失败`, error); return []; } })); return deduplicateMagnetResults(groups.flat()); }
    async searchBtsow(keyword, baseUrl = "https://btsow.lol") {
        const payload = await storageManager.cachedRequest(`magnet:btsow:${keyword}`, CACHE_TTL.magnet, (() => gmHttp.gmRequest("POST", `${baseUrl}/search`, JSON.stringify([{ search: keyword }, 50, 1]), {}, { "Content-Type": "application/json" })));
        const value = "string" === typeof payload ? JSON.parse(payload) : payload;
        return (value?.data || []).map((item => normalizeMagnetResult({ title: item.name, magnet: `magnet:?xt=urn:btih:${item.hash}`, size: `${(Number(item.size) / 1073741824).toFixed(2)} GB`, date: utils.formatDate(new Date(1e3 * item.lastUpdateTime)) }, "btsow"))).filter(Boolean);
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
            copyBox.append(`<button type="button" class="jhs-btn magnet-hub-btn jhs-offline-btn" data-resource="${safeMagnet}">离线</button>`);
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
