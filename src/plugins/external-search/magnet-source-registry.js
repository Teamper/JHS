const MAGNET_SOURCE_IDS = Object.freeze(["native-javdb", "native-javbus", "u9a9", "u3c3", "sukebei", "btsow"]);

function normalizeMagnetResult(result, source) {
    if (!result || !String(result.magnet || "").startsWith("magnet:")) return null;
    return { title: String(result.title || ""), magnet: result.magnet, size: result.size || "", date: result.date || "", seeders: Number(result.seeders) || 0, leechers: Number(result.leechers) || 0, source, files: Array.isArray(result.files) ? result.files : [] };
}

function extractInfoHash(magnet) {
    const hash = new URL(magnet).searchParams.get("xt")?.match(/^urn:btih:([a-z2-7]{32}|[a-f\d]{40})$/i)?.[1];
    return hash ? hash.toUpperCase() : null;
}

function deduplicateMagnetResults(results) {
    const unique = new Map();
    results.forEach((result => {
        const key = extractInfoHash(result.magnet) || `${result.source}:${result.magnet}`;
        const existing = unique.get(key);
        existing ? existing.sources = [...new Set([...(existing.sources || [existing.source]), result.source])] : unique.set(key, { ...result, sources: [result.source] });
    }));
    return [...unique.values()];
}

class MagnetSourceRegistry {
    constructor(sources = []) { this.sources = new Map(); sources.forEach((source => this.register(source))); }
    register(source) {
        if (!source?.id || !source.name || "function" !== typeof source.search || "function" !== typeof source.targetUrl) throw new TypeError("Invalid magnet provider");
        this.sources.set(source.id, { enabled: true, priority: 100, ...source });
        return this;
    }
    get(id) { return this.sources.get(id) || null; }
    getEnabledSources() { return [...this.sources.values()].filter((source => source.enabled)).sort(((a, b) => a.priority - b.priority)); }
}

function validateHttpsBaseUrl(value) {
    const url = new URL(value);
    if ("https:" !== url.protocol) throw new TypeError("Source URL must use https");
    return url.origin;
}

function validateCustomMagnetSource(config) {
    const allowed = ["id", "name", "enabled", "priority", "searchUrlTemplate", "targetUrlTemplate", "parserType", "rowSelector", "titleSelector", "magnetSelector", "sizeSelector", "dateSelector", "seedersSelector", "leechersSelector", "resultsPath", "titlePath", "hashPath", "magnetPath", "sizePath", "datePath", "seedersPath"];
    if (Object.keys(config).some((key => !allowed.includes(key)))) throw new TypeError("Unsupported custom source field");
    if (!["torrent-table", "magnet-links", "json"].includes(config.parserType)) throw new TypeError("Unsupported parser type");
    if (!String(config.name || "").trim()) throw new TypeError("Source name is required");
    validateHttpsBaseUrl(config.searchUrlTemplate.replace("{keyword}", "test"));
    validateHttpsBaseUrl((config.targetUrlTemplate || config.searchUrlTemplate).replace("{keyword}", "test"));
    if ("torrent-table" === config.parserType && (!config.rowSelector?.trim() || !config.magnetSelector?.trim())) throw new TypeError("表格来源必须填写结果行选择器和磁力选择器");
    if ("json" === config.parserType && (!config.resultsPath?.trim() || (!config.magnetPath?.trim() && !config.hashPath?.trim()))) throw new TypeError("JSON 来源必须填写结果数组路径，并填写磁力路径或哈希路径");
    return { ...config, name: config.name.trim(), targetUrlTemplate: config.targetUrlTemplate || config.searchUrlTemplate };
}

function applyMagnetRules(result, tagRules = [], titleFilters = [], fileFilters = []) {
    const text = `${result.title || ""} ${(result.files || []).join(" ")}`;
    const matches = (rule, value) => "regex" === rule.type ? new RegExp(rule.pattern, "i").test(value) : value.toLowerCase().includes(rule.pattern.toLowerCase());
    const tags = tagRules.filter((rule => rule.enabled && matches(rule, text)));
    let hidden = false, penalty = 0; const filteredReasons = [];
    [...titleFilters.map((rule => ({ ...rule, value: result.title || "" }))), ...fileFilters.map((rule => ({ ...rule, value: (result.files || []).join(" ") })))].filter((rule => rule.enabled)).forEach((rule => {
        if (!matches(rule, rule.value)) return; filteredReasons.push(rule.id || rule.pattern); "hide" === rule.action ? hidden = true : penalty += Number(rule.penalty) || 0;
    }));
    return { ...result, tags: tags.map((rule => rule.name)), customTagWeight: tags.reduce(((sum, rule) => sum + (Number(rule.weight) || 0)), 0), hidden, filterPenalty: penalty, filteredReasons };
}

function parseNativeMagnets(root, source) {
    const results = new Map();
    $(root).find('a[href^="magnet:"],[data-clipboard-text^="magnet:"]').each(((index, element) => {
        const node = $(element), magnet = node.attr("href") || node.attr("data-clipboard-text");
        if (!magnet) return;
        const container = node.closest(".item, .magnet-name, tr, .panel-block"), title = container.find(".name, .magnet-name, .title").first().text().trim() || node.text().trim() || "本站磁力";
        const result = normalizeMagnetResult({ title, magnet, size: container.find(".meta, .size").first().text().trim() }, source);
        result && results.set(extractInfoHash(magnet) || magnet, result);
    }));
    return [...results.values()];
}

function readJsonPath(value, path) { return String(path || "").split(".").filter(Boolean).reduce(((current, key) => current?.[key]), value); }
function parseCustomMagnetResponse(config, payload, sourceId) {
    config = validateCustomMagnetSource(config);
    if ("json" === config.parserType) return (readJsonPath(payload, config.resultsPath) || []).map((item => normalizeMagnetResult({ title: readJsonPath(item, config.titlePath), magnet: config.magnetPath ? readJsonPath(item, config.magnetPath) : `magnet:?xt=urn:btih:${readJsonPath(item, config.hashPath)}`, size: readJsonPath(item, config.sizePath), date: readJsonPath(item, config.datePath), seeders: readJsonPath(item, config.seedersPath) }, `custom:${sourceId}`))).filter(Boolean);
    const root = utils.htmlTo$dom(payload), rows = "magnet-links" === config.parserType ? root.find('a[href^="magnet:"]') : root.find(config.rowSelector);
    return rows.map(((index, element) => { const row = $(element), magnetNode = "magnet-links" === config.parserType ? row : row.find(config.magnetSelector).first(); return normalizeMagnetResult({ title: "magnet-links" === config.parserType ? row.text().trim() : row.find(config.titleSelector).first().text().trim(), magnet: magnetNode.attr("href") || magnetNode.attr("data-magnet"), size: row.find(config.sizeSelector).text().trim(), date: row.find(config.dateSelector).text().trim(), seeders: row.find(config.seedersSelector).text().trim(), leechers: row.find(config.leechersSelector).text().trim() }, `custom:${sourceId}`); })).get().filter(Boolean);
}
