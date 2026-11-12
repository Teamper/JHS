// @ts-check
import { normalizeTranslationConfiguration } from "../../core/translation-model.js";
import { normalizeMediaConnection } from "../../core/media-library-model.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { createTranslationConnections, TRANSLATION_SETTINGS_STYLES } from "./translation-connections.js";
import { createMediaConnections, MEDIA_LIBRARY_STYLES } from "./media-connections.js";
import { createPrivacyPreferences, PRIVACY_STYLES } from "./privacy-controls.js";

export const ENHANCEMENT_SETTINGS_STYLES = TRANSLATION_SETTINGS_STYLES + MEDIA_LIBRARY_STYLES + PRIVACY_STYLES + `
.jhs-setting-section .jhs-media-connections,.jhs-setting-section .jhs-translation-settings,.jhs-setting-section .jhs-privacy-config{padding:0;background:transparent}
.jhs-setting-section .jhs-media-connections fieldset,.jhs-setting-section .jhs-translation-settings fieldset{border:0;padding:0;grid-template-columns:minmax(0,1fr)}
.jhs-setting-section :is(.jhs-media-connections,.jhs-translation-settings,.jhs-privacy-config) label.jhs-setting-row{display:grid;grid-template-columns:minmax(120px,1fr) minmax(100px,280px);align-items:center;gap:var(--jhs-space-3);width:auto;padding:var(--jhs-space-2) 0;border-bottom:1px solid var(--jhs-border)}
.jhs-setting-section [hidden]{display:none!important}
.jhs-setting-section .jhs-select-trigger>.jhs-select-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.jhs-setting-section .jhs-translation-settings summary{cursor:pointer;padding:var(--jhs-space-2);color:var(--jhs-text);font-weight:var(--jhs-font-weight-semibold)}
@media(max-width:600px){.jhs-setting-section :is(.jhs-media-connections,.jhs-translation-settings,.jhs-privacy-config) label.jhs-setting-row{grid-template-columns:minmax(0,1fr)} .jhs-setting-section label.jhs-setting-row:has(input[type=checkbox]){grid-template-columns:minmax(0,1fr) auto}}
`;

/** Settings owns the view lifetime independently of page features. @param {string} kind @param {any} options */
export async function openEnhancementSettings(kind, options) {
    const { document, settings, dialog, ui, translation, media, scope: owner } = options;
    const scope = new LifecycleScope(`settings:${kind}`), release = owner.addCleanup(() => scope.dispose());
    scope.addCleanup(release);
    let id = 0, closed = false;
    /** @type {HTMLElement} */ let root;
    try {
        if (kind === "translation") {
            const state = await translation.getConfiguration();
            scope.assertActive();
            root = createTranslationConnections({ document, scope, state, preferences: settings.snapshot(),
                onSave: async (value, revision) => { scope.assertActive(); await translation.saveConfiguration(value, revision); return translation.getConfiguration(); },
                onTest: (value, requestScope) => translation.testConnection(value, requestScope),
                onPreferences: value => settings.patch(value),
            });
        } else if (kind === "media") {
            let state = await media.getConfiguration();
            scope.assertActive();
            root = createMediaConnections({ document, scope, connections: state.connections, enabled: media.enabled(),
                onSave: async (connections, enabled) => { scope.assertActive(); await media.saveConnections(connections, state.revision); state = await media.getConfiguration(); scope.assertActive(); await settings.set("enableMediaLibrary", enabled); },
                onTest: (value, requestScope) => media.testConnection(value, requestScope),
            });
        } else {
            root = createPrivacyPreferences({ document, scope, settings, onClose: () => dialog.close(id) });
        }
        root.style.display = "none";
        document.body.append(root);
        scope.addCleanup(() => { if (id && !closed) dialog.close(id); root.remove(); });
        id = dialog.open({ type: 1, title: { translation: "翻译服务", media: "Emby / Jellyfin", privacy: "隐私遮罩偏好" }[kind],
            content: ui.jquery(root), ui: { size: "form", body: "scroll" }, end: () => { closed = true; scope.dispose(); },
        });
        return scope;
    } catch (error) { scope.dispose(); throw error; }
}

