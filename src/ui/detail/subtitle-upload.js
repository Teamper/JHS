// @ts-check

/** @param {{document: Document, scope: any}} options */
export function createSubtitleUploadView({ document, scope }) {
    const root = document.createElement("div");
    root.className = "jhs-subtitles";
    const note = document.createElement("p");
    note.setAttribute("role", "status");
    note.setAttribute("aria-live", "polite");
    note.textContent = "正在核对 115 账号和影片目录…";
    const form = document.createElement("label"), filename = document.createElement("input");
    form.append("最终字幕文件名", filename);
    const targets = document.createElement("div"), results = document.createElement("div"), actions = document.createElement("div");
    targets.className = "jhs-subtitles__results";
    results.className = "jhs-subtitles__results";
    targets.setAttribute("aria-label", "115 匹配目录");
    actions.className = "jhs-subtitles__actions";
    const button = (/** @type {string} */ text, /** @type {() => void} */ run) => {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "jhs-btn jhs-btn--secondary";
        node.textContent = text;
        scope.listen(node, "click", run);
        actions.append(node);
        return node;
    };
    root.append(note, form, targets, results, actions);
    const directories = new Map();
    /** @param {any[]} matches */
    function add(matches) {
        for (const match of matches) {
            if (directories.has(match.folderId)) continue;
            const label = document.createElement("label"), checkbox = document.createElement("input"), text = document.createElement("span");
            label.className = "jhs-subtitles__row jhs-subtitles__actions";
            checkbox.type = "checkbox";
            text.textContent = `${match.name} · 目录 ${match.folderId}`;
            label.append(checkbox, text);
            targets.append(label);
            directories.set(match.folderId, { checkbox, match });
        }
    }
    return {
        root, filename, button, add, results,
        /** @param {string} text */ message(text) { note.textContent = text; },
        selected() { return [...directories.values()].filter(item => item.checkbox.checked).map(item => item.match); },
        lock() { filename.disabled = true; for (const item of directories.values()) item.checkbox.disabled = true; },
        /** @param {string} text */ result(text) { const node = document.createElement("p"); node.textContent = text; results.append(node); },
    };
}
