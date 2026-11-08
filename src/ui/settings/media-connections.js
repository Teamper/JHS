// @ts-check
import { LifecycleScope } from "../../core/lifecycle-scope.js";

export const MEDIA_LIBRARY_STYLES = `
.jhs-media-connections { display:flex; flex-direction:column; gap:var(--jhs-space-3); padding:var(--jhs-space-4); color:var(--jhs-text); background:var(--jhs-bg); min-width:0; box-sizing:border-box; }
.jhs-media-connections fieldset { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--jhs-space-3); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); padding:var(--jhs-space-3); min-width:0; }
.jhs-media-connection-editor { margin-bottom:var(--jhs-space-3); }
.jhs-media-connection-editor > summary { padding:var(--jhs-space-2); cursor:pointer; color:var(--jhs-text); }
.jhs-media-connections label { display:flex; flex-direction:column; gap:var(--jhs-space-1); min-width:0; width:100%; }
.jhs-media-connections input:not([type=checkbox]) { width:100%; box-sizing:border-box; min-width:0; padding:var(--jhs-space-2); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); font:inherit; color:var(--jhs-text); background:var(--jhs-surface); }
.jhs-media-connections legend { color:var(--jhs-text); font-weight:var(--jhs-font-weight-semibold); }
.jhs-media-connections .jhs-media-choice { flex-direction:row; align-items:center; }
.jhs-media-connections__wide { grid-column:1/-1; }
.jhs-media-actions,.jhs-media-filter { display:flex; flex-wrap:wrap; align-items:center; gap:var(--jhs-space-2); }
.jhs-media-badge { display:inline-flex; gap:var(--jhs-space-1); flex-wrap:wrap; align-items:center; color:var(--jhs-text); background:var(--jhs-surface); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); padding:var(--jhs-space-1) var(--jhs-space-2); font-size:var(--jhs-font-size-sm); }
.jhs-media-badge [hidden] { display:none!important; }
.jhs-media-details { display:flex; flex-direction:column; gap:var(--jhs-space-2); padding:var(--jhs-space-3) 0; }
.jhs-media-details a { color:var(--jhs-primary); overflow-wrap:anywhere; }
[data-jhs-media-filtered] { display:none!important; }
@media(max-width:480px) { .jhs-media-connections fieldset { grid-template-columns:minmax(0,1fr); } }
`;

