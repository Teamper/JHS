// @ts-check
import { JhsSelect } from "../../core/ui-primitives.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { DEFAULT_TRANSLATION_PROMPT, TRANSLATION_TYPES, translationErrorLabel } from "../../core/translation-model.js";
export const TRANSLATION_SETTINGS_STYLES = `
.jhs-translation-settings,.jhs-translation-workspace{padding:var(--jhs-space-4);box-sizing:border-box;display:grid;gap:var(--jhs-space-3);color:var(--jhs-text);min-width:0}
.jhs-translation-settings fieldset,.jhs-translation-row{display:grid;gap:var(--jhs-space-3);min-width:0;padding:var(--jhs-space-3);border:1px solid var(--jhs-border);border-radius:var(--jhs-radius-md)}
.jhs-translation-settings label{display:grid;gap:var(--jhs-space-1);min-width:0}
.jhs-translation-settings label.jhs-translation-choice{display:flex;align-items:center;gap:var(--jhs-space-2)}
.jhs-translation-choice input[type=checkbox]{flex:none;width:18px;height:18px;margin:0}
.jhs-translation-settings .jhs-field{width:100%;min-width:0;box-sizing:border-box}
.jhs-translation-settings textarea{min-height:100px;resize:vertical}
.jhs-translation-actions,.jhs-translation-fallback{display:flex;flex-wrap:wrap;align-items:center;gap:var(--jhs-space-2)}
.jhs-translation-fallback select{flex:1;min-width:120px}
.jhs-translation-settings [hidden],.jhs-translation-workspace [hidden]{display:none!important}
.jhs-translation-settings p,.jhs-translation-workspace p{overflow-wrap:anywhere}
.jhs-translation-row > strong{color:var(--jhs-text)}
.jhs-translation-output{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--jhs-text)}
.jhs-translation-workspace[data-jhs-translation-masked] .jhs-translation-output{color:transparent!important;text-shadow:none!important;user-select:none;background:var(--jhs-surface-2)}
.jhs-translation-meta{font-size:var(--jhs-font-size-sm);color:var(--jhs-text-secondary)}
.jhs-translation-range{max-height:220px;overflow:auto;overscroll-behavior:contain}
`;
/** Encrypted connection editing is separate from portable preferences and the durable request ledger. @param {{document:Document, scope:LifecycleScope, state:any, preferences:any, onSave:(value:any,revision:string|null)=>Promise<any>, onTest:(value:any,scope:LifecycleScope)=>Promise<any>, onPreferences:(value:any)=>Promise<any>}} options */
export function createTranslationConnections(options) {
    const { document, scope } = options, root = document.createElement("section");
    root.className = "jhs-translation-settings jhs-ui";
    let revision = options.state.revision;

    const button = (/** @type {HTMLElement} */ host, /** @type {string} */ label, /** @type {()=>any} */ run, owner = scope) => {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "jhs-btn jhs-btn--secondary";
        node.textContent = label;
        let pending = false;
        owner.listen(node, "click", () => {
            if (pending)
                return;
            pending = true;
            node.setAttribute("aria-disabled", "true");
            void Promise.resolve().then(run).catch(error => { if (!owner.disposed)
                status.textContent = error instanceof Error ? error.message : "翻译设置操作失败"; }).finally(() => { pending = false; if (!owner.disposed)
                node.removeAttribute("aria-disabled"); });
        });
        host.append(node);
        return node;
    };
    const field = (/** @type {HTMLElement} */ host, /** @type {string} */ label, /** @type {string} */ value, type = "text") => {
        const wrapper = document.createElement("label"), input = document.createElement("input");
        input.className = "jhs-field";
        input.type = type;
        input.value = value;
        if (type === "password") {
            input.autocomplete = "new-password";
            input.spellcheck = false;
        }
        wrapper.append(label, input);
        host.append(wrapper);
        return { wrapper, input };
    };
    const group = (/** @type {string} */ label) => { const host = document.createElement("fieldset"), legend = document.createElement("legend"); legend.textContent = label; host.append(legend); root.append(host); return host; };
    const connections = group("具名服务配置"), rows = document.createElement("div"), actions = document.createElement("div"), status = document.createElement("p");
    actions.className = "jhs-translation-actions";
    status.setAttribute("role", "status");
    connections.append(rows, actions);
    const selection = group("主服务与备用链"), primary = document.createElement("select"), primaryLabel = document.createElement("label"), fallbackList = document.createElement("ol");
    primary.className = "jhs-select-source";
    primaryLabel.append("主服务", primary);
    selection.append(primaryLabel, fallbackList);
    /** @type {Array<{root:HTMLElement,read:()=>any}>} */ const entries = [];
    /** @type {Array<{root:HTMLElement,select:HTMLSelectElement}>} */ const fallbacks = [];
    const choices = () => [{ id: "google", name: "Google", enabled: true }, ...entries.map(entry => entry.read())];
    const fill = (/** @type {HTMLSelectElement} */ select, /** @type {string} */ value) => {
        select.replaceChildren();
        const all = select === primary ? choices() : [{ id: "", name: "选择备用服务", enabled: true }, ...choices()];
        if (value && !all.some(item => item.id === value))
            all.push({ id: value, name: "已移除配置，请重新选择", enabled: false });
        for (const item of all) {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.name || "未命名服务";
            option.disabled = !item.enabled;
            select.append(option);
        }
        select.value = value;
        JhsSelect.instances.get(select)?.refresh();
    };
    const refreshChoices = () => { fill(primary, primary.value); for (const item of fallbacks)
        fill(item.select, item.select.value); };
    const append = (/** @type {any} */ connection) => {
        const row = document.createElement("fieldset"), legend = document.createElement("legend"), rowScope = new LifecycleScope("translation:profile"), id = connection.id || crypto.randomUUID();
        const release = scope.addCleanup(() => rowScope.dispose());
        rowScope.addCleanup(release);
        legend.textContent = connection.name || "新服务";
        row.append(legend);
        const name = field(row, "名称", connection.name || "").input;
        const typeLabel = document.createElement("label"), type = document.createElement("select");
        type.className = "jhs-select-source";
        typeLabel.append("协议", type);
        row.append(typeLabel);
        for (const [value, label] of TRANSLATION_TYPES) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            type.append(option);
        }
        type.value = connection.type || "deepseek";
        const model = field(row, "模型", connection.model || ""), endpoint = field(row, "接口地址", connection.endpoint || "", "password"), apiKey = field(row, "API Key", connection.apiKey || "", "password");
        const variantLabel = document.createElement("label"), variant = document.createElement("select");
        variant.className = "jhs-select-source";
        variantLabel.append("DeepL API", variant);
        row.append(variantLabel);
        for (const [value, label] of [["free", "Free"], ["pro", "Pro"]]) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            variant.append(option);
        }
        variant.value = connection.variant || "free";
        const enableLabel = document.createElement("label"), enabled = document.createElement("input");
        enableLabel.className = "jhs-translation-choice";
        enabled.className = "jhs-switch";
        enabled.setAttribute("role", "switch");
        enabled.type = "checkbox";
        enabled.checked = connection.enabled === true;
        enableLabel.append(enabled, "启用");
        row.append(enableLabel);
        const footer = document.createElement("div"), result = document.createElement("p");
        footer.className = "jhs-translation-actions";
        result.setAttribute("role", "status");
        const read = () => ({ id, name: name.value, type: type.value, model: model.input.value, endpoint: endpoint.input.value, apiKey: apiKey.input.value, variant: variant.value, enabled: enabled.checked });
        const renderType = () => { model.wrapper.hidden = ["deeplx", "deepl"].includes(type.value); endpoint.wrapper.hidden = !type.value.startsWith("custom-") && type.value !== "deeplx"; variantLabel.hidden = type.value !== "deepl"; };
        rowScope.listen(type, "change", renderType);
        rowScope.listen(name, "input", () => { legend.textContent = name.value || "新服务"; refreshChoices(); });
        rowScope.listen(enabled, "change", refreshChoices);
        button(footer, "测试连接", async () => { result.textContent = "连接中…"; try {
            await options.onTest(read(), rowScope);
            if (!rowScope.disposed)
                result.textContent = "连接成功";
        }
        catch (error) {
            if (!rowScope.disposed)
                result.textContent = translationErrorLabel(error);
        } }, rowScope);
        button(footer, "删除", () => { entries.splice(entries.findIndex(item => item.root === row), 1); rowScope.dispose(); row.closest("details")?.remove(); refreshChoices(); add.focus(); }, rowScope);
        row.append(footer, result);
        const details = document.createElement("details"), summary = document.createElement("summary");
        summary.textContent = connection.name || "新服务";
        details.open = !connection.id || connection.id === options.state.configuration.primary;
        scope.listen(details, "toggle", () => { if (details.open) for (const other of rows.querySelectorAll("details")) if (other !== details) other.open = false; });
        rowScope.listen(name, "input", () => { summary.textContent = name.value || "新服务"; });
        details.append(summary, row);
        rows.append(details);
        entries.push({ root: row, read });
        renderType();
        return name;
    };
    const add = button(actions, "添加服务", () => { if (entries.length >= 20)
        throw new Error("最多配置 20 个翻译服务"); const name = append({}); refreshChoices(); name.focus(); });
    const appendFallback = (/** @type {string} */ value) => {
        const rowScope = new LifecycleScope("translation:fallback"), release = scope.addCleanup(() => rowScope.dispose());
        rowScope.addCleanup(release);
        const row = document.createElement("li"), select = document.createElement("select");
        row.className = "jhs-translation-fallback";
        select.className = "jhs-select-source";
        select.setAttribute("aria-label", "备用服务");
        fill(select, value);
        row.append(select);
        const item = { root: row, select };
        fallbacks.push(item);
        fallbackList.append(row);
        for (const [label, delta] of /** @type {Array<[string,number]>} */ ([["上移", -1], ["下移", 1]]))
            button(row, label, () => { const index = fallbacks.indexOf(item), next = index + delta; if (next < 0 || next >= fallbacks.length)
                return; const focus = document.activeElement; [fallbacks[index], fallbacks[next]] = [fallbacks[next], fallbacks[index]]; for (const entry of fallbacks)
                fallbackList.append(entry.root); const HTMLElementType = document.defaultView?.HTMLElement; if (HTMLElementType && focus instanceof HTMLElementType)
                focus.focus(); }, rowScope);
        button(row, "删除", () => { fallbacks.splice(fallbacks.indexOf(item), 1); rowScope.dispose(); row.remove(); JhsSelect.get(primary)?.trigger[0]?.focus(); }, rowScope);
    };
    button(selection, "添加备用服务", () => { if (fallbacks.length < 20)
        appendFallback(""); });
    button(selection, "保存服务", async () => { const result = await options.onSave({ schema: 1, profiles: entries.map(entry => entry.read()), primary: primary.value, fallbacks: fallbacks.map(item => item.select.value) }, revision); if (!scope.disposed) {
        revision = result.revision;
        status.textContent = "服务配置已保存";
    } });
    const preferences = group("翻译偏好"), promptLabel = document.createElement("label"), prompt = document.createElement("textarea");
    prompt.className = "jhs-field";
    prompt.value = options.preferences.translationPrompt ?? DEFAULT_TRANSLATION_PROMPT;
    promptLabel.append("提示模板（{text} 为原文）", prompt);
    preferences.append(promptLabel);
    const concurrency = field(preferences, "并发请求（1—10）", String(options.preferences.translationConcurrency ?? 2), "number").input;
    concurrency.min = "1";
    concurrency.max = "10";
    concurrency.step = "1";
    button(preferences, "保存翻译偏好", async () => { await options.onPreferences({ translationPrompt: prompt.value, translationConcurrency: Number(concurrency.value) }); if (!scope.disposed)
        status.textContent = "翻译偏好已保存"; });
    root.append(status);
    for (const connection of options.state.configuration.profiles)
        append(connection);
    fill(primary, options.state.configuration.primary);
    for (const value of options.state.configuration.fallbacks)
        appendFallback(value);
    JhsSelect.refreshAll(root);
    return root;
}
