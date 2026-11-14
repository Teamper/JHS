// @ts-check

export const SUBTITLE_WORKSPACE_STYLES = `
.jhs-subtitles { display:flex; flex-direction:column; height:100%; min-height:0; gap:var(--jhs-space-3); padding:var(--jhs-space-4); color:var(--jhs-text); background:var(--jhs-bg); box-sizing:border-box; overflow-y:auto; overscroll-behavior:contain; }
.jhs-subtitles > :not(.jhs-subtitles__results) { flex-shrink:0; }
.jhs-subtitles__filters,.jhs-subtitles__actions { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); align-items:center; }
.jhs-subtitles__filters label { display:flex; flex:1 1 160px; flex-direction:column; gap:var(--jhs-space-1); }
.jhs-subtitles .jhs-field { min-width:0; padding:var(--jhs-space-2); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); color:var(--jhs-text); background:var(--jhs-surface); font:inherit; }
.jhs-subtitles__results { min-height:144px; overflow-y:auto; overscroll-behavior:contain; flex:1; }
.jhs-subtitles__row { padding:var(--jhs-space-3) 0; border-bottom:1px solid var(--jhs-border); overflow-wrap:anywhere; }
.jhs-subtitles strong { color:var(--jhs-text); }
.jhs-subtitles label.jhs-subtitles__row { display:flex; width:100%; }
.jhs-subtitles__meta { color:var(--jhs-text-muted); margin:var(--jhs-space-1) 0 var(--jhs-space-2); }
.jhs-subtitles__preview { max-height:40vh; white-space:pre-wrap; overflow:auto; overscroll-behavior:contain; margin:0; padding:var(--jhs-space-3); background:var(--jhs-surface-2); color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
.jhs-subtitles [hidden] { display:none; }
`;