/** Mount editors into the full settings lifetime and its save coordinator. @param {any} options */
export async function mountEnhancementSettings(options) {
    const { document, root, session, scope, translation, media } = options;
    const settings = { snapshot: () => session.snapshot(), patch: (/** @type {any} */ value) => session.patch(value) };
    const mounts = [
        ["translation", "translation-connections-panel"],
        ["media", "media-connections-panel"],
        ["privacy", "privacy-preferences-panel"],
    ];
    await Promise.all(mounts.map(async ([kind, id]) => {
        const host = root.querySelector(`#${id}`);
        if (!host) return;
        host.querySelector("[data-jhs-open]")?.remove();
        const container = document.createElement("div"), content = document.createElement("div");
        const status = document.createElement("p"), actions = document.createElement("div");
        status.setAttribute("role", "status");
        actions.className = "jhs-media-actions";
        container.append(content, status, actions);
        host.append(container);
        let editorScope = new LifecycleScope(`settings-editor:${kind}`);
        scope.addCleanup(() => editorScope.dispose());
        /** @type {any} */ let state;
        let blocked = false;
        const button = (/** @type {string} */ label, /** @type {()=>any} */ run) => {
            const node = document.createElement("button");
            node.type = "button"; node.className = "jhs-btn jhs-btn--secondary"; node.textContent = label;
            scope.listen(node, "click", () => { void Promise.resolve().then(run).catch(error => {
                if (!scope.disposed) status.textContent = error.message || "配置操作失败";
            }); });
            actions.append(node);
        };
        const render = (/** @type {any} */ next, forceDirty = false) => {
            scope.assertActive();
            state = next;
            blocked = false;
            editorScope.dispose();
            editorScope = new LifecycleScope(`settings-editor:${kind}`);
            const bind = (/** @type {any} */ editor) => {
                const owner = editorScope;
                session.registerEditor(kind, {
                    capture: editor.capture,
                    countDirty: kind !== "privacy",
                    validatePreferences: editor.validate,
                    validate: (/** @type {any} */ value) => {
                        if (kind === "translation") normalizeTranslationConfiguration(value);
                        if (kind === "media") {
                            if (value.length > 20 || new Set(value.map((/** @type {any} */ item) => item.id)).size !== value.length) throw new Error("媒体服务器标识重复或数量过多");
                            value.forEach(normalizeMediaConnection);
                        }
                    },
                    save: async (/** @type {any} */ value) => {
                        owner.assertActive();
                        if (blocked) throw new Error("请先重新读取并选择连接配置");
                        if (kind === "privacy") return;
                        const service = kind === "translation" ? translation : media;
                        try {
                            if (Array.isArray(state.revision)) await service.resolveConfiguration(value, state.revision);
                            else if (kind === "translation") await translation.saveConfiguration(value, state.revision);
                            else await media.saveConnections(value, state.revision);
                            const current = await service.getConfiguration();
                            if (!owner.disposed) { state = current; status.textContent = ""; }
                        } catch (error) {
                            if (!owner.disposed) status.textContent = /** @type {any} */ (error).message || "保存失败，草稿已保留";
                            throw error;
                        }
                    },
                    error: (/** @type {any} */ error) => { if (!owner.disposed) status.textContent = error.message || "保存失败，草稿已保留"; },
                });
                if (forceDirty) session.editors.get(kind).base = null;
                const capturePreferences = () => kind === "translation" ? editor.preferences() : kind === "media" ? { enableMediaLibrary: editor.enabled() } : editor.capture();
                let previous = structuredClone(capturePreferences());
                const preferences = () => {
                    const values = capturePreferences();
                    const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key])));
                    previous = structuredClone(values);
                    if (Object.keys(changed).length) void session.patch(changed);
                };
                editorScope.listen(content, "input", preferences);
                editorScope.listen(content, "change", preferences);
                editorScope.listen(session, "settings.changed", (/** @type {any} */ event) => {
                    if (!event.detail?.external) return;
                    editor.applyPreferences?.(session.snapshot());
                    previous = structuredClone(capturePreferences());
                });
            };
            let view;
            if (kind === "translation") view = createTranslationConnections({ document, scope: editorScope, state, preferences: settings.snapshot(), embedded: true, bindDraft: bind,
                onSave: async () => {}, onPreferences: async () => {}, onTest: (value, owner) => translation.testConnection(value, owner) });
            else if (kind === "media") view = createMediaConnections({ document, scope: editorScope, connections: state.connections, enabled: [true, "yes"].includes(settings.snapshot().enableMediaLibrary), embedded: true, bindDraft: bind,
                onSave: async () => {}, onTest: (value, owner) => media.testConnection(value, owner) });
            else view = createPrivacyPreferences({ document, scope: editorScope, settings, embedded: true, bindDraft: bind, onClose: () => {} });
            content.replaceChildren(view);
            session.emit();
        };
        const read = async (refresh = false) => {
            const service = kind === "translation" ? translation : media;
            if (refresh) {
                if (kind === "translation") await translation.reloadConfiguration().catch(() => {});
                else await media.reload().catch(() => {});
            }
            return service.getConfiguration();
        };
        const choose = (/** @type {any[]} */ candidates) => {
            scope.assertActive();
            actions.replaceChildren();
            blocked = true;
            const revisions = candidates.map(candidate => candidate.revision);
            if (session.editors.has(kind)) button("保留当前草稿", () => {
                state = { ...state, revision: revisions.length === 1 ? revisions[0] : revisions };
                blocked = false; status.textContent = "草稿已保留，请在页底保存设置";
                actions.replaceChildren(); retry(); session.emit();
            });
            for (const [index, candidate] of candidates.entries()) {
                const value = JSON.parse(candidate.value);
                const profiles = kind === "translation" ? value.profiles : value;
                const names = profiles.map((/** @type {any} */ profile) => profile.name).join("、") || "默认配置";
                button(`使用已保存配置 ${index + 1}（${names}）`, () => {
                    render(kind === "translation" ? { configuration: value, revision: revisions } : { connections: value, revision: revisions }, revisions.length > 1);
                    actions.replaceChildren(); retry(); status.textContent = revisions.length > 1 ? "已选择版本，请在页底保存设置以解决冲突" : "已载入保存的配置";
                });
            }
            retry();
        };
        const retry = () => button("重新读取配置", async () => {
            try {
                const next = await read(true);
                scope.assertActive();
                const existing = session.editors.get(kind);
                if (existing && JSON.stringify(existing.capture()) !== JSON.stringify(existing.base)) {
                    choose([{ revision: next.revision, value: JSON.stringify(kind === "translation" ? next.configuration : next.connections) }]);
                    status.textContent = "已读取最新配置，请选择保留草稿或载入已保存配置";
                } else { render(next); status.textContent = "已重新读取配置"; }
            } catch (error) { showFailure(error); }
        });
        const showFailure = (/** @type {any} */ error) => {
            if (scope.disposed) return;
            blocked = true;
            status.textContent = error.message || "配置读取失败，原记录已保留";
            if (error.candidates?.length) choose(error.candidates);
        };
        if (kind === "privacy") render(null);
        else {
            retry();
            try { render(await read()); }
            catch (error) { showFailure(error); }
        }
    }));
}
