// @ts-check

/** @param {{page:number,pages:number,total:number,attribute:"data-page"|"data-nvpage"}} options */
export function newVideoPagination({page, pages, total, attribute}) {
    if (!pages) return '<span class="jhs-pagination__summary">共 0 条记录</span>';
    /** @param {number} value @param {string | number} label @param {boolean} [numbered] */
    const button = (value, label, numbered = false) => `<button type="button" class="jhs-btn jhs-btn--secondary pagination-btn${numbered ? " page-number-btn" : ""}" ${attribute}="${value}"${numbered && value === page ? ' aria-current="page"' : ""}>${label}</button>`;
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    const end = Math.min(pages, start + 4);
    const parts = [];
    if (page > 1) {
        if (pages > 5) parts.push(button(1, "首页"));
        parts.push(button(page - 1, "上一页"));
    }
    for (let next = start; next <= end; next++) parts.push(button(next, next, true));
    if (page < pages) {
        parts.push(button(page + 1, "下一页"));
        if (pages > 5) parts.push(button(pages, "尾页"));
    }
    return parts.join("") + `<span class="jhs-pagination__summary">第 ${page}/${pages} 页，共 ${total} 条</span>`;
}
