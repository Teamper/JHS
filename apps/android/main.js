import { LifecycleScope } from "../../src/core/lifecycle-scope.js";
import { catalogOrders, orderMovies, sorting, viewToggle } from "../../src/app/mobile/browse-controls.js";
import { button, el, movieTitle, select, sheet, STATE_LABELS } from "../../src/app/mobile/components.js";
import { mountLiquidNavigation } from "../../src/app/mobile/liquid-navigation.js";
import { renderMoviePoster } from "../../src/app/mobile/movie-poster.js";

const tabs = { browse: "发现", new: "新作", library: "作品库", mine: "我的" };
const icons = {
    browse: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    new: "M12 2v5m0 10v5M2 12h5m10 0h5M6 6l3 3m6 6 3 3M18 6l-3 3m-6 6-3 3",
    library: "M5 3h14v18l-7-4-7 4z",
    mine: "M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 22v-1a8 8 0 0 1 16 0v1",
};
const fixtures = [
    ["样片-10", "沿河的午后", "2025-06-28", "#315072", "#9dd9d4", 4.1, 53],
    ["样片-2", "小镇的夏天", "2025-06-02", "#965640", "#ffd995", 4.7, 81],
    ["样片-7", "海岸线尽头的白塔", "2025-05-19", "#594f81", "#e0bbec", 4.6, 26],
    ["样片-4", "走进傍晚的山林", "2025-04-16", "#3d685f", "#e2efd3", 4.4, 104],
].map(([carNum, title, releaseDate, background, accent, ratingValue, voteCount], index) =>
    ({ carNum, title, releaseDate, background, accent, ratingValue, voteCount, id: String(index) }));

const root = document.querySelector("#main"), title = document.querySelector("#title");
const back = document.querySelector("#back"), privacy = document.querySelector("#privacy");
const saved = new Map();
const preferences = { androidCatalogLayout: "grid", theme: "light" };
const settings = Object.assign(new EventTarget(), {
    snapshot: () => ({ ...preferences }),
    set(key, value) {
        preferences[key] = value;
        this.dispatchEvent(new Event("settings.changed"));
    },
});
const app = { services: { settings }, run: (_owner, action) => action() };
const appScope = new LifecycleScope("preview");
let active = "browse", order = "source", scope;
const updateTabs = mountLiquidNavigation(document.querySelector(".mobile-tabs"), tabs, icons, selectTab, appScope);

function illustration(work, className) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 490"><path fill="${work.background}" d="M0 0h800v490H0z"/><circle cx="610" cy="155" r="78" fill="${work.accent}"/><path fill="${work.accent}" opacity=".6" d="M0 426l306-221 191 125 303-90v250H0z"/></svg>`;
    const node = el("img", null, className);
    node.alt = "";
    node.dataset.contentSensitive = "";
    node.src = "data:image/svg+xml," + encodeURIComponent(svg);
    return node;
}

function begin(name, previous = null) {
    scope?.dispose();
    scope = new LifecycleScope("preview:page");
    root.replaceChildren();
    title.textContent = name;
    back.hidden = !previous;
    back.onclick = previous;
    document.body.dataset.route = name === "设置" ? "settings" : active;
    window.scrollTo(0, 0);
}

function selectTab(name) {
    active = name;
    updateTabs(name);
    begin(tabs[name]);
    if (name === "mine") {
        const choices = el("nav", null, "settings-group-list");
        choices.append(button("设置", showSettings, "settings-link"));
        root.append(choices);
        return;
    }
    const works = name === "library" ? fixtures.filter(work => saved.has(work.id)) : name === "new" ? fixtures.slice(0, 2) : fixtures;
    const grid = el("div", null, "poster-grid section");
    function refresh() {
        const selected = orderMovies(works, name === "new" && order === "source" ? "date" : order);
        grid.replaceChildren(...selected.map(work => {
            const card = renderMoviePoster(work, () => showWork(work));
            card.querySelector(".artwork").replaceChildren(illustration(work, "cover"));
            return card;
        }));
        if (!selected.length) grid.append(el("p", "暂无已保存样片", "empty"));
    }
    const controls = el("div", null, "actions catalog-result-actions");
    controls.append(sorting(catalogOrders, order, value => { order = value; refresh(); }), viewToggle(app, scope, grid));
    root.append(controls, el("p", `${works.length} 部样片`, "catalog-count"), grid);
    refresh();
}

function showWork(work) {
    begin("作品详情", () => selectTab(active));
    const hero = el("section", null, "movie-hero");
    const identity = el("div", null, "movie-identity");
    identity.dataset.contentSensitive = "";
    identity.append(el("p", work.carNum, "movie-code"), movieTitle("h2", work.title, work.carNum));
    hero.append(identity, illustration(work, "cover-large"));
    const gallery = button("查看画面", () => {
        if (document.body.hasAttribute("data-jhs-mobile-mask")) return;
        const dialog = sheet(root, "画面", scope);
        dialog.append(illustration(work, "cover-large"));
        dialog.showModal();
    }, "quiet-action");
    const controls = el("div", null, "detail-controls");
    const states = el("div", null, "actions detail-states");
    for (const [flag, label] of Object.entries(STATE_LABELS)) {
        const action = button(label, () => {
            const flags = new Set(saved.get(work.id));
            if (flags.has(flag)) flags.delete(flag);
            else flags.add(flag);
            if (flags.size) saved.set(work.id, flags);
            else saved.delete(work.id);
            action.setAttribute("aria-pressed", String(flags.has(flag)));
        }, "quiet-action");
        action.setAttribute("aria-pressed", String(saved.get(work.id)?.has(flag) ?? false));
        states.append(action);
    }
    controls.append(states);
    root.append(hero, gallery, controls);
}

function showSettings() {
    begin("设置", () => selectTab("mine"));
    const options = select([["light", "浅色"], ["dark", "深色"]], "主题");
    options.value = preferences.theme;
    const row = el("label", null, "settings-mobile-field");
    row.append(el("span", "主题"), options);
    const save = button("保存", () => {
        settings.set("theme", options.value);
        document.documentElement.dataset.jhsTheme = options.value;
        selectTab("mine");
    }, "primary");
    root.append(row, save);
}

privacy.onclick = () => {
    const masked = document.body.toggleAttribute("data-jhs-mobile-mask");
    privacy.setAttribute("aria-pressed", String(masked));
};
selectTab("browse");