/** All provider strings enter text nodes. @param {{document: Document, scope: any, onSearch: () => void, onRecords?: (trigger: HTMLButtonElement) => void, onAction: (record: any, action: string, trigger: HTMLButtonElement) => void}} options */
export function createSubtitleWorkspace(options) {
    const { document, scope } = options;
    const root = document.createElement("div");
    root.className = "jhs-subtitles";
    const filters = document.createElement("div");
    filters.className = "jhs-subtitles__filters";
    const field = (/** @type {string} */ label, /** @type {string} */ placeholder) => {
        const wrapper = document.createElement("label"), input = document.createElement("input");
        wrapper.append(label, input);
        input.type = "search";
        input.className = "jhs-field";
        input.placeholder = placeholder;
        filters.append(wrapper);
        return input;
    };
    const query = field("搜索字幕", "文件名或格式"), language = field("语言筛选", "例如 zh、en 或 Chinese");
    const sources = document.createElement("div");
    sources.className = "jhs-subtitles__actions";
    const status = document.createElement("div");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const results = document.createElement("div");
    results.className = "jhs-subtitles__results";
    results.tabIndex = 0;
    results.setAttribute("aria-label", "字幕结果");
    const preview = document.createElement("pre");
    preview.className = "jhs-subtitles__preview";
    preview.hidden = true;
    preview.tabIndex = 0;
    preview.setAttribute("aria-label", "字幕预览");
    root.append(filters, sources, status, results, preview);
    /** @type {Map<string, any[]>} */ const records = new Map();
    /** @type {Map<string, HTMLElement>} */ const rows = new Map();
    /** @type {Map<string, any>} */ const rowRecords = new Map();
    /** @type {Map<string, string>} */ const states = new Map();
    let provider = "", note = "";
    const label = (/** @type {string} */ id) => id === "xunlei" ? "迅雷" : id === "subtitlecat" ? "SubtitleCat" : id;
    const button = (/** @type {string} */ text, /** @type {() => void} */ action) => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = "jhs-btn jhs-btn--secondary jhs-btn--sm";
        element.textContent = text;
        scope.listen(element, "click", action);
        return element;
    };
    const sourceButtons = new Map();
    for (const id of ["", "xunlei", "subtitlecat"]) {
        const element = button(id ? label(id) : "全部来源", () => { provider = id; render(); });
        sourceButtons.set(id, element);
        sources.append(element);
    }
    sources.append(button("重新搜索", options.onSearch));
    if (options.onRecords) { const recordsButton = button("上传记录", () => options.onRecords?.(recordsButton)); sources.append(recordsButton); }
    /** @type {HTMLElement | null} */ let previewTrigger = null;
    const closePreview = button("收起预览", () => {
        preview.hidden = closePreview.hidden = true;
        if (previewTrigger?.isConnected) previewTrigger.focus(); else results.focus();
    });
    closePreview.hidden = true;
    root.insertBefore(closePreview, preview);
    function render() {
        for (const [id, element] of sourceButtons) element.setAttribute("aria-pressed", String(provider === id));
        const text = query.value.trim().toLowerCase(), lang = language.value.trim().toLowerCase();
        let count = 0;
        const keep = new Set();
        for (const [id, items] of records) {
            for (const record of items) {
                const key = JSON.stringify([id, record.url]);
                keep.add(key);
                rowRecords.set(key, record);
                let row = rows.get(key);
                if (!row) {
                    row = document.createElement("article");
                    row.className = "jhs-subtitles__row";
                    const name = document.createElement("strong"), meta = document.createElement("div"), actions = document.createElement("div");
                    name.textContent = record.name || "字幕";
                    meta.className = "jhs-subtitles__meta";
                    meta.textContent = `${label(id)} · ${record.language || "语言未知"} · ${String(record.extension).toUpperCase()}`;
                    actions.className = "jhs-subtitles__actions";
                    for (const [action, title] of [["preview", "预览"], ["download", "下载"], ["upload", "上传至 115"]]) {
                        const trigger = document.createElement("button");
                        trigger.type = "button";
                        trigger.className = "jhs-btn jhs-btn--secondary jhs-btn--sm";
                        trigger.textContent = title;
                        trigger.dataset.subtitleAction = action;
                        trigger.dataset.subtitleKey = key;
                        actions.append(trigger);
                    }
                    row.append(name, meta, actions);
                    rows.set(key, row);
                    results.append(row);
                }
                row.hidden = Boolean(provider && id !== provider || text && !`${record.name} ${record.extension}`.toLowerCase().includes(text) || lang && !String(record.language || "unknown").toLowerCase().includes(lang));
                if (!row.hidden) count++;
            }
        }
        for (const [key, row] of rows) if (!keep.has(key)) { row.remove(); rows.delete(key); rowRecords.delete(key); }
        status.textContent = note || `${[...states].map(([id, state]) => `${label(id)} ${state}`).join(" · ")} · 显示 ${count} 项`;
    }
    scope.listen(query, "input", render);
    scope.listen(language, "input", render);
    scope.listen(results, "click", (/** @type {Event} */ event) => {
        const trigger = event.target instanceof Element ? event.target.closest("button[data-subtitle-action]") : null;
        if (!(trigger instanceof HTMLButtonElement) || trigger.disabled) return;
        const record = rowRecords.get(trigger.dataset.subtitleKey || "");
        if (record) options.onAction(record, trigger.dataset.subtitleAction || "", trigger);
    });
    return {
        root,
        reset() { records.clear(); states.clear(); note = ""; for (const id of ["xunlei", "subtitlecat"]) states.set(id, "查询中"); render(); },
        /** @param {{providerId: string, status: string, records: any[], error?: string}} result */
        update(result) { records.set(result.providerId, result.records); states.set(result.providerId, result.status === "error" ? `失败 ${result.error || ""}` : result.records.length ? `${result.records.length} 项` : "无结果"); render(); },
        /** @param {string} text */ message(text) { note = text; render(); },
        /** @param {string} text @param {HTMLElement} [trigger] */ showPreview(text, trigger) { previewTrigger = trigger || null; preview.textContent = text; preview.hidden = closePreview.hidden = false; preview.focus(); },
    };
}
