// @ts-check
import { button, el, sheet } from "./components.js";

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

/** @param {HTMLElement} root @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope
 * @param {string[][]} options @param {string} current @param {(key:string)=>void} change */
export function sorting(root, scope, options, current, change) {
    const dialog = sheet(root, "排序", scope, false);
    const fields = el("fieldset", null, "sort-options");
    fields.setAttribute("aria-label", "排序方式");
    const choices = options.map(([key, label]) => {
        const row = el("label");
        const radio = el("input");
        radio.type = "radio";
        radio.name = "android-sort-order";
        radio.value = key;
        row.append(el("span", label), radio);
        fields.append(row);
        return radio;
    });
    const title = () => "排序 · " + options.find(([key]) => key === current)?.[1];
    const open = button(title(), () => {
        for (const choice of choices) choice.autofocus = choice.checked = choice.value === current;
        dialog.showModal();
    }, "quiet-action");
    open.setAttribute("aria-haspopup", "dialog");
    const actions = el("div", null, "actions sheet-actions");
    actions.append(button("取消", () => dialog.close(), "quiet-action"), button("应用排序", () => {
        const selected = choices.find(choice => choice.checked);
        dialog.close();
        if (!selected || selected.value === current) return;
        current = selected.value;
        open.textContent = title();
        change(current);
    }, "primary"));
    dialog.append(fields, actions);
    return open;
}

/** @param {any} app @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope @param {HTMLElement} result
 * @param {{layout?:string}} [route] @param {string} [fallback] */
export function viewToggle(app, scope, result, route, fallback) {
    const layout = () => (route?.layout ?? fallback ?? app.services.settings.snapshot().androidCatalogLayout) === "list" ? "list" : "grid";
    const toggle = button("", () => {
        const next = layout() === "grid" ? "list" : "grid";
        if (route) {
            route.layout = next;
            apply();
        } else void app.run(scope, () => app.services.settings.set("androidCatalogLayout", next));
    }, "quiet-action");
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
    const rows = [...root.querySelectorAll("[data-work]")];
    const index = rows.findIndex(node => node.getBoundingClientRect().bottom > 12);
    if (index < 0) return null;
    return { keys: rows.map(node => node.getAttribute("data-work")), index, top: rows[index].getBoundingClientRect().top };
}

/** @param {ParentNode} root @param {ReturnType<typeof visibleWork>} anchor */
export function restoreWork(root, anchor) {
    if (!anchor) return;
    const { keys, index, top } = anchor;
    const rows = [...root.querySelectorAll("[data-work]")];
    let match = rows.find(node => node.getAttribute("data-work") === keys[index]);
    if (!match) {
        const byKey = new Map(rows.map(node => [node.getAttribute("data-work"), node]));
        for (let distance = 1; !match && distance < keys.length; distance++) {
            match = byKey.get(keys[index + distance]) ?? byKey.get(keys[index - distance]);
        }
    }
    if (match) window.scrollBy(0, match.getBoundingClientRect().top - top);
}

/** @param {Map<string, any>} selection @param {any[]} items */
export function retainMovieSelection(selection, items) {
    if (!selection.size) return;
    const present = new Set(items.filter(item => item.stateEligibility?.eligible !== false).map(item => item.carNum));
    for (const key of selection.keys()) if (!present.has(key)) selection.delete(key);
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
