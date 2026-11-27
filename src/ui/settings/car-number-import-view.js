// @ts-check

/** Render parsed numbers as a summary and accessible, bounded details. */
/** @param {any} jq @param {any} host @param {{recognized:number,values:string[],invalid:string[]}} parsed @param {string} action @param {string} message @param {{added:number,updated:number,failed:number,skipped?:number}|null} [summary] */
export function renderCarImportResult(jq, host, parsed, action, message, summary = null) {
    host.empty().prop("hidden", false);
    host.append(jq("<h4></h4>").text(summary ? "导入结果" : "解析结果"));
    const metrics = jq('<dl class="jhs-import-metrics"></dl>');
    const duplicate = Math.max(0, parsed.recognized - parsed.values.length - parsed.invalid.length);
    const counts = summary ? [["新增",summary.added],["更新",summary.updated],["跳过",summary.skipped || 0],["重复",duplicate],["失败",summary.failed]]
        : [["有效",parsed.values.length],["重复",duplicate],["无效",parsed.invalid.length]];
    for (const [label,value] of counts) metrics.append(jq("<div></div>").append(jq("<dt></dt>").text(label),jq("<dd></dd>").text(value)));
    host.append(metrics, jq('<p class="jhs-import-message" role="status"></p>').text(message || `导入状态：${action}`));
    if (!parsed.values.length && !parsed.invalid.length) return;
    const details = jq('<details class="jhs-import-details"></details>').append(jq("<summary></summary>").text("查看番号与异常明细"));
    const list = jq('<div class="jhs-import-detail-list jhs-scrollbar"></div>');
    for (const [title,values] of [["有效番号",parsed.values],["异常项",parsed.invalid]]) {
        if (!values.length) continue;
        const section = jq("<section></section>").append(jq("<h5></h5>").text(title));
        const entries = jq("<ul></ul>");
        for (const value of values) entries.append(jq("<li></li>").text(value));
        list.append(section.append(entries));
    }
    host.append(details.append(list));
}