/** @param {{document: Document, scope: any, connections: any[], enabled: boolean, onSave: (connections: any[], enabled: boolean) => Promise<void>, onTest: (connection: any, scope: LifecycleScope) => Promise<any>}} options */
export function createMediaConnections(options) {
    const { document, scope } = options;
    const root = document.createElement("div");
    root.className = "jhs-media-connections";
    const enabledLabel = document.createElement("label"), enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.setAttribute("role", "switch");
    enabled.checked = options.enabled;
    enabledLabel.className = "jhs-media-choice";
    enabledLabel.append(enabled, "启用媒体库联动");
    const rows = document.createElement("div"), actions = document.createElement("div"), status = document.createElement("p");
    actions.className = "jhs-media-actions";
    status.setAttribute("role", "status");
    /** @type {Array<{root: HTMLElement, read: () => any}>} */ const entries = [];
    const button = (/** @type {HTMLElement} */ host, /** @type {string} */ text, /** @type {() => void} */ action, owner = scope) => {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "jhs-btn jhs-btn--secondary jhs-btn--sm";
        node.textContent = text;
        owner.listen(node, "click", action);
        host.append(node);
        return node;
    };
    const append = (/** @type {any} */ connection) => {
        const id = connection.id || crypto.randomUUID(), row = document.createElement("fieldset"), legend = document.createElement("legend");
        const rowScope = new LifecycleScope(`media:connection:${id}`);
        const release = scope.addCleanup(() => rowScope.dispose());
        rowScope.addCleanup(release);
        legend.textContent = connection.name || "新服务器";
        const editor = document.createElement("details"), summary = document.createElement("summary");
        summary.textContent = legend.textContent;
        editor.className = "jhs-media-connection-editor";
        editor.open = !connection.id || entries.length === 0;
        editor.append(summary, row);
        row.append(legend);
        rowScope.listen(editor, "toggle", () => { if (editor.open) for (const other of rows.querySelectorAll("details")) if (other !== editor) other.open = false; });
        const field = (/** @type {string} */ text, /** @type {string} */ value, type = "text") => {
            const label = document.createElement("label"), input = document.createElement("input");
            input.type = type;
            input.value = value;
            if (type === "password") { input.autocomplete = "new-password"; input.spellcheck = false; }
            label.append(text, input);
            row.append(label);
            return input;
        };
        const name = field("名称", connection.name || ""), address = field("服务器地址（含代理子路径）", connection.address || ""), apiKey = field("API Key", connection.apiKey || "", "password"), userId = field("用户 ID 范围（可选）", connection.userId || "");
        rowScope.listen(name, "input", () => { legend.textContent = name.value.trim() || "新服务器"; summary.textContent = legend.textContent; });
        const typeHost = document.createElement("div");
        typeHost.className = "jhs-media-actions";
        typeHost.setAttribute("role", "group");
        typeHost.setAttribute("aria-label", "服务器类型");
        let type = connection.type || "jellyfin";
        const types = ["emby", "jellyfin"].map(value => button(typeHost, value === "emby" ? "Emby" : "Jellyfin", () => { type = value; renderType(); }, rowScope));
        const renderType = () => types.forEach((node, index) => {
            const selected = ["emby", "jellyfin"][index] === type;
            node.setAttribute("aria-pressed", String(selected));
            node.classList.toggle("jhs-btn--primary", selected);
            node.classList.toggle("jhs-btn--secondary", !selected);
        });
        renderType();
        row.append(typeHost);
        const enableLabel = document.createElement("label"), enable = document.createElement("input");
        enable.type = "checkbox";
        enable.className = "jhs-switch";
        enable.setAttribute("role", "switch");
        enable.checked = connection.enabled === true;
        enableLabel.className = "jhs-media-choice";
        enableLabel.append(enable, "启用此服务器");
        row.append(enableLabel);
        const footer = document.createElement("div"), result = document.createElement("div");
        footer.className = "jhs-media-actions jhs-media-connections__wide";
        result.className = "jhs-media-connections__wide";
        result.setAttribute("role", "status");
        const read = () => ({ id, name: name.value, address: address.value, apiKey: apiKey.value, userId: userId.value, type, enabled: enable.checked });
        const test = button(footer, "测试连接", () => {
            test.disabled = true;
            result.textContent = "连接中…";
            void options.onTest(read(), rowScope).then(info => { if (!rowScope.disposed && row.isConnected) result.textContent = `连接成功 · ${info.name}`; }, () => { if (!rowScope.disposed && row.isConnected) result.textContent = "连接失败，请检查地址、API Key 和用户范围"; }).finally(() => { if (!rowScope.disposed && row.isConnected) test.disabled = false; });
        }, rowScope);
        button(footer, "移除此服务器", () => { const index = entries.findIndex(item => item.root === editor); entries.splice(index, 1); rowScope.dispose(); editor.remove(); add.focus(); }, rowScope);
        row.append(footer, result);
        rows.append(editor);
        entries.push({ root: editor, read });
        if (!connection.id) name.focus();
    };
    const add = button(actions, "添加服务器", () => { if (entries.length < 20) append({}); });
    const save = button(actions, "保存连接与启用状态", () => {
        save.disabled = true;
        status.textContent = "正在保存…";
        void options.onSave(entries.map(item => item.read()), enabled.checked).then(() => { if (!scope.disposed) status.textContent = "已保存"; }, error => { if (!scope.disposed) status.textContent = error instanceof TypeError ? error.message : "保存失败，请检查配置后重试"; }).finally(() => { if (!scope.disposed) save.disabled = false; });
    });
    root.append(enabledLabel, rows, actions, status);
    for (const connection of options.connections) append(connection);
    return root;
}

/** @param {{document: Document, onRefresh: () => void, onOpen: (result: any) => void}} options */
export function createMediaStatus(options) {
    const { document } = options;
    const root = document.createElement("div"), label = document.createElement("span"), open = document.createElement("button"), refresh = document.createElement("button");
    root.className = "jhs-media-badge";
    root.setAttribute("data-jhs-media-control", "");
    label.setAttribute("role", "status");
    label.setAttribute("aria-live", "polite");
    for (const node of [open, refresh]) { node.type = "button"; node.className = "jhs-btn jhs-btn--ghost jhs-btn--sm"; }
    open.textContent = "媒体库详情 / 播放";
    refresh.textContent = "刷新媒体库";
    let result = { hits: [] };
    open.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); options.onOpen(result); });
    refresh.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); options.onRefresh(); });
    root.append(label, open, refresh);
    return {
        root,
        refresh,
        /** @param {any} value */
        render(value) {
            result = value;
            const labels = { loading: "媒体库查询中", present: "已入库", absent: "未入库", unknown: "结果未知" };
            label.textContent = value.status === "unknown" && value.servers?.some((/** @type {any} */ server) => server.status === "error") ? "媒体库查询失败" : labels[/** @type {keyof typeof labels} */ (value.status)] || labels.unknown;
            open.hidden = !value.hits.length;
            refresh.disabled = value.status === "loading";
            root.title = (value.servers || []).map((/** @type {any} */ server) => `${server.name} · ${server.error || labels[/** @type {keyof typeof labels} */ (server.status)] || "结果未知"}`).join("\n");
        },
    };
}
