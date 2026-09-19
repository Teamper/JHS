// @ts-check

/** @typedef {any} JQueryHandle Legacy jQuery runtime handle. */

/** 返回当前详情页的宿主资源边界；调用者不得重挂载这些节点。 */
/** @param {any} hostAdapter */
export function getDetailResourceAdapter(hostAdapter) {
    if (!window.isDetailPage || typeof hostAdapter?.getDetailResourceBoundary !== "function") return null;
    const boundary = hostAdapter.getDetailResourceBoundary();
    if (!boundary) return null;
    return {
        ...boundary, hostRoot: $(boundary.hostRoot), controller: $(boundary.controller), observeRoot: $(boundary.observeRoot), resourceRoot: $(boundary.resourceRoot), resourceRegion: $(boundary.resourceRegion),
        sortSelect: $(boundary.sortSelect), getActionTarget(/** @type {Element} */ row) {
            const target = $(boundary.getActionTarget(row));
            if (!target.length || !boundary.actionTargetRequiresWrapper?.(row)) return target;
            let actions = target.children(".jhs-offline-actions").first();
            return actions.length || (actions = $('<span class="jhs-offline-actions"></span>').appendTo(target)), actions;
        },
    };
}
