// @ts-check
export const ONE115_RENAME_STYLES = `
.jhs-115-rename-preview { padding:var(--jhs-space-4); color:var(--jhs-text); background:var(--jhs-bg); }
.jhs-115-rename-preview label.jhs-115-rename-preview__row { display:flex; width:100%; box-sizing:border-box; gap:var(--jhs-space-2); align-items:start; padding:var(--jhs-space-3) 0; border-bottom:1px solid var(--jhs-border); overflow-wrap:anywhere; }
.jhs-115-rename-preview__text { display:grid; min-width:0; gap:var(--jhs-space-1); }
.jhs-115-rename-preview__text strong { color:var(--jhs-text); }
.jhs-115-rename-preview__status { color:var(--jhs-text-muted); }
`;

/** @param {{document: Document, records: any[]}} options */
export function create115RenamePreview({ document, records }) {
    const root = document.createElement("div");
    root.className = "jhs-115-rename-preview";
    const note = document.createElement("p");
    note.textContent = "勾选需要重命名的文件，核对新名称后确认执行。扩展名、分片和画质/字幕后缀会保留。";
    root.append(note);
    const entries = records.map(record => {
        const row = document.createElement("label"), checkbox = document.createElement("input"), text = document.createElement("span"), before = document.createElement("span"), after = document.createElement("strong"), status = document.createElement("span");
        row.className = "jhs-115-rename-preview__row";
        text.className = "jhs-115-rename-preview__text";
        checkbox.type = "checkbox";
        checkbox.disabled = !record.fileId || !record.accountId || record.name === record.nextName;
        before.textContent = record.name;
        after.textContent = `→ ${record.nextName}`;
        status.className = "jhs-115-rename-preview__status";
        status.textContent = !record.accountId ? "请重新匹配以确认账号" : record.name === record.nextName ? "名称已规范，无需修改" : "未开始";
        text.append(before, after, status);
        row.append(checkbox, text);
        root.append(row);
        return { record, checkbox, status };
    });
    const progress = document.createElement("p"), submit = document.createElement("button");
    progress.setAttribute("role", "status"); progress.setAttribute("aria-live", "polite");
    submit.type = "button"; submit.className = "jhs-btn jhs-btn--primary"; submit.textContent = "确认重命名所选文件";
    root.append(progress, submit);
    return { root, entries, progress, submit };
}
