// @ts-check

import { calcMagnetScore, getMagnetQualitySignals } from "../../core/magnet-quality.js";

/** @param {unknown} value */
export function magnetSizeBytes(value) {
    if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
    const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)\s*([KMGTPE]?)(I?B|BYTES?)$/i);
    if (!match) return null;
    const power = " KMGTPE".indexOf(match[2].toUpperCase());
    return Number(match[1]) * (/^I/i.test(match[3]) ? 1024 : 1000) ** Math.max(0, power);
}

/** @param {Record<string, any>[]} records @param {string} sort @param {string[]} filters */
export function selectMagnetResults(records, sort = "quality", filters = []) {
    const selected = records.filter(record => {
        const signals = getMagnetQualitySignals(`${record.title || ""} ${record.resolution || ""}`, Boolean(record.hasSubtitle || record.hasSubtitleTag));
        return (!filters.includes("subtitle") || signals.subtitle)
            && (!filters.includes("4k") || ["4k", "2160p"].includes(signals.resolution))
            && (!filters.includes("uncensored") || /无码|無碼|破解|uncensored|(?:-|\b)u(?:c)?\b/i.test(record.title));
    });
    const metric = (/** @type {Record<string, any>} */ record) => {
        if (sort.startsWith("size")) return magnetSizeBytes(record.size);
        if (sort === "date") { const time = Date.parse(record.date || ""); return Number.isFinite(time) ? time : null; }
        if (sort === "seeders") {
            if (record.seeders == null || String(record.seeders).trim() === "") return null;
            const count = Number(record.seeders);
            return Number.isSafeInteger(count) && count >= 0 ? count : null;
        }
        return record._score.total;
    };
    return selected.sort((left, right) => {
        const a = metric(left), b = metric(right);
        if (a === null) return b === null ? 0 : 1;
        if (b === null) return -1;
        return sort === "size-asc" ? a - b : b - a;
    });
}

/** Reconcile result rows without replacing focused controls. */
export class MagnetResultsView {
    /** @param {any} panel @param {(value: any) => any} jquery */
    constructor(panel, jquery) {
        this.jquery = jquery;
        this.panel = panel;
        /** @type {Record<string, any>[]} */ this.records = [];
        /** @type {Map<string, any>} */ this.rows = new Map();
        this.root = jquery('<div class="jhs-magnet-view"></div>').appendTo(panel);
        const controls = jquery('<div class="jhs-magnet-controls"></div>').appendTo(this.root);
        this.sort = "quality";
        const sorting = jquery('<div role="group" aria-label="磁力排序"></div>').appendTo(controls);
        for (const [value, label] of [["quality", "质量"], ["seeders", "做种数"], ["date", "最新"], ["size-desc", "大小降序"], ["size-asc", "大小升序"]]) {
            jquery('<button type="button" class="jhs-btn jhs-btn--secondary"></button>').attr({ "data-sort": value, "aria-pressed": String(value === this.sort) }).text(label).appendTo(sorting);
        }
        for (const [value, label] of [["subtitle", "字幕"], ["4k", "4K"], ["uncensored", "无码/破解"]]) {
            const field = jquery("<label></label>").appendTo(controls);
            jquery('<input type="checkbox" class="jhs-checkbox">').val(value).appendTo(field);
            field.append(panel[0].ownerDocument.createTextNode(label));
        }
        this.summary = jquery('<div class="magnet-query-status" role="status"></div>').appendTo(this.root);
        this.list = jquery('<div class="jhs-magnet-items"></div>').appendTo(this.root);
        controls.on("change", "input", () => this.render());
        sorting.on("click", "button", (/** @type {MouseEvent} */ event) => {
            this.sort = jquery(event.currentTarget).attr("data-sort");
            sorting.find("button").attr("aria-pressed", "false");
            jquery(event.currentTarget).attr("aria-pressed", "true");
            this.render();
        });
    }

    /** @param {Record<string, any>[]} records */
    update(records) {
        this.records = records.map(record => {
            const base = calcMagnetScore(record);
            return { ...record, _score: { ...base, total: Math.max(0, Math.min(100, base.total + (record.customTagWeight || 0) + (record.filterPenalty || 0))) } };
        });
        this.render();
    }

    render() {
        const filters = this.root.find('input:checked').map((/** @type {number} */ index, /** @type {HTMLInputElement} */ element) => element.value).get();
        const selected = selectMagnetResults(this.records, this.sort, filters);
        const keys = new Set();
        const focused = this.panel[0].ownerDocument.activeElement;
        const scrollTop = this.panel[0].scrollTop;
        for (const record of selected) {
            const key = record.infoHash || record.magnet;
            keys.add(key);
            let row = this.rows.get(key);
            if (!row) {
                row = this.jquery('<div class="magnet-result"><div class="magnet-title"><span class="magnet-score"></span> <a></a></div><div class="magnet-info"></div><div class="magnet-tags"></div><div class="magnet-copy"><button type="button" class="jhs-btn jhs-btn--secondary magnet-hub-btn copy-btn">复制链接</button><button type="button" class="jhs-btn jhs-btn--secondary magnet-hub-btn jhs-offline-btn">离线</button></div></div>');
                this.rows.set(key, row);
            }
            const score = record._score.total;
            row.find(".magnet-score").text(`${score >= 80 ? "高" : score >= 60 ? "中" : "低"} ${score}`)
                .attr("title", `做种 ${record._score.seeders}/35 · 分辨率 ${record._score.resolution}/25 · 字幕 ${record._score.subtitle}/20 · 新鲜度 ${record._score.freshness}/15 · 完整性 ${record._score.completeness}/5`);
            row.find(".magnet-title a").attr("href", record.magnet).text(record.title);
            row.find(".magnet-info").text(`大小 ${record.size || "未知"} · 做种 ${record.seeders ?? "—"} · 日期 ${record.date || "未知"}`);
            row.find(".magnet-tags").text([...(record.sources || [record.source]), ...(record.tags || [])].filter(Boolean).join(" · "));
            row.find(".copy-btn").attr("data-magnet", record.magnet).data("magnet", record.magnet);
            row.find(".jhs-offline-btn").attr("data-resource", record.magnet);
            this.list.append(row);
        }
        for (const [key, row] of this.rows) if (!keys.has(key)) { row.remove(); this.rows.delete(key); }
        this.summary.text(selected.length ? `显示 ${selected.length} 条资源` : "当前筛选无匹配资源");
        if (focused?.isConnected && this.panel[0].ownerDocument.activeElement !== focused) focused.focus({ preventScroll: true });
        this.panel[0].scrollTop = scrollTop;
    }
}
