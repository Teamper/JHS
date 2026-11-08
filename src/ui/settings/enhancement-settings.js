// @ts-check
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { createTranslationConnections, TRANSLATION_SETTINGS_STYLES } from "./translation-connections.js";
import { createMediaConnections, MEDIA_LIBRARY_STYLES } from "./media-connections.js";
import { createPrivacyPreferences, PRIVACY_STYLES } from "./privacy-controls.js";

export const ENHANCEMENT_SETTINGS_STYLES = TRANSLATION_SETTINGS_STYLES + MEDIA_LIBRARY_STYLES + PRIVACY_STYLES;

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
            await media.initialize();
            scope.assertActive();
            root = createMediaConnections({ document, scope, connections: media.listConnections(), enabled: media.enabled(),
                onSave: async (connections, enabled) => { scope.assertActive(); await media.saveConnections(connections); scope.assertActive(); await settings.set("enableMediaLibrary", enabled); },
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
