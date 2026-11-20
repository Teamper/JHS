// @ts-check
import { button, el, select } from "./components.js";

const byCode = new Intl.Collator("zh-Hans", { numeric: true, sensitivity: "base" });
export const catalogOrders = [["source", "站点顺序"], ["date", "发行日期 · 最新"], ["date-asc", "发行日期 · 最早"],
    ["rating", "站点评分"], ["votes", "评价人数"], ["code", "番号"]];
export const newOrders = catalogOrders.filter(([key]) => ["date", "date-asc", "code"].includes(key));
export const libraryOrders = [["updated", "最近更新"], ...newOrders, ["personal", "个人评分"]];

/** @param {any[]} works @param {string} order @param {{exact?:string|null, ratings?:Record<string,{rating:number}>}} [options] */
export function orderMovies(works, order, { exact, ratings } = {}) {
    const number = (/** @type {any} */ work) => {
        switch (order) {
            case "rating": return work.ratingValue;
            case "votes": return work.voteCount;
            case "personal": return ratings?.[work.carNum]?.rating;
            case "updated": return Date.parse(work.updateDate);
            default: return Date.parse(work.releaseDate || work.publishTime);
        }
    };
    return [...works].sort((a, b) => {
        if (exact) {
            const aMatch = a.carNum === exact && (a.stateEligibility?.eligible ?? true);
            const bMatch = b.carNum === exact && (b.stateEligibility?.eligible ?? true);
            if (aMatch !== bMatch) return Number(bMatch) - Number(aMatch);
        }
        if (order === "source") return 0;
        if (order === "code") return Number(!a.carNum) - Number(!b.carNum) || byCode.compare(a.carNum || "", b.carNum || "");
        const left = number(a), right = number(b);
        if (!Number.isFinite(left) || !Number.isFinite(right)) return Number(!Number.isFinite(left)) - Number(!Number.isFinite(right));
        return order === "date-asc" ? left - right : right - left;
    });
}

/** @param {string[][]} options @param {string} value @param {(key:string)=>void} change */
export function sorting(options, value, change) {
    const control = select(options, "排序");
    control.value = value;
    control.onchange = () => change(control.value);
    const label = el("label", null, "catalog-control");
    label.append(el("span", "排序"), control);
    return label;
}

/** @param {any} app @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope @param {HTMLElement} result */
export function viewToggle(app, scope, result) {
    const layout = () => app.services.settings.snapshot().androidCatalogLayout === "list" ? "list" : "grid";
    const toggle = button("", () => app.run(scope, () => app.services.settings.set("androidCatalogLayout", layout() === "grid" ? "list" : "grid")), "quiet-action");
    function apply() {
        const value = layout();
        result.dataset.catalogLayout = value;
        toggle.textContent = value === "grid" ? "列表视图" : "海报墙";
        toggle.setAttribute("aria-label", value === "grid" ? "切换到列表视图" : "切换到海报墙");
    }
    apply();
    scope.listen(app.services.settings, "settings.changed", apply);
    return toggle;
}

/** @param {ParentNode} root */
export function visibleWork(root) {
    const first = [...root.querySelectorAll("[data-work]")].find(node => node.getBoundingClientRect().bottom > 12);
    return first instanceof HTMLElement ? { key: first.dataset.work, top: first.getBoundingClientRect().top } : null;
}

/** @param {ParentNode} root @param {{key?:string,top:number}|null} anchor */
export function restoreWork(root, anchor) {
    if (!anchor) return;
    const match = [...root.querySelectorAll("[data-work]")].find(node => node.getAttribute("data-work") === anchor.key);
    if (match) window.scrollBy(0, match.getBoundingClientRect().top - anchor.top);
}

/** @param {any[]} items @param {any[]} next */
export function appendCatalogItems(items, next) {
    const known = new Set(items.map(item => item.id));
    for (const item of next) {
        if (known.has(item.id)) continue;
        known.add(item.id);
        items.push(item);
    }
}
