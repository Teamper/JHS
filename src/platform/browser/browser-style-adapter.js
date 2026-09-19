// @ts-check

export class BrowserStyleAdapter {
    /** @param {Document} [documentRuntime] */
    constructor(documentRuntime = document) { this.document = documentRuntime; }
    /** @param {string} id @param {string} css */
    register(id, css) {
        if (this.document.getElementById(id)) throw new Error(`Duplicate style: ${id}`);
        const style = this.document.createElement("style");
        style.id = id;
        style.textContent = css;
        this.document.head.append(style);
        return () => style.remove();
    }
    /** @param {string} id */
    remove(id) { this.document.getElementById(id)?.remove(); }
}
