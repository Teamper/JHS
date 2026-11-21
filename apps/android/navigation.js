export const tabs = { browse: "发现", follow: "追新", library: "片库", mine: "我的" };
export const icons = {
    browse: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    follow: "M12 2v5m0 10v5M2 12h5m10 0h5M6 6l3 3m6 6 3 3M18 6l-3 3m-6 6-3 3",
    library: "M5 3h14v18l-7-4-7 4z",
    mine: "M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 22v-1a8 8 0 0 1 16 0v1",
};
export const defaultFilters = { actor: "", category: "", collection: "", rated: false, flags: [] };

function page(name, id, initial) {
    return {
        name, id, q: "", mode: "all", follow: "pending", sort: name === "library" ? "updated" : name === "follow" ? "date" : "source",
        layout: name === "library" || name === "follow" ? "list" : "grid",
        filters: { ...defaultFilters, flags: [] }, selection: null, anchor: null, scroll: 0, mediaScroll: 0,
        ...initial,
    };
}

export function createNavigation(root) {
    const stacks = Object.fromEntries(Object.keys(tabs).map(tab => [tab, [page(tab)]]));
    let tab = "browse";
    const current = () => stacks[tab].at(-1);
    const items = () => [...root.querySelectorAll("[data-work]")];

    function capture() {
        const route = current();
        route.scroll = window.scrollY;
        const elements = items();
        const topLine = document.querySelector(".mobile-top").getBoundingClientRect().bottom;
        const index = elements.findIndex(element => element.getBoundingClientRect().bottom > topLine);
        const item = elements[index];
        route.anchor = item ? {
            id: item.dataset.work, top: item.getBoundingClientRect().top,
            neighbors: elements.map((element, index) => [element.dataset.work, index])
                .sort((a, b) => Math.abs(a[1] - index) - Math.abs(b[1] - index) || b[1] - a[1])
                .map(([id]) => id),
        } : null;
        const media = root.querySelector(".media-strip");
        if (media) route.mediaScroll = media.scrollLeft;
    }

    function restore() {
        const route = current();
        window.scrollTo(0, route.scroll);
        const media = root.querySelector(".media-strip");
        if (media) media.scrollLeft = route.mediaScroll;
        const anchor = route.anchor;
        if (!anchor) return;
        const byId = new Map(items().map(element => [element.dataset.work, element]));
        const match = byId.get(anchor.id) ?? anchor.neighbors.map(id => byId.get(id)).find(Boolean);
        if (match) window.scrollBy(0, match.getBoundingClientRect().top - anchor.top);
    }

    return {
        current,
        tab: () => tab,
        parent: () => stacks[tab].at(-2),
        canPop: () => stacks[tab].length > 1,
        capture,
        restore,
        select(next) { capture(); tab = next; },
        push(name, id, initial) { capture(); stacks[tab].push(page(name, id, initial)); },
        pop() { stacks[tab].pop(); },
        resetScroll() { Object.assign(current(), { anchor: null, scroll: 0 }); },
    };
}
