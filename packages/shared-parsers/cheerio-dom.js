// The public parsers use read-only DOM operations. Cheerio keys nodes by identity
// so boundary and sibling comparisons also work with fetched HTML.
/** @param {any} $ Injected Cheerio loader result. @param {string} url */
export function cheerioDocument($, url) {
    const nodes = new WeakMap();
    /** @param {any} node @returns {any} */
    function wrap(node) {
        if (!node) return null;
        if (nodes.has(node)) return nodes.get(node);
        const selection = $(node);
        /** @param {string} selector */
        const select = selector => selection.find(selector).toArray().map(wrap);
        const view = {
            get URL() { return url; },
            get body() { return wrap($("body")[0] ?? $.root()[0]); },
            get nodeType() { return node.type === "root" ? 9 : node.type === "text" ? 3 : 1; },
            get textContent() { return selection.text(); },
            get parentElement() { return node.parent?.type !== "root" ? wrap(node.parent) : null; },
            get previousSibling() { return wrap(node.prev); },
            get previousElementSibling() { return wrap(selection.prev()[0]); },
            get nextElementSibling() { return wrap(selection.next()[0]); },
            /** @param {string} name */
            getAttribute: name => selection.attr(name) ?? null,
            /** @param {string} name */
            hasAttribute: name => selection.attr(name) !== undefined,
            /** @param {string} selector */
            querySelector: selector => wrap(selection.find(selector).first()[0]),
            querySelectorAll: select,
            /** @param {string} selector */
            closest: selector => wrap(selection.closest(selector)[0]),
            /** @param {string} selector */
            matches: selector => selection.is(selector),
            /** @param {any} other */
            contains: other => other === view || other?.parentElement != null && view.contains(other.parentElement),
            cloneNode: () => wrap(selection.clone()[0]),
            remove: () => { selection.remove(); },
        };
        nodes.set(node, view);
        return view;
    }
    return /** @type {Document} */ (wrap($.root()[0]));
}
