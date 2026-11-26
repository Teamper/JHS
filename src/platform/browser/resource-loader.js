// @ts-check

/** @param {string} url @param {Document} [doc] */
export function importResource(url, doc = document) {
    const destination = new URL(url, doc.baseURI).href;
    const nodes = doc.head.querySelectorAll("link[href], script[src]");
    if ([...nodes].some(node => ("href" in node ? node.href : /** @type {HTMLScriptElement} */ (node).src) === destination)) return;
    if (url.includes("css")) {
        const style = doc.createElement("link");
        style.rel = "stylesheet";
        style.href = destination;
        doc.head.appendChild(style);
    } else {
        const script = doc.createElement("script");
        script.type = "text/javascript";
        script.src = destination;
        doc.head.appendChild(script);
    }
}

export function importVendorStyles() {
    for (const url of [
        "https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/layer.min.css",
        "https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css",
        "https://cdn.jsdelivr.net/npm/viewerjs@1.11.1/dist/viewer.min.css",
        "https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/css/tabulator_semanticui.min.css",
    ]) importResource(url);
}
